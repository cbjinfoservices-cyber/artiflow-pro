import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [154, 120, 44];
const DANGER: [number, number, number] = [185, 65, 65];

/** Une ligne d'historique, déjà mise en forme pour le PDF. */
export interface PdfHistoriqueTestsRow {
  dateLabel: string;
  automatisationNom: string;
  resultat: string;
  message: string | null;
}

export interface PdfHistoriqueTestsInput {
  emetteur: { entreprise: string; email: string | null };
  rows: PdfHistoriqueTestsRow[];
  stats: { total: number; succes: number; tauxSucces: number; dernierLabel: string };
  /** Libellé lisible des filtres actifs (« échecs uniquement · 30 derniers jours »). */
  filtreLabel: string;
}

/**
 * Construit un PDF récapitulatif de l'historique des tests d'envois automatiques :
 * en-tête, indicateurs (total, taux de réussite, dernière exécution) et tableau détaillé.
 * Les lignes fournies reflètent déjà les filtres actifs (mêmes que l'export CSV).
 */
export async function buildHistoriqueTestsPdf(input: PdfHistoriqueTestsInput): Promise<jsPDF> {
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
  doc.setFontSize(18);
  doc.setTextColor(38, 36, 33);
  doc.text("HISTORIQUE DES TESTS", pageW - margin, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 68, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 84, pageW - margin, 84);

  // Indicateurs (3 encadrés)
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 50;
  const boxTop = 100;
  const kpis = [
    { label: "TESTS JOURNALISÉS", value: String(input.stats.total) },
    { label: "TAUX DE RÉUSSITE", value: `${input.stats.tauxSucces}%`, sub: `${input.stats.succes}/${input.stats.total}` },
    { label: "DERNIÈRE EXÉCUTION", value: input.stats.dernierLabel },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, boxTop + 17);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 36);
    if (b.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(b.sub, bx + 14, boxTop + 46);
    }
  });

  let y = boxTop + boxH + 26;

  // Ligne des filtres actifs
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Tests (${input.rows.length})`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(input.filtreLabel, pageW - margin, y, { align: "right" });
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Date", "Automatisation", "Résultat", "Message"]] as string[][],
    body: input.rows.length
      ? input.rows.map((r) => [
          r.dateLabel,
          r.automatisationNom,
          r.resultat === "succes" ? "Succès" : "Échec",
          r.message ?? "—",
        ])
      : [["—", "Aucun test pour ce filtre", "", ""]],
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
      0: { cellWidth: 118 },
      2: { cellWidth: 58 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const val = String(data.cell.raw ?? "");
        if (val === "Succès") data.cell.styles.textColor = ACCENT;
        else if (val === "Échec") data.cell.styles.textColor = DANGER;
      }
    },
  });

  // Pied de page sur toutes les pages
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