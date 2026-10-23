import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";
import autoTableImport from "npm:jspdf-autotable@3.8.2";

// ENVOI ANNUEL automatique du PDF de RÉGULARITÉ D'ARCHIVAGE des récaps d'échecs « test à blanc ».
// Prévue pour tourner SANS session utilisateur, appelée par une tâche planifiée.
// Chaque passage n'envoie qu'en janvier, le jour choisi (4 par défaut) : on transmet alors à
// l'artisan un PDF récapitulant la régularité de son archivage des récaps d'échecs sur l'exercice
// qui vient de s'achever (mois par mois, moyenne mensuelle, mois le plus actif).
// Anti-doublon via echecs_blanc_recap_annuel_dernier.
// Un appel avec { userId, force: true } (bouton « Tester ») envoie tout de suite le PDF à
// l'artisan, sans tenir compte du jour ni de l'anti-doublon.
// Un appel avec { userId, testRelance: true } (bouton « Recevoir la relance maintenant ») envoie
// tout de suite l'email de RELANCE, sans tenir compte du délai réglé ni de l'anti-doublon.
// Le délai de relance (15/30/45 j) est réglable sur le profil.
// Les adresses en copie (Cc) configurées sur le rappel d'archivage reçoivent aussi le PDF ; si
// l'option « récap annuel au comptable » est activée, l'adresse du comptable reçoit une copie.
// Chaque relance adressée est journalisée (recap_echecs_annuel_relances) pour alimenter le
// compteur « relances par exercice » du tableau de bord.
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

const JOUR_ENVOI_DEFAUT = 4; // jour de janvier par défaut
const HEURE_ENVOI_DEFAUT = 7; // 07:00 par défaut, heure de Paris

// Délai (en jours) après la date réglée au-delà duquel une RELANCE automatique est adressée à
// l'artisan si le récap annuel de l'exercice n'a toujours pas été transmis (cf. badge « à confirmer »).
// Délai réglable sur le profil : 15, 30 ou 45 jours (15 par défaut).
const DELAIS_RELANCE = [15, 30, 45] as const;
const DELAI_RELANCE_DEFAUT = 15;

/** Ramène une valeur quelconque à un délai de relance valide (15, 30 ou 45 j ; défaut 15). */
function normaliserDelaiRelance(v: unknown): number {
  const n = Math.round(Number(v));
  return (DELAIS_RELANCE as readonly number[]).includes(n) ? n : DELAI_RELANCE_DEFAUT;
}

/** Ramène une valeur quelconque à un jour de janvier valide (1-28 ; défaut 4). */
function normaliserJourEnvoi(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 28 ? n : JOUR_ENVOI_DEFAUT;
}

/** Ramène une valeur quelconque à une heure d'envoi valide (0-23 ; défaut 7). */
function normaliserHeureEnvoi(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : HEURE_ENVOI_DEFAUT;
}

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [154, 120, 44];
const SECONDARY: [number, number, number] = [122, 88, 60];

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
 * refuse l'envoi ou ne répond pas : le récap annuel de régularité et ses relances ne sont
 * jamais perdus à cause d'un seul fournisseur. Chaque tentative est tracée pour la carte
 * « Suivi des envois » du back-office.
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
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.com";
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

/**
 * Construit la liste des adresses en copie (Cc) d'un email du récap annuel : les copies réglées
 * sur le rappel d'archivage, PLUS l'adresse du comptable (et son adresse secondaire) quand
 * l'option « envoyer le récap annuel au comptable » est activée sur le profil.
 */
function construireCcAnnuel(p: Record<string, unknown>): string[] {
  const cc = normalizeCc(p.echecs_blanc_recap_alerte_cc);
  if (p.echecs_blanc_recap_annuel_cc_comptable === true) {
    const comptable = String(p.comptable_email ?? "").trim();
    const comptableCc = String(p.comptable_cc_email ?? "").trim();
    if (comptable && !cc.includes(comptable)) cc.push(comptable);
    if (comptableCc && !cc.includes(comptableCc)) cc.push(comptableCc);
  }
  return cc;
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

interface Emetteur {
  entreprise: string;
  metier?: string | null;
  telephone?: string | null;
  email?: string | null;
  siret?: string | null;
  tva?: string | null;
}

interface MoisSerie {
  cle: string;
  label: string;
  count: number;
  /** Récaps archivés à la main (bouton / envoi manuel). */
  manuel: number;
  /** Récaps archivés automatiquement (tâche planifiée hebdomadaire). */
  auto: number;
}

/** Vrai si une valeur de `source` correspond à un archivage automatique (tâche planifiée). */
function estSourceAuto(source: unknown): boolean {
  const s = String(source ?? "").trim().toLowerCase();
  return s === "hebdo" || s === "auto" || s === "automatique";
}

/** Série mensuelle des 12 mois d'un exercice (janvier → décembre), compteurs à zéro. */
function serieMoisExercice(annee: number): MoisSerie[] {
  const mois: MoisSerie[] = [];
  for (let m = 0; m < 12; m += 1) {
    const d = new Date(annee, m, 1);
    mois.push({
      cle: `${annee}-${String(m + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      count: 0,
      manuel: 0,
      auto: 0,
    });
  }
  return mois;
}

interface CellInfo {
  section: string;
  column: { index: number };
  row: { index: number };
  cell: { raw: unknown; styles: Record<string, unknown> };
}

/**
 * Construit le PDF « régularité d'archivage des récaps d'échecs » d'un exercice : en-tête
 * émetteur, indicateurs (récaps archivés, moyenne mensuelle, mois couverts, mois le plus actif),
 * un histogramme des 12 mois puis un tableau détaillé mois par mois. Document d'archivage annuel.
 */
function buildRegulariteEchecsPdf(params: {
  emetteur: Emetteur;
  annee: string;
  serie: MoisSerie[];
  stats: { total: number; moyenne: number; moisCouverts: number; moisActifLabel: string; manuel: number; auto: number };
}): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("RÉGULARITÉ D'ARCHIVAGE DES RÉCAPS D'ÉCHECS", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Récaps « test à blanc » archivés au fil de l'exercice", margin, 71);

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

  // Indicateurs (4 encadrés)
  const gap = 10;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 50;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "RÉCAPS ARCHIVÉS", value: String(params.stats.total) },
    { label: "MOYENNE / MOIS", value: params.stats.moyenne.toFixed(1) },
    { label: "MOIS COUVERTS", value: `${params.stats.moisCouverts}/12` },
    { label: "MOIS LE PLUS ACTIF", value: params.stats.moisActifLabel },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 12, boxTop + 17);
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 12, boxTop + 36);
  });

  // ---- Histogramme des 12 mois ----
  const chartTitleY = boxTop + boxH + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Archivage mois par mois", margin, chartTitleY);

  // Légende des sources (automatique / manuel), alignée à droite du titre du graphique.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const legendeY = chartTitleY - 3;
  const legendeAutoLabel = `Automatique (${params.stats.auto})`;
  const legendeManuelLabel = `Manuel (${params.stats.manuel})`;
  const legendeManuelW = doc.getTextWidth(legendeManuelLabel);
  const legendeAutoW = doc.getTextWidth(legendeAutoLabel);
  const legendeGap = 14;
  const swatch = 7;
  const manuelX = pageW - margin - legendeManuelW - swatch - 4;
  const autoX = manuelX - legendeGap - legendeAutoW - swatch - 4;
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(manuelX, legendeY - 6, swatch, swatch, "F");
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(legendeManuelLabel, manuelX + swatch + 4, legendeY);
  doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
  doc.rect(autoX, legendeY - 6, swatch, swatch, "F");
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(legendeAutoLabel, autoX + swatch + 4, legendeY);

  const chartX = margin;
  const chartW = pageW - margin * 2;
  const chartTop = chartTitleY + 14;
  const chartH = 120;
  const baseY = chartTop + chartH;
  const maxVal = Math.max(1, ...params.serie.map((m) => m.count));

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

  const n = params.serie.length;
  const groupW = chartW / n;
  const barW = Math.min(groupW * 0.5, 26);
  const leftPad = (groupW - barW) / 2;
  const usableH = chartH - 8;
  // Barres EMPILÉES par source : automatique (bas, couleur secondaire) + manuel (haut, accent).
  params.serie.forEach((m, i) => {
    const gx = chartX + i * groupW + leftPad;
    const h = m.count > 0 ? (m.count / maxVal) * usableH : 0;
    if (m.count > 0) {
      const autoH = (m.auto / m.count) * h;
      const manuelH = h - autoH;
      // Segment automatique (bas).
      if (autoH > 0) {
        doc.setFillColor(SECONDARY[0], SECONDARY[1], SECONDARY[2]);
        doc.rect(gx, baseY - autoH, barW, autoH, "F");
      }
      // Segment manuel (au-dessus de la partie automatique).
      if (manuelH > 0) {
        doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        doc.rect(gx, baseY - h, barW, manuelH, "F");
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(String(m.count), gx + barW / 2, baseY - h - 3, { align: "center" });
    } else {
      doc.setFillColor(232, 228, 222);
      doc.rect(gx, baseY - 2, barW, 2, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(m.label, gx + barW / 2, baseY + 11, { align: "center" });
  });

  const y = baseY + 34;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail mois par mois", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Exercice ${params.annee}`, pageW - margin, y, { align: "right" });

  const total = params.stats.total;
  const body = params.serie.map((m) => [
    m.label,
    String(m.count),
    String(m.auto),
    String(m.manuel),
    total > 0 ? `${Math.round((m.count / total) * 100)} %` : "0 %",
  ]);

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Mois", "Récaps archivés", "dont auto.", "dont manuel", "Part de l'exercice"]] as string[][],
    body: body.length ? body : [["—", "Aucune donnée", "", "", ""]],
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
      1: { halign: "right", cellWidth: 72 },
      2: { halign: "right", cellWidth: 62 },
      3: { halign: "right", cellWidth: 68 },
      4: { halign: "right", cellWidth: 96 },
    },
    didParseCell: (data: CellInfo) => {
      if (data.section !== "body") return;
      if (data.column.index === 1) {
        const val = Number(data.cell.raw);
        if (val > 0) data.cell.styles.textColor = ACCENT;
      }
      if (data.column.index === 2) {
        const val = Number(data.cell.raw);
        if (val > 0) data.cell.styles.textColor = SECONDARY;
      }
    },
  });

  // ---- Tableau de synthèse par source (manuel vs automatique) ----
  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  const synthY = lastY + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Synthèse par source de l'archivage", margin, synthY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Exercice ${params.annee}`, pageW - margin, synthY, { align: "right" });

  const pctSource = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)} %` : "0 %");
  autoTable(doc, {
    startY: synthY + 6,
    margin: { left: margin, right: margin },
    head: [["Source de l'archivage", "Récaps archivés", "Part de l'exercice"]] as string[][],
    body: [
      ["Automatique (tâche planifiée hebdo)", String(params.stats.auto), pctSource(params.stats.auto)],
      ["Manuel (relance à la main)", String(params.stats.manuel), pctSource(params.stats.manuel)],
      ["Total", String(total), total > 0 ? "100 %" : "0 %"],
    ],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right", cellWidth: 108 },
      2: { halign: "right", cellWidth: 108 },
    },
    didParseCell: (data: CellInfo) => {
      if (data.section !== "body") return;
      if (data.row.index === 2) data.cell.styles.fontStyle = "bold";
      if (data.column.index === 1 && data.row.index === 0) data.cell.styles.textColor = SECONDARY;
      if (data.column.index === 1 && data.row.index === 1) data.cell.styles.textColor = ACCENT;
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
    doc.text("Régularité générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

/** Mini-jauge colorée (une barre remplie) pour l'email : libellé, compteur, pourcentage et couleur. */
function miniJauge(label: string, count: number, pct: number, color: string): string {
  const width = Math.max(2, Math.min(100, pct));
  return `<div style="margin:0 0 10px;">
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#71717a;margin-bottom:4px;">
      <span>${escapeHtml(label)}</span>
      <span style="font-weight:700;color:#18181b;">${count} · ${pct}&nbsp;%</span>
    </div>
    <div style="height:10px;border-radius:9999px;background:#ececec;overflow:hidden;">
      <div style="height:100%;width:${width}%;background:${color};border-radius:9999px;"></div>
    </div>
  </div>`;
}

function buildEmailHtml(
  nom: string,
  annee: string,
  total: number,
  moyenne: number,
  moisCouverts: number,
  moisActifLabel: string,
  totalAuto: number,
  totalManuel: number,
): string {
  // Deux mini-jauges colorées : part automatique (teinte secondaire) vs part manuelle (accent).
  const pctAuto = total > 0 ? Math.round((totalAuto / total) * 100) : 0;
  const pctManuel = total > 0 ? Math.round((totalManuel / total) * 100) : 0;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Régularité d'archivage des récaps d'échecs · exercice ${escapeHtml(annee)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Veuillez trouver ci-joint le <strong>récap annuel de régularité</strong> de votre archivage des récaps
          d'échecs (rejeux « test à blanc ») pour l'exercice <strong>${escapeHtml(annee)}</strong>.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Récaps archivés : <strong style="color:#18181b;">${total}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Moyenne mensuelle : <strong style="color:#18181b;">${moyenne.toFixed(1)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Mois couverts : <strong style="color:#18181b;">${moisCouverts}/12</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Mois le plus actif : <strong style="color:#18181b;">${escapeHtml(moisActifLabel)}</strong></p>
          <p style="margin:0;color:#71717a;">Sources : <strong style="color:#18181b;">${totalAuto} automatique${totalAuto > 1 ? "s" : ""}</strong> · <strong style="color:#18181b;">${totalManuel} manuel${totalManuel > 1 ? "s" : ""}</strong></p>
        </div>
        <div style="margin:0 0 18px;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#71717a;">Répartition des archivages</p>
          ${miniJauge("Automatique (tâche planifiée)", totalAuto, pctAuto, "#7a583c")}
          ${miniJauge("Manuel (reprise à la main)", totalManuel, pctManuel, "#9a782c")}
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Ce document vous permet de vérifier la régularité de votre archivage et de repérer d'éventuels
          trous sur l'année.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro pour ${escapeHtml(nom)}.
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * Email de RELANCE automatique adressé à l'artisan quand le récap annuel de régularité de
 * l'exercice n'a pas été transmis au-delà du délai réglé (15, 30 ou 45 jours) après la date
 * d'envoi (même logique que le badge « Récap annuel à confirmer » du tableau de bord). Sert de
 * rappel doux : vérifier que la tâche planifiée tourne et que des récaps d'échecs ont bien été
 * archivés sur l'exercice.
 */
function buildRelanceEmailHtml(nom: string, annee: string, jourLimite: number): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(nom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#b45309;">Récap annuel de régularité à confirmer · exercice ${escapeHtml(annee)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Le <strong>récap annuel de régularité d'archivage</strong> des récaps d'échecs de l'exercice
          <strong>${escapeHtml(annee)}</strong> n'a pas encore été transmis, alors que la date d'envoi
          réglée est dépassée de plus de ${jourLimite} jours.
        </p>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;font-size:13px;color:#9a3412;margin:0 0 18px;">
          <p style="margin:0 0 8px;font-weight:700;">Que vérifier ?</p>
          <p style="margin:0 0 6px;">• La tâche planifiée <strong>envoi-recap-echecs-annuel</strong> est bien branchée et active.</p>
          <p style="margin:0;">• Des récaps d'échecs ont bien été archivés sur l'exercice (sinon, aucun PDF n'est généré).</p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Vous pouvez aussi envoyer le récap annuel tout de suite depuis l'application
          (carte « Récap hebdo des échecs test à blanc » → « Tester maintenant »).
        </p>
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
    const anneeForcee = typeof body?.annee === "string" && /^\d{4}$/.test(body.annee) ? Number(body.annee) : null;

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
    const anneeCible = month <= 1 ? year - 1 : year;
    const anneeNum = anneeForcee ?? anneeCible;
    const anneeStr = String(anneeNum);
    const rangeStart = new Date(anneeNum, 0, 1).toISOString();
    const rangeEnd = new Date(anneeNum + 1, 0, 1).toISOString();
    const canSend = Boolean((Deno.env.get("BREVO_API_KEY") ?? "").trim() || (resendKey && fromDomain));

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let query = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, telephone, email, siret, tva, comptable_email, comptable_cc_email, echecs_blanc_recap_annuel_actif, echecs_blanc_recap_annuel_dernier, echecs_blanc_recap_annuel_jour, echecs_blanc_recap_annuel_heure, echecs_blanc_recap_annuel_relance_dernier, echecs_blanc_recap_annuel_relance_delai, echecs_blanc_recap_annuel_cc_comptable, echecs_blanc_recap_alerte_cc",
      );
    if (scopeUserId) query = query.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await query;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    // ---- APERÇU de l'email de RELANCE (« Aperçu de la relance », aucun envoi) ----
    // Renvoie le HTML + l'objet de l'email de relance « à confirmer » tel qu'il partirait, en
    // simulant éventuellement une autre échéance de délai (15/30/45 j). Aucun email n'est envoyé.
    if (body?.previewRelance === true && scopeUserId) {
      const p = (profiles ?? [])[0] as Record<string, unknown> | undefined;
      if (!p) return json({ ok: false, error: "Profil introuvable." }, 404);
      const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const delai = normaliserDelaiRelance(p.echecs_blanc_recap_annuel_relance_delai);
      const joursSimule = typeof body?.jours === "number" ? normaliserDelaiRelance(body.jours) : delai;
      const exercicePrev = month <= 1 ? year - 1 : year;
      const exercicePrevStr = String(exercicePrev);
      return json({
        ok: true,
        html: buildRelanceEmailHtml(emetteurNom, exercicePrevStr, joursSimule),
        subject: `Récap annuel de régularité à confirmer — ${exercicePrevStr}`,
        jours: joursSimule,
        annee: exercicePrevStr,
      });
    }

    // ---- TEST MANUEL de la relance (« Recevoir la relance maintenant ») ----
    // Envoie tout de suite l'email de relance à l'artisan, sans tenir compte du délai réglé ni de
    // l'anti-doublon, pour vérifier que l'email de relance « à confirmer » lui parvient bien.
    if (body?.testRelance === true && scopeUserId) {
      const p = (profiles ?? [])[0] as Record<string, unknown> | undefined;
      if (!p) return json({ ok: false, error: "Profil introuvable." }, 404);
      const artisanEmail = String(p.email ?? "").trim();
      const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");
      const delai = normaliserDelaiRelance(p.echecs_blanc_recap_annuel_relance_delai);
      // Délai simulé : le bouton « Rejouer la relance X jours » peut tester une autre échéance.
      const joursSimule = typeof body?.jours === "number" ? normaliserDelaiRelance(body.jours) : delai;
      const exerciceTest = month <= 1 ? year - 1 : year;
      const exerciceTestStr = String(exerciceTest);
      if (!artisanEmail) {
        return json({ ok: true, configured: canSend, sent: 0, jours: joursSimule, details: [{ reason: "Email de l'artisan manquant." }] });
      }
      if (!canSend) {
        return json({ ok: true, configured: false, sent: 0, jours: joursSimule, details: [{ reason: "Aucun service d'envoi configuré." }] });
      }
      const ccListTest = construireCcAnnuel(p);
      try {
        const envoi = await envoyerEmailAvecRepli(
          "envoi-recap-echecs-annuel",
          {
            nom: emetteurNom,
            to: [artisanEmail],
            cc: ccListTest.length ? ccListTest : undefined,
            subject: `Récap annuel de régularité à confirmer (test) — ${exerciceTestStr}`,
            html: buildRelanceEmailHtml(emetteurNom, exerciceTestStr, joursSimule),
          },
          admin,
          { simulerEchecBrevo },
        );
        if (!envoi.ok) {
          return json({ ok: true, configured: true, sent: 0, jours: joursSimule, details: [{ reason: envoi.error || "Envoi refusé par les fournisseurs." }] });
        }
        // Journalise la relance (source « manuel ») pour le compteur de relances par exercice.
        await admin
          .from("recap_echecs_annuel_relances")
          .insert({ user_id: scopeUserId, exercice: exerciceTestStr, source: "manuel" });
        return json({ ok: true, configured: true, sent: 1, jours: joursSimule, annee: exerciceTestStr });
      } catch {
        return json({ ok: true, configured: true, sent: 0, jours: joursSimule, details: [{ reason: "Erreur d'envoi." }] });
      }
    }

    let sent = 0;
    let skipped = 0;
    const details: Array<{ userId: string; sent: boolean; reason?: string; total?: number; annee?: string }> = [];

    for (const raw of profiles ?? []) {
      const p = raw as Record<string, unknown>;
      const userId = String(p.id);
      const artisanEmail = String(p.email ?? "").trim();
      const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");

      const actif = p.echecs_blanc_recap_annuel_actif !== false || force;
      if (!actif) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap annuel désactivé." });
        continue;
      }
      if (!force && String(p.echecs_blanc_recap_annuel_dernier ?? "") === anneeStr) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Récap annuel déjà envoyé pour cet exercice." });
        continue;
      }
      // Passage planifié : uniquement en janvier, le jour et l'heure réglés sur le profil.
      if (!scopeUserId && !ignoreTime) {
        if (month !== 1) {
          details.push({ userId, sent: false, reason: "Hors fenêtre (janvier)." });
          continue;
        }
        const jourEnvoi = normaliserJourEnvoi(p.echecs_blanc_recap_annuel_jour);
        const heureEnvoi = normaliserHeureEnvoi(p.echecs_blanc_recap_annuel_heure);
        if (todayDay !== jourEnvoi || todayHour !== heureEnvoi) {
          details.push({ userId, sent: false, reason: "Hors créneau d'envoi." });
          continue;
        }
      }
      if (!artisanEmail) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Email de l'artisan manquant." });
        continue;
      }
      if (!canSend) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun service d'envoi configuré." });
        continue;
      }

      const { data: rows, error: rowError } = await admin
        .from("recap_echecs_blanc_envois")
        .select("source, created_at")
        .eq("user_id", userId)
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .order("created_at", { ascending: true });
      if (rowError) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Lecture de l'historique impossible." });
        continue;
      }

      const entrees = (rows ?? []) as Array<Record<string, unknown>>;
      const serie = serieMoisExercice(anneeNum);
      const index = new Map(serie.map((m) => [m.cle, m]));
      entrees.forEach((e) => {
        const d = new Date(String(e.created_at ?? ""));
        if (Number.isNaN(d.getTime())) return;
        const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const m = index.get(cle);
        if (!m) return;
        m.count += 1;
        // Répartition manuel / automatique selon la source de l'archivage.
        if (estSourceAuto(e.source)) m.auto += 1;
        else m.manuel += 1;
      });

      const total = entrees.length;
      const totalAuto = serie.reduce((s, m) => s + m.auto, 0);
      const totalManuel = serie.reduce((s, m) => s + m.manuel, 0);
      const moyenne = total / 12;
      const moisCouverts = serie.filter((m) => m.count > 0).length;
      const moisActif = serie.reduce<MoisSerie | null>(
        (max, m) => (m.count > 0 && (!max || m.count > max.count) ? m : max),
        null,
      );
      const moisActifLabel = moisActif ? `${moisActif.label} (${moisActif.count})` : "—";

      // En usage normal, on n'envoie pas un PDF vide (aucun archivage sur l'exercice).
      if (total === 0 && !force) {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Aucun archivage sur l'exercice." });
        continue;
      }

      const ccList = construireCcAnnuel(p);

      const pdf = buildRegulariteEchecsPdf({
        emetteur: {
          entreprise: emetteurNom,
          metier: p.metier ? String(p.metier) : null,
          telephone: p.telephone ? String(p.telephone) : null,
          email: p.email ? String(p.email) : null,
          siret: p.siret ? String(p.siret) : null,
          tva: p.tva ? String(p.tva) : null,
        },
        annee: anneeStr,
        serie,
        stats: { total, moyenne, moisCouverts, moisActifLabel, manuel: totalManuel, auto: totalAuto },
      });
      const pdfBase64 = toBase64(new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer));
      const filename = `regularite-archivage-recaps-echecs-${anneeStr}.pdf`;
      const subject = force
        ? `Régularité d'archivage des récaps d'échecs (test) — ${anneeStr}`
        : `Régularité d'archivage des récaps d'échecs — ${anneeStr}`;

      try {
        const envoi = await envoyerEmailAvecRepli(
          "envoi-recap-echecs-annuel",
          {
            nom: emetteurNom,
            to: [artisanEmail],
            cc: ccList.length ? ccList : undefined,
            subject,
            html: buildEmailHtml(emetteurNom, anneeStr, total, moyenne, moisCouverts, moisActifLabel, totalAuto, totalManuel),
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
            .update({ echecs_blanc_recap_annuel_dernier: anneeStr, updated_at: new Date().toISOString() })
            .eq("id", userId);
        }
        sent += 1;
        details.push({ userId, sent: true, total, annee: anneeStr });
      } catch {
        skipped += 1;
        details.push({ userId, sent: false, reason: "Erreur d'envoi." });
      }
    }

    // ---- RELANCE automatique : récap annuel de l'exercice non transmis 15 j après la date réglée ----
    // Même logique que le badge « Récap annuel à confirmer » du tableau de bord. Uniquement en
    // passage planifié (jamais depuis le bouton de test) et au plus une fois par exercice.
    let relances = 0;
    const relancesDetails: Array<{ userId: string; sent: boolean; reason?: string; annee?: string }> = [];
    if (!scopeUserId && !force) {
      const exerciceBadge = year - 1; // exercice attendu : celui qui vient de s'achever
      const exerciceBadgeStr = String(exerciceBadge);
      for (const raw of profiles ?? []) {
        const p = raw as Record<string, unknown>;
        const userId = String(p.id);
        const artisanEmail = String(p.email ?? "").trim();
        const emetteurNom = String(p.entreprise ?? p.metier ?? "Votre artisan");
        if (p.echecs_blanc_recap_annuel_actif === false) continue;
        // Déjà transmis pour cet exercice : pas de relance.
        if (Number(p.echecs_blanc_recap_annuel_dernier ?? -Infinity) >= exerciceBadge) continue;
        // Relance déjà adressée pour cet exercice (anti-doublon).
        if (String(p.echecs_blanc_recap_annuel_relance_dernier ?? "") === exerciceBadgeStr) continue;
        const jourEnvoi = normaliserJourEnvoi(p.echecs_blanc_recap_annuel_jour);
        const heureEnvoi = normaliserHeureEnvoi(p.echecs_blanc_recap_annuel_heure);
        const delaiRelance = normaliserDelaiRelance(p.echecs_blanc_recap_annuel_relance_delai);
        const prevue = new Date(exerciceBadge + 1, 0, jourEnvoi, heureEnvoi, 0, 0, 0).getTime();
        const limite = prevue + delaiRelance * 86400000;
        // Tant que la date réglée n'est pas dépassée du délai réglé (15/30/45 j), on reste discret.
        if (Date.now() <= limite) continue;
        if (!artisanEmail || !canSend) continue;
        const ccList = construireCcAnnuel(p);
        try {
          const envoiRelance = await envoyerEmailAvecRepli(
            "envoi-recap-echecs-annuel",
            {
              nom: emetteurNom,
              to: [artisanEmail],
              cc: ccList.length ? ccList : undefined,
              subject: `Récap annuel de régularité à confirmer — ${exerciceBadgeStr}`,
              html: buildRelanceEmailHtml(emetteurNom, exerciceBadgeStr, delaiRelance),
            },
            admin,
          );
          if (!envoiRelance.ok) {
            relancesDetails.push({ userId, sent: false, reason: envoiRelance.error || "Envoi refusé par les fournisseurs." });
            continue;
          }
          await admin
            .from("profiles")
            .update({
              echecs_blanc_recap_annuel_relance_dernier: exerciceBadgeStr,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
          // Journalise la relance (source « auto ») pour le compteur de relances par exercice.
          await admin
            .from("recap_echecs_annuel_relances")
            .insert({ user_id: userId, exercice: exerciceBadgeStr, source: "auto" });
          relances += 1;
          relancesDetails.push({ userId, sent: true, annee: exerciceBadgeStr });
        } catch {
          relancesDetails.push({ userId, sent: false, reason: "Erreur d'envoi." });
        }
      }
    }

    return json({
      ok: true,
      configured: canSend,
      annee: anneeStr,
      users: (profiles ?? []).length,
      sent,
      skipped,
      relances,
      details,
      relancesDetails,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});