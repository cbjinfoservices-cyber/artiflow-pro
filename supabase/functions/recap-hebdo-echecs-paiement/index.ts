import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Récapitulatif HEBDOMADAIRE par email vers les gestionnaires : liste les échecs
// d'ouverture de paiement Stripe de la semaine (table `paiements_echecs`), avec une
// synthèse du nombre d'échecs par offre et le détail des derniers incidents.
//
// Prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (voir Agents → Tâches planifiées), à déclencher CHAQUE HEURE. La fonction revérifie
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

/** Fenêtre couverte par le récap (en jours). */
const PERIODE_JOURS = 7;
/** Anti-doublon : pas deux récaps à moins de 6 jours d'intervalle. */
const INTERVALLE_MIN_JOURS = 6;
/** Jour/heure d'envoi par défaut (lundi 08:00, heure de Paris). */
const JOUR_DEFAUT = 1;
const HEURE_DEFAUT = 8;

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

function frEuros(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
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

/** Un échec de paiement tel que journalisé côté Backend. */
interface EchecPaiement {
  entreprise: string | null;
  artisan_email: string | null;
  offre: string | null;
  facturation: string | null;
  montant_total: number | null;
  message: string | null;
  created_at: string;
  /** Famille de l'échec, pour trier les incidents directement dans l'email. */
  famille: FamilleEchec;
}

/**
 * Famille d'un échec de paiement, pour trier les incidents à la lecture de l'email :
 * - `configuration` : le tunnel Stripe n'a pas pu s'ouvrir (moyen de paiement non activé,
 *   clé ou compte mal configuré). À corriger de notre côté, dans Stripe.
 * - `carte` : l'artisan est bien arrivé au paiement mais sa carte a été refusée.
 *   À relancer auprès de lui.
 * - `autre` : cause non reconnue, à examiner au cas par cas.
 */
type FamilleEchec = "configuration" | "carte" | "autre";

/** Motifs (dans le message Stripe) qui trahissent une carte refusée côté artisan. */
const MOTIFS_CARTE = [
  "card was declined",
  "declined",
  "refusée",
  "refuse",
  "do not honor",
  "insufficient",
  "fonds insuffisants",
  "expired",
  "expirée",
  "pickup",
  "stolen",
  "lost card",
  "incorrect number",
  "incorrect cvc",
  "generic_decline",
  "authentication required",
  "3d secure",
];

/** Motifs (dans le message Stripe) qui trahissent un problème de configuration du tunnel. */
const MOTIFS_CONFIGURATION = [
  "no valid payment method",
  "payment_method_types",
  "payment method type",
  "payment method configuration",
  "not configured",
  "pas encore configuré",
  "n'est pas encore configuré",
  "no such api key",
  "api key",
  "api_key",
  "not allowed",
  "forbidden",
  "permission",
  "unsupported currency",
  "currency is not supported",
  "activer les paiements",
];

/**
 * Range un échec de paiement dans sa famille (configuration / carte / autre) à partir du
 * message renvoyé par Stripe. La carte refusée prime, pour ne jamais ranger un « declined »
 * en problème de configuration.
 */
function classerEchec(message: string | null): FamilleEchec {
  const m = String(message ?? "").toLowerCase();
  if (!m) return "autre";
  if (MOTIFS_CARTE.some((motif) => m.includes(motif))) return "carte";
  if (MOTIFS_CONFIGURATION.some((motif) => m.includes(motif))) return "configuration";
  return "autre";
}

/** Libellé, couleurs et description associés à chaque famille dans l'email. */
const FAMILLE_META: Record<FamilleEchec, { label: string; bg: string; color: string; note: string }> = {
  configuration: {
    label: "Configuration Stripe",
    bg: "#fef3c7",
    color: "#92400e",
    note: "tunnel non ouvert — à corriger de notre côté",
  },
  carte: {
    label: "Carte refusée",
    bg: "#fee2e2",
    color: "#b91c1c",
    note: "refus de la banque — à relancer auprès de l'artisan",
  },
  autre: {
    label: "Autre cause",
    bg: "#f4f4f5",
    color: "#52525b",
    note: "à examiner au cas par cas",
  },
};

/** Répartition des échecs par famille, pour le bloc de synthèse de l'email. */
interface RepartitionFamille {
  famille: FamilleEchec;
  count: number;
}

/** Compte les échecs par famille, dans un ordre fixe et lisible. */
function compterParFamille(echecs: EchecPaiement[]): RepartitionFamille[] {
  const ordre: FamilleEchec[] = ["configuration", "carte", "autre"];
  return ordre.map((famille) => ({
    famille,
    count: echecs.filter((e) => e.famille === famille).length,
  }));
}

/** Répartition des échecs pour une offre donnée. */
interface GroupeOffre {
  offre: string;
  count: number;
  montantTotal: number;
}

/** Regroupe les échecs par offre, du plus touché au moins touché. */
function grouperParOffre(echecs: EchecPaiement[]): GroupeOffre[] {
  const map = new Map<string, GroupeOffre>();
  echecs.forEach((e) => {
    const cle = (e.offre ?? "").trim() || "Offre non renseignée";
    const cur = map.get(cle);
    if (cur) {
      cur.count += 1;
      cur.montantTotal += Number(e.montant_total ?? 0) || 0;
    } else {
      map.set(cle, { offre: cle, count: 1, montantTotal: Number(e.montant_total ?? 0) || 0 });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** Construit l'email récapitulatif hebdomadaire des échecs de paiement. */
function buildEmailHtml(
  groupes: GroupeOffre[],
  echecs: EchecPaiement[],
  total: number,
  destinataires: string[],
  estTest = false,
): string {
  const lignesGroupes = groupes
    .map(
      (g) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#18181b;">${escapeHtml(g.offre)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#b91c1c;font-weight:700;text-align:center;">${g.count}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#52525b;text-align:right;">${escapeHtml(frEuros(g.montantTotal))}</td>
      </tr>`,
    )
    .join("");

  const recents = echecs.slice(0, 10);
  const lignesDetail = recents
    .map((e) => {
      const meta = FAMILLE_META[e.famille];
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#18181b;">${escapeHtml(
          e.entreprise?.trim() || e.artisan_email?.trim() || "Artisan",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#52525b;">${escapeHtml(
          (e.offre ?? "—") + (e.facturation ? ` · ${e.facturation}` : ""),
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${meta.bg};color:${meta.color};font-size:11px;font-weight:700;white-space:nowrap;">${escapeHtml(
          meta.label,
        )}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#71717a;">${escapeHtml(
          frDateTime(e.created_at),
        )}</td>
      </tr>`;
    })
    .join("");

  // Synthèse par famille : permet de trier les incidents directement dans l'email, sans
  // ouvrir le back-office — combien relèvent d'une erreur de configuration à corriger de
  // notre côté, combien sont des cartes refusées à relancer auprès de l'artisan.
  const repartition = compterParFamille(echecs);
  const cartesFamilles = repartition
    .filter((r) => r.count > 0)
    .map((r) => {
      const meta = FAMILLE_META[r.famille];
      return `<div style="display:inline-block;margin:4px 6px 0 0;padding:6px 12px;border-radius:10px;background:${meta.bg};color:${meta.color};">
        <span style="font-size:16px;font-weight:700;">${r.count}</span>
        <span style="font-size:12px;font-weight:600;margin-left:6px;">${escapeHtml(meta.label)}</span>
        <div style="font-size:11px;font-weight:400;opacity:0.85;">${escapeHtml(meta.note)}</div>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">Récap hebdo · échecs de paiement</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">ArtiFlow-pro · ${estTest ? "envoi de test" : `synthèse automatique des ${PERIODE_JOURS} derniers jours`}</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">
          ${total} échec${total > 1 ? "s" : ""} d'ouverture de paiement cette semaine
        </div>
        ${
          cartesFamilles
            ? `<p style="margin:16px 0 4px;font-size:13px;font-weight:700;color:#18181b;">Répartition par famille</p>
        <div>${cartesFamilles}</div>`
            : ""
        }
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici les tentatives de souscription qui n'ont pas pu ouvrir la page de paiement Stripe
          sur les ${PERIODE_JOURS} derniers jours, regroupées par offre et classées par famille
          (configuration Stripe à corriger de notre côté / carte refusée à relancer auprès de l'artisan).
          Aucun abonnement n'a été créé et <strong>aucun montant n'a été prélevé</strong>. Vous pouvez
          relancer ces artisans en un clic depuis le back-office.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f4f4f5;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Offre</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#71717a;">Échecs</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:#71717a;">Montant attendu</th>
            </tr>
          </thead>
          <tbody>${lignesGroupes}</tbody>
        </table>
        ${
          lignesDetail
            ? `<p style="margin:20px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Derniers incidents (${recents.length})</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Artisan</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Offre</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Famille</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Date</th>
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

    // 1) Échecs de paiement de la fenêtre (les plus récents en premier).
    const depuis = new Date(Date.now() - PERIODE_JOURS * 86_400_000).toISOString();
    const { data, error } = await admin
      .from("paiements_echecs")
      .select("entreprise, artisan_email, offre, facturation, montant_total, message, created_at")
      .gte("created_at", depuis)
      .order("created_at", { ascending: false });
    if (error) return json({ ok: false, error: error.message }, 500);

    const echecs = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      entreprise: row.entreprise ? String(row.entreprise) : null,
      artisan_email: row.artisan_email ? String(row.artisan_email) : null,
      offre: row.offre ? String(row.offre) : null,
      facturation: row.facturation ? String(row.facturation) : null,
      montant_total: row.montant_total === null || row.montant_total === undefined ? null : Number(row.montant_total),
      message: row.message ? String(row.message) : null,
      created_at: String(row.created_at ?? ""),
      famille: classerEchec(row.message ? String(row.message) : null),
    })) as EchecPaiement[];

    const total = echecs.length;
    const groupes = grouperParOffre(echecs);
    const familles = compterParFamille(echecs);
    const destinataires = await adressesGestionnaires(admin);

    // Mode aperçu : on renvoie le HTML de l'email, sans rien envoyer.
    if (preview) {
      return json({
        ok: true,
        preview: true,
        total,
        groupes,
        familles,
        destinataires,
        subject: `Récap hebdo · ${total} échec${total > 1 ? "s" : ""} de paiement`,
        html: buildEmailHtml(groupes, echecs, total, destinataires, true),
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
      return json({ ok: true, sent: 0, total, reason: "Aucun échec de paiement sur la période." });
    }

    // 4) Anti-doublon : pas deux récaps à moins de 6 jours d'intervalle (sauf test manuel).
    if (!force) {
      const { data: derniers } = await admin
        .from("recap_echecs_paiement_envois")
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
    const subject = `${force ? "Test · " : ""}Récap hebdo · ${total} échec${total > 1 ? "s" : ""} de paiement`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${fromDomain}>`,
        to: destinataires,
        subject,
        html: buildEmailHtml(groupes, echecs, total, destinataires, force),
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as { message?: string } | null;
      return json({ ok: true, sent: 0, total, reason: errData?.message || "Refus de Resend." });
    }

    // Trace de l'envoi (sert d'anti-doublon et d'archive).
    await admin.from("recap_echecs_paiement_envois").insert({
      nb_echecs: total,
      periode_jours: PERIODE_JOURS,
      destinataires,
    });

    return json({ ok: true, configured: true, sent: 1, total, groupes, destinataires });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
