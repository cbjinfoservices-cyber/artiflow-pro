import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Récapitulatif HEBDOMADAIRE par email vers les gestionnaires : liste les alertes de
// configuration Stripe (table `alerte_config_stripe`) qui ne sont PAS ENCORE TRAITÉES,
// avec une synthèse par cause (carte / pays / configuration) et le détail des alertes les
// plus anciennes (donc les plus urgentes).
//
// Prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (voir le guide des tâches planifiées), à déclencher CHAQUE HEURE. La fonction revérifie
// elle-même le jour et l'heure (défaut : lundi 08:00, heure de Paris) et son anti-doublon,
// donc un appel horaire ne produit qu'un seul envoi par semaine.
//
// Un appel avec `preview: true` renvoie simplement le HTML de l'email (aucun envoi).
// Un appel avec `force: true` envoie tout de suite, sans tenir compte du jour/heure
// ni de l'anti-doublon (pour un test manuel depuis l'interface).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Compte gestionnaire principal : toujours prévenu, même sans ligne en base. */
const GESTIONNAIRE_PRINCIPAL_EMAIL = "cbj.infoservices@gmail.com";

/** Anti-doublon : pas deux récaps à moins de 6 jours d'intervalle. */
const INTERVALLE_MIN_JOURS = 6;
/** Jour/heure d'envoi par défaut (lundi 08:00, heure de Paris). */
const JOUR_DEFAUT = 1;
const HEURE_DEFAUT = 8;
/** Nombre maximum d'alertes détaillées dans l'email. */
const MAX_DETAIL = 15;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function frDateTime(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Ancienneté lisible depuis une date (« il y a 3 j », « il y a 5 h »…). */
function anciennete(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff <= 0) return "à l'instant";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "moins d'1 h";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

/** Heure courante (0-23) à l'heure de Paris. */
function parisHour(): number {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h !== undefined) return Number(h) % 24;
  } catch {
    /* repli */
  }
  return new Date().getHours();
}

/** Jour de la semaine courant à l'heure de Paris (1 = lundi … 7 = dimanche). */
function parisWeekday(): number {
  try {
    const wd = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date());
    const map: Record<string, number> = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 7 };
    const key = wd.toLowerCase().replace(".", "").slice(0, 3);
    if (map[key]) return map[key];
  } catch {
    /* repli */
  }
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Rassemble les adresses email des gestionnaires (principal + table gestionnaires). */
async function adressesGestionnaires(admin: Admin): Promise<string[]> {
  const set = new Set<string>();
  set.add(GESTIONNAIRE_PRINCIPAL_EMAIL);
  try {
    const { data } = await admin.from("gestionnaires").select("email");
    (data ?? []).forEach((row: { email?: string }) => {
      const email = String(row?.email ?? "").trim();
      if (email) set.add(email);
    });
  } catch {
    /* best-effort : on garde au minimum le gestionnaire principal */
  }
  return Array.from(set);
}

/** Une alerte de configuration Stripe encore non traitée. */
interface AlerteNonTraitee {
  id: number;
  motif: "pays" | "carte" | "";
  pays: string;
  created_at: string;
}

/** Répartition des alertes pour une cause donnée. */
interface GroupeCause {
  cle: "carte" | "pays" | "configuration";
  label: string;
  count: number;
}

/** Libellé lisible d'une cause d'alerte. */
function libelleCause(motif: string): string {
  if (motif === "carte") return "Carte non activée";
  if (motif === "pays") return "Pays / devise non supporté";
  return "Configuration incomplète";
}

/** Classe un motif dans l'une des causes de synthèse. */
function cleCause(motif: string): "carte" | "pays" | "configuration" {
  if (motif === "carte") return "carte";
  if (motif === "pays") return "pays";
  return "configuration";
}

/** Regroupe les alertes par cause, de la plus fréquente à la moins fréquente. */
function grouperParCause(alertes: AlerteNonTraitee[]): GroupeCause[] {
  const map = new Map<string, GroupeCause>();
  alertes.forEach((a) => {
    const cle = cleCause(a.motif);
    const cur = map.get(cle);
    if (cur) {
      cur.count += 1;
    } else {
      map.set(cle, { cle, label: libelleCause(a.motif), count: 1 });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Construit l'email récapitulatif hebdomadaire des alertes Stripe non traitées. */
function buildEmailHtml(
  groupes: GroupeCause[],
  alertes: AlerteNonTraitee[],
  total: number,
  destinataires: string[],
  estTest = false,
): string {
  const lignesGroupes = groupes
    .map(
      (g) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#18181b;">${escapeHtml(g.label)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#b45309;font-weight:700;text-align:center;">${g.count}</td>
      </tr>`,
    )
    .join("");

  const recents = alertes.slice(0, MAX_DETAIL);
  const lignesDetail = recents
    .map(
      (a) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#18181b;">${escapeHtml(
          libelleCause(a.motif),
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#52525b;text-transform:uppercase;">${escapeHtml(
          a.pays || "—",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#71717a;">${escapeHtml(
          frDateTime(a.created_at),
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#b45309;font-weight:600;">${escapeHtml(
          anciennete(a.created_at),
        )}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">Récap hebdo · alertes Stripe à traiter</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">ArtiFlow-pro · ${estTest ? "envoi de test" : "synthèse automatique des alertes non traitées"}</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3c7;color:#b45309;font-size:12px;font-weight:700;">
          ${total} alerte${total > 1 ? "s" : ""} de configuration Stripe en attente de traitement
        </div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Ces alertes signalent qu'un client n'a pas pu ouvrir la page de paiement (configuration
          Stripe incomplète) et qu'<strong>aucune action de traitement n'a encore été enregistrée</strong>.
          Traitez-les depuis le back-office (« Marquer comme traitée ») pour éviter d'y revenir.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f4f4f5;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Cause</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#71717a;">En attente</th>
            </tr>
          </thead>
          <tbody>${lignesGroupes}</tbody>
        </table>
        ${
          lignesDetail
            ? `<p style="margin:20px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Détail des ${recents.length} alerte${recents.length > 1 ? "s" : ""} les plus anciennes</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Cause</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Pays</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Détectée le</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Ancienneté</th>
            </tr>
          </thead>
          <tbody>${lignesDetail}</tbody>
        </table>`
            : ""
        }
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          Récap généré le ${escapeHtml(frDateTime(new Date().toISOString()))} et envoyé à ${escapeHtml(
            destinataires.join(", "),
          )}.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro.
      </div>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const force = body?.force === true;
    const preview = body?.preview === true;
    const ignoreTime = body?.ignoreTime === true;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Alertes de configuration Stripe encore NON traitées (les plus anciennes d'abord :
    //    ce sont les plus urgentes à traiter).
    const { data, error } = await admin
      .from("alerte_config_stripe")
      .select("id, motif, pays, created_at")
      .neq("statut", "traitee")
      .order("created_at", { ascending: true });
    if (error) return json({ ok: false, error: error.message }, 500);

    const alertes = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id) || 0,
      motif: (row.motif === "pays" || row.motif === "carte" ? row.motif : "") as "pays" | "carte" | "",
      pays: row.pays ? String(row.pays) : "",
      created_at: String(row.created_at ?? ""),
    })) as AlerteNonTraitee[];

    const total = alertes.length;
    const groupes = grouperParCause(alertes);
    const destinataires = await adressesGestionnaires(admin);

    // Mode aperçu : on renvoie le HTML de l'email, sans rien envoyer.
    if (preview) {
      return json({
        ok: true,
        preview: true,
        total,
        groupes,
        destinataires,
        subject: `Récap hebdo · ${total} alerte${total > 1 ? "s" : ""} Stripe à traiter`,
        html: buildEmailHtml(groupes, alertes, total, destinataires, true),
      });
    }

    if (!resendKey || !fromDomain) {
      return json({
        ok: true,
        configured: false,
        sent: 0,
        total,
        reason: "Resend non configuré (clé API + domaine d'envoi).",
      });
    }

    // 2) Jour/heure d'envoi (défaut lundi 08:00, heure de Paris) — sauf test manuel.
    if (!force && !ignoreTime) {
      const jourCible = Number.isFinite(Number(body?.day)) ? ((Number(body.day) - 1 + 7) % 7) + 1 : JOUR_DEFAUT;
      const heureCible = Number.isFinite(Number(body?.hour)) ? Number(body.hour) % 24 : HEURE_DEFAUT;
      if (parisWeekday() !== jourCible || parisHour() !== heureCible) {
        return json({ ok: true, sent: 0, total, reason: "Hors créneau d'envoi hebdomadaire." });
      }
    }

    // 3) Rien à signaler : on n'envoie pas d'email vide (sauf test manuel).
    if (total === 0 && !force) {
      return json({ ok: true, sent: 0, total, reason: "Aucune alerte Stripe en attente de traitement." });
    }

    // 4) Anti-doublon : pas deux récaps à moins de 6 jours d'intervalle (sauf test manuel).
    if (!force) {
      const { data: derniers } = await admin
        .from("recap_alertes_stripe_envois")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      const dernier = Array.isArray(derniers) && derniers[0] ? String(derniers[0].created_at ?? "") : "";
      const t = dernier ? new Date(dernier).getTime() : 0;
      if (t && Date.now() - t < INTERVALLE_MIN_JOURS * 86_400_000) {
        return json({ ok: true, sent: 0, total, reason: "Récap déjà envoyé cette semaine." });
      }
    }

    if (destinataires.length === 0) {
      return json({ ok: true, sent: 0, total, reason: "Aucun gestionnaire à prévenir." });
    }

    // 5) Envoi de l'email aux gestionnaires.
    const subject = `${force ? "Test · " : ""}Récap hebdo · ${total} alerte${total > 1 ? "s" : ""} Stripe à traiter`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${fromDomain}>`,
        to: destinataires,
        subject,
        html: buildEmailHtml(groupes, alertes, total, destinataires, force),
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as { message?: string } | null;
      return json({ ok: true, sent: 0, total, reason: errData?.message || "Refus de Resend." });
    }

    // Trace de l'envoi (sert d'anti-doublon et d'archive).
    await admin.from("recap_alertes_stripe_envois").insert({
      nb_alertes: total,
      destinataires,
    });

    return json({ ok: true, configured: true, sent: 1, total, groupes, destinataires });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
