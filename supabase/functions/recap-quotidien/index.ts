import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fonction de récapitulatif quotidien par email.
// Elle est prévue pour tourner SANS session utilisateur : appelée par une tâche
// planifiée (voir Agents → Tâches planifiées). Comme chaque artisan peut choisir son
// heure d'envoi, la tâche planifiée est appelée CHAQUE HEURE : chaque passage n'envoie
// qu'aux artisans dont l'heure choisie correspond à l'heure courante (défaut 08:00).
// Un appel avec `preview: true` renvoie simplement le HTML de l'email, sans rien envoyer.
//
// À chaque passage, elle rassemble pour chaque artisan :
//   - les reprogrammations de relances enregistrées récemment (relance_reprogrammations),
//   - les échecs d'envoi détectés récemment (journal d'escalade, table escalade_journal),
//   - les factures en retard (échéance dépassée et non payées),
//   - les devis sans réponse (envoyés depuis un moment et toujours sans décision).
// puis envoie UN email récapitulatif à l'artisan (via Resend).
//
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN
// dans les secrets du Backend (à activer depuis le panneau Resend).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Canaux pris en compte par défaut si l'artisan n'a rien choisi. */
const CANAUX_DEFAUT = ["Email", "SMS", "WhatsApp"];

/** Nombre de jours au-delà duquel un devis envoyé est considéré « sans réponse ». */
const DEVIS_SANS_REPONSE_JOURS = 7;

/** Heure d'envoi par défaut du rappel de la veille (heure de Paris) si non renseignée. */
const RAPPEL_HEURE_DEFAUT = 17;

/** Heure (Paris) du passage qui évalue l'alerte email sur le taux de réussite. */
const TAUX_ALERTE_HEURE = 8;

/** Seuil par défaut de l'alerte email sur le taux de réussite (%). */
const TAUX_ALERTE_SEUIL_DEFAUT = 70;

/** Fenêtre par défaut (jours) de l'alerte email sur le taux de réussite. */
const TAUX_ALERTE_JOURS_DEFAUT = 7;

/** Borne une valeur entre un minimum et un maximum. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

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

/** Renvoie la première ligne d'un résultat de jointure (tableau ou objet). */
function firstRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) ?? null;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

/** Formate une date en « 07 oct. 2026 ». */
function frDate(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Montant en euros (ex. « 1 250,00 € »). */
function frEuro(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/** Nombre de jours entiers écoulés depuis une date (ISO ou timestamp). */
function joursDepuis(value: unknown): number {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/** Date du jour (ISO, YYYY-MM-DD). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Date décalée de `days` jours (ISO, YYYY-MM-DD). */
function isoFromOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

/**
 * Email de rappel envoyé à l'artisan la veille d'une relance client programmée :
 * il peut ainsi revoir le message (ou annuler la relance) avant l'envoi automatique.
 */
function buildRelanceRappelHtml(
  nom: string,
  items: Array<{ client: string; datePrevue: string; message: string }>,
): string {
  const lignes = items
    .map(
      (it) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(
          it.client,
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#52525b;">${escapeHtml(
          it.datePrevue ? frDate(it.datePrevue) : "—",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:#71717a;">${escapeHtml(
          it.message || "Message par défaut du profil",
        )}</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e5e5;padding:24px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;">${escapeHtml(nom)}</p>
      <div style="display:inline-block;margin-top:8px;padding:6px 12px;border-radius:999px;background:#ccfbf1;color:#0f766e;font-size:12px;font-weight:700;">
        Rappel avant envoi
      </div>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#3f3f46;">
        ${items.length} relance${items.length > 1 ? "s" : ""} client${items.length > 1 ? "s" : ""} ${items.length > 1 ? "sont programmées" : "est programmée"} pour <strong>demain</strong>. C'est le dernier moment pour revoir le message ou l'annuler : l'envoi partira automatiquement le jour venu.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:14px;">
        <thead><tr>
          <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Client</th>
          <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Envoi prévu</th>
          <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Message</th>
        </tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">Rappel automatique envoyé par ArtiFlow-pro depuis votre tableau de bord (widget « Relances programmées »).</p>
    </div>
  </div>
</body></html>`;
}

/**
 * Heure courante (0-23) à l'heure de Paris. La tâche planifiée tourne chaque heure et
 * n'envoie qu'aux artisans dont l'heure d'envoi correspond, ce qui permet à chacun de
 * choisir son créneau tout en gardant un seul passage planifié côté serveur.
 */
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
    /* repli sur l'heure serveur */
  }
  return new Date().getHours();
}

/** Un devis est « sans réponse » s'il a été envoyé puis jamais tranché par le client. */
function isDevisSansReponse(statut: unknown): boolean {
  const v = String(statut ?? "").trim().toLowerCase();
  return v.includes("envoy") || v.includes("relanc");
}

/** Une facture est « en retard » si elle est émise (non payée) et son échéance est dépassée. */
function isFactureEnRetard(statut: unknown): boolean {
  const v = String(statut ?? "").trim().toLowerCase();
  if (v.includes("pay") || v.includes("régl") || v.includes("regl")) return false;
  if (v.includes("brouillon") || v.includes("annul") || v.includes("avoir")) return false;
  return true;
}

/**
 * Construit l'email de rappel envoyé au client d'une facture critique lors de la
 * relance automatique déclenchée par le récap quotidien (sans clic manuel).
 */
function buildReminderHtml(
  emetteurNom: string,
  clientNom: string,
  numero: string,
  montant: string,
  echeance: string,
  jours: number,
): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">
          Rappel de paiement
        </div>
        <p style="margin:16px 0 12px;font-size:15px;">Bonjour ${escapeHtml(clientNom || "")},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">Nous vous rappelons que la facture <strong>${escapeHtml(
          numero,
        )}</strong> d'un montant de <strong>${escapeHtml(
          montant,
        )}</strong> reste en attente de règlement (échéance du ${escapeHtml(echeance)}).</p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Facture : <strong style="color:#18181b;">${escapeHtml(numero)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Montant total TTC : <strong style="color:#18181b;">${escapeHtml(montant)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Échéance : <strong style="color:#18181b;">${escapeHtml(echeance)}</strong></p>
          <p style="margin:0;color:#b45309;">Retard : <strong>${jours} jour${jours > 1 ? "s" : ""}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Si le règlement a déjà été effectué, merci de ne pas tenir compte de ce message. Nous restons à votre disposition pour toute question.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Rappel envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Construit l'email d'alerte envoyé à l'artisan quand le taux de réussite des emails de
 * test reste sous le seuil choisi pendant la fenêtre réglée.
 */
function buildAlerteTauxHtml(
  nom: string,
  taux: number,
  seuil: number,
  jours: number,
  total: number,
  echecs: number,
): string {
  const couleur = taux >= seuil ? "#0f766e" : "#b91c1c";
  const fond = taux >= seuil ? "#ccfbf1" : "#fee2e2";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Alerte taux de réussite · ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${fond};color:${couleur};font-size:12px;font-weight:700;">
          Taux sous le seuil
        </div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Sur les <strong>${jours} derniers jours</strong>, votre taux de réussite des emails de test est de
          <strong style="color:${couleur};">${taux}%</strong>, soit sous le seuil de <strong>${seuil}%</strong>
          que vous avez défini.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Taux de réussite (${jours} j) : <strong style="color:#18181b;">${taux}%</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Emails de test sur la période : <strong style="color:#18181b;">${total}</strong></p>
          <p style="margin:0;color:${couleur};">Échecs : <strong>${echecs}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Vérifiez la configuration d'envoi d'emails d'ArtiFlow-pro (clé Resend et domaine vérifié), puis
          relancez un test.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Alerte automatique envoyée par ArtiFlow-pro.
      </div>
    </div>
  </div>
</body></html>`;
}

/** Applique un modèle de message contenant des variables type {{client}}. */
function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => values[key.toLowerCase()] ?? "");
}

/** Construit l'email d'une relance client programmée (identité artisan + corps personnalisé). */
function buildClientRelanceHtml(emetteurNom: string, contactLine: string, messageHtml: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        ${contactLine ? `<p style="margin:6px 0 0;font-size:13px;color:#71717a;">${contactLine}</p>` : ""}
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">${messageHtml}</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

/** Construit un en-tête de table homogène. */
function tableHead(cols: Array<{ label: string; right?: boolean }>): string {
  return `<tr>${cols
    .map(
      (c) =>
        `<th style="text-align:${c.right ? "right" : "left"};padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">${escapeHtml(
          c.label,
        )}</th>`,
    )
    .join("")}</tr>`;
}

interface ReproLine {
  client: string;
  numero: string;
  canal: string;
  ancienne: string | null;
  nouvelle: string | null;
  at: string;
}

interface EchecLine {
  client: string;
  canal: string;
  numero: string;
  erreur: string;
  at: string;
}

interface FactureLine {
  factureId: number;
  clientId: number | null;
  email: string;
  client: string;
  numero: string;
  montant: number;
  echeance: string | null;
  jours: number;
}

interface DevisLine {
  client: string;
  numero: string;
  montant: number;
  created: string | null;
  jours: number;
}

/** Construit l'email récapitulatif quotidien. */
function buildRecapHtml(
  nom: string,
  repros: ReproLine[],
  echecs: EchecLine[],
  facturesEnRetard: FactureLine[],
  devisSansReponse: DevisLine[],
  windowLabel: string,
  autoRelances: FactureLine[] = [],
  autoSeuil = 30,
): string {
  const blocRepros =
    repros.length > 0
      ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Reprogrammations (${repros.length})</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>${tableHead([{ label: "Client" }, { label: "Devis" }, { label: "Canal" }, { label: "Report" }])}</thead>
        <tbody>
          ${repros
            .map(
              (r) => `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(
              r.client || "Client",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#52525b;">${escapeHtml(
              r.numero || "—",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#52525b;">${escapeHtml(
              r.canal || "Email",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#52525b;">${escapeHtml(
              r.ancienne ? frDate(r.ancienne) : "Sans date",
            )} → ${escapeHtml(r.nouvelle ? frDate(r.nouvelle) : "Sans date")}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  const blocFactures =
    facturesEnRetard.length > 0
      ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#b45309;">Factures en retard (${facturesEnRetard.length})</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>${tableHead([
          { label: "Client" },
          { label: "Facture" },
          { label: "Échéance" },
          { label: "Retard", right: true },
        ])}</thead>
        <tbody>
          ${facturesEnRetard
            .map(
              (f) => `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #fef3c7;font-size:13px;color:#18181b;">${escapeHtml(
              f.client || "Client",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fef3c7;font-size:13px;color:#52525b;">${escapeHtml(
              f.numero || "—",
            )} · ${escapeHtml(frEuro(f.montant))}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fef3c7;font-size:13px;color:#52525b;">${escapeHtml(
              f.echeance ? frDate(f.echeance) : "—",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fef3c7;font-size:13px;text-align:right;color:#b45309;font-weight:600;">${f.jours} j</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  const blocDevis =
    devisSansReponse.length > 0
      ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#0f766e;">Devis sans réponse (${devisSansReponse.length})</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>${tableHead([
          { label: "Client" },
          { label: "Devis" },
          { label: "Envoyé le" },
          { label: "Silence", right: true },
        ])}</thead>
        <tbody>
          ${devisSansReponse
            .map(
              (d) => `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #ccfbf1;font-size:13px;color:#18181b;">${escapeHtml(
              d.client || "Client",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #ccfbf1;font-size:13px;color:#52525b;">${escapeHtml(
              d.numero || "—",
            )} · ${escapeHtml(frEuro(d.montant))}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #ccfbf1;font-size:13px;color:#52525b;">${escapeHtml(
              d.created ? frDate(d.created) : "—",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #ccfbf1;font-size:13px;text-align:right;color:#0f766e;font-weight:600;">${d.jours} j</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  const blocEchecs =
    echecs.length > 0
      ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#b91c1c;">Échecs détectés (${echecs.length})</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>${tableHead([{ label: "Client" }, { label: "Dossier" }, { label: "Canal" }, { label: "Motif" }])}</thead>
        <tbody>
          ${echecs
            .map(
              (e) => `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#b91c1c;">${escapeHtml(
              e.client || "Client",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#52525b;">${escapeHtml(
              e.numero || "—",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#52525b;">${escapeHtml(
              e.canal || "Email",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:12px;color:#b91c1c;">${escapeHtml(
              e.erreur || "Envoi impossible.",
            )}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  const blocAuto =
    autoRelances.length > 0
      ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#0f766e;">Relances automatiques envoyées (${autoRelances.length})</p>
      <p style="margin:0 0 8px;font-size:12px;color:#71717a;">Rappels envoyés automatiquement aux clients des factures critiques (+${autoSeuil} j), sans action de votre part.</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>${tableHead([
          { label: "Client" },
          { label: "Facture" },
          { label: "Montant" },
          { label: "Retard", right: true },
        ])}</thead>
        <tbody>
          ${autoRelances
            .map(
              (f) => `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #ccfbf1;font-size:13px;color:#18181b;">${escapeHtml(
              f.client || "Client",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #ccfbf1;font-size:13px;color:#52525b;">${escapeHtml(
              f.numero || "—",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #ccfbf1;font-size:13px;color:#52525b;">${escapeHtml(
              frEuro(f.montant),
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #ccfbf1;font-size:13px;text-align:right;color:#0f766e;font-weight:600;">${f.jours} j</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  const rien =
    repros.length === 0 &&
    echecs.length === 0 &&
    facturesEnRetard.length === 0 &&
    devisSansReponse.length === 0;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e5e5;padding:24px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;">${escapeHtml(nom)}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#71717a;">Récapitulatif quotidien ArtiFlow-pro · ${escapeHtml(
        windowLabel,
      )}</p>
      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;">
        ${repros.length} reprogrammation${repros.length > 1 ? "s" : ""} · ${echecs.length} échec${
          echecs.length > 1 ? "s" : ""
        } · ${facturesEnRetard.length} facture${facturesEnRetard.length > 1 ? "s" : ""} en retard · ${
          devisSansReponse.length
        } devis sans réponse
      </div>
      ${
        rien
          ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.7;color:#3f3f46;">Rien à signaler : aucune reprogrammation, échec, facture en retard ni devis sans réponse. Votre suivi est à jour.</p>`
          : `<p style="margin:14px 0 0;font-size:13px;line-height:1.7;color:#3f3f46;">Voici tout ce qui mérite votre attention aujourd'hui : reprogrammations, échecs, factures en retard et devis sans réponse.</p>`
      }
      ${blocFactures}
      ${blocDevis}
      ${blocEchecs}
      ${blocAuto}
      ${blocRepros}
      <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">Email automatique envoyé par ArtiFlow-pro (récapitulatif quotidien).</p>
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

    // `userId` optionnel : passé pour ne traiter qu'un artisan (test manuel).
    // Fenêtre du récapitulatif : 24 h par défaut. `force` envoie l'email même sans contenu.
    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const windowHours = Number(body?.windowHours ?? 24) > 0 ? Number(body.windowHours) : 24;
    const force = body?.force === true;
    // Aperçu : on renvoie le HTML de l'email sans rien envoyer (bouton « Aperçu »).
    const preview = body?.preview === true;
    // Filtrage horaire : ignorable pour forcer un passage (utile pour les tests).
    const ignoreHour = body?.ignoreHour === true;
    const hourOverride = Number.isFinite(Number(body?.hour)) ? Number(body.hour) % 24 : null;
    const since = new Date(Date.now() - windowHours * 3600000).toISOString();
    const windowLabel = windowHours === 24 ? "dernières 24 h" : `dernières ${windowHours} h`;
    const today = todayISO();

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Profils : destinataire (email) + nom d'affichage + réglages du récap
    //    (interrupteur par artisan, canaux, heure, pause vacances, dernier envoi).
    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, email, recap_quotidien_actif, recap_canaux, recap_heure, recap_devis_seuil, pause_jusqu_au, recap_dernier_envoi, relance_facture_auto_actif, relance_facture_seuil, relance_facture_delai_min, alerte_echec_test_email, taux_alerte_email_actif, taux_alerte_seuil, taux_alerte_jours, taux_alerte_dernier_envoi_at",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    // 2) Reprogrammations récentes (join relance → devis → user).
    const { data: reprosRaw, error: reproError } = await admin
      .from("relance_reprogrammations")
      .select("id, relance_id, ancienne_date, nouvelle_date, created_at, relances(canal, devis(user_id, numero, client_id))")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (reproError) return json({ ok: false, error: reproError.message }, 500);

    // 3) Échecs récents depuis le journal d'escalade.
    const { data: runsRaw, error: runsError } = await admin
      .from("escalade_journal")
      .select("id, user_id, run_at, envoye, echoue, clients_echoues")
      .gte("run_at", since);
    if (runsError) return json({ ok: false, error: runsError.message }, 500);

    // 4) Factures en retard : échéance dépassée et non payées.
    const { data: facturesRaw, error: facturesError } = await admin
      .from("factures")
      .select("id, user_id, numero, client_id, total_ttc, date_echeance, statut")
      .lt("date_echeance", today);
    if (facturesError) return json({ ok: false, error: facturesError.message }, 500);

    // 5) Devis sans réponse : envoyés (jamais tranchés par le client) et anciens.
    const { data: devisRaw, error: devisError } = await admin
      .from("devis")
      .select("id, user_id, numero, client_id, total_ht, created_at, statut");
    if (devisError) return json({ ok: false, error: devisError.message }, 500);

    // 6) Noms de clients (pour nommer reprogrammations, factures et devis).
    const clientIds = new Set<number>();
    (reprosRaw ?? []).forEach((raw) => {
      const rel = firstRow((raw as Record<string, unknown>).relances);
      const devisRow = firstRow(rel?.devis);
      if (devisRow?.client_id != null) clientIds.add(Number(devisRow.client_id));
    });
    (facturesRaw ?? []).forEach((raw) => {
      const f = raw as Record<string, unknown>;
      if (isFactureEnRetard(f.statut) && f.client_id != null) clientIds.add(Number(f.client_id));
    });
    (devisRaw ?? []).forEach((raw) => {
      const d = raw as Record<string, unknown>;
      if (isDevisSansReponse(d.statut) && d.client_id != null) clientIds.add(Number(d.client_id));
    });
    const clientsById = new Map<number, string>();
    const clientEmailById = new Map<number, string>();
    if (clientIds.size > 0) {
      const { data: clientsData } = await admin
        .from("clients")
        .select("id, nom, email")
        .in("id", [...clientIds]);
      (clientsData ?? []).forEach((c) => {
        const row = c as Record<string, unknown>;
        clientsById.set(Number(row.id), String(row.nom ?? "Client"));
        clientEmailById.set(Number(row.id), String(row.email ?? "").trim());
      });
    }
    const clientName = (id: unknown) => (id != null ? clientsById.get(Number(id)) ?? "Client" : "Client");
    const clientEmail = (id: unknown) =>
      id != null && Number.isFinite(Number(id)) ? clientEmailById.get(Number(id)) ?? "" : "";

    // 7) Regroupement par artisan.
    const reprosByUser = new Map<string, ReproLine[]>();
    (reprosRaw ?? []).forEach((raw) => {
      const row = raw as Record<string, unknown>;
      const rel = firstRow(row.relances);
      const devisRow = firstRow(rel?.devis);
      const userId = devisRow?.user_id ? String(devisRow.user_id) : null;
      if (!userId) return;
      const line: ReproLine = {
        client: clientName(devisRow?.client_id),
        numero: String(devisRow?.numero ?? ""),
        canal: String(rel?.canal ?? "Email"),
        ancienne: row.ancienne_date ? String(row.ancienne_date) : null,
        nouvelle: row.nouvelle_date ? String(row.nouvelle_date) : null,
        at: String(row.created_at ?? ""),
      };
      const arr = reprosByUser.get(userId) ?? [];
      arr.push(line);
      reprosByUser.set(userId, arr);
    });

    const echecsByUser = new Map<string, EchecLine[]>();
    (runsRaw ?? []).forEach((raw) => {
      const row = raw as Record<string, unknown>;
      const userId = row.user_id ? String(row.user_id) : null;
      if (!userId) return;
      const echoues = Array.isArray(row.clients_echoues)
        ? (row.clients_echoues as Array<Record<string, unknown>>)
        : [];
      if (echoues.length === 0) return;
      const arr = echecsByUser.get(userId) ?? [];
      echoues.forEach((e) => {
        arr.push({
          client: String(e?.nom ?? "Client"),
          canal: String(e?.canal ?? "Email"),
          numero: String(e?.numero ?? ""),
          erreur: String(e?.erreur ?? "Envoi impossible."),
          at: String(row.run_at ?? ""),
        });
      });
      echecsByUser.set(userId, arr);
    });

    // Factures en retard regroupées par artisan (les plus anciennes d'abord).
    const facturesByUser = new Map<string, FactureLine[]>();
    (facturesRaw ?? []).forEach((raw) => {
      const f = raw as Record<string, unknown>;
      const userId = f.user_id ? String(f.user_id) : null;
      if (!userId || !isFactureEnRetard(f.statut)) return;
      const echeance = f.date_echeance ? String(f.date_echeance) : null;
      const arr = facturesByUser.get(userId) ?? [];
      arr.push({
        factureId: Number(f.id),
        clientId: f.client_id != null ? Number(f.client_id) : null,
        email: clientEmail(f.client_id),
        client: clientName(f.client_id),
        numero: String(f.numero ?? ""),
        montant: Number(f.total_ttc ?? 0),
        echeance,
        jours: echeance ? joursDepuis(echeance) : 0,
      });
      facturesByUser.set(userId, arr);
    });
    facturesByUser.forEach((arr) => arr.sort((a, b) => b.jours - a.jours));

    // Devis sans réponse regroupés par artisan (les plus anciens d'abord).
    const devisByUser = new Map<string, DevisLine[]>();
    (devisRaw ?? []).forEach((raw) => {
      const d = raw as Record<string, unknown>;
      const userId = d.user_id ? String(d.user_id) : null;
      if (!userId || !isDevisSansReponse(d.statut)) return;
      const jours = joursDepuis(d.created_at);
      // Le seuil de jours est appliqué par artisan plus bas (réglable 7 / 14 / 21 j).
      const arr = devisByUser.get(userId) ?? [];
      arr.push({
        client: clientName(d.client_id),
        numero: String(d.numero ?? ""),
        montant: Number(d.total_ht ?? 0),
        created: d.created_at ? String(d.created_at) : null,
        jours,
      });
      devisByUser.set(userId, arr);
    });
    devisByUser.forEach((arr) => arr.sort((a, b) => b.jours - a.jours));

    // Anti-doublon de la relance auto : dernière relance connue par facture, afin
    // de ne pas rappeler deux fois le même client rapproché (délai réglable par artisan).
    const factureIdsForDelai = new Set<number>();
    facturesByUser.forEach((arr) => arr.forEach((f) => factureIdsForDelai.add(f.factureId)));
    const lastRelanceByFacture = new Map<number, number>();
    if (factureIdsForDelai.size > 0) {
      const { data: relRows } = await admin
        .from("relance_facture_envois")
        .select("facture_id, envoye_le")
        .in("facture_id", [...factureIdsForDelai]);
      (relRows ?? []).forEach((row) => {
        const r = row as Record<string, unknown>;
        const fid = Number(r.facture_id);
        const t = new Date(String(r.envoye_le ?? "")).getTime();
        if (Number.isFinite(fid) && Number.isFinite(t)) {
          const prev = lastRelanceByFacture.get(fid);
          if (prev === undefined || t > prev) lastRelanceByFacture.set(fid, t);
        }
      });
    }

    const usersProcessed = scopeUserId ? 1 : (profiles ?? []).length;
    const canSend = Boolean(resendKey && fromDomain);

    // Relances client programmées par l'artisan : traitées à chaque passage planifié.
    // On ne le fait jamais en test manuel ni en aperçu. Chaque relance due est envoyée
    // puis marquée « Envoyée » (idempotent), et la fiche client est horodatée.
    let relancesClientEnvoyees = 0;
    if (canSend && !scopeUserId && !preview && !force) {
      const { data: dues } = await admin
        .from("relances_client")
        .select("id, user_id, client_id, message, date_prevue")
        .eq("statut", "Programmée")
        .lte("date_prevue", today);
      const dueList = (dues ?? []) as Array<Record<string, unknown>>;
      if (dueList.length > 0) {
        const clientIdsDue = [
          ...new Set(dueList.map((d) => Number(d.client_id)).filter((v) => Number.isFinite(v))),
        ];
        const userIdsDue = [...new Set(dueList.map((d) => String(d.user_id)))];
        const clientMapDue = new Map<number, { nom: string; email: string }>();
        if (clientIdsDue.length > 0) {
          const { data: clientsDue } = await admin.from("clients").select("id, nom, email").in("id", clientIdsDue);
          (clientsDue ?? []).forEach((c) => {
            const row = c as Record<string, unknown>;
            clientMapDue.set(Number(row.id), {
              nom: String(row.nom ?? ""),
              email: String(row.email ?? "").trim(),
            });
          });
        }
        const profMapDue = new Map<string, Record<string, unknown>>();
        if (userIdsDue.length > 0) {
          const { data: profsDue } = await admin
            .from("profiles")
            .select("id, entreprise, metier, telephone, email, email_sujet_relance, email_corps_relance")
            .in("id", userIdsDue);
          (profsDue ?? []).forEach((p) => {
            const row = p as Record<string, unknown>;
            profMapDue.set(String(row.id), row);
          });
        }

        for (const d of dueList) {
          const relanceId = Number(d.id);
          const clientIdDue = Number(d.client_id);
          const userIdDue = String(d.user_id);
          const clientDue = clientMapDue.get(clientIdDue);
          if (!clientDue || !clientDue.email) {
            await admin
              .from("relances_client")
              .update({ statut: "Échec", motif_echec: "Ce client n'a pas d'adresse email." })
              .eq("id", relanceId);
            continue;
          }
          const pd = profMapDue.get(userIdDue) ?? {};
          const nomDue = String(pd.entreprise ?? pd.metier ?? "Votre artisan");
          const contactDue = [pd.telephone, pd.email].filter(Boolean).map((v) => escapeHtml(v)).join(" · ");
          const valuesDue: Record<string, string> = { client: clientDue.nom, entreprise: nomDue };
          const corpsModele = String(pd.email_corps_relance ?? "").trim();
          // Le message ponctuel saisi à la programmation est prioritaire.
          const messageDue =
            String(d.message ?? "").trim() ||
            (corpsModele
              ? applyTemplate(corpsModele, valuesDue)
              : `Bonjour ${clientDue.nom}, je me permets de vous recontacter au sujet de notre dossier.`);
          const messageHtmlDue = escapeHtml(messageDue).replace(/\n/g, "<br>");
          const sujetModele = String(pd.email_sujet_relance ?? "").trim();
          const subjectDue = sujetModele ? applyTemplate(sujetModele, valuesDue) : `Un mot de ${nomDue}`;
          try {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: `${nomDue} <noreply@${fromDomain}>`,
                to: [clientDue.email],
                subject: subjectDue,
                html: buildClientRelanceHtml(nomDue, contactDue, messageHtmlDue),
              }),
            });
            if (!r.ok) {
              const errData = (await r.json().catch(() => null)) as { message?: string } | null;
              await admin
                .from("relances_client")
                .update({ statut: "Échec", motif_echec: errData?.message || "Envoi refusé par Resend." })
                .eq("id", relanceId);
              continue;
            }
            const nowIso = new Date().toISOString();
            await admin.from("relances_client").update({ statut: "Envoyée", envoye_le: nowIso }).eq("id", relanceId);
            await admin.from("clients").update({ derniere_relance_at: nowIso }).eq("id", clientIdDue);
            await admin.from("envois_email").insert({
              user_id: userIdDue,
              facture_id: null,
              devis_id: null,
              relance_id: null,
              type: "relance",
              canal: "email",
              groupe: false,
              destinataire: clientDue.email,
              sujet: subjectDue,
            });
            relancesClientEnvoyees += 1;
          } catch (err) {
            await admin
              .from("relances_client")
              .update({
                statut: "Échec",
                motif_echec: err instanceof Error ? err.message : "Erreur inconnue lors de l'envoi.",
              })
              .eq("id", relanceId);
          }
        }
      }
    }

    // Rappel à l'artisan la veille d'une relance client programmée : il peut ainsi la revoir
    // (modifier le message ou l'annuler) avant l'envoi automatique du lendemain.
    // Un seul rappel par relance (colonne rappel_envoye_le), sur les passages planifiés.
    let rappelsRelanceEnvoyes = 0;
    if (canSend && !scopeUserId && !preview && !force) {
      const tomorrow = isoFromOffset(1);
      const { data: aRappeler } = await admin
        .from("relances_client")
        .select("id, user_id, client_id, date_prevue, message")
        .eq("statut", "Programmée")
        .eq("date_prevue", tomorrow)
        .is("rappel_envoye_le", null);
      const rappelList = (aRappeler ?? []) as Array<Record<string, unknown>>;
      if (rappelList.length > 0) {
        // Regroupe les relances du lendemain par artisan (un seul email par artisan).
        const byUser = new Map<string, Array<{ clientId: number; datePrevue: string; message: string }>>();
        rappelList.forEach((r) => {
          const uid = String(r.user_id);
          const arr = byUser.get(uid) ?? [];
          arr.push({
            clientId: Number(r.client_id),
            datePrevue: String(r.date_prevue ?? ""),
            message: String(r.message ?? ""),
          });
          byUser.set(uid, arr);
        });
        // Destinataires : nom d'affichage + email de l'artisan.
        const uidList = [...byUser.keys()];
        const { data: profsRappel } = await admin
          .from("profiles")
          .select("id, entreprise, metier, email, rappel_relance_actif, rappel_relance_heure")
          .in("id", uidList);
        const profRappelById = new Map<string, Record<string, unknown>>();
        (profsRappel ?? []).forEach((p) => {
          const row = p as Record<string, unknown>;
          profRappelById.set(String(row.id), row);
        });
        // Noms des clients concernés par les relances du lendemain.
        const clientIdsRappel = [
          ...new Set(rappelList.map((r) => Number(r.client_id)).filter((v) => Number.isFinite(v))),
        ];
        const nomClientRappel = new Map<number, string>();
        if (clientIdsRappel.length > 0) {
          const { data: cliR } = await admin.from("clients").select("id, nom").in("id", clientIdsRappel);
          (cliR ?? []).forEach((c) => {
            const row = c as Record<string, unknown>;
            nomClientRappel.set(Number(row.id), String(row.nom ?? "Client"));
          });
        }

        for (const [uid, lignes] of byUser.entries()) {
          const prof = profRappelById.get(uid) ?? {};
          // Réglage de l'artisan : rappel coupé, ou heure d'envoi différente de l'heure courante.
          const rappelActif = prof.rappel_relance_actif !== false;
          const rappelHeure =
            prof.rappel_relance_heure === null || prof.rappel_relance_heure === undefined
              ? RAPPEL_HEURE_DEFAUT
              : Number(prof.rappel_relance_heure);
          const cibleRappel = hourOverride ?? parisHour();
          if (!rappelActif || rappelHeure !== cibleRappel) continue;
          const artisanEmail = String(prof.email ?? "").trim();
          if (!artisanEmail) continue;
          const artisanNom = String(prof.entreprise ?? prof.metier ?? "Votre artisan");
          const items = lignes.map((l) => ({
            client: nomClientRappel.get(l.clientId) ?? "Client",
            datePrevue: l.datePrevue,
            message: l.message,
          }));
          const sujet = `Rappel : ${items.length} relance${items.length > 1 ? "s" : ""} programmée${
            items.length > 1 ? "s" : ""
          } demain`;
          try {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: `${artisanNom} <noreply@${fromDomain}>`,
                to: [artisanEmail],
                subject: sujet,
                html: buildRelanceRappelHtml(artisanNom, items),
              }),
            });
            if (!r.ok) continue;
            // Marque le rappel comme envoyé pour ne pas le répéter au passage suivant.
            const idsRappel = rappelList
              .filter((r2) => String(r2.user_id) === uid)
              .map((r2) => Number(r2.id))
              .filter((v) => Number.isFinite(v));
            if (idsRappel.length > 0) {
              await admin
                .from("relances_client")
                .update({ rappel_envoye_le: new Date().toISOString() })
                .in("id", idsRappel);
            }
            rappelsRelanceEnvoyes += 1;
          } catch {
            /* un rappel qui échoue n'empêche pas le reste */
          }
        }
      }
    }

    let sent = 0;
    let skipped = 0;
    let previewHtml: string | null = null;
    let previewSubject = "";
    let previewRepros = 0;
    let previewEchecs = 0;
    let previewFactures = 0;
    let previewDevis = 0;
    const details: Array<{
      userId: string;
      repros: number;
      echecs: number;
      factures: number;
      devis: number;
      sent: boolean;
      reason?: string;
    }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const email = String(p.email ?? "").trim();
      const nom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      // Interrupteur par artisan : par défaut activé si la colonne n'est pas renseignée.
      const actif = p.recap_quotidien_actif !== false;
      // Pause vacances : ne coupe que les passages planifiés (les tests manuels et l'aperçu restent possibles).
      const enPause = p.pause_jusqu_au ? String(p.pause_jusqu_au).slice(0, 10) >= today : false;
      // Canaux choisis par l'artisan (liste vide ou absente = tous les canaux).
      const canauxChoisis =
        Array.isArray(p.recap_canaux) && (p.recap_canaux as unknown[]).length > 0
          ? (p.recap_canaux as unknown[]).map((c) => String(c).toLowerCase())
          : CANAUX_DEFAUT.map((c) => c.toLowerCase());
      const inCanaux = (canal: string) => canauxChoisis.includes(String(canal || "Email").toLowerCase());
      const repros = (reprosByUser.get(userId) ?? []).filter((r) => inCanaux(r.canal));
      const echecs = (echecsByUser.get(userId) ?? []).filter((e) => inCanaux(e.canal));
      // Seuil « devis sans réponse » réglable par artisan (défaut 7 jours).
      const devisSeuil =
        Number.isFinite(Number(p.recap_devis_seuil)) && Number(p.recap_devis_seuil) > 0
          ? Number(p.recap_devis_seuil)
          : DEVIS_SANS_REPONSE_JOURS;
      // Relance automatique des factures critiques : réglage par artisan (défaut activé),
      // seuil en jours de retard (défaut 30). Coupée par la pause vacances et l'interrupteur du récap.
      const relanceFactureAuto = p.relance_facture_auto_actif !== false;
      const seuilAutoFacture =
        Number.isFinite(Number(p.relance_facture_seuil)) && Number(p.relance_facture_seuil) > 0
          ? Number(p.relance_facture_seuil)
          : 30;
      // Délai anti-doublon (jours) propre à l'artisan : pas deux rappels rapprochés d'une même facture.
      const delaiAutoFacture =
        Number.isFinite(Number(p.relance_facture_delai_min)) && Number(p.relance_facture_delai_min) >= 0
          ? Number(p.relance_facture_delai_min)
          : 14;
      // Factures et devis ne dépendent pas d'un canal : toujours inclus.
      const factures = facturesByUser.get(userId) ?? [];
      const devis = (devisByUser.get(userId) ?? []).filter((d) => d.jours >= devisSeuil);
      const hasContent = repros.length > 0 || echecs.length > 0 || factures.length > 0 || devis.length > 0;
      const nbFactures = factures.length;
      const nbDevis = devis.length;

      // Récap coupé pour cet artisan : on saute (sauf test manuel forcé).
      if (!actif && !force) {
        skipped += 1;
        details.push({ userId, repros: repros.length, echecs: echecs.length, factures: nbFactures, devis: nbDevis, sent: false, reason: "Récap coupé." });
        continue;
      }

      // Pause vacances : on suspend l'envoi automatique (mais un test manuel reste possible).
      if (enPause && !force && !preview) {
        skipped += 1;
        details.push({ userId, repros: repros.length, echecs: echecs.length, factures: nbFactures, devis: nbDevis, sent: false, reason: "Pause vacances." });
        continue;
      }

      // Filtrage par heure d'envoi choisie par l'artisan : ne s'applique qu'aux passages
      // planifiés (sans userId) et hors test manuel / aperçu. Avec une tâche planifiée
      // horaire, chacun reçoit son récap à l'heure qu'il a choisie (défaut 08:00).
      if (!scopeUserId && !ignoreHour && !preview) {
        const cible = hourOverride ?? parisHour();
        const heureChoisie = p.recap_heure === null || p.recap_heure === undefined ? 8 : Number(p.recap_heure);
        if (heureChoisie !== cible) {
          details.push({ userId, repros: repros.length, echecs: echecs.length, factures: nbFactures, devis: nbDevis, sent: false });
          continue;
        }
      }

      // On n'envoie que s'il y a du contenu (sauf mode forcé pour un test manuel).
      if (!hasContent && !force) {
        details.push({ userId, repros: 0, echecs: 0, factures: 0, devis: 0, sent: false });
        continue;
      }
      // Mode aperçu : on construit l'email sans l'envoyer et on le renvoie au client.
      if (preview) {
        previewHtml = buildRecapHtml(nom, repros, echecs, factures, devis, windowLabel);
        previewSubject = `Récapitulatif quotidien · ${repros.length} reprog., ${echecs.length} échec, ${nbFactures} facture, ${nbDevis} devis`;
        previewRepros = repros.length;
        previewEchecs = echecs.length;
        previewFactures = nbFactures;
        previewDevis = nbDevis;
        details.push({ userId, repros: repros.length, echecs: echecs.length, factures: nbFactures, devis: nbDevis, sent: false });
        continue;
      }

      if (!canSend || !email) {
        skipped += 1;
        details.push({ userId, repros: repros.length, echecs: echecs.length, factures: nbFactures, devis: nbDevis, sent: false, reason: !email ? "Email manquant." : "Resend non configuré." });
        continue;
      }

      // Relance automatique des factures critiques (déclenchée par le récap, sans clic manuel).
      // Uniquement sur les passages planifiés : jamais pendant un test manuel ni un aperçu.
      const autoRelances: FactureLine[] = [];
      if (relanceFactureAuto && !preview && !force) {
        const critiques = factures.filter((f) => {
          if (f.jours < seuilAutoFacture || !f.email) return false;
          if (delaiAutoFacture <= 0) return true;
          const last = lastRelanceByFacture.get(f.factureId);
          return last === undefined || Date.now() - last >= delaiAutoFacture * 86400000;
        });
        for (const f of critiques) {
          const rappelSubject = `Rappel : facture ${f.numero} en attente de règlement`;
          try {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: `${nom} <noreply@${fromDomain}>`,
                to: [f.email],
                subject: rappelSubject,
                html: buildReminderHtml(
                  nom,
                  f.client,
                  f.numero,
                  frEuro(f.montant),
                  f.echeance ? frDate(f.echeance) : "—",
                  f.jours,
                ),
              }),
            });
            if (!r.ok) continue;
            await admin.from("envois_email").insert({
              user_id: userId,
              facture_id: f.factureId,
              devis_id: null,
              relance_id: null,
              type: "relance",
              canal: "email",
              groupe: false,
              destinataire: f.email,
              sujet: rappelSubject,
            });
            await admin.from("relance_facture_envois").insert({
              user_id: userId,
              facture_id: f.factureId,
              client_id: f.clientId,
              client_nom: f.client || "Client",
              numero: f.numero,
              montant: f.montant,
              jours_retard: f.jours,
              palier: seuilAutoFacture,
              auto: true,
            });
            autoRelances.push(f);
          } catch {
            /* une relance qui échoue n'empêche pas l'envoi du récap */
          }
        }
      }

      try {
        const html = buildRecapHtml(nom, repros, echecs, factures, devis, windowLabel, autoRelances, seuilAutoFacture);
        const subject = `Récapitulatif quotidien · ${repros.length} reprogrammation${
          repros.length > 1 ? "s" : ""
        }, ${echecs.length} échec${echecs.length > 1 ? "s" : ""}, ${nbFactures} facture${
          nbFactures > 1 ? "s" : ""
        } en retard, ${nbDevis} devis sans réponse${
          autoRelances.length > 0 ? `, ${autoRelances.length} relance${autoRelances.length > 1 ? "s" : ""} auto` : ""
        }`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${nom} <noreply@${fromDomain}>`,
            to: [email],
            subject,
            html,
          }),
        });
        if (res.ok) {
          sent += 1;
          // On horodate le dernier envoi réel pour l'afficher dans l'application.
          await admin
            .from("profiles")
            .update({ recap_dernier_envoi: new Date().toISOString() })
            .eq("id", userId);
          // On garde une trace horodatée de l'envoi (date + compteurs) pour l'historique.
          await admin.from("recap_envois").insert({
            user_id: userId,
            repros: repros.length,
            echecs: echecs.length,
            factures: nbFactures,
            devis: nbDevis,
          });
          details.push({ userId, repros: repros.length, echecs: echecs.length, factures: nbFactures, devis: nbDevis, sent: true });
        } else {
          skipped += 1;
          details.push({ userId, repros: repros.length, echecs: echecs.length, factures: nbFactures, devis: nbDevis, sent: false, reason: "Refus de Resend." });
        }
      } catch {
        skipped += 1;
        details.push({ userId, repros: repros.length, echecs: echecs.length, factures: nbFactures, devis: nbDevis, sent: false, reason: "Erreur d'envoi." });
      }
    }

    // Alerte email sur le taux de réussite : si le taux des N derniers jours (fenêtre réglée par
    // l'artisan) reste sous le seuil choisi, on prévient l'artisan. Un seul email par période
    // (anti-doublon 20 h), et uniquement sur le passage planifié de 8 h (heure de Paris).
    let alertesTauxEnvoyees = 0;
    if (canSend && !scopeUserId && !preview && !force) {
      const cibleTaux = hourOverride ?? parisHour();
      if (cibleTaux === TAUX_ALERTE_HEURE) {
        for (const raw of profiles ?? []) {
          const p = raw as Record<string, unknown>;
          if (p.taux_alerte_email_actif !== true) continue;
          const userId = String(p.id);
          const destinataire =
            String(p.alerte_echec_test_email ?? "").trim() || String(p.email ?? "").trim();
          if (!destinataire) continue;
          // Anti-doublon : pas plus d'une alerte par période de 20 h.
          const dernierTaux = p.taux_alerte_dernier_envoi_at
            ? new Date(String(p.taux_alerte_dernier_envoi_at)).getTime()
            : 0;
          if (dernierTaux && Date.now() - dernierTaux < 20 * 3600000) continue;
          const seuil = clamp(Number(p.taux_alerte_seuil ?? TAUX_ALERTE_SEUIL_DEFAUT), 1, 100);
          const jours = clamp(Number(p.taux_alerte_jours ?? TAUX_ALERTE_JOURS_DEFAUT), 1, 60);
          const depuisTaux = new Date(Date.now() - jours * 86400000).toISOString();
          const { data: testsTaux } = await admin
            .from("email_test_historique")
            .select("resultat")
            .eq("user_id", userId)
            .gte("created_at", depuisTaux);
          const lignesTaux = (testsTaux ?? []) as Array<Record<string, unknown>>;
          // Sans aucun test sur la période, on ne peut rien conclure : on n'alerte pas.
          if (lignesTaux.length === 0) continue;
          const succesTaux = lignesTaux.filter((r) => String(r.resultat ?? "") === "succes").length;
          const totalTaux = lignesTaux.length;
          const echecsTaux = totalTaux - succesTaux;
          const tauxTaux = Math.round((succesTaux / totalTaux) * 100);
          if (tauxTaux >= seuil) continue;
          const nomTaux = String(p.entreprise ?? p.metier ?? "Votre artisan");
          const sujetTaux = `Alerte ArtiFlow-pro : taux de réussite à ${tauxTaux}% (sous ${seuil}%)`;
          try {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: `${nomTaux} <noreply@${fromDomain}>`,
                to: [destinataire],
                subject: sujetTaux,
                html: buildAlerteTauxHtml(nomTaux, tauxTaux, seuil, jours, totalTaux, echecsTaux),
              }),
            });
            if (!r.ok) continue;
            await admin
              .from("profiles")
              .update({ taux_alerte_dernier_envoi_at: new Date().toISOString() })
              .eq("id", userId);
            // Journalise l'alerte envoyee (marque « automatique ») pour l'historique.
            await admin.from("taux_alerte_historique").insert({
              user_id: userId,
              taux: tauxTaux,
              seuil,
              jours,
              total: totalTaux,
              echecs: echecsTaux,
              manuel: false,
            });
            alertesTauxEnvoyees += 1;
          } catch {
            /* une alerte qui échoue n'empêche pas le reste */
          }
        }
      }
    }

    return json({
      ok: true,
      configured: canSend,
      window: windowLabel,
      users: usersProcessed,
      sent,
      skipped,
      relancesClient: relancesClientEnvoyees,
      rappelsRelance: rappelsRelanceEnvoyes,
      alertesTaux: alertesTauxEnvoyees,
      reason: canSend ? undefined : "Resend non configuré (clé API + domaine d'envoi).",
      html: previewHtml ?? undefined,
      subject: preview ? previewSubject : undefined,
      repros: preview ? previewRepros : undefined,
      echecs: preview ? previewEchecs : undefined,
      factures: preview ? previewFactures : undefined,
      devis: preview ? previewDevis : undefined,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});