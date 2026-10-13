import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fonction du récapitulatif HEBDOMADAIRE des envois automatiques.
// Elle est prévue pour tourner SANS session utilisateur : appelée par une tâche
// planifiée (voir Agents → Tâches planifiées). Comme chaque artisan choisit son jour et
// son heure d'envoi, la tâche planifiée est appelée CHAQUE HEURE : chaque passage n'envoie
// qu'aux artisans dont le jour ET l'heure correspondent (défaut : lundi 08:00, heure de Paris).
// Un appel avec `userId` + `force: true` (bouton « Tester maintenant ») envoie tout de suite
// le récap de cet artisan, sans tenir compte du jour/heure.
//
// Le contenu est la synthèse de toutes les automatisations de l'artisan (à jour / à vérifier /
// inactives) avec la synthèse CSV en pièce jointe, à l'adresse de son profil.
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN.

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
    const email =
      typeof item === "string" ? item : String((item as Record<string, unknown>)?.email ?? "");
    const clean = email.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) && !out.includes(clean)) out.push(clean);
  }
  return out;
}

type AutoStatut = "ok" | "attention" | "inactif" | "inconnu";

const STATUT_LABEL: Record<AutoStatut, string> = {
  ok: "À jour",
  attention: "À vérifier",
  inactif: "Inactive",
  inconnu: "À confirmer",
};

const STATUT_COLOR: Record<AutoStatut, string> = {
  ok: "#0f766e",
  attention: "#b91c1c",
  inactif: "#71717a",
  inconnu: "#a16207",
};

function frDate(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function joursDepuis(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function ecartJours(a: Date, b: Date): number {
  const ja = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const jb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((ja - jb) / 86400000);
}

function libelleEcheance(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jours = ecartJours(d, new Date());
  if (jours === 0) return `aujourd'hui à ${heure}`;
  if (jours === 1) return `demain à ${heure}`;
  if (jours > 1 && jours <= 7) return `dans ${jours} jours (${frDate(iso)})`;
  return frDate(iso);
}

function prochainHoraire(now: Date = new Date()): string {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function prochainQuotidien(heure: number, now: Date = new Date()): string {
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, 0, 0, 0);
  return d.toISOString();
}

function prochainMensuel(jour: number, heure: number, now: Date = new Date()): string {
  const j = Math.min(28, Math.max(1, Math.round(Number.isFinite(jour) && jour > 0 ? jour : 1)));
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  let d = new Date(now.getFullYear(), now.getMonth(), j, h, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d = new Date(now.getFullYear(), now.getMonth() + 1, j, h, 0, 0, 0);
  return d.toISOString();
}

function prochainAnnuel(jour: number, heure: number, now: Date = new Date()): string {
  const j = Math.min(28, Math.max(1, Math.round(Number.isFinite(jour) && jour > 0 ? jour : 5)));
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  let d = new Date(now.getFullYear(), 0, j, h, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d = new Date(now.getFullYear() + 1, 0, j, h, 0, 0, 0);
  return d.toISOString();
}

function prochainHebdo(jour: number, heure: number, now: Date = new Date()): string {
  const cible = Math.min(7, Math.max(1, Math.round(Number.isFinite(jour) && jour > 0 ? jour : 1)));
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  const jsCible = cible % 7; // 7 (dimanche) → 0
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
  let delta = (jsCible - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString();
}

function calculerStatut(params: {
  actif: boolean;
  enPause?: boolean;
  tracable: boolean;
  dernierPassage: string | null;
  toleranceJours: number;
  alertes?: number;
}): AutoStatut {
  const { actif, enPause = false, tracable, dernierPassage, toleranceJours, alertes = 0 } = params;
  if (!actif || enPause) return "inactif";
  if (alertes > 0) return "attention";
  if (!tracable) return "inconnu";
  if (!dernierPassage) return "attention";
  return joursDepuis(dernierPassage) <= toleranceJours ? "ok" : "attention";
}

function estEnPause(pauseJusquAu: unknown): boolean {
  if (!pauseJusquAu) return false;
  return String(pauseJusquAu).slice(0, 10) >= new Date().toISOString().slice(0, 10);
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

/** Encodage base64 (UTF-8) d'un texte, pour la pièce jointe CSV. */
function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(`\uFEFF${text}`);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(";"), ...rows.map((row) => row.map(escapeCell).join(";"))];
  return lines.join("\r\n");
}

interface AutoItem {
  id: string;
  nom: string;
  frequence: string;
  dernierPassage: string | null;
  dernierDetail: string | null;
  prochaineLibelle: string;
  statut: AutoStatut;
  note: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/**
 * Reconstruit la synthèse des automatisations d'un artisan. Les requêtes filtrent
 * explicitement par `user_id` (le client service-role n'applique pas la RLS) et ne
 * s'appuient que sur des traces déjà enregistrées en base.
 */
async function chargerItems(admin: Admin, userId: string, p: Record<string, unknown>): Promise<AutoItem[]> {
  const [recapRes, envoisRes, escaladeRes, recapQuotRes, aboRes] = await Promise.all([
    admin
      .from("recap_recontact_envois")
      .select("envoye_le, nb_comptes, origine")
      .eq("user_id", userId)
      .order("envoye_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("envois_email")
      .select("type, mode, mois_cle, nb_lignes, created_at")
      .eq("user_id", userId)
      .in("type", ["comptable", "comptable_bilan"])
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("escalade_journal")
      .select("run_at, envoye, echoue")
      .eq("user_id", userId)
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("recap_envois")
      .select("envoye_le")
      .eq("user_id", userId)
      .order("envoye_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("abonnements")
      .select("rappel_prelevement_charge")
      .eq("artisan_id", userId)
      .not("rappel_prelevement_charge", "is", null)
      .order("rappel_prelevement_charge", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const recap = (recapRes.data ?? null) as Record<string, unknown> | null;
  const envois = (envoisRes.data ?? []) as Array<Record<string, unknown>>;
  const escaladeRun = (escaladeRes.data ?? null) as Record<string, unknown> | null;
  const recapQuot = (recapQuotRes.data ?? null) as Record<string, unknown> | null;
  const abo = (aboRes.data ?? null) as Record<string, unknown> | null;

  const dernierJournal = envois.find((e) => e.type === "comptable") ?? null;
  const dernierBilan = envois.find((e) => e.type === "comptable_bilan") ?? null;
  const pause = estEnPause(p.pause_jusqu_au);
  const modeLabel = (mode: unknown) => (String(mode ?? "").toLowerCase() === "automatique" ? "automatique" : "manuel");
  const derniereDateHebdo = (recap?.envoye_le ?? p.recontact_rappel_dernier_envoi ?? null) as string | null;

  const items: AutoItem[] = [];

  items.push({
    id: "recap-hebdo",
    nom: "Récap hebdo des recontacts",
    frequence: "Hebdomadaire (1×/semaine)",
    dernierPassage: derniereDateHebdo,
    dernierDetail: recap
      ? `${Number(recap.nb_comptes ?? 0)} compte(s) · origine ${recap.origine === "test" ? "test manuel" : "automatique"}`
      : null,
    prochaineLibelle: "selon la cadence réglée",
    statut: calculerStatut({
      actif: p.recontact_rappel_hebdo_actif !== false,
      enPause: pause,
      tracable: true,
      dernierPassage: derniereDateHebdo,
      toleranceJours: 8,
    }),
    note: null,
  });

  const relanceManquanteActif = p.comptable_relance_manquante_actif === true;
  items.push({
    id: "relance-manquant",
    nom: "Alerte mois comptable sans envoi",
    frequence: "Quotidienne",
    dernierPassage: null,
    dernierDetail: p.comptable_relance_dernier_cle ? `Dernier mois alerté : ${p.comptable_relance_dernier_cle}` : null,
    prochaineLibelle: "chaque jour",
    statut: calculerStatut({
      actif: relanceManquanteActif,
      enPause: pause,
      tracable: false,
      dernierPassage: null,
      toleranceJours: 2,
    }),
    note: "Ce passage ne laisse pas de trace en base : seul le dernier mois alerté est mémorisé.",
  });

  const journalAuto = p.comptable_auto_actif === true;
  const prochainJournal = prochainMensuel(Number(p.comptable_auto_jour ?? 1), Number(p.comptable_auto_heure ?? 8));
  items.push({
    id: "journal-mensuel",
    nom: "Journal comptable mensuel",
    frequence: "Mensuelle",
    dernierPassage: (dernierJournal?.created_at ?? null) as string | null,
    dernierDetail: dernierJournal
      ? `Mois ${dernierJournal.mois_cle ?? "—"} · ${Number(dernierJournal.nb_lignes ?? 0)} ligne(s) · ${modeLabel(dernierJournal.mode)}`
      : p.comptable_auto_dernier_mois
        ? `Dernier mois traité : ${p.comptable_auto_dernier_mois}`
        : null,
    prochaineLibelle: libelleEcheance(prochainJournal),
    statut: calculerStatut({
      actif: journalAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: (dernierJournal?.created_at ?? null) as string | null,
      toleranceJours: 35,
    }),
    note: journalAuto ? null : "Envoi mensuel non activé dans les réglages comptables.",
  });

  const bilanAuto = p.comptable_bilan_auto_actif === true;
  const prochainBilan = prochainAnnuel(Number(p.comptable_bilan_jour ?? 5), 8);
  items.push({
    id: "bilan-annuel",
    nom: "Bilan d'archivage annuel",
    frequence: "Annuelle (en janvier)",
    dernierPassage: (dernierBilan?.created_at ?? null) as string | null,
    dernierDetail: p.comptable_bilan_dernier_annee ? `Dernier exercice archivé : ${p.comptable_bilan_dernier_annee}` : null,
    prochaineLibelle: libelleEcheance(prochainBilan),
    statut: calculerStatut({
      actif: bilanAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: (dernierBilan?.created_at ?? null) as string | null,
      toleranceJours: 400,
    }),
    note: bilanAuto ? null : "Bilan annuel non activé dans les réglages comptables.",
  });

  const dernierRappel = (abo?.rappel_prelevement_charge ?? null) as string | null;
  items.push({
    id: "rappel-prelevement",
    nom: "Rappel de prélèvement (J-3)",
    frequence: "Quotidienne (envoi à J-3)",
    dernierPassage: dernierRappel,
    dernierDetail: dernierRappel ? `Dernier prélèvement annoncé : ${dernierRappel}` : null,
    prochaineLibelle: "chaque jour",
    statut: calculerStatut({
      actif: true,
      tracable: Boolean(dernierRappel),
      dernierPassage: dernierRappel,
      toleranceJours: 40,
    }),
    note: "Ne se déclenche que lorsqu'un prélèvement est imminent : les longs silences sont normaux.",
  });

  const escaladeAuto = p.relance_auto_actif !== false;
  const prochainEscalade = prochainHoraire();
  items.push({
    id: "escalade-relances",
    nom: "Escalade automatique des relances",
    frequence: "Horaire",
    dernierPassage: (escaladeRun?.run_at ?? null) as string | null,
    dernierDetail: escaladeRun
      ? `${Number(escaladeRun.envoye ?? 0)} envoyée(s) · ${Number(escaladeRun.echoue ?? 0)} échec(s)`
      : null,
    prochaineLibelle: libelleEcheance(prochainEscalade),
    statut: calculerStatut({
      actif: escaladeAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: (escaladeRun?.run_at ?? null) as string | null,
      toleranceJours: 2,
      alertes: Number(escaladeRun?.echoue ?? 0) > 0 ? 1 : 0,
    }),
    note: Number(escaladeRun?.echoue ?? 0) > 0 ? "Le dernier passage a enregistré des échecs d'envoi." : null,
  });

  const recapQuotidienAuto = p.recap_quotidien_actif !== false;
  const prochainRecapQuot = prochainQuotidien(Number(p.recap_heure ?? 8));
  const dernierRecapQuot = ((recapQuot?.envoye_le ?? p.recap_dernier_envoi) ?? null) as string | null;
  items.push({
    id: "recap-quotidien",
    nom: "Récapitulatif quotidien",
    frequence: "Quotidienne",
    dernierPassage: dernierRecapQuot,
    dernierDetail: null,
    prochaineLibelle: libelleEcheance(prochainRecapQuot),
    statut: calculerStatut({
      actif: recapQuotidienAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: dernierRecapQuot,
      toleranceJours: 2,
    }),
    note: null,
  });

  const recapEnvoisAuto = p.envois_auto_recap_hebdo_actif === true;
  const prochainRecapEnvois = prochainHebdo(
    Number(p.envois_auto_recap_hebdo_jour ?? 1),
    Number(p.envois_auto_recap_hebdo_heure ?? 8),
  );
  items.push({
    id: "recap-hebdo-envois-auto",
    nom: "Récap hebdo des envois automatiques",
    frequence: "Hebdomadaire",
    dernierPassage: (p.envois_auto_recap_hebdo_dernier_envoi ?? null) as string | null,
    dernierDetail: null,
    prochaineLibelle: libelleEcheance(prochainRecapEnvois),
    statut: calculerStatut({
      actif: recapEnvoisAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: (p.envois_auto_recap_hebdo_dernier_envoi ?? null) as string | null,
      toleranceJours: 8,
    }),
    note: recapEnvoisAuto ? null : "Récap hebdo non activé depuis le tableau de bord.",
  });

  return items;
}

function buildEmailHtml(nom: string, items: AutoItem[], csvName: string, cc: string[] = []): string {
  const aJour = items.filter((i) => i.statut === "ok").length;
  const attention = items.filter((i) => i.statut === "attention");
  const inactifs = items.filter((i) => i.statut === "inactif").length;

  const lignes = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(i.nom)}<br><span style="font-size:11px;color:#a1a1aa;">${escapeHtml(i.frequence)}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:700;color:${STATUT_COLOR[i.statut]};">${escapeHtml(STATUT_LABEL[i.statut])}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;">${escapeHtml(i.dernierPassage ? frDate(i.dernierPassage) : "—")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#52525b;">${escapeHtml(i.prochaineLibelle)}</td>
      </tr>`,
    )
    .join("");

  const blocAttention =
    attention.length > 0
      ? `<p style="margin:16px 0 8px;font-size:13px;font-weight:700;color:#b91c1c;">À vérifier (${attention.length})</p>
      <ul style="margin:0 0 8px;padding-left:18px;">
        ${attention
          .map(
            (i) =>
              `<li style="font-size:13px;color:#3f3f46;margin-bottom:4px;"><strong>${escapeHtml(i.nom)}</strong>${
                i.note ? ` — ${escapeHtml(i.note)}` : ""
              }</li>`,
          )
          .join("")}
      </ul>`
      : `<p style="margin:16px 0 0;font-size:13px;line-height:1.7;color:#3f3f46;">Tout est à jour : aucune automatisation ne demande votre attention.</p>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap hebdomadaire de vos envois automatiques</p>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
          <tr>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:#0f766e;">${aJour}</div>
              <div style="font-size:11px;color:#71717a;">à jour</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${attention.length > 0 ? "#b91c1c" : "#18181b"};">${attention.length}</div>
              <div style="font-size:11px;color:#71717a;">à vérifier</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;text-align:center;">
              <div style="font-size:20px;font-weight:700;">${inactifs}</div>
              <div style="font-size:11px;color:#71717a;">inactive${inactifs > 1 ? "s" : ""}</div>
            </td>
          </tr>
        </table>
        ${blocAttention}
        <p style="margin:20px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Détail des automatisations</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Automatisation</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">État</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Dernier passage</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Prochaine</th>
          </tr></thead>
          <tbody>${lignes}</tbody>
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#71717a;line-height:1.6;">
          La synthèse complète est jointe au format CSV (${escapeHtml(csvName)}), ouvrable directement dans Excel.
        </p>
        ${cc.length > 0
          ? `<p style="margin:8px 0 0;font-size:12px;color:#71717a;line-height:1.6;">Une copie (Cc) est adressée à ${cc
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");

    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const preview = body?.preview === true;
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;
    const hourOverride = Number.isFinite(Number(body?.hour)) ? Number(body.hour) % 24 : null;
    const dayOverride = Number.isFinite(Number(body?.day)) ? ((Number(body.day) - 1 + 7) % 7) + 1 : null;
    const today = new Date().toISOString().slice(0, 10);

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
        "id, entreprise, metier, email, recontact_rappel_hebdo_actif, recontact_rappel_dernier_envoi, recap_quotidien_actif, recap_heure, recap_dernier_envoi, comptable_auto_actif, comptable_auto_jour, comptable_auto_heure, comptable_auto_dernier_mois, comptable_relance_manquante_actif, comptable_relance_dernier_cle, comptable_bilan_auto_actif, comptable_bilan_jour, comptable_bilan_dernier_annee, relance_auto_actif, pause_jusqu_au, envois_auto_recap_hebdo_actif, envois_auto_recap_hebdo_jour, envois_auto_recap_hebdo_heure, envois_auto_recap_hebdo_dernier_envoi, envois_auto_recap_hebdo_cc",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    // Mode aperçu : on construit l'email pour l'artisan ciblé et on le renvoie tel quel,
    // sans rien envoyer (et même si Resend n'est pas encore configuré), afin de valider
    // le rendu avant d'activer l'envoi.
    if (preview && scopeUserId) {
      const rawPrev = (profiles ?? [])[0];
      if (!rawPrev) return json({ ok: false, error: "Profil introuvable." }, 404);
      const pPrev = rawPrev as Record<string, unknown>;
      const nomPrev = String(pPrev.entreprise ?? pPrev.metier ?? "Votre artisan");
      const itemsPrev = await chargerItems(admin, scopeUserId, pPrev);
      const csvNamePrev = `envois-automatiques-${today}.csv`;
      const aVerifierPrev = itemsPrev.filter((i) => i.statut === "attention").length;
      const ccPrev = normalizeCc(pPrev.envois_auto_recap_hebdo_cc);
      const subjectPrev = `Récap hebdo des envois automatiques${aVerifierPrev > 0 ? ` · ${aVerifierPrev} à vérifier` : ""}`;
      return json({
        ok: true,
        preview: true,
        html: buildEmailHtml(nomPrev, itemsPrev, csvNamePrev, ccPrev),
        subject: subjectPrev,
        destinataires: 1 + ccPrev.length,
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
      const actif = p.envois_auto_recap_hebdo_actif === true;
      const enPause = p.pause_jusqu_au ? String(p.pause_jusqu_au).slice(0, 10) >= today : false;

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
          p.envois_auto_recap_hebdo_heure === null || p.envois_auto_recap_hebdo_heure === undefined
            ? 8
            : Number(p.envois_auto_recap_hebdo_heure);
        const jourChoisi =
          p.envois_auto_recap_hebdo_jour === null || p.envois_auto_recap_hebdo_jour === undefined
            ? 1
            : Number(p.envois_auto_recap_hebdo_jour);
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

      const items = await chargerItems(admin, userId, p);
      const csvName = `envois-automatiques-${today}.csv`;
      const csv = toCsv(
        ["Automatisation", "Statut", "Fréquence", "Dernier passage", "Détail du dernier passage", "Prochaine exécution", "Remarque"],
        items.map((i) => [
          i.nom,
          STATUT_LABEL[i.statut] ?? i.statut,
          i.frequence,
          i.dernierPassage ? frDate(i.dernierPassage) : "—",
          i.dernierDetail ?? "",
          i.prochaineLibelle,
          i.note ?? "",
        ]),
      );

      const aVerifier = items.filter((i) => i.statut === "attention").length;
      const subject = `Récap hebdo des envois automatiques${aVerifier > 0 ? ` · ${aVerifier} à vérifier` : ""}`;
      const ccList = normalizeCc(p.envois_auto_recap_hebdo_cc);

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${nom} <noreply@${fromDomain}>`,
            to: [email],
            cc: ccList.length ? ccList : undefined,
            subject,
            html: buildEmailHtml(nom, items, csvName, ccList),
            attachments: [{ filename: csvName, content: textToBase64(csv), content_type: "text/csv" }],
          }),
        });
        if (res.ok) {
          sent += 1;
          await admin
            .from("profiles")
            .update({ envois_auto_recap_hebdo_dernier_envoi: new Date().toISOString() })
            .eq("id", userId);
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
