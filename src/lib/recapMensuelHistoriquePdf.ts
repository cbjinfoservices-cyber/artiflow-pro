import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PointRecapMensuel } from "@/lib/diagnosticEmail";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [154, 120, 44];
const SECONDARY: [number, number, number] = [122, 88, 60];

/** Une ligne d'historique de récap mensuel, déjà mise en forme pour le PDF. */
export interface PdfRecapMensuelRow {
  /** Mois récapitulé (« octobre 2026 »). */
  moisLabel: string;
  /** Date d'envoi (jj/mm/aaaa). */
  dateLabel: string;
  /** Heure d'envoi (hh:mm). */
  heureLabel: string;
  /** « Automatique » ou « Test manuel ». */
  type: string;
  /** Destinataire principal (adresse de l'artisan). */
  destinataire: string;
  /** Vrai si le comptable a été mis en copie de cet envoi. */
  copieComptable: boolean;
}

export interface PdfRecapMensuelInput {
  emetteur: { entreprise: string; email: string | null };
  rows: PdfRecapMensuelRow[];
  stats: { total: number; reels: number; tests: number; dernierLabel: string };
  /** Libellé lisible des filtres actifs (« tests uniquement · 24 derniers mois »). */
  filtreLabel: string;
}

/**
 * Construit un PDF récapitulatif de l'HISTORIQUE DES RÉCAPS MENSUELS « mot de passe ancien » :
 * en-tête, indicateurs (total, réels, tests, dernier envoi) et tableau détaillé. Les lignes
 * fournies reflètent déjà les filtres actifs (mêmes que le graphe et l'export CSV).
 */
export async function buildRecapMensuelHistoriquePdf(input: PdfRecapMensuelInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  if (input.emetteur.email) doc.text(input.emetteur.email, margin, 68);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(38, 36, 33);
  doc.text("HISTORIQUE DES RÉCAPS MENSUELS", pageW - margin, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 68, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 84, pageW - margin, 84);

  // Indicateurs (4 encadrés)
  const gap = 10;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 50;
  const boxTop = 100;
  const kpis = [
    { label: "RÉCAPS ENVOYÉS", value: String(input.stats.total) },
    { label: "RÉELS", value: String(input.stats.reels) },
    { label: "TESTS", value: String(input.stats.tests) },
    { label: "DERNIER ENVOI", value: input.stats.dernierLabel },
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
    doc.setFontSize(12);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 12, boxTop + 36);
  });

  const y = boxTop + boxH + 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Récaps (${input.rows.length})`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(input.filtreLabel, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Mois récapitulé", "Date", "Heure", "Type", "Destinataire", "Comptable"]] as string[][],
    body: input.rows.length
      ? input.rows.map((r) => [
          r.moisLabel,
          r.dateLabel,
          r.heureLabel,
          r.type,
          r.destinataire || "—",
          r.copieComptable ? "En copie" : "Non",
        ])
      : [["—", "Aucun récap pour ce filtre", "", "", "", ""]],
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
      1: { cellWidth: 74 },
      2: { cellWidth: 46 },
      3: { cellWidth: 78 },
      5: { cellWidth: 62 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const val = String(data.cell.raw ?? "");
        if (val === "Automatique") data.cell.styles.textColor = ACCENT;
        else if (val === "Test manuel") data.cell.styles.textColor = SECONDARY;
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
    doc.text("Historique généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface PdfComparatifCadenceInput {
  emetteur: { entreprise: string; email: string | null };
  /** Fenêtre comparée, en mois (6, 12 ou 24). Pilote les libellés et le graphe. */
  fenetre: number;
  /** Fenêtre courante : les N derniers mois (un point par mois). */
  courant: PointRecapMensuel[];
  /** Fenêtre précédente : les N mois d'avant (alignée index par index). */
  precedent: PointRecapMensuel[];
  /** Total des récaps sur la fenêtre courante. */
  totalCourant: number;
  /** Total des récaps sur la fenêtre précédente. */
  totalPrecedent: number;
}

/**
 * Construit un PDF « comparatif de cadence annuelle » des récaps mensuels « mot de passe
 * ancien » : il oppose les 12 derniers mois aux 12 mois précédents, mois par mois, avec la
 * variation. Même base de calcul que le bandeau « Cadence annuelle » et l'export CSV, donc
 * les chiffres concordent partout.
 */
export async function buildComparatifCadencePdf(input: PdfComparatifCadenceInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  if (input.emetteur.email) doc.text(input.emetteur.email, margin, 68);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(38, 36, 33);
  doc.text("COMPARATIF DE CADENCE", pageW - margin, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `${input.fenetre} derniers mois vs ${input.fenetre} mois précédents`,
    pageW - margin,
    66,
    { align: "right" },
  );
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 79, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 84, pageW - margin, 84);

  const delta =
    input.totalPrecedent > 0
      ? Math.round(((input.totalCourant - input.totalPrecedent) / input.totalPrecedent) * 100)
      : null;
  const ROUGE: [number, number, number] = [201, 74, 58];

  // Indicateurs (3 encadrés)
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 50;
  const boxTop = 100;
  const kpis: { label: string; value: string; couleur: [number, number, number] }[] = [
    { label: `${input.fenetre} DERNIERS MOIS`, value: String(input.totalCourant), couleur: ACCENT },
    { label: `${input.fenetre} MOIS PRÉCÉDENTS`, value: String(input.totalPrecedent), couleur: MUTED },
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

  // ---- Mini-graphe comparatif : barres courantes vs précédentes, mois par mois ----
  const chartTitleY = boxTop + boxH + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Cadence mois par mois", margin, chartTitleY);

  // Légende (à droite du titre).
  const sw = 8;
  doc.setFillColor(216, 205, 192);
  doc.rect(pageW - margin - 262, chartTitleY - 7, sw, sw, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(pageW - margin - 128, chartTitleY - 7, sw, sw, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${input.fenetre} mois précédents`, pageW - margin - 250, chartTitleY);
  doc.text("Période courante", pageW - margin - 116, chartTitleY);

  const chartX = margin;
  const chartW = pageW - margin * 2;
  const chartTop = chartTitleY + 12;
  const chartH = 118;
  const baseY = chartTop + chartH;
  const n = Math.max(input.courant.length, 1);
  const maxVal = Math.max(
    ...input.courant.map((p) => p.total),
    ...input.precedent.map((p) => p.total),
    1,
  );

  // Grille horizontale discrète + axes.
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

  input.courant.forEach((p, i) => {
    const prec = input.precedent[i]?.total ?? 0;
    const gx = chartX + i * groupW + leftPad;
    const hPrec = (prec / maxVal) * usableH;
    const hCur = (p.total / maxVal) * usableH;
    // Barre de la période précédente (à gauche).
    if (prec > 0) {
      doc.setFillColor(216, 205, 192);
      doc.rect(gx, baseY - hPrec, barW, hPrec, "F");
    } else {
      doc.setFillColor(232, 228, 222);
      doc.rect(gx, baseY - 2, barW, 2, "F");
    }
    // Barre de la période courante (à droite).
    if (p.total > 0) {
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.rect(gx + barW + barGap, baseY - hCur, barW, hCur, "F");
    } else {
      doc.setFillColor(232, 228, 222);
      doc.rect(gx + barW + barGap, baseY - 2, barW, 2, "F");
    }
    // Valeur au-dessus de la barre courante (si la place le permet).
    if (n <= 12 && p.total > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text(String(p.total), gx + barW + barGap + barW / 2, baseY - hCur - 3, { align: "center" });
    }
    // Libellé du mois (un sur deux si la fenêtre est longue).
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
  doc.text(`${input.fenetre} derniers mois vs ${input.fenetre} mois précédents`, pageW - margin, y, {
    align: "right",
  });

  const body = input.courant.map((p, i) => {
    const prec = input.precedent[i];
    const pt = prec ? prec.total : 0;
    const d = pt > 0 ? Math.round(((p.total - pt) / pt) * 100) : null;
    return [p.label, String(p.total), String(pt), d === null ? "N/A" : `${d > 0 ? "+" : ""}${d} %`];
  });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Mois", `${input.fenetre} derniers mois`, `${input.fenetre} mois précédents`, "Variation"]] as string[][],
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
    didParseCell: (data) => {
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
    doc.text("Comparatif généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}