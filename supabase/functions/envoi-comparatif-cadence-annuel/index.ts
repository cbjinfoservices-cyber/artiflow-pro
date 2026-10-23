import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import autoTableImport from "npm:jspdf-autotable@3.8.2";

// ENVOI ANNUEL automatique du PDF « COMPARATIF DE CADENCE » des récaps mensuels
// « mot de passe ancien » (fenêtre courante vs fenêtre précédente). Prévue pour tourner SANS
// session utilisateur, appelée par une tâche planifiée. Chaque passage n'envoie qu'en janvier,
// le jour choisi (4 par défaut) : on transmet alors au comptable le comparatif de cadence de
// l'exercice qui vient de s'achever, pour visualiser la régularité des récaps. Anti-doublon via
// mot_de_passe_comparatif_annuel_dernier. La fenêtre (6/12/24 mois) est lue dans le profil.
// Un appel avec { userId, force: true } (bouton « Tester ») envoie tout de suite le PDF à
// l'artisan, sans tenir compte du jour ni de l'anti-doublon.
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN.

const autoTable = autoTableImport as unknown as (
  doc: unknown,
  options: Record<string, unknown>,
) => void;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JOUR_ENVOI = 4; // jour de janvier
const HEURE_ENVOI = 7; // 07:00, heure de Paris

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [154, 120, 44];
const ROUGE: [number, number, number] = [201, 74, 58];
const BAR_PREC: [number, number, number] = [216, 205, 192];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type EnvoiEmailOptions = {
  nom: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
};

type ResultatEnvoiEmail = {
  ok: boolean;
  fournisseur: "brevo" | "resend" | "aucun";
  repli: boolean;
  id?: string;
  error?: string;
};

/**
 * Expédie un email en essayant Brevo, puis bascule automatiquement sur Resend si Brevo
 * refuse l'envoi ou ne répond pas : le comparatif de cadence annuel n'est jamais perdu à
 * cause d'un seul fournisseur. Chaque tentative est tracée pour la carte « Suivi des envois ».
 * `simulerEchecBrevo` force un échec Brevo (bouton « Tester le repli ») sans appeler Brevo.
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: EnvoiEmailOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  options?: { simulerEchecBrevo?: boolean },
): Promise<ResultatEnvoiEmail> {
  const tracer = async (fournisseur: string, statut: string, repli: boolean, message?: string) => {
    if (!admin) return;
    try {
      await admin
        .from("envoi_fournisseur_historique")
        .insert({ fonction, fournisseur, statut, repli, message: message ?? null });
    } catch {
      /* la trace ne doit jamais bloquer un envoi */
    }
  };

  const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.fr";
  let erreurBrevo = "";

  if (options?.simulerEchecBrevo) {
    erreurBrevo = "Test du repli : échec Brevo simulé volontairement.";
    await tracer("brevo", "echec", false, erreurBrevo);
  } else if (brevoKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: opts.nom, email: brevoFrom },
          to: opts.to.map((email) => ({ email })),
          cc: opts.cc && opts.cc.length ? opts.cc.map((email) => ({ email })) : undefined,
          subject: opts.subject,
          htmlContent: opts.html,
          attachment:
            opts.attachments && opts.attachments.length
              ? opts.attachments.map((a) => ({ name: a.filename, content: a.content }))
              : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { messageId?: string; message?: string } | null;
      if (res.ok) {
        await tracer("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo", repli: false, id: data?.messageId };
      }
      erreurBrevo = data?.message || `Brevo a refusé l'envoi (code ${res.status}).`;
      await tracer("brevo", "echec", false, erreurBrevo);
    } catch (e) {
      erreurBrevo = e instanceof Error ? e.message : "Brevo est injoignable.";
      await tracer("brevo", "echec", false, erreurBrevo);
    }
  } else {
    erreurBrevo = "Clé API Brevo absente.";
  }

  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

  if (resendKey && fromDomain) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${opts.nom} <noreply@${fromDomain}>`,
          to: opts.to,
          cc: opts.cc && opts.cc.length ? opts.cc : undefined,
          subject: opts.subject,
          html: opts.html,
          attachments: opts.attachments && opts.attachments.length ? opts.attachments : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (res.ok) {
        await tracer("resend", "succes", false);
        return { ok: true, fournisseur: "resend", repli: true, id: data?.id };
      }
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    }
  }

  return {
    ok: false,
    fournisseur: "aucun",
    repli: true,
    error: "Aucun service d'envoi configuré (Resend non paramétré).",
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Parties « jour / heure / année / mois » à l'heure de Paris. */
function parisParts(): { day: number; hour: number; year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  });
  try {
    const parts = fmt.formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
    return { day: get("day"), hour: get("hour") % 24, year: get("year"), month: get("month") };
  } catch {
    const now = new Date();
    return { day: now.getDate(), hour: now.getHours(), year: now.getFullYear(), month: now.getMonth() + 1 };
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Début (inclus) de la fenêtre des N derniers mois, calé au 1er du mois. */
function debutFenetreMois(mois: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() - (mois - 1));
  return d;
}

interface PointSerie {
  cle: string;
  label: string;
  total: number;
}

/**
 * Construit la série mensuelle des récaps à partir d'une liste d'envois déjà chargée.
 * `offsetFenetres` = 0 pour la fenêtre courante, 1 pour la fenêtre équivalente précédente.
 * Même logique que le graphe du Diagnostic, pour des chiffres identiques.
 */
function construireSerie(
  entrees: Array<{ created_at: string }>,
  mois: number,
  offsetFenetres: number,
): PointSerie[] {
  const debut = debutFenetreMois(mois * (offsetFenetres + 1));
  const compte = new Map<string, number>();
  entrees.forEach((e) => {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime()) || d < debut) return;
    const cle = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    compte.set(cle, (compte.get(cle) ?? 0) + 1);
  });
  const points: PointSerie[] = [];
  for (let i = 0; i < mois; i += 1) {
    const d = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
    const cle = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    points.push({
      cle,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      total: compte.get(cle) ?? 0,
    });
  }
  return points;
}

interface Emetteur {
  entreprise: string;
  metier?: string | null;
  telephone?: string | null;
  email?: string | null;
  siret?: string | null;
  tva?: string | null;
}

interface CellInfo {
  section: string;
  column: { index: number };
  cell: { raw: unknown; styles: Record<string, unknown> };
}

/**
 * Construit le PDF « comparatif de cadence » : en-tête émetteur, indicateurs (fenêtre
 * courante, fenêtre précédente, variation), un MINI-GRAPHE à barres (barres courantes vs
 * précédentes, mois par mois) puis le tableau détaillé. Document d'archivage annuel.
 */
function buildComparatifPdf(params: {
  emetteur: Emetteur;
  fenetre: number;
  annee: string;
  courant: PointSerie[];
  precedent: PointSerie[];
  totalCourant: number;
  totalPrecedent: number;
}): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const fenetre = params.fenetre;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("COMPARATIF DE CADENCE", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Récaps « mot de passe ancien » · fenêtre courante vs précédente", margin, 71);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(`Exercice ${params.annee}`, pageW - margin, 71, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(params.emetteur.entreprise || "Mon entreprise", margin, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    params.emetteur.metier,
    params.emetteur.telephone,
    params.emetteur.email,
    params.emetteur.siret ? `SIRET : ${params.emetteur.siret}` : null,
    params.emetteur.tva ? `N° TVA : ${params.emetteur.tva}` : null,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => doc.text(line, margin, 115 + i * 12));

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  const delta =
    params.totalPrecedent > 0
      ? Math.round(((params.totalCourant - params.totalPrecedent) / params.totalPrecedent) * 100)
      : null;

  // Indicateurs (3 encadrés).
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 50;
  const boxTop = dividerY + 18;
  const kpis: { label: string; value: string; couleur: [number, number, number] }[] = [
    { label: `${fenetre} DERNIERS MOIS`, value: String(params.totalCourant), couleur: ACCENT },
    { label: `${fenetre} MOIS PRÉCÉDENTS`, value: String(params.totalPrecedent), couleur: MUTED },
    {
      label: "VARIATION",
      value: delta === null ? "N/A" : `${delta > 0 ? "+" : ""}${delta} %`,
      couleur: delta !== null && delta < 0 ? ROUGE : ACCENT,
    },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(b.couleur[0], b.couleur[1], b.couleur[2]);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, boxTop + 18);
    doc.setFontSize(14);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 38);
  });

  // ---- Mini-graphe comparatif (barres courantes vs précédentes) ----
  const chartTitleY = boxTop + boxH + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Cadence mois par mois", margin, chartTitleY);

  const sw = 8;
  doc.setFillColor(BAR_PREC[0], BAR_PREC[1], BAR_PREC[2]);
  doc.rect(pageW - margin - 262, chartTitleY - 7, sw, sw, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(pageW - margin - 128, chartTitleY - 7, sw, sw, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${fenetre} mois précédents`, pageW - margin - 250, chartTitleY);
  doc.text("Période courante", pageW - margin - 116, chartTitleY);

  const chartX = margin;
  const chartW = pageW - margin * 2;
  const chartTop = chartTitleY + 12;
  const chartH = 118;
  const baseY = chartTop + chartH;
  const n = Math.max(params.courant.length, 1);
  const maxVal = Math.max(
    ...params.courant.map((p) => p.total),
    ...params.precedent.map((p) => p.total),
    1,
  );

  [0.25, 0.5, 0.75, 1].forEach((r) => {
    doc.setDrawColor(240, 237, 232);
    doc.setLineWidth(0.6);
    doc.line(chartX, baseY - chartH * r, chartX + chartW, baseY - chartH * r);
  });
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.8);
  doc.line(chartX, baseY, chartX + chartW, baseY);
  doc.line(chartX, chartTop, chartX, baseY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(String(maxVal), chartX - 4, chartTop + 3, { align: "right" });
  doc.text("0", chartX - 4, baseY, { align: "right" });

  const groupW = chartW / n;
  const pairW = Math.min(groupW * 0.6, 18);
  const barGap = 1.5;
  const barW = Math.max((pairW - barGap) / 2, 1.5);
  const leftPad = (groupW - (barW * 2 + barGap)) / 2;
  const usableH = chartH - 8;

  params.courant.forEach((p, i) => {
    const prec = params.precedent[i]?.total ?? 0;
    const gx = chartX + i * groupW + leftPad;
    const hPrec = (prec / maxVal) * usableH;
    const hCur = (p.total / maxVal) * usableH;
    if (prec > 0) {
      doc.setFillColor(BAR_PREC[0], BAR_PREC[1], BAR_PREC[2]);
      doc.rect(gx, baseY - hPrec, barW, hPrec, "F");
    } else {
      doc.setFillColor(232, 228, 222);
      doc.rect(gx, baseY - 2, barW, 2, "F");
    }
    if (p.total > 0) {
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.rect(gx + barW + barGap, baseY - hCur, barW, hCur, "F");
    } else {
      doc.setFillColor(232, 228, 222);
      doc.rect(gx + barW + barGap, baseY - 2, barW, 2, "F");
    }
    if (n <= 12 && p.total > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(String(p.total), gx + barW + barGap + barW / 2, baseY - hCur - 3, { align: "center" });
    }
    if (n <= 12 || i % 2 === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(p.label, gx + (barW * 2 + barGap) / 2, baseY + 11, { align: "center" });
    }
  });

  const y = baseY + 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail mois par mois", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${fenetre} derniers mois vs ${fenetre} mois précédents`, pageW - margin, y, { align: "right" });

  const body = params.courant.map((p, i) => {
    const prec = params.precedent[i]?.total ?? 0;
    const d = prec > 0 ? Math.round(((p.total - prec) / prec) * 100) : null;
    return [p.label, String(p.total), String(prec), d === null ? "N/A" : `${d > 0 ? "+" : ""}${d} %`];
  });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Mois", `${fenetre} derniers mois`, `${fenetre} mois précédents`, "Variation"]] as string[][],
    body: body.length ? body : [["—", "Aucune donnée", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      1: { halign: "right", cellWidth: 110 },
      2: { halign: "right", cellWidth: 110 },
      3: { halign: "right", cellWidth: 90 },
    },
    didParseCell: (data: CellInfo) => {
      if (data.section === "body" && data.column.index === 3) {
        const val = String(data.cell.raw ?? "");
        if (val.startsWith("+")) data.cell.styles.textColor = ACCENT;
        else if (val.startsWith("-")) data.cell.styles.textColor = ROUGE;
      }
    },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(1);
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Comparatif généré avec ArtiFlow-Pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

function buildEmailHtml(params: {
  nom: string;
  fenetre: number;
  annee: string;
  totalCourant: number;
  totalPrecedent: number;
  delta: number | null;
}): string {
  const { nom, fenetre, annee, totalCourant, totalPrecedent, delta } = params;
  const deltaLabel =
    delta === null ? "non calculable" : `${delta > 0 ? "+" : ""}${delta} %`;
  const deltaCouleur = delta !== null && delta < 0 ? "#b91c1c" : "#0f766e";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Comparatif de cadence des récaps mot de passe · exercice ${escapeHtml(annee)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Veuillez trouver ci-joint le <strong>comparatif de cadence</strong> des récapitulatifs de sécurité
          « mot de passe ancien » de l'exercice <strong>${escapeHtml(annee)}</strong>. Il compare les
          <strong>${fenetre} derniers mois</strong> aux <strong>${fenetre} mois précédents</strong>, mois par mois.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">${fenetre} derniers mois : <strong style="color:#18181b;">${totalCourant}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">${fenetre} mois précédents : <strong style="color:#18181b;">${totalPrecedent}</strong></p>
          <p style="margin:0;color:#71717a;">Variation : <strong style="color:${deltaCouleur};">${deltaLabel}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Le graphe et le détail mois par mois figurent dans le PDF joint. Nous restons à votre disposition pour toute question.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-Pro pour ${escapeHtml(nom)}.
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const simulerEchecBrevo = body?.simulerEchecBrevo === true;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    const force = body?.force === true;
    const ignoreTime = body?.ignoreTime === true;

    if (scopeUserId) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const authClient = createClient(supabaseUrl, anonKey ?? "", {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData } = await authClient.auth.getUser();
      if (!anonKey || userData?.user?.id !== scopeUserId) {
        return json({ ok: false, error: "Accès non autorisé." }, 401);
      }
    }

    const { day: todayDay, hour: todayHour, year, month } = parisParts();
    // Exercice clôturé : l'année qui vient de s'achever si l'on est en janvier, sinon l'année en cours.
    const anneeNum = month <= 1 ? year - 1 : year;
    const anneeStr = String(anneeNum);
    const canSend = Boolean((Deno.env.get("BREVO_API_KEY") ?? "").trim() || (resendKey && fromDomain));

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let query = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, telephone, email, siret, tva, comptable_email, comptable_cc_email, comptable_app_url, mot_de_passe_comparatif_annuel_actif, mot_de_passe_comparatif_annuel_dernier, mot_de_passe_comparatif_fenetre",
      );
    if (scopeUserId) query = query.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await query;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; total?: number }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const artisanEmail = String(p.email ?? "").trim();
      const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const comptableEmails = [String(p.comptable_email ?? "").trim(), String(p.comptable_cc_email ?? "").trim()]
        .filter((a) => a)
        .filter((a, i, arr) => arr.indexOf(a) === i);

      const actif = p.mot_de_passe_comparatif_annuel_actif !== false || force;
      if (!actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Comparatif annuel désactivé." });
        continue;
      }
      if (!force && String(p.mot_de_passe_comparatif_annuel_dernier ?? "") === anneeStr) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Comparatif déjà envoyé pour cet exercice." });
        continue;
      }
      // Passage planifié : uniquement en janvier, le jour et l'heure choisis.
      if (!scopeUserId && !ignoreTime) {
        if (month !== 1) {
          details.push({ userId, sent: false, reason: "Hors fenêtre (janvier)." });
          continue;
        }
        if (todayDay !== JOUR_ENVOI || todayHour !== HEURE_ENVOI) {
          details.push({ userId, sent: false, reason: "Hors créneau d'envoi." });
          continue;
        }
      }

      // Fenêtre lue dans le profil (6, 12 ou 24 mois), 12 par défaut.
      const fenetreBrute = Number(p.mot_de_passe_comparatif_fenetre);
      const fenetre = fenetreBrute === 6 || fenetreBrute === 12 || fenetreBrute === 24 ? fenetreBrute : 12;

      // On charge l'historique sur les 2 fenêtres (courante + précédente).
      const debut = debutFenetreMois(fenetre * 2);
      const { data: rows, error: rowError } = await admin
        .from("mot_de_passe_recap_historique")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", debut.toISOString())
        .order("created_at", { ascending: true });
      if (rowError) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Lecture de l'historique impossible." });
        continue;
      }

      const entrees = (rows ?? []) as Array<{ created_at: string }>;
      const courant = construireSerie(entrees, fenetre, 0);
      const precedent = construireSerie(entrees, fenetre, 1);
      const totalCourant = courant.reduce((s, pt) => s + pt.total, 0);
      const totalPrecedent = precedent.reduce((s, pt) => s + pt.total, 0);
      const delta =
        totalPrecedent > 0 ? Math.round(((totalCourant - totalPrecedent) / totalPrecedent) * 100) : null;

      // En usage normal : il faut un comptable destinataire. En test : l'email de l'artisan suffit.
      if (!force && comptableEmails.length === 0) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email du comptable manquant." });
        continue;
      }
      if (totalCourant === 0 && totalPrecedent === 0 && !force) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun récap sur la période." });
        continue;
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun service d'envoi configuré." });
        continue;
      }

      const destinataires: string[] = [];
      const pushDest = (addr: string) => {
        const a = addr.trim();
        if (!a) return;
        if (!destinataires.some((d) => d.toLowerCase() === a.toLowerCase())) destinataires.push(a);
      };
      if (force) {
        pushDest(artisanEmail);
      } else {
        comptableEmails.forEach(pushDest);
        pushDest(artisanEmail); // copie à l'artisan pour sa propre archive
      }
      if (destinataires.length === 0) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucune adresse destinataire." });
        continue;
      }

      const pdf = buildComparatifPdf({
        emetteur: {
          entreprise: emetteurNom,
          metier: p.metier ? String(p.metier) : null,
          telephone: p.telephone ? String(p.telephone) : null,
          email: p.email ? String(p.email) : null,
          siret: p.siret ? String(p.siret) : null,
          tva: p.tva ? String(p.tva) : null,
        },
        fenetre,
        annee: anneeStr,
        courant,
        precedent,
        totalCourant,
        totalPrecedent,
      });
      const pdfBase64 = toBase64(new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer));
      const filename = `comparatif-cadence-${anneeStr}.pdf`;
      const subject = force
        ? `Comparatif de cadence des récaps mot de passe (test) — ${anneeStr}`
        : `Comparatif de cadence des récaps mot de passe — ${anneeStr}`;

      try {
        const envoi = await envoyerEmailAvecRepli(
          "envoi-comparatif-cadence-annuel",
          {
            nom: emetteurNom,
            to: destinataires,
            subject,
            html: buildEmailHtml({ nom: emetteurNom, fenetre, annee: anneeStr, totalCourant, totalPrecedent, delta }),
            attachments: [{ filename, content: pdfBase64 }],
          },
          admin,
          { simulerEchecBrevo },
        );
        if (!envoi.ok) {
          skipped += 1;
          details.push({ userId, sent: false, reason: envoi.error || "Envoi refusé par les fournisseurs." });
          continue;
        }
        if (!force) {
          await admin
            .from("profiles")
            .update({ mot_de_passe_comparatif_annuel_dernier: anneeStr, updated_at: new Date().toISOString() })
            .eq("id", userId);
        } else {
          await admin
            .from("profiles")
            .update({ mot_de_passe_comparatif_annuel_test_ok_at: new Date().toISOString() })
            .eq("id", userId);
        }
        sent += 1;
        details.push({ userId, sent: true, total: totalCourant });
      } catch {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Erreur d'envoi." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      annee: anneeStr,
      users: (profiles ?? []).length,
      sent,
      skipped,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
