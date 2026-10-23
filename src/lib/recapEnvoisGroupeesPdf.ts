import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [196, 120, 58];

/** Une ligne du détail des envois groupés du mois. */
export interface PdfRecapEnvoisGroupeesRow {
  /** Date d'envoi (jj/mm). */
  dateLabel: string;
  /** Libellé du chantier concerné. */
  chantier: string;
  /** Nom du client. */
  client: string;
  /** Adresse email réellement utilisée. */
  destinataire: string;
}

export interface PdfRecapEnvoisGroupeesInput {
  emetteur: { entreprise: string; email: string | null };
  /** Mois récapitulé (« octobre 2026 »). */
  moisLabel: string;
  stats: {
    /** Clients distincts relancés par un envoi groupé sur le mois. */
    clientsRelances: number;
    /** Emails groupés réellement partis sur le mois. */
    emailsGroupees: number;
    /** Chantiers distincts concernés. */
    chantiersRelances: number;
    /** Délai moyen (jours) avant le prochain email sur le même chantier. */
    delaiMoyenJours: number | null;
    /** Envois encore sans email suivant. */
    enAttente: number;
    /** Ancienneté moyenne (jours) de ces envois en attente. */
    attenteMoyenneJours: number | null;
  };
  rows: PdfRecapEnvoisGroupeesRow[];
  /** Les 12 derniers mois, du plus ancien au plus récent (courbe de tendance). */
  serie?: PdfComparaisonPoint[];
}

/**
 * Dessine le bloc « tendance des 12 derniers mois » : deux courbes (emails groupés et
 * clients relancés), grille, valeurs de repère, légende et mois en abscisse.
 * `top` est l'ordonnée du titre du bloc ; la fonction renvoie l'ordonnée juste sous le graphique.
 * Partagé par le récap mensuel simple et par le PDF de comparaison, pour un rendu identique.
 */
function dessinerCourbeTendance(
  doc: jsPDF,
  options: { serie: PdfComparaisonPoint[]; top: number; margin: number; pageW: number; pageH: number },
): number {
  const { serie, margin, pageW, pageH } = options;
  const maxVal = Math.max(1, ...serie.map((p) => Math.max(p.emailsGroupees, p.clientsRelances)));
  const hauteurBloc = 186;
  let blocTop = options.top;
  if (blocTop + hauteurBloc > pageH - 70) {
    doc.addPage();
    blocTop = margin + 14;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Tendance des 12 derniers mois", margin, blocTop);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("emails groupés et clients relancés, mois par mois", pageW - margin, blocTop, { align: "right" });

  // Légende des deux courbes.
  const legY = blocTop + 18;
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(1.8);
  doc.line(margin, legY - 2.5, margin + 16, legY - 2.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 74, 70);
  doc.text("Emails groupés", margin + 21, legY);
  doc.setDrawColor(96, 112, 128);
  doc.line(margin + 96, legY - 2.5, margin + 112, legY - 2.5);
  doc.text("Clients relancés", margin + 117, legY);

  const plotTop = blocTop + 34;
  const plotBottom = blocTop + 166;
  const plotLeft = margin + 22;
  const plotRight = pageW - margin;

  // Grille horizontale et valeurs de repère.
  [0, 0.5, 1].forEach((frac) => {
    const gy = plotBottom - frac * (plotBottom - plotTop);
    doc.setDrawColor(frac === 0 ? LINE[0] : 240, frac === 0 ? LINE[1] : 238, frac === 0 ? LINE[2] : 234);
    doc.setLineWidth(frac === 0 ? 1 : 0.5);
    doc.line(plotLeft, gy, plotRight, gy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(String(Math.round(maxVal * frac)), plotLeft - 5, gy + 2, { align: "right" });
  });

  const stepX = (plotRight - plotLeft) / (serie.length - 1);
  const point = (index: number, valeur: number): [number, number] => [
    plotLeft + index * stepX,
    plotBottom - (valeur / maxVal) * (plotBottom - plotTop),
  ];

  const tracer = (valeurs: number[], couleur: [number, number, number]) => {
    doc.setDrawColor(couleur[0], couleur[1], couleur[2]);
    doc.setLineWidth(1.7);
    for (let i = 0; i < valeurs.length - 1; i += 1) {
      const [x1, y1] = point(i, valeurs[i]);
      const [x2, y2] = point(i + 1, valeurs[i + 1]);
      doc.line(x1, y1, x2, y2);
    }
    doc.setFillColor(couleur[0], couleur[1], couleur[2]);
    valeurs.forEach((valeur, i) => {
      const [x, y] = point(i, valeur);
      doc.circle(x, y, 1.8, "F");
    });
  };

  tracer(serie.map((p) => p.emailsGroupees), ACCENT);
  tracer(serie.map((p) => p.clientsRelances), [96, 112, 128]);

  serie.forEach((p, i) => {
    const [x] = point(i, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(p.moisLabel, x, plotBottom + 12, { align: "center" });
  });

  return plotBottom + 16;
}

/**
 * Construit le PDF du récap mensuel des envois groupés : à ranger avec les archives clients.
 * Mêmes chiffres que la carte de suivi affichée dans l'application.
 */
export async function buildRecapEnvoisGroupeesPdf(input: PdfRecapEnvoisGroupeesInput): Promise<jsPDF> {
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
  doc.setFontSize(14);
  doc.setTextColor(38, 36, 33);
  doc.text("RÉCAP MENSUEL DES ENVOIS GROUPÉS", pageW - margin, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(input.moisLabel, pageW - margin, 68, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 82, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 94, pageW - margin, 94);

  // Indicateurs (4 encadrés)
  const gap = 10;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 52;
  const boxTop = 110;
  const delaiLabel =
    input.stats.delaiMoyenJours === null
      ? "—"
      : `${input.stats.delaiMoyenJours.toString().replace(".", ",")} j`;
  const kpis = [
    { label: "CLIENTS RELANCÉS", value: String(input.stats.clientsRelances), sub: "clients distincts" },
    { label: "EMAILS GROUPÉS", value: String(input.stats.emailsGroupees), sub: "réellement partis" },
    { label: "CHANTIERS CONCERNÉS", value: String(input.stats.chantiersRelances), sub: "relancés ce mois-ci" },
    {
      label: "DÉLAI AVANT LE PROCHAIN EMAIL",
      value: delaiLabel,
      sub:
        input.stats.enAttente > 0
          ? `${input.stats.enAttente} en attente${
              input.stats.attenteMoyenneJours !== null
                ? ` (${input.stats.attenteMoyenneJours.toString().replace(".", ",")} j)`
                : ""
            }`
          : "moyenne sur le même chantier",
    },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 12, boxTop + 16);
    doc.setFontSize(14);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 12, boxTop + 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(doc.splitTextToSize(b.sub, boxW - 22)[0] ?? "", bx + 12, boxTop + 45);
  });

  const y = boxTop + boxH + 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Détail des envois groupés (${input.rows.length})`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(input.moisLabel, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Date", "Chantier", "Client", "Destinataire"]] as string[][],
    body: input.rows.length
      ? input.rows.map((r) => [r.dateLabel, r.chantier, r.client, r.destinataire])
      : [["—", "Aucun envoi groupé sur ce mois", "", ""]],
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
      0: { cellWidth: 62 },
      1: { cellWidth: 170 },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Courbe des 12 derniers mois : la tendance de fond des relances groupées, au-delà du seul
  // mois récapitulé. Même graphique que dans le PDF de comparaison.
  const serieMensuelle = input.serie ?? [];
  const apresCourbe =
    serieMensuelle.length >= 2
      ? dessinerCourbeTendance(doc, {
          serie: serieMensuelle,
          top: finalY + 44,
          margin,
          pageW,
          pageH,
        })
      : finalY;

  // Encart de lecture : rappelle ce que mesurent les chiffres, pour l'archive.
  const lecture = doc.splitTextToSize(
    "Un envoi groupé regroupe dans un seul email tous les chantiers silencieux d'un même client, avec son avancement réel et son lien de suivi. Un client n'est compté qu'une fois, même si plusieurs de ses chantiers ont été relancés. Le délai mesure le temps écoulé entre un envoi groupé et l'email suivant sur le même chantier.",
    pageW - margin * 2 - 28,
  ) as string[];
  const lectureH = 30 + lecture.length * 11;
  let lectureY = apresCourbe + 24;
  if (lectureY + lectureH > pageH - 70) {
    doc.addPage();
    lectureY = margin + 10;
  }
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, lectureY, pageW - margin * 2, lectureH, 6, 6, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(margin, lectureY, 4, lectureH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("LECTURE", margin + 14, lectureY + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 74, 70);
  lecture.forEach((line, i) => {
    doc.text(line, margin + 14, lectureY + 31 + i * 11);
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
    doc.text("Récap généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

/** Un mois comparé dans le PDF de comparaison. */
export interface PdfComparaisonMois {
  /** Libellé du mois (« Septembre 2026 »). */
  moisLabel: string;
  stats: PdfRecapEnvoisGroupeesInput["stats"];
}

/** Un mois de la courbe de tendance (12 derniers mois). */
export interface PdfComparaisonPoint {
  /** Libellé court du mois (« oct. 25 »). */
  moisLabel: string;
  /** Emails groupés réellement partis ce mois-là. */
  emailsGroupees: number;
  /** Clients distincts relancés ce mois-là. */
  clientsRelances: number;
}

export interface PdfComparaisonRecapInput {
  emetteur: { entreprise: string; email: string | null };
  /** Mois de référence (le plus ancien). */
  a: PdfComparaisonMois;
  /** Mois comparé (le plus récent). */
  b: PdfComparaisonMois;
  /** Les 12 derniers mois, du plus ancien au plus récent (courbe de tendance). */
  serie?: PdfComparaisonPoint[];
}

/** Nombre au format français avec signe explicite (« +3 » / « -2 » / « = »). */
function deltaLabel(valeur: number, suffixe = ""): string {
  if (valeur === 0) return `= ${suffixe}`.trim();
  const signe = valeur > 0 ? "+" : "−";
  const abs = Math.abs(valeur);
  const texte = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(".", ",");
  return `${signe}${texte}${suffixe ? ` ${suffixe}` : ""}`;
}

/** Écart relatif en pourcentage, ou null quand la base est nulle. */
function pourcentageEvolution(avant: number, apres: number): string {
  if (avant === 0) return apres === 0 ? "stable" : "nouveau";
  const pct = Math.round(((apres - avant) / Math.abs(avant)) * 100);
  if (pct === 0) return "stable";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)} %`;
}

/**
 * Construit le PDF de comparaison de deux mois de récap des envois groupés :
 * les mêmes chiffres que la carte de suivi, côte à côte, avec l'évolution et une
 * lecture rapide de la progression. Sert de preuve à joindre aux archives clients.
 */
export async function buildComparaisonRecapEnvoisGroupeesPdf(
  input: PdfComparaisonRecapInput,
): Promise<jsPDF> {
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
  doc.setFontSize(14);
  doc.setTextColor(38, 36, 33);
  doc.text("COMPARAISON DE DEUX MOIS", pageW - margin, 52, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Envois groupés aux clients silencieux`, pageW - margin, 68, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 82, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 94, pageW - margin, 94);

  // Deux encadrés de tête : le mois de référence et le mois comparé.
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap) / 2;
  const boxH = 58;
  const boxTop = 110;
  [
    { titre: "MOIS DE RÉFÉRENCE", label: input.a.moisLabel, emphase: false },
    { titre: "MOIS COMPARÉ", label: input.b.moisLabel, emphase: true },
  ].forEach((box, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(box.titre, bx + 14, boxTop + 18);
    doc.setFontSize(15);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(box.label, bx + 14, boxTop + 40);
    if (box.emphase) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.text("mois le plus récent", bx + 14, boxTop + 51);
    }
  });

  const a = input.a.stats;
  const b = input.b.stats;
  const delaiTexte = (v: number | null) => (v === null ? "—" : `${v.toString().replace(".", ",")} j`);

  const lignes: { indicateur: string; avant: string; apres: string; delta: string; evolution: string }[] = [
    {
      indicateur: "Clients relancés",
      avant: String(a.clientsRelances),
      apres: String(b.clientsRelances),
      delta: deltaLabel(b.clientsRelances - a.clientsRelances),
      evolution: pourcentageEvolution(a.clientsRelances, b.clientsRelances),
    },
    {
      indicateur: "Emails groupés envoyés",
      avant: String(a.emailsGroupees),
      apres: String(b.emailsGroupees),
      delta: deltaLabel(b.emailsGroupees - a.emailsGroupees),
      evolution: pourcentageEvolution(a.emailsGroupees, b.emailsGroupees),
    },
    {
      indicateur: "Chantiers concernés",
      avant: String(a.chantiersRelances),
      apres: String(b.chantiersRelances),
      delta: deltaLabel(b.chantiersRelances - a.chantiersRelances),
      evolution: pourcentageEvolution(a.chantiersRelances, b.chantiersRelances),
    },
    {
      indicateur: "Délai avant le prochain email",
      avant: delaiTexte(a.delaiMoyenJours),
      apres: delaiTexte(b.delaiMoyenJours),
      delta:
        a.delaiMoyenJours !== null && b.delaiMoyenJours !== null
          ? deltaLabel(Math.round((b.delaiMoyenJours - a.delaiMoyenJours) * 10) / 10, "j")
          : "—",
      evolution:
        a.delaiMoyenJours !== null && b.delaiMoyenJours !== null
          ? Math.round(b.delaiMoyenJours - a.delaiMoyenJours) === 0
            ? "stable"
            : b.delaiMoyenJours < a.delaiMoyenJours
              ? "plus rapide"
              : "plus lent"
          : "—",
    },
    {
      indicateur: "Envois en attente de suite",
      avant: String(a.enAttente),
      apres: String(b.enAttente),
      delta: deltaLabel(b.enAttente - a.enAttente),
      evolution: pourcentageEvolution(a.enAttente, b.enAttente),
    },
  ];

  const introY = boxTop + boxH + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Progression des relances groupées", margin, introY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${input.a.moisLabel} → ${input.b.moisLabel}`, pageW - margin, introY, { align: "right" });

  autoTable(doc, {
    startY: introY + 8,
    margin: { left: margin, right: margin },
    head: [["Indicateur", input.a.moisLabel, input.b.moisLabel, "Écart", "Évolution"]] as string[][],
    body: lignes.map((l) => [l.indicateur, l.avant, l.apres, l.delta, l.evolution]),
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
      0: { cellWidth: 190 },
      1: { halign: "right", cellWidth: 80 },
      2: { halign: "right", cellWidth: 80 },
      3: { halign: "right", cellWidth: 62 },
      4: { halign: "right", cellWidth: 80 },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? introY;

  // Courbe des 12 derniers mois : la tendance de fond des relances groupées, au-delà de
  // la simple comparaison de deux mois. Même bloc que dans le récap mensuel simple.
  const serie = input.serie ?? [];
  const apresCourbeY =
    serie.length >= 2
      ? dessinerCourbeTendance(doc, { serie, top: finalY + 44, margin, pageW, pageH })
      : finalY;

  // Lecture rapide : la phrase qui résume la progression d'un coup d'œil.
  const ecartClients = b.clientsRelances - a.clientsRelances;
  const phraseClients =
    ecartClients > 0
      ? `${ecartClients} client${ecartClients > 1 ? "s" : ""} de plus relancé${ecartClients > 1 ? "s" : ""} par un envoi groupé.`
      : ecartClients < 0
        ? `${Math.abs(ecartClients)} client${Math.abs(ecartClients) > 1 ? "s" : ""} de moins relancé${Math.abs(ecartClients) > 1 ? "s" : ""} qu'au mois de référence.`
        : "Autant de clients relancés que sur le mois de référence.";
  const phraseEmails =
    b.emailsGroupees === a.emailsGroupees
      ? "Le volume d'emails groupés est identique."
      : `${b.emailsGroupees} email${b.emailsGroupees > 1 ? "s" : ""} groupé${b.emailsGroupees > 1 ? "s" : ""} contre ${a.emailsGroupees} le mois de référence.`;
  const phraseDelai =
    a.delaiMoyenJours !== null && b.delaiMoyenJours !== null
      ? b.delaiMoyenJours < a.delaiMoyenJours
        ? `Les clients sont recontactés plus vite (${delaiTexte(b.delaiMoyenJours)} au lieu de ${delaiTexte(a.delaiMoyenJours)}).`
        : b.delaiMoyenJours > a.delaiMoyenJours
          ? `Le délai avant le prochain email s'allonge (${delaiTexte(b.delaiMoyenJours)} au lieu de ${delaiTexte(a.delaiMoyenJours)}).`
          : "Le délai avant le prochain email est stable."
      : "Le délai avant le prochain email n'est pas encore mesurable sur les deux mois.";

  const lecture = doc.splitTextToSize(
    `${phraseClients} ${phraseEmails} ${phraseDelai} Un client n'est compté qu'une fois par mois, même si plusieurs de ses chantiers ont été relancés ; le délai mesure le temps écoulé entre un envoi groupé et l'email suivant sur le même chantier.`,
    pageW - margin * 2 - 28,
  ) as string[];
  const lectureH = 30 + lecture.length * 11;
  let lectureY = apresCourbeY + 24;
  if (lectureY + lectureH > pageH - 60) {
    doc.addPage();
    lectureY = margin + 10;
  }
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, lectureY, pageW - margin * 2, lectureH, 6, 6, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(margin, lectureY, 4, lectureH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("À RETENIR", margin + 14, lectureY + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 74, 70);
  lecture.forEach((line, i) => {
    doc.text(line, margin + 14, lectureY + 31 + i * 11);
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
    doc.text("Comparaison générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}