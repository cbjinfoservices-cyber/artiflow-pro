import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { BalanceAgee, ComptaTotaux, JournalLigne, TvaParTaux } from "@/lib/exportComptable";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];

/** Montant au format comptable français (« 1 250,00 € »). */
function euros(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Libellé français d'un taux de TVA (« 20 % », « 5,5 % »). */
function tauxLabel(taux: number): string {
  const s = Number.isInteger(taux) ? String(taux) : taux.toFixed(1).replace(".", ",");
  return `${s} %`;
}

export interface RecapTvaPdfInput {
  emetteur: {
    entreprise: string;
    metier?: string;
    telephone?: string;
    email?: string;
    siret?: string | null;
    tva?: string | null;
  };
  /** Ventilation de la TVA collectée par taux. */
  tva: TvaParTaux[];
  /** Total de TVA collectée (toutes bases confondues). */
  totalTva: number;
  /** Totaux de synthèse de la période (facturé, encaissé, reste à encaisser…). */
  totaux: ComptaTotaux;
  /** Libellé de la période / du client filtré (affiché sous le titre). */
  filtreLabel: string;
}

/**
 * Construit un PDF « récapitulatif de TVA par taux », prêt à transmettre au comptable :
 * en-tête émetteur, indicateurs de synthèse, détail par taux (base taxable, TVA, TTC,
 * nombre de factures) et ligne de total. Document généré avec ArtiFlow-pro.
 */
export function buildRecapTvaPdf(input: RecapTvaPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Titre + métadonnées
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("RÉCAPITULATIF TVA PAR TAUX", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Document destiné à votre comptable", margin, 71);

  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(input.filtreLabel, pageW - margin, 71, { align: "right" });

  // Bloc émetteur
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    input.emetteur.metier,
    input.emetteur.telephone,
    input.emetteur.email,
    input.emetteur.siret ? `SIRET : ${input.emetteur.siret}` : null,
    input.emetteur.tva ? `N° TVA : ${input.emetteur.tva}` : null,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 115 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Indicateurs de synthèse (4 encadrés)
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 46;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "FACTURÉ HT", value: euros(input.totaux.factureHT) },
    { label: "TVA COLLECTÉE", value: euros(input.totalTva) },
    { label: "FACTURÉ TTC", value: euros(input.totaux.factureTTC) },
    { label: "ENCAISSÉ TTC", value: euros(input.totaux.encaisse) },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, boxTop + 17);
    doc.setFontSize(12);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 35);
  });

  let y = boxTop + boxH + 30;

  // Détail par taux
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail de la TVA collectée par taux", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${input.tva.length} taux`, pageW - margin, y, { align: "right" });

  const totalBase = input.tva.reduce((s, t) => s + t.baseHT, 0);
  const totalTtc = input.tva.reduce((s, t) => s + t.ttc, 0);
  const totalDocs = input.tva.reduce((s, t) => s + t.nbDocuments, 0);

  const body: string[][] = input.tva.length
    ? input.tva.map((t) => [
        tauxLabel(t.taux),
        euros(t.baseHT),
        euros(t.tva),
        euros(t.ttc),
        String(t.nbDocuments),
      ])
    : [["Aucune base taxable sur la période", "", "", "", ""]];

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Taux", "Base taxable HT", "TVA collectée", "Total TTC", "Nb factures"]],
    body,
    foot: input.tva.length
      ? [["Total", euros(totalBase), euros(input.totalTva), euros(totalTtc), String(totalDocs)]]
      : undefined,
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    footStyles: { fillColor: [247, 245, 241], textColor: [32, 30, 27], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", cellWidth: 74 },
    },
  });

  // Répartition visuelle (barres) sous le tableau
  let barY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 26;
  if (input.tva.length > 0) {
    if (barY > pageH - 120) {
      doc.addPage();
      barY = margin + 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Répartition de la base taxable", margin, barY);
    barY += 16;

    const barW = pageW - margin * 2;
    input.tva.forEach((t) => {
      const pct = totalBase > 0 ? t.baseHT / totalBase : 0;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(`Taux ${tauxLabel(t.taux)}`, margin, barY + 9);
      doc.text(`${Math.round(pct * 100)} %`, pageW - margin, barY + 9, { align: "right" });
      doc.setFillColor(232, 228, 222);
      doc.roundedRect(margin, barY + 14, barW, 6, 3, 3, "F");
      doc.setFillColor(196, 120, 58);
      const fillW = Math.max(4, barW * pct);
      if (pct > 0) doc.roundedRect(margin, barY + 14, fillW, 6, 3, 3, "F");
      barY += 30;
    });
  }

  // Note de bas de tableau
  const noteY = barY + 6;
  if (noteY < pageH - 70) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      "La TVA collectée est calculée à partir du taux propre à chaque ligne de facture (20 %, 10 %, 5,5 %…). Les avoirs sont exclus.",
      margin,
      noteY,
      { maxWidth: pageW - margin * 2 },
    );
  }

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
    doc.text("Récapitulatif généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface JournalComptablePdfInput {
  emetteur: RecapTvaPdfInput["emetteur"];
  /** Libellé de la période / du client filtré (affiché sous le titre). */
  filtreLabel: string;
  /** Journal consolidé (devis + factures/avoirs + paiements), trié chronologiquement. */
  lignes: JournalLigne[];
  /** Totaux de synthèse de la période. */
  totaux: ComptaTotaux;
  /** Ventilation de la TVA collectée par taux. */
  tva: TvaParTaux[];
}

/**
 * Construit un PDF « journal comptable complet » pour une période : en-tête émetteur,
 * synthèse de la période, journal chronologique (devis, factures/avoirs, paiements) et
 * récapitulatif de TVA par taux. Un seul document à transmettre au comptable.
 */
export function buildJournalComptablePdf(input: JournalComptablePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Titre + métadonnées
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("JOURNAL COMPTABLE", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Devis, factures et paiements consolidés", margin, 71);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(input.filtreLabel, pageW - margin, 71, { align: "right" });

  // Bloc émetteur
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    input.emetteur.metier,
    input.emetteur.telephone,
    input.emetteur.email,
    input.emetteur.siret ? `SIRET : ${input.emetteur.siret}` : null,
    input.emetteur.tva ? `N° TVA : ${input.emetteur.tva}` : null,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 115 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Indicateurs de synthèse (4 encadrés)
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 46;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "FACTURÉ HT", value: euros(input.totaux.factureHT) },
    { label: "TVA COLLECTÉE", value: euros(input.totaux.tvaCollectee) },
    { label: "ENCAISSÉ TTC", value: euros(input.totaux.encaisse) },
    { label: "RESTE À ENCAISSER", value: euros(input.totaux.resteAEncaisser) },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 13, boxTop + 17);
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 13, boxTop + 35);
  });

  let y = boxTop + boxH + 28;

  // Tableau du journal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Journal de la période", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${input.lignes.length} ligne${input.lignes.length > 1 ? "s" : ""}`, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Date", "Type", "N°", "Client", "HT", "TVA", "TTC", "Statut"]],
    body: input.lignes.length
      ? input.lignes.map((l) => [
          l.date || "—",
          l.type,
          l.numero,
          l.client || "Sans client",
          euros(l.ht),
          euros(l.tva),
          euros(l.ttc),
          l.statut,
        ])
      : [["Aucun mouvement sur la période", "", "", "", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: 4.5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 50 },
      2: { cellWidth: 66 },
      4: { halign: "right", cellWidth: 58 },
      5: { halign: "right", cellWidth: 48 },
      6: { halign: "right", cellWidth: 62 },
      7: { cellWidth: 58 },
    },
  });

  let afterJournal = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Récapitulatif de TVA par taux
  if (afterJournal > pageH - 170) {
    doc.addPage();
    afterJournal = margin + 10;
  }
  y = afterJournal + 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("TVA collectée par taux", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${input.tva.length} taux`, pageW - margin, y, { align: "right" });

  const totalBase = input.tva.reduce((s, t) => s + t.baseHT, 0);
  const totalTtc = input.tva.reduce((s, t) => s + t.ttc, 0);
  const totalDocs = input.tva.reduce((s, t) => s + t.nbDocuments, 0);

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Taux", "Base taxable HT", "TVA collectée", "Total TTC", "Nb factures"]],
    body: input.tva.length
      ? input.tva.map((t) => [tauxLabel(t.taux), euros(t.baseHT), euros(t.tva), euros(t.ttc), String(t.nbDocuments)])
      : [["Aucune base taxable sur la période", "", "", "", ""]],
    foot: input.tva.length
      ? [["Total", euros(totalBase), euros(input.totaux.tvaCollectee), euros(totalTtc), String(totalDocs)]]
      : undefined,
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    footStyles: { fillColor: [247, 245, 241], textColor: [32, 30, 27], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", cellWidth: 74 },
    },
  });

  const afterTva = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Note explicative
  if (afterTva + 40 < pageH - 46) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      "Les paiements repris dans le journal correspondent aux factures encaissées, datées au jour réel du règlement. La TVA collectée est calculée à partir du taux propre à chaque ligne de facture ; les avoirs sont exclus.",
      margin,
      afterTva + 22,
      { maxWidth: pageW - margin * 2 },
    );
  }

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
    doc.text("Journal comptable généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface BalanceAgeePdfInput {
  emetteur: RecapTvaPdfInput["emetteur"];
  /** Libellé du filtre actif (période / client) rappelé sous le titre. */
  filtreLabel: string;
  /** Répartition des créances impayées par ancienneté (0-30, 30-60, +60 j). */
  balance: BalanceAgee;
  /** Détail des factures impayées (une ligne par facture), du plus ancien au plus récent. */
  detail?: Array<{ numero: string; client: string; echeance: string | null; jours: number; montant: number }>;
}

/** Date au format court français « 05/10/2026 », ou vide si absente/invalide. */
function dateFr(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

/**
 * Construit un PDF « balance âgée des créances » : en-tête émetteur, total du reste à encaisser,
 * répartition par ancienneté (0-30 j / 30-60 j / +60 j) et, en option, le détail de chaque facture
 * impayée (numéro, échéance, ancienneté, montant TTC). Document prêt à transmettre au comptable.
 */
export function buildBalanceAgeePdf(input: BalanceAgeePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Titre + métadonnées
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("BALANCE ÂGÉE DES CRÉANCES", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Montants TTC impayés répartis par ancienneté", margin, 71);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(input.filtreLabel, pageW - margin, 71, { align: "right" });

  // Bloc émetteur
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    input.emetteur.metier,
    input.emetteur.telephone,
    input.emetteur.email,
    input.emetteur.siret ? `SIRET : ${input.emetteur.siret}` : null,
    input.emetteur.tva ? `N° TVA : ${input.emetteur.tva}` : null,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 115 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Bandeau du total reste à encaisser
  const totalTop = dividerY + 20;
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, totalTop, pageW - margin * 2, 48, 6, 6, "F");
  doc.setFillColor(196, 120, 58);
  doc.rect(margin, totalTop, 4, 48, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("RESTE À ENCAISSER (TTC)", margin + 14, totalTop + 18);
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(euros(input.balance.totalMontant), margin + 14, totalTop + 37);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `${input.balance.totalCount} facture${input.balance.totalCount > 1 ? "s" : ""} impayée${input.balance.totalCount > 1 ? "s" : ""}`,
    pageW - margin - 14,
    totalTop + 30,
    { align: "right" },
  );

  let y = totalTop + 48 + 30;

  // Répartition par ancienneté
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Répartition par ancienneté", margin, y);

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Palier", "Montant TTC", "Part", "Nb factures"]],
    body: input.balance.buckets.map((b) => [
      b.label,
      euros(b.montant),
      `${input.balance.totalMontant > 0 ? Math.round((b.montant / input.balance.totalMontant) * 100) : 0} %`,
      String(b.count),
    ]),
    foot: [["Total", euros(input.balance.totalMontant), "100 %", String(input.balance.totalCount)]],
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    footStyles: { fillColor: [247, 245, 241], textColor: [32, 30, 27], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right", cellWidth: 70 },
      3: { halign: "right", cellWidth: 84 },
    },
  });

  let afterBuckets = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Détail des factures impayées (optionnel)
  const detail = input.detail ?? [];
  if (detail.length > 0) {
    if (afterBuckets > pageH - 150) {
      doc.addPage();
      afterBuckets = margin + 10;
    }
    y = afterBuckets + 30;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Détail des factures impayées", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${detail.length} facture${detail.length > 1 ? "s" : ""}`, pageW - margin, y, { align: "right" });

    autoTable(doc, {
      startY: y + 8,
      margin: { left: margin, right: margin },
      head: [["N°", "Client", "Échéance", "Ancienneté", "Montant TTC"]],
      body: detail.map((l) => [l.numero, l.client || "Sans client", dateFr(l.echeance), `${l.jours} j`, euros(l.montant)]),
      styles: {
        font: "helvetica",
        fontSize: 8.6,
        cellPadding: 5,
        textColor: [50, 46, 43],
        lineColor: [236, 232, 227],
        lineWidth: 0.5,
      },
      headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 249, 247] },
      columnStyles: {
        0: { cellWidth: 78 },
        3: { halign: "right", cellWidth: 70 },
        4: { halign: "right", cellWidth: 82 },
      },
    });
  }

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
    doc.text("Balance âgée générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface HistoriqueComptablePdfInput {
  emetteur: RecapTvaPdfInput["emetteur"];
  /** Libellé du périmètre affiché (filtres actifs). */
  filtreLabel: string;
  /** Lignes de l'historique affiché (mêmes colonnes que l'export CSV, colonne « Vers » incluse). */
  lignes: Array<{
    mois: string;
    date: string;
    mode: string;
    lignes: string;
    destinataire: string;
    type: string;
    vers: string;
  }>;
  /** Titre du document (par défaut « HISTORIQUE DES ENVOIS AU COMPTABLE »). */
  titre?: string;
  /** Sous-titre affiché sous le titre (par défaut « Journaux mensuels et récaps de régularité »). */
  sousTitre?: string;
  /** Libellé du pied de page (par défaut « Historique des envois généré avec ArtiFlow-pro »). */
  piedLabel?: string;
}

/**
 * Construit un PDF « historique des envois au comptable » : en-tête émetteur, synthèse
 * (total d'envois, récaps reçus par l'artisan / transmis au comptable) et tableau des
 * envois, avec la colonne « Vers (moi / comptable) » — un document cohérent avec l'export CSV.
 */
export function buildComptableHistoriquePdf(input: HistoriqueComptablePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Titre + métadonnées
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.titre ?? "HISTORIQUE DES ENVOIS AU COMPTABLE", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(input.sousTitre ?? "Journaux mensuels et récaps de régularité", margin, 71);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(input.filtreLabel, pageW - margin, 71, { align: "right" });

  // Bloc émetteur
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    input.emetteur.metier,
    input.emetteur.telephone,
    input.emetteur.email,
    input.emetteur.siret ? `SIRET : ${input.emetteur.siret}` : null,
    input.emetteur.tva ? `N° TVA : ${input.emetteur.tva}` : null,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 115 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Synthèse : total d'envois, récaps reçus par l'artisan / transmis au comptable.
  const total = input.lignes.length;
  const recapMoi = input.lignes.filter((l) => l.vers === "Moi").length;
  const recapComptable = input.lignes.filter((l) => l.vers === "Comptable").length;
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 46;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "ENVOIS AU TOTAL", value: String(total) },
    { label: "RÉCAPS REÇUS (VOUS)", value: String(recapMoi) },
    { label: "VERS LE COMPTABLE", value: String(recapComptable) },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, boxTop + 17);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 35);
  });

  const y = boxTop + boxH + 28;

  // Tableau des envois (mêmes colonnes que l'export CSV)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail des envois", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${total} ligne${total > 1 ? "s" : ""}`, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Mois", "Date", "Mode", "Lignes", "Destinataire", "Type", "Vers (moi / comptable)"]],
    body: total
      ? input.lignes.map((l) => [l.mois, l.date || "—", l.mode, l.lignes, l.destinataire || "—", l.type, l.vers])
      : [["Aucun envoi sur ce périmètre", "", "", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 84 },
      2: { cellWidth: 56 },
      3: { halign: "right", cellWidth: 40 },
      5: { cellWidth: 66 },
      6: { halign: "right", cellWidth: 70 },
    },
  });

  // Note de bas de tableau
  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Récap par destinataire (moi / comptable) : nombre d'envois et total de lignes
  // transmises pour chacun, en complément de la synthèse d'en-tête.
  const parDest = new Map<string, { envois: number; lignes: number }>();
  input.lignes.forEach((l) => {
    const key = l.vers === "Moi" ? "Moi" : "Comptable";
    const b = parDest.get(key) ?? { envois: 0, lignes: 0 };
    b.envois += 1;
    const n = Number(l.lignes);
    if (Number.isFinite(n)) b.lignes += n;
    parDest.set(key, b);
  });
  const versMoi = parDest.get("Moi") ?? { envois: 0, lignes: 0 };
  const versComptable = parDest.get("Comptable") ?? { envois: 0, lignes: 0 };

  let afterDest = afterTable;
  if (afterDest > pageH - 170) {
    doc.addPage();
    afterDest = margin + 10;
  }
  const destY = afterDest + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Envois et lignes par destinataire", margin, destY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("moi / comptable", pageW - margin, destY, { align: "right" });

  autoTable(doc, {
    startY: destY + 8,
    margin: { left: margin, right: margin },
    head: [["Destinataire", "Envois", "Lignes transmises"]],
    body: [
      ["Vers moi (récap artisan)", String(versMoi.envois), String(versMoi.lignes)],
      ["Vers le comptable", String(versComptable.envois), String(versComptable.lignes)],
    ],
    foot: [["Total", String(total), String(versMoi.lignes + versComptable.lignes)]],
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    footStyles: { fillColor: [247, 245, 241], textColor: [32, 30, 27], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      1: { halign: "right", cellWidth: 80 },
      2: { halign: "right", cellWidth: 120 },
    },
  });

  const afterRecapDest = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? destY;

  // Note de bas de tableau
  if (afterRecapDest + 40 < pageH - 46) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      "Colonne « Vers » : « Moi » = récap de régularité reçu par l'artisan ; « Comptable » = journal mensuel ou récap transmis au comptable.",
      margin,
      afterRecapDest + 22,
      { maxWidth: pageW - margin * 2 },
    );
  }

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
    doc.text(input.piedLabel ?? "Historique des envois généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface BilansArchivagePdfInput {
  emetteur: RecapTvaPdfInput["emetteur"];
  /** Libellé du périmètre listé (généralement le nombre d'exercices). */
  filtreLabel: string;
  /** Liste des bilans d'archivage envoyés (un par exercice). */
  bilans: Array<{
    annee: string;
    date: string;
    mode: string;
    destinataire: string;
    lignes: string;
  }>;
}

/**
 * Construit un PDF « liste des bilans d'archivage envoyés » : en-tête émetteur, synthèse
 * (nombre de bilans, d'exercices archivés et de lignes archivées) et tableau (exercice,
 * date d'envoi, mode, destinataire, nombre de lignes). Complète l'export CSV pour l'archivage
 * de la traçabilité hors application.
 */
export function buildBilansArchivagePdf(input: BilansArchivagePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Titre + métadonnées
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("BILANS D'ARCHIVAGE ENVOYÉS", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Liste des bilans transmis au comptable, un par exercice", margin, 71);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(input.filtreLabel, pageW - margin, 71, { align: "right" });

  // Bloc émetteur
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    input.emetteur.metier,
    input.emetteur.telephone,
    input.emetteur.email,
    input.emetteur.siret ? `SIRET : ${input.emetteur.siret}` : null,
    input.emetteur.tva ? `N° TVA : ${input.emetteur.tva}` : null,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 115 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Synthèse : nombre de bilans, d'exercices distincts archivés et total de lignes.
  const total = input.bilans.length;
  const exercices = new Set(
    input.bilans.map((b) => (b.annee || "").trim()).filter((a) => a && a !== "—"),
  ).size;
  const totalLignes = input.bilans.reduce((s, b) => {
    const n = Number(b.lignes);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 46;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "BILANS ENVOYÉS", value: String(total) },
    { label: "EXERCICES ARCHIVÉS", value: String(exercices) },
    { label: "LIGNES ARCHIVÉES", value: String(totalLignes) },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, boxTop + 17);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 35);
  });

  const y = boxTop + boxH + 28;

  // Tableau des bilans
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail des bilans envoyés", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${total} ligne${total > 1 ? "s" : ""}`, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Exercice", "Date d'envoi", "Mode", "Destinataire", "Nombre de lignes"]],
    body: total
      ? input.bilans.map((b) => [
          b.annee || "—",
          b.date || "—",
          b.mode || "—",
          b.destinataire || "—",
          b.lignes || "—",
        ])
      : [["Aucun bilan d'archivage envoyé", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 8.6,
      cellPadding: 5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 120 },
      2: { cellWidth: 92 },
      4: { halign: "right", cellWidth: 110 },
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  if (afterTable + 40 < pageH - 46) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      "Chaque ligne correspond au bilan d'archivage d'un exercice, transmis au comptable (automatiquement en janvier ou renvoyé manuellement). Le mode « Manuel (test) » signale un envoi de vérification.",
      margin,
      afterTable + 22,
      { maxWidth: pageW - margin * 2 },
    );
  }

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
    doc.text("Bilans d'archivage générés avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface RemplacementsPdfInput {
  emetteur: RecapTvaPdfInput["emetteur"];
  /** Libellé du périmètre listé (filtres actifs ou « tous les remplacements »). */
  filtreLabel: string;
  /** Renvois de remplacement réellement effectués (une ligne par renvoi ponctuel). */
  remplacements: Array<{
    adresse: string;
    nom: string;
    date: string;
    nature: string;
    exercice: string;
  }>;
  /**
   * Récap du mois en cours (pièces renvoyées, séparées journal / bilan), s'il est
   * fourni : repris dans un bandeau dédié sous les indicateurs de synthèse.
   */
  recapMois?: {
    journal: number;
    bilan: number;
    total: number;
    /** Libellé du mois (« octobre 2026 »). */
    moisLabel: string;
  };
  /**
   * Mention « Mois épinglé » affichée en tête du document quand le filtre « mois épinglé
   * uniquement » est actif (liste des mois surveillés).
   */
  mentionEpingle?: string;
  /**
   * Mini-récap des mois épinglés « à surveiller » (journaux / bilans par mois, plus une ligne de
   * total), repris dans un petit tableau sous les indicateurs de synthèse.
   */
  recapEpingles?: Array<{
    mois: string;
    /** Rang de surveillance du mois (1 = le plus prioritaire), affiché sous la forme « N/total ». */
    priorite?: number;
    /** Nombre total de mois épinglés surveillés, affiché après le rang (« /total »). */
    prioriteTotal?: number;
    journal: number;
    bilan: number;
    total: number;
  }>;
  /**
   * Petit libellé du mode de rangement des mois épinglés utilisé dans le document (« priorité » ou
   * « chrono »), affiché en tête de la liste des mois épinglés, pour tracer le rangement dans l'archive.
   */
  triEpinglesLabel?: string;
  /**
   * Image du mini-graphe des renvois par mois (data URL PNG), intégrée au document
   * sous le tableau. Généralement la période choisie dans la vue « Remplacements ».
   */
  chartImage?: string | null;
  /** Libellé de la période du mini-graphe (« 6 derniers mois »), affiché sous le titre de l'image. */
  chartPeriodeLabel?: string;
}

/**
 * Construit un PDF « liste des remplacements » : en-tête émetteur, synthèse (nombre de renvois,
 * d'adresses ponctuelles distinctes et d'exercices concernés) et tableau (adresse, libellé, date,
 * nature, exercice concerné). Complète l'export CSV pour tracer les envois de remplacement hors
 * application (ex. expert-comptable remplaçant).
 */
export function buildRemplacementsPdf(input: RemplacementsPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Titre + métadonnées
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("REMPLACEMENTS COMPTABLES", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Renvois de journal et de bilan à des destinataires ponctuels", margin, 71);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 54, { align: "right" });
  doc.text(input.filtreLabel, pageW - margin, 71, { align: "right" });

  // Bloc émetteur
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    input.emetteur.metier,
    input.emetteur.telephone,
    input.emetteur.email,
    input.emetteur.siret ? `SIRET : ${input.emetteur.siret}` : null,
    input.emetteur.tva ? `N° TVA : ${input.emetteur.tva}` : null,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 115 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Synthèse : nombre de renvois, d'adresses ponctuelles distinctes et d'exercices concernés.
  const total = input.remplacements.length;
  const adresses = new Set(
    input.remplacements.map((r) => (r.adresse || "").trim().toLowerCase()).filter((a) => a.length > 0),
  ).size;
  const exercices = new Set(
    input.remplacements.map((r) => (r.exercice || "").trim()).filter((a) => a && a !== "—"),
  ).size;
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 46;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "RENVOIS PONCTUELS", value: String(total) },
    { label: "ADRESSES UTILISÉES", value: String(adresses) },
    { label: "EXERCICES CONCERNÉS", value: String(exercices) },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, boxTop + 17);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 35);
  });

  let y = boxTop + boxH + 22;

  // Mention « Mois épinglé » : rappel en tête du document que la liste est restreinte aux
  // mois mis à surveiller (filtre « mois épinglé uniquement » actif).
  if (input.mentionEpingle) {
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(margin, y, pageW - margin * 2, 32, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(margin, y, 4, 32, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("MOIS ÉPINGLÉ", margin + 14, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(input.mentionEpingle, margin + 14, y + 26, { maxWidth: pageW - margin * 2 - 24 });
    y += 32 + 14;
  }

  // Mini-récap des mois épinglés « à surveiller » : journaux / bilans par mois, plus une ligne
  // de total, pour retrouver la répartition de ses mois surveillés directement dans le document.
  if (input.recapEpingles && input.recapEpingles.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Mois épinglés · journaux / bilans", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `${input.recapEpingles.length} mois surveillé${input.recapEpingles.length > 1 ? "s" : ""}`,
      pageW - margin,
      y,
      { align: "right" },
    );
    // Petit libellé d'en-tête rappelant le mode de rangement utilisé (priorité manuelle / chrono),
    // pour tracer dans l'archive le rangement appliqué aux mois épinglés.
    let recapTableY = y + 8;
    if (input.triEpinglesLabel) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(input.triEpinglesLabel, margin, y + 18);
      recapTableY = y + 26;
    }
    const totJournal = input.recapEpingles.reduce((s, m) => s + m.journal, 0);
    const totBilan = input.recapEpingles.reduce((s, m) => s + m.bilan, 0);
    const totTotal = input.recapEpingles.reduce((s, m) => s + m.total, 0);
    autoTable(doc, {
      startY: recapTableY,
      margin: { left: margin, right: margin },
      head: [["Mois épinglé", "Journaux", "Bilans", "Total"]],
      // Le rang de surveillance sous la forme « N/total » (1 = le plus prioritaire) est affiché
      // devant chaque mois, dans l'ordre de priorité de la surveillance mémorisé.
      body: input.recapEpingles.map((m) => [
        m.priorite
          ? `${m.priorite}/${m.prioriteTotal ?? input.recapEpingles?.length ?? m.priorite} · ${m.mois}`
          : m.mois,
        String(m.journal),
        String(m.bilan),
        String(m.total),
      ]),
      foot: [["Total", String(totJournal), String(totBilan), String(totTotal)]],
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        cellPadding: 6,
        textColor: [50, 46, 43],
        lineColor: [236, 232, 227],
        lineWidth: 0.5,
      },
      headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
      footStyles: { fillColor: [247, 245, 241], textColor: [32, 30, 27], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 249, 247] },
      columnStyles: {
        1: { halign: "right", cellWidth: 84 },
        2: { halign: "right", cellWidth: 84 },
        3: { halign: "right", cellWidth: 84 },
      },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 24;
  }

  // Récap du mois en cours (pièces renvoyées, journal vs bilan), s'il est fourni.
  if (input.recapMois) {
    const r = input.recapMois;
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(margin, y, pageW - margin * 2, 36, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(margin, y, 4, 36, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`CE MOIS · ${(r.moisLabel || "").toUpperCase()}`, margin + 14, y + 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(
      `${r.journal} journal${r.journal > 1 ? "x" : ""}  ·  ${r.bilan} bilan${r.bilan > 1 ? "s" : ""}  ·  ${r.total} pièce${r.total > 1 ? "s" : ""} renvoyée${r.total > 1 ? "s" : ""}`,
      margin + 14,
      y + 29,
    );
    y += 36 + 20;
  } else {
    y += 6;
  }

  // Tableau des remplacements
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail des remplacements", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${total} ligne${total > 1 ? "s" : ""}`, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Adresse", "Libellé", "Date", "Nature", "Exercice concerné"]],
    body: total
      ? input.remplacements.map((r) => [
          r.adresse || "—",
          r.nom || "—",
          r.date || "—",
          r.nature || "—",
          r.exercice || "—",
        ])
      : [["Aucun remplacement sur ce périmètre", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 8.4,
      cellPadding: 5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      2: { cellWidth: 104 },
      3: { cellWidth: 92 },
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  if (afterTable + 40 < pageH - 46) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      "Chaque ligne correspond à un renvoi de journal ou de bilan d'archivage à une adresse ponctuelle (ex. expert-comptable remplaçant), en plus ou à la place de votre comptable habituel.",
      margin,
      afterTable + 22,
      { maxWidth: pageW - margin * 2 },
    );
  }

  // Image du mini-graphe des renvois par mois (période choisie), intégrée directement au document.
  if (input.chartImage) {
    const chartW = pageW - margin * 2;
    const chartH = chartW / 1.907; // ratio 820 x 430 du graphe exporté
    const chartHeading = afterTable + 46;
    let chartTop = chartHeading;
    if (chartTop + 20 + chartH > pageH - 46) {
      doc.addPage();
      chartTop = margin + 10;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Renvois par mois", margin, chartTop);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    if (input.chartPeriodeLabel) {
      doc.text(input.chartPeriodeLabel, pageW - margin, chartTop, { align: "right" });
    }
    try {
      doc.addImage(input.chartImage, "PNG", margin, chartTop + 14, chartW, chartH);
    } catch {
      /* image illisible : le reste du document reste valide */
    }
  }

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
    doc.text("Remplacements générés avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}