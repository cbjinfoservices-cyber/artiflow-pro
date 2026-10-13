import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fonction de l'ENVOI HEBDOMADAIRE du récapitulatif d'échecs « test à blanc » (CSV joint).
// Elle est prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (voir Agents → Tâches planifiées). Comme chaque artisan choisit son jour et son heure
// d'envoi, la tâche planifiée est appelée CHAQUE HEURE : chaque passage n'envoie qu'aux
// artisans dont le jour ET l'heure correspondent (défaut : lundi 08:00, heure de Paris).
// Un appel avec `userId` + `force: true` (bouton « Tester maintenant ») envoie tout de suite
// le récap de cet artisan, sans tenir compte du jour/heure.
//
// Elle sert AUSSI de garde-fou d'archivage : quand il n'y a aucun échec à expédier, elle
// vérifie si le dernier récap d'échecs (manuel ou auto) date de plus du SEUIL réglé sur le
// profil (15/30/60 jours, défaut 30) et, le cas échéant, envoie un rappel « archivage en
// retard » à l'artisan (au plus une fois par semaine).
//
// Un appel avec `userId` + `testAlerte: true` (bouton « Tester le rappel ») envoie tout de
// suite le rappel d'archivage, sans tenir compte du seuil ni de l'anti-doublon.
//
// Le contenu regroupe, PAR AUTOMATISATION, les échecs des rejeux « test à blanc » de la fenêtre
// réglée (7/14/30 jours, issue de la table rejeux_blanc_historique), avec un fichier CSV joint.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

/** Normalise une liste d'adresses en copie (liste de chaînes ou d'objets { email }). */
function normalizeCc(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const s = item.trim();
      if (s) out.push(s);
    } else if (item && typeof item === "object") {
      const email = String((item as Record<string, unknown>).email ?? "").trim();
      if (email) out.push(email);
    }
  }
  return out;
}

/** Échappe une cellule CSV (séparateur point-virgule, compatible Excel FR). */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Construit le contenu CSV à partir d'un en-tête et de lignes de données. */
function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(";"), ...rows.map((row) => row.map(escapeCell).join(";"))];
  return lines.join("\r\n");
}

/** Encode un contenu texte en base64 (UTF-8) avec BOM, pour la pièce jointe email. */
function toBase64(content: string): string {
  const bytes = new TextEncoder().encode(`\uFEFF${content}`);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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

function estEnPause(pauseJusquAu: unknown): boolean {
  if (!pauseJusquAu) return false;
  return String(pauseJusquAu).slice(0, 10) >= new Date().toISOString().slice(0, 10);
}

/** Ramene une valeur quelconque a une fenetre valide (7, 14 ou 30 jours ; defaut 7). */
function normaliserFenetre(v: unknown): number {
  const n = Math.round(Number(v));
  return n === 7 || n === 14 || n === 30 ? n : 7;
}

/** Seuils (en jours) valides pour le rappel « archivage en retard ». */
/** Ramene une valeur quelconque a un seuil de rappel valide (15, 30 ou 60 jours ; defaut 30). */
function normaliserSeuil(v: unknown): number {
  const n = Math.round(Number(v));
  return n === 15 || n === 30 || n === 60 ? n : 30;
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

/** Un rejeu à blanc en échec, tel que consigné côté Backend. */
interface RejeuEchec {
  automatisation_id: string;
  automatisation_nom: string;
  destinataire: string;
  created_at: string;
}

/** Un groupe d'échecs rattaché à une automatisation. */
interface GroupeEchecs {
  nom: string;
  echecs: number;
  dernier: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Charge les échecs des rejeux à blanc de la fenêtre (en jours) donnée pour un artisan. */
async function chargerEchecsFenetre(admin: Admin, userId: string, jours: number): Promise<RejeuEchec[]> {
  const span = normaliserFenetre(jours);
  const debut = new Date(Date.now() - span * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("rejeux_blanc_historique")
    .select("automatisation_id, automatisation_nom, destinataire, created_at")
    .eq("user_id", userId)
    .eq("ok", false)
    .gte("created_at", debut)
    .order("created_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    automatisation_id: String(row.automatisation_id ?? ""),
    automatisation_nom: String(row.automatisation_nom ?? "Automatisation"),
    destinataire: String(row.destinataire ?? ""),
    created_at: String(row.created_at ?? ""),
  }));
}

/** Regroupe les échecs par automatisation, du plus touché au moins touché. */
function grouperEchecs(echecs: RejeuEchec[]): GroupeEchecs[] {
  const map = new Map<string, GroupeEchecs>();
  echecs.forEach((e) => {
    const cle = e.automatisation_nom || e.automatisation_id || "Automatisation";
    const cur = map.get(cle);
    if (cur) {
      cur.echecs += 1;
      if (new Date(e.created_at).getTime() > new Date(cur.dernier).getTime()) cur.dernier = e.created_at;
    } else {
      map.set(cle, { nom: cle, echecs: 1, dernier: e.created_at });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.echecs - a.echecs);
}

/** Construit le CSV (synthèse par automatisation + détail complet) de l'historique d'échecs. */
function buildCsv(echecs: RejeuEchec[], groupes: GroupeEchecs[]): string {
  const synthese = toCsv(
    ["Automatisation", "Nb échecs", "Dernier échec"],
    groupes.map((g) => [g.nom, String(g.echecs), frDateTime(g.dernier)]),
  );
  const detail = toCsv(
    ["Automatisation", "Date", "Adresse de test", "Résultat"],
    echecs.map((e) => [e.automatisation_nom, frDateTime(e.created_at), e.destinataire, "Échec"]),
  );
  return `Échecs par automatisation (${groupes.length})\r\n${synthese}\r\n\r\nDétail de l'historique\r\n${detail}`;
}

function buildEmailHtml(
  nom: string,
  groupes: GroupeEchecs[],
  total: number,
  destinataire: string,
  jours: number,
  cc: string[] = [],
): string {
  const lignes = groupes
    .map(
      (g) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#18181b;">${escapeHtml(g.nom)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#b91c1c;font-weight:700;text-align:center;">${g.echecs}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#71717a;">${escapeHtml(frDateTime(g.dernier))}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap hebdo des échecs « test à blanc »</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">
          ${groupes.length} automatisation${groupes.length > 1 ? "s" : ""} en échec sur ${total} rejeu${total > 1 ? "x" : ""}
        </div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici les échecs de vos rejeux « test à blanc » des ${jours} derniers jours, regroupés par
          automatisation. Le fichier <strong>CSV</strong> en pièce jointe contient le détail à archiver.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f4f4f5;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Automatisation</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#71717a;">Échecs</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Dernier échec</th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Récap généré le ${escapeHtml(frDateTime(new Date().toISOString()))} et envoyé à ${escapeHtml(destinataire)}.
        </p>
        ${cc.length > 0
          ? `<p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">Une copie (Cc) est adressée à ${cc
              .map((a) => escapeHtml(a))
              .join(", ")}.</p>`
          : ""}
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

/** Seuil (en jours) par defaut au-dela duquel on previent que l'archivage des recaps d'echecs traine. */
const SEUIL_RETARD_JOURS = 30;
/** Anti-doublon : on n'envoie pas plus d'un rappel « archivage en retard » par semaine. */
const THROTTLE_ALERTE_JOURS = 7;

/** Nombre de jours entiers écoulés depuis une date ISO. */
function joursDepuisISO(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/**
 * Renvoie la date du dernier archivage réel d'un artisan : la plus récente entre le journal
 * des récaps d'échecs envoyés (manuel + auto) et la date du dernier envoi consignée au profil.
 * `null` si l'artisan n'a encore jamais archivé.
 */
async function chargerDernierArchivage(
  admin: Admin,
  userId: string,
  profilDernier: unknown,
): Promise<string | null> {
  const { data } = await admin
    .from("recap_echecs_blanc_envois")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const journal =
    Array.isArray(data) && data[0]
      ? String((data[0] as Record<string, unknown>).created_at ?? "")
      : "";
  const profil = profilDernier ? String(profilDernier) : "";
  const candidats = [journal, profil].filter((v) => v && !Number.isNaN(new Date(v).getTime()));
  if (candidats.length === 0) return null;
  candidats.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return candidats[0];
}

/** Rendu HTML du rappel « archivage en retard ». */
function buildAlerteRetardHtml(
  nom: string,
  dernierArchivage: string,
  jours: number,
  destinataire: string,
  seuil: number,
  estTest = false,
  cc: string[] = [],
): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Rappel : archivage des récaps d'échecs en retard</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">
          Dernier récap d'échecs il y a ${jours} jours
        </div>
        <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
          Vous avez activé le récap hebdomadaire des échecs des rejeux « test à blanc », mais aucun
          récap n'a été archivé depuis le <strong>${escapeHtml(frDateTime(dernierArchivage))}</strong>
          (soit plus de ${seuil} jours). Pensez à relancer un récap pour garder une trace
          fraîche de la vérification de vos rendus.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          ${estTest ? "Il s'agit d'un TEST : aucun récap réel n'a besoin d'être relancé." : "Rappel envoyé automatiquement à"} ${escapeHtml(destinataire)}. Aucune action n'est requise si vos
          rejeux n'ont connu aucun échec.
        </p>
        ${cc.length > 0
          ? `<p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">Une copie (Cc) est adressée à ${cc
              .map((a) => escapeHtml(a))
              .join(", ")}.</p>`
          : ""}
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Envoie un rappel « archivage en retard » si le dernier récap d'échecs date de plus du seuil,
 * au plus une fois par semaine (anti-doublon consigné sur le profil). Silencieux en cas d'échec.
 */
async function verifierAlerteRetard(
  admin: Admin,
  opts: {
    userId: string;
    email: string;
    nom: string;
    dernierEnvoiProfil: unknown;
    resendKey: string;
    fromDomain: string;
    alerteDerniere: unknown;
    seuil: number;
    force?: boolean;
    /** Adresses mises en copie (Cc) du rappel. */
    cc?: string[];
  },
): Promise<{ envoye: boolean; jours?: number }> {
  let dernier = await chargerDernierArchivage(admin, opts.userId, opts.dernierEnvoiProfil);
  if (!dernier) {
    // En mode test, on fabrique un dernier archivage datant du seuil pour produire un email représentatif.
    if (!opts.force) return { envoye: false };
    dernier = new Date(Date.now() - opts.seuil * 86400000).toISOString();
  }
  const jours = joursDepuisISO(dernier);
  if (!opts.force && jours < opts.seuil) return { envoye: false };
  if (!opts.force && opts.alerteDerniere) {
    const t = new Date(String(opts.alerteDerniere)).getTime();
    if (!Number.isNaN(t) && Date.now() - t < THROTTLE_ALERTE_JOURS * 86400000) {
      return { envoye: false };
    }
  }
  try {
    const subject = opts.force
      ? `Test : rappel « archivage en retard » (${jours} j)`
      : `Rappel : archivage des récaps d'échecs en retard (${jours} j)`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${opts.nom} <noreply@${opts.fromDomain}>`,
        to: [opts.email],
        cc: opts.cc && opts.cc.length ? opts.cc : undefined,
        subject,
        html: buildAlerteRetardHtml(opts.nom, dernier, jours, opts.email, opts.seuil, opts.force === true, opts.cc ?? []),
      }),
    });
    if (res.ok) {
      // On ne consomme l'anti-doublon que pour un vrai rappel, jamais pour un test.
      if (!opts.force) {
        await admin
          .from("profiles")
          .update({ echecs_blanc_recap_alerte_retard_dernier: new Date().toISOString() })
          .eq("id", opts.userId);
      }
      return { envoye: true, jours };
    }
  } catch {
    /* silencieux : le rappel est un confort, on n'échoue pas la tâche pour autant */
  }
  return { envoye: false };
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
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const preview = body?.preview === true;
    const force = body?.force === true;
    const testAlerte = body?.testAlerte === true;
    const ignoreTime = body?.ignoreTime === true;
    const hourOverride = Number.isFinite(Number(body?.hour)) ? Number(body.hour) % 24 : null;
    const dayOverride = Number.isFinite(Number(body?.day)) ? ((Number(body.day) - 1 + 7) % 7) + 1 : null;

    if (!preview && (!resendKey || !fromDomain)) {
      return json({
        ok: true,
        configured: false,
        sent: 0,
        skipped: 0,
        reason: "Resend non configuré (clé API + domaine d'envoi).",
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, pause_jusqu_au, echecs_blanc_recap_hebdo_actif, echecs_blanc_recap_hebdo_jour, echecs_blanc_recap_hebdo_heure, echecs_blanc_recap_hebdo_fenetre, echecs_blanc_recap_hebdo_dernier_envoi, echecs_blanc_recap_alerte_seuil, echecs_blanc_recap_alerte_retard_dernier, echecs_blanc_recap_alerte_cc, echecs_blanc_recap_hebdo_cc",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    // Mode aperçu : on construit l'email pour l'artisan ciblé et on le renvoie tel quel, sans
    // rien envoyer (même si Resend n'est pas encore configuré), pour valider le rendu.
    if (preview && scopeUserId) {
      const rawPrev = (profiles ?? [])[0];
      if (!rawPrev) return json({ ok: false, error: "Profil introuvable." }, 404);
      const pPrev = rawPrev as Record<string, unknown>;
      const nomPrev = String(pPrev.entreprise ?? pPrev.metier ?? "Votre artisan");
      const emailPrev = String(pPrev.email ?? "").trim() || "votre adresse";
      const fenetrePrev = normaliserFenetre(pPrev.echecs_blanc_recap_hebdo_fenetre);
      const echecsPrev = await chargerEchecsFenetre(admin, scopeUserId, fenetrePrev);
      const groupesPrev = grouperEchecs(echecsPrev);
      const subjectPrev = `Récap hebdo des échecs test à blanc · ${groupesPrev.length} automatisation${groupesPrev.length > 1 ? "s" : ""}`;
      return json({
        ok: true,
        preview: true,
        html: buildEmailHtml(
          nomPrev,
          groupesPrev,
          echecsPrev.length,
          emailPrev,
          fenetrePrev,
          normalizeCc(pPrev.echecs_blanc_recap_hebdo_cc),
        ),
        subject: subjectPrev,
        echecs: echecsPrev.length,
      });
    }

    // Mode test du rappel d'archivage : on envoie tout de suite l'email « archivage en retard »
    // à l'artisan ciblé, sans tenir compte du seuil ni de l'anti-doublon, pour vérifier la réception.
    if (testAlerte && scopeUserId) {
      const rawTest = (profiles ?? [])[0];
      if (!rawTest) return json({ ok: false, error: "Profil introuvable." }, 404);
      const pTest = rawTest as Record<string, unknown>;
      const emailTest = String(pTest.email ?? "").trim();
      if (!emailTest) {
        return json({ ok: true, configured: true, sent: 0, skipped: 1, details: [{ userId: scopeUserId, sent: false, reason: "Email manquant." }] });
      }
      const alerteTest = await verifierAlerteRetard(admin, {
        userId: scopeUserId,
        email: emailTest,
        nom: String(pTest.entreprise ?? pTest.metier ?? "Votre artisan"),
        dernierEnvoiProfil: pTest.echecs_blanc_recap_hebdo_dernier_envoi,
        resendKey,
        fromDomain,
        alerteDerniere: pTest.echecs_blanc_recap_alerte_retard_dernier,
        seuil: normaliserSeuil(pTest.echecs_blanc_recap_alerte_seuil),
        force: true,
        cc: normalizeCc(pTest.echecs_blanc_recap_alerte_cc),
      });
      return json({
        ok: true,
        configured: true,
        sent: alerteTest.envoye ? 1 : 0,
        skipped: alerteTest.envoye ? 0 : 1,
        jours: alerteTest.jours,
        details: [{ userId: scopeUserId, sent: alerteTest.envoye, reason: alerteTest.envoye ? undefined : "Envoi impossible (Resend)." }],
      });
    }

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string }> = [];

    const cibleHour = hourOverride ?? parisHour();
    const cibleDay = dayOverride ?? parisWeekday();

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      const nom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const actif = p.echecs_blanc_recap_hebdo_actif === true;
      const enPause = estEnPause(p.pause_jusqu_au);

      if (!force && !actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap hebdo coupé." });
        continue;
      }
      if (!force && enPause) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Pause vacances." });
        continue;
      }
      if (!force && !ignoreTime) {
        const heureChoisie =
          p.echecs_blanc_recap_hebdo_heure === null || p.echecs_blanc_recap_hebdo_heure === undefined
            ? 8
            : Number(p.echecs_blanc_recap_hebdo_heure);
        const jourChoisi =
          p.echecs_blanc_recap_hebdo_jour === null || p.echecs_blanc_recap_hebdo_jour === undefined
            ? 1
            : Number(p.echecs_blanc_recap_hebdo_jour);
        if (heureChoisie !== cibleHour || jourChoisi !== cibleDay) {
          details.push({ userId, sent: false });
          continue;
        }
      }
      if (!email) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email manquant." });
        continue;
      }

      const fenetre = normaliserFenetre(p.echecs_blanc_recap_hebdo_fenetre);
      const echecs = await chargerEchecsFenetre(admin, userId, fenetre);
      const groupes = grouperEchecs(echecs);
      if (groupes.length === 0) {
        skipped += 1;
        // Aucun échec → pas de récap à envoyer. On vérifie quand même si l'archivage traîne :
        // au-delà du seuil sans récap, on prévient l'artisan par email (hors test manuel).
        let raison = `Aucun échec sur les ${fenetre} derniers jours.`;
        if (!force) {
          const alerte = await verifierAlerteRetard(admin, {
            userId,
            email,
            nom,
            dernierEnvoiProfil: p.echecs_blanc_recap_hebdo_dernier_envoi,
            resendKey,
            fromDomain,
            alerteDerniere: p.echecs_blanc_recap_alerte_retard_dernier,
            seuil: normaliserSeuil(p.echecs_blanc_recap_alerte_seuil),
            cc: normalizeCc(p.echecs_blanc_recap_alerte_cc),
          });
          if (alerte.envoye) {
            raison = `Aucun échec, mais rappel d'archivage envoyé (retard de ${alerte.jours} j).`;
          }
        }
        details.push({ userId, sent: false, reason: raison });
        continue;
      }

      const csv = buildCsv(echecs, groupes);
      const contentBase64 = toBase64(csv);
      const filename = `echecs-rejeux-${new Date().toISOString().slice(0, 10)}.csv`;
      const subject = `Récap hebdo des échecs test à blanc · ${groupes.length} automatisation${groupes.length > 1 ? "s" : ""}`;
      // Adresses mises en copie (Cc) du récap d'échecs lui-même (comptable, collaborateur…).
      const ccHebdo = normalizeCc(p.echecs_blanc_recap_hebdo_cc);

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${nom} <noreply@${fromDomain}>`,
            to: [email],
            cc: ccHebdo.length ? ccHebdo : undefined,
            subject,
            html: buildEmailHtml(nom, groupes, echecs.length, email, fenetre, ccHebdo),
            attachments: [{ filename, content: contentBase64 }],
          }),
        });
        if (res.ok) {
          sent += 1;
          const maintenant = new Date().toISOString();
          await admin
            .from("profiles")
            .update({ echecs_blanc_recap_hebdo_dernier_envoi: maintenant })
            .eq("id", userId);
          await admin
            .from("recap_echecs_blanc_envois")
            .insert({ user_id: userId, source: "hebdo" });
          details.push({ userId, sent: true });
        } else {
          const errData = (await res.json().catch(() => null)) as { message?: string } | null;
          skipped += 1;
          details.push({ userId, sent: false, reason: errData?.message || "Refus de Resend." });
        }
      } catch (e) {
        skipped += 1;
        details.push({ userId, sent: false, reason: e instanceof Error ? e.message : "Erreur d'envoi." });
      }
    }

    return json({
      ok: true,
      configured: true,
      users: scopeUserId ? 1 : (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
