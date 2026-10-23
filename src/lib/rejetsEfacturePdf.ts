import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [196, 120, 58];

/** Une facture rejetée telle qu'elle apparaît sur la fiche papier. */
export interface RejetEfactureLigne {
  numero: string;
  client: string | null;
  motif: string | null;
  montantTtc: number;
  dateEmission?: string | null;
}

export interface RejetsEfacturePdfInput {
  /** Période couverte par la liste (« Octobre 2026 », « Tous les mois »…). */
  moisLabel: string;
  /** Nom de l'entreprise, affiché en tête si disponible. */
  entreprise?: string | null;
  lignes: RejetEfactureLigne[];
}

function euros(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function dateFr(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Construit la fiche « rejets du mois » : une page courte, pensée pour être imprimée ou
 * envoyée, qui liste chaque facture rejetée avec son client, son motif et son montant, et
 * laisse une case à cocher pour suivre les corrections faites hors écran.
 */
export function buildRejetsEfacturePdf(input: RejetsEfacturePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("FACTURES REJETÉES À CORRIGER", margin, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const sousTitre = [
    input.entreprise?.trim() ? input.entreprise.trim() : "Mon entreprise",
    `Période : ${input.moisLabel}`,
    `Édité le ${new Date().toLocaleDateString("fr-FR")}`,
  ].join(" · ");
  doc.text(sousTitre, margin, 70);

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 86, pageW - margin, 86);

  const total = input.lignes.length;
  const montant = input.lignes.reduce((somme, l) => somme + Number(l.montantTtc || 0), 0);

  const kpis = [
    { label: "FACTURES REJETÉES", value: String(total) },
    { label: "MONTANT TTC BLOQUÉ", value: euros(montant) },
    { label: "À RETRANSMETTRE", value: total > 0 ? String(total) : "—" },
  ];
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 44;
  const boxTop = 102;
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
    doc.text(b.value, bx + 14, boxTop + 34);
  });

  autoTable(doc, {
    startY: boxTop + boxH + 26,
    margin: { left: margin, right: margin },
    head: [["Fait", "Numéro", "Client", "Émise le", "Motif du rejet", "Montant TTC"]],
    body:
      total > 0
        ? input.lignes.map((l) => [
            "",
            l.numero,
            l.client?.trim() ? l.client : "Sans client",
            dateFr(l.dateEmission),
            l.motif?.trim() ? l.motif.trim() : "Motif non renseigné",
            euros(Number(l.montantTtc || 0)),
          ])
        : [["", "—", "Aucune facture rejetée sur cette période", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
      valign: "middle",
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 34, halign: "center" },
      1: { cellWidth: 78 },
      2: { cellWidth: 108 },
      3: { cellWidth: 76 },
      5: { halign: "right", cellWidth: 84 },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? boxTop + 80;

  // Mode d'emploi court : la fiche sert à travailler hors écran, puis à cocher au fur et à mesure.
  if (finalY < pageH - 130) {
    const noteTop = finalY + 22;
    const note = doc.splitTextToSize(
      "Comment s'en servir : corrigez le motif indiqué sur la facture (SIRET du client, numéro de TVA, coordonnées de règlement…), cochez la ligne une fois la correction faite, puis repassez la facture en « Prête à transmettre » depuis le registre. Une facture rejetée reste bloquée tant qu'elle n'est pas retransmise.",
      pageW - margin * 2 - 32,
    ) as string[];
    const noteH = 30 + note.length * 12;
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(margin, noteTop, pageW - margin * 2, noteH, 6, 6, "F");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(margin, noteTop, 4, noteH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("MODE D'EMPLOI", margin + 14, noteTop + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(80, 74, 70);
    note.forEach((line, i) => doc.text(line, margin + 14, noteTop + 32 + i * 12));
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(1);
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Liste générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}