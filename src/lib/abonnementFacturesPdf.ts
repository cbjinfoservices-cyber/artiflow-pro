import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];

/** Montant au format comptable français (« 1 250,00 € »). */
function euros(value: number, devise: string): string {
  const v = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2, style: "currency", currency: devise || "EUR" }).format(v);
  } catch {
    return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise || ""}`.trim();
  }
}

export interface FactureArchiveRow {
  numero: string;
  /** Date déjà mise en forme (« 05 oct. 2026 ») ou « Date inconnue ». */
  dateLabel: string;
  montant: number;
  devise: string;
  statutLabel: string;
}

export interface FacturesAbonnementPdfInput {
  emetteur: {
    entreprise: string;
    email: string | null;
    metier: string | null;
  };
  /** Libellé du périmètre exporté (année / statut actifs). */
  filtreLabel: string;
  factures: FactureArchiveRow[];
  /** Unité des montants : « HT » ou « TTC », selon le réglage de l'abonnement. */
  mention: "HT" | "TTC";
  /** Total de la sélection, déjà formulé (« 348,00 € » ou « 120,00 € + 30,00 $ »). */
  totalLabel: string;
  /** Récapitulatif par exercice (une ligne par année) affiché en tête du document. */
  recapParAnnee?: { annee: string; nombre: number; totalLabel: string; statuts?: string }[];
  /** Résumé global des statuts (payées / en attente / impayées) pour la ligne de clôture. */
  recapTotalStatuts?: string;
  /** Offre en cours, rappelée dans l'en-tête (facultatif). */
  offre?: string;
}

/**
 * Construit un PDF « archive des factures d'abonnement » : en-tête émetteur, synthèse
 * (nombre de factures + total HT de la sélection) et tableau détaillé (date, n° facture,
 * montant, devise, statut). Pensé pour l'archivage comptable, en complément de l'export CSV.
 */
export function buildFacturesAbonnementPdf(input: FacturesAbonnementPdfInput): jsPDF {
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
  doc.text("FACTURES D'ABONNEMENT", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Archive de vos reçus Stripe", margin, 71);

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
    input.offre ? `Offre : ${input.offre}` : null,
    input.emetteur.metier,
    input.emetteur.email,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 115 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Synthèse : nombre de factures + total HT de la sélection
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap) / 2;
  const boxH = 48;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "FACTURES DANS LA SÉLECTION", value: String(input.factures.length) },
    { label: `TOTAL ${input.mention} DE LA SÉLECTION`, value: input.totalLabel || "—" },
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
    doc.text(b.label, bx + 14, boxTop + 18);
    doc.setFontSize(14);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 37);
  });

  let y = boxTop + boxH + 26;

  // Récapitulatif par exercice (une ligne par année) — en tête, avant le détail.
  const recap = input.recapParAnnee ?? [];
  if (recap.length) {
    const nbTotal = recap.reduce((sum, r) => sum + r.nombre, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Total par exercice", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${nbTotal} facture${nbTotal > 1 ? "s" : ""}`, pageW - margin, y, { align: "right" });

    autoTable(doc, {
      startY: y + 6,
      margin: { left: margin, right: margin },
      head: [["Exercice", "Factures", `Total ${input.mention}`, "Statut"]],
      body: recap.map((r) => [
        r.annee && r.annee !== "—" ? r.annee : "Date inconnue",
        String(r.nombre),
        r.totalLabel || "—",
        r.statuts || "—",
      ]),
      // Ligne de clôture : cumul de tous les exercices de la sélection.
      foot: [["Total (toutes années)", String(nbTotal), input.totalLabel || "—", input.recapTotalStatuts || "—"]],
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 5.5,
        textColor: [50, 46, 43],
        lineColor: [236, 232, 227],
        lineWidth: 0.5,
      },
      headStyles: { fillColor: [69, 63, 56], textColor: [249, 247, 244], fontStyle: "bold" },
      footStyles: { fillColor: [240, 236, 231], textColor: [60, 55, 50], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 249, 247] },
      columnStyles: {
        0: { cellWidth: 84 },
        1: { halign: "right", cellWidth: 62 },
        2: { halign: "right", cellWidth: 104 },
        3: { cellWidth: "auto" },
      },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 26;
  }

  // Tableau des factures
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Détail des factures", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `${input.factures.length} facture${input.factures.length > 1 ? "s" : ""}`,
    pageW - margin,
    y,
    { align: "right" },
  );

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["Date", "N° facture", "Montant", "Devise", "Statut"]],
    body: input.factures.length
      ? input.factures.map((f) => [
          f.dateLabel || "—",
          f.numero || "—",
          euros(f.montant, f.devise),
          f.devise || "EUR",
          f.statutLabel || "—",
        ])
      : [["Aucune facture dans la sélection", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5.5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 100 },
      2: { halign: "right", cellWidth: 82 },
      3: { cellWidth: 56 },
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Note de bas de tableau
  if (afterTable + 44 < pageH - 46) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `Montants exprimés en ${input.mention}, tels qu'émis par Stripe sur chaque facture d'abonnement. Ce document complète l'export CSV pour l'archivage comptable.`,
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
    doc.text("Factures d'abonnement générées avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface PrelevementRow {
  numero: string;
  /** Date déjà mise en forme (« 05 oct. 2026 ») ou « Date inconnue ». */
  dateLabel: string;
  montant: number;
  devise: string;
  statutLabel: string;
}

export interface RelevePrelevementsPdfInput {
  emetteur: {
    entreprise: string;
    email: string | null;
    metier: string | null;
  };
  /** Libellé du périmètre exporté (année / statut actifs). */
  filtreLabel: string;
  mention: "HT" | "TTC";
  /** Total de la sélection, déjà formulé. */
  totalLabel: string;
  prelevements: PrelevementRow[];
  /** Offre en cours, rappelée dans l'en-tête (facultatif). */
  offre?: string;
}

/**
 * Construit un PDF « relevé des prélèvements d'abonnement » : en-tête émetteur, synthèse
 * (nombre de prélèvements + total) puis une ligne par prélèvement (date, n° facture, montant,
 * devise, statut) avec une ligne de total. Sert de pièce comptable dans le « pack comptable ».
 */
export function buildRelevePrelevementsPdf(input: RelevePrelevementsPdfInput): jsPDF {
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
  doc.text("RELEVÉ DES PRÉLÈVEMENTS", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Détail des prélèvements de votre abonnement", margin, 71);

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
    input.offre ? `Offre : ${input.offre}` : null,
    input.emetteur.metier,
    input.emetteur.email,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 115 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(120, 115 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Synthèse : nombre de prélèvements + total de la sélection
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap) / 2;
  const boxH = 48;
  const boxTop = dividerY + 20;
  const kpis = [
    { label: "PRÉLÈVEMENTS DANS LA SÉLECTION", value: String(input.prelevements.length) },
    { label: `TOTAL ${input.mention} PRÉLEVÉ`, value: input.totalLabel || "—" },
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
    doc.text(b.label, bx + 14, boxTop + 18);
    doc.setFontSize(14);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 37);
  });

  const y = boxTop + boxH + 26;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Date", "N° facture", "Montant", "Devise", "Statut"]],
    body: input.prelevements.length
      ? input.prelevements.map((p) => [
          p.dateLabel || "—",
          p.numero || "—",
          euros(p.montant, p.devise),
          p.devise || "EUR",
          p.statutLabel || "—",
        ])
      : [["Aucun prélèvement dans la sélection", "", "", "", ""]],
    foot: [["Total des prélèvements", "", input.totalLabel || "—", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5.5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    footStyles: { fillColor: [240, 236, 231], textColor: [60, 55, 50], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 110 },
      2: { halign: "right", cellWidth: 96 },
      3: { cellWidth: 56 },
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Note de bas de tableau
  if (afterTable + 44 < pageH - 46) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `Montants exprimés en ${input.mention}, tels qu'émis par Stripe sur chaque prélèvement d'abonnement. Ce relevé complète le récapitulatif et le CSV pour l'archivage comptable.`,
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
    doc.text("Relevé des prélèvements généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface PackComptableSommaireInput {
  emetteur: {
    entreprise: string;
    email: string | null;
    metier: string | null;
  };
  /** Libellé du périmètre exporté (année / statut actifs). */
  filtreLabel: string;
  /** Unité des montants : « HT » ou « TTC ». */
  mention: "HT" | "TTC";
  /** Total de la sélection, déjà formulé. */
  totalLabel: string;
  /** Nombre de pièces (factures) du périmètre. */
  nombreFactures: number;
  /** Fichiers contenus dans l'archive, avec la description affichée dans le sommaire. */
  fichiers: { nom: string; description: string }[];
  /** Offre en cours, rappelée dans l'en-tête (facultatif). */
  offre?: string;
  /** Titre principal de la page de garde (par défaut « PACK COMPTABLE »). */
  titre?: string;
  /** Sous-titre de la page de garde (par défaut « Archive comptable de votre abonnement »). */
  sousTitre?: string;
}

/**
 * Construit la page de garde du « pack comptable » : titre, émetteur, périmètre filtré
 * (mentions, nombre de factures, total) et sommaire détaillé des fichiers contenus dans
 * l'archive. Placée en tête du ZIP pour un envoi au comptable immédiatement lisible.
 */
export function buildSommairePackComptablePdf(input: PackComptableSommaireInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.titre ?? "PACK COMPTABLE", margin, 92);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(input.sousTitre ?? "Archive comptable de votre abonnement", margin, 112);

  doc.setFontSize(10.5);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 92, { align: "right" });
  doc.text("Votre abonnement ArtiFlow-pro", pageW - margin, 112, { align: "right", maxWidth: 200 });

  // Bloc émetteur
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", margin, 148);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [
    input.offre ? `Offre : ${input.offre}` : null,
    input.emetteur.metier,
    input.emetteur.email,
  ].filter((v): v is string => Boolean(v && String(v).trim().length > 0));
  emetteurLines.forEach((line, i) => {
    doc.text(line, margin, 163 + i * 12);
  });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  const dividerY = Math.max(168, 163 + emetteurLines.length * 12 + 6);
  doc.line(margin, dividerY, pageW - margin, dividerY);

  // Périmètre : quatre repères de synthèse (filtres, mention, nombre de factures, total).
  let y = dividerY + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Périmètre du pack", margin, y);
  y += 12;

  const reperes: { label: string; value: string }[] = [
    { label: "PÉRIMÈTRE", value: input.filtreLabel || "—" },
    { label: "MONTANTS", value: `Exprimés en ${input.mention}` },
    { label: "FACTURES", value: String(input.nombreFactures) },
    { label: `TOTAL ${input.mention}`, value: input.totalLabel || "—" },
  ];
  const gap = 12;
  const colW = (pageW - margin * 2 - gap) / 2;
  const cellH = 44;
  reperes.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = margin + col * (colW + gap);
    const by = y + row * (cellH + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, by, colW, cellH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, by, 4, cellH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(r.label, bx + 14, by + 17);
    doc.setFontSize(12);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(r.value || "—", bx + 14, by + 34, { maxWidth: colW - 24 });
  });
  y += 2 * (cellH + gap) + 14;

  // Sommaire des fichiers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Sommaire de l'archive", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${input.fichiers.length} document${input.fichiers.length > 1 ? "s" : ""}`, pageW - margin, y, {
    align: "right",
  });

  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [["N°", "Fichier", "Contenu"]],
    body: input.fichiers.map((f, i) => [String(i + 1), f.nom, f.description]),
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: 200, fontStyle: "bold" },
      2: { cellWidth: "auto" },
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  if (afterTable + 52 < pageH - 46) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `Ce pack regroupe l'ensemble des pièces comptables de votre abonnement sur le périmètre indiqué. Les montants sont exprimés en ${input.mention}, tels qu'émis par Stripe, et servent à déclarer l'unité, non à recalculer la TVA.`,
      margin,
      afterTable + 22,
      { maxWidth: pageW - margin * 2 },
    );
  }

  // Pied de page
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `Page de garde — ${input.titre ?? "Pack comptable"} — générée avec ArtiFlow-pro`,
    margin,
    pageH - 28,
  );
  doc.text("1 / 1", pageW - margin, pageH - 28, { align: "right" });

  return doc;
}