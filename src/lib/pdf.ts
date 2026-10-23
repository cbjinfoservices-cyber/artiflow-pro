import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { metierLabel } from "@/lib/metiers";

export interface PdfLigne {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  /** Taux de TVA appliqué à la ligne, en pourcentage (20 par défaut). */
  taux_tva?: number;
}

/** Libellé du taux de TVA au format français (« 20 % », « 5,5 % »). */
function tvaRateLabel(value: number | undefined): string {
  const n = Number(value);
  const rate = Number.isFinite(n) && n >= 0 ? n : 20;
  return `${String(rate).replace(".", ",")} %`;
}

export interface PdfEmetteur {
  entreprise: string;
  metier: string;
  telephone: string;
  email: string;
  /** Forme juridique de l'entreprise (auto-entrepreneur, EI, EURL, SARL, SASU/SAS). */
  formeJuridique?: string | null;
  logo?: string | null;
  siret?: string | null;
  tva?: string | null;
  assurance?: string | null;
  penalitesRetard?: string | null;
  /** Escompte pour paiement anticipé (texte libre), repris sur les factures. */
  escompte?: string | null;
}

export interface PdfClient {
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
}

export interface PdfSignature {
  nom: string;
  dateLabel: string;
  image?: string | null;
}

/** Apparence personnalisable des documents (issue du profil de l'artisan). */
export interface PdfDocumentStyle {
  /** Couleur d'accent (barre du bloc total, coordonnées de paiement), en RGB. */
  accent?: [number, number, number];
  /** Afficher le logo de l'entreprise en en-tête (vrai par défaut). */
  afficherLogo?: boolean;
  /** Coordonnées de paiement (IBAN / BIC, conditions), affichées sur les factures. */
  paiement?: string | null;
  /** Message de pied de page libre, affiché en bas de tous les documents (devis & factures). */
  piedPage?: string | null;
  /**
   * Modèle de mise en page du tableau des lignes :
   * - « standard » : une colonne par information (Désignation · Qté · P.U. HT · TVA · Total HT) ;
   * - « compact » : quantité + unité réunies et P.U. HT + Total HT regroupés dans une même colonne,
   *   idéal quand les désignations sont courtes et qu'on veut densifier le document.
   */
  modeleDocument?: "standard" | "compact";
  /** Ajouter la mention « facture émise au format électronique » (art. 289 bis du CGI). */
  mentionElectronique?: boolean;
  /** Mentions complémentaires libres ajoutées au pied de page. */
  mentionsSupplementaires?: string[];
}

export interface PdfDocumentInput {
  type: "devis" | "facture";
  numero: string;
  dateLabel: string;
  statut: string;
  objet: string;
  emetteur: PdfEmetteur;
  client: PdfClient | null;
  lignes: PdfLigne[];
  totalHT: number;
  totalTTC: number;
  echeanceLabel?: string;
  reference?: string;
  signature?: PdfSignature | null;
  /** Apparence personnalisée (couleur d'accent, logo, coordonnées de paiement). */
  style?: PdfDocumentStyle;
}

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];

function euros(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return /^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG";
}

function loadImageSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Construit un document PDF (devis ou facture) prêt à être enregistré. */
export async function buildDocumentPdf(input: PdfDocumentInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const isAvoir = input.type === "facture" && input.numero.startsWith("AV");
  const title = input.type === "devis" ? "DEVIS" : isAvoir ? "AVOIR" : "FACTURE";
  // Couleur d'accent du document (personnalisable depuis le profil), orange « cuivre » par défaut.
  const accent: [number, number, number] = input.style?.accent ?? [196, 120, 58];
  // Le logo peut être masqué depuis le profil, même s'il est enregistré.
  const afficherLogo = input.style?.afficherLogo !== false;

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Logo (facultatif) + émetteur
  let textX = margin;
  const logo = afficherLogo ? input.emetteur.logo : null;
  if (logo && logo.startsWith("data:image")) {
    const size = await loadImageSize(logo);
    if (size) {
      const maxW = 132;
      const maxH = 46;
      const scale = Math.min(maxW / size.w, maxH / size.h, 1);
      const lw = Math.round(size.w * scale);
      const lh = Math.round(size.h * scale);
      try {
        doc.addImage(logo, imageFormat(logo), margin, 40, lw, lh);
        textX = margin + lw + 16;
      } catch {
        textX = margin;
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", textX, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [metierLabel(input.emetteur.metier), input.emetteur.telephone, input.emetteur.email].filter(
    (v) => v && v.trim().length > 0,
  );
  emetteurLines.forEach((line, i) => {
    doc.text(line, textX, 74 + i * 13);
  });

  // Titre & métadonnées (à droite)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(38, 36, 33);
  doc.text(title, pageW - margin, 60, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`N° ${input.numero}`, pageW - margin, 78, { align: "right" });
  doc.text(input.dateLabel, pageW - margin, 92, { align: "right" });
  doc.text(`Statut : ${input.statut}`, pageW - margin, 106, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 122, pageW - margin, 122);

  // Bloc client
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("CLIENT", margin, 144);
  doc.setFontSize(11.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.client?.nom || "—", margin, 161);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90, 84, 80);
  const clientLines = [input.client?.adresse, input.client?.telephone, input.client?.email].filter(
    (v) => v && String(v).trim().length > 0,
  ) as string[];
  clientLines.forEach((line, i) => {
    doc.text(String(line), margin, 177 + i * 13);
  });

  // Objet des travaux
  let y = 177 + clientLines.length * 13 + 18;
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, y, pageW - margin * 2, 34, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Objet", margin + 14, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 74, 70);
  doc.text(input.objet || "—", margin + 14, y + 27);
  y += 34 + 16;

  // Tableau des lignes.
  // Quantité et unité sont réunies dans une même cellule (« 3 m² », « 2 intervention »).
  // Modèle standard : une colonne par information. Modèle compact : on regroupe en plus
  // P.U. HT et Total HT dans une seule colonne (P.U. en haut, Total en dessous), ce qui
  // densifie le document quand les lignes sont courtes.
  const compact = input.style?.modeleDocument === "compact";
  const tableHead = compact
    ? [["Désignation", "Qté", "P.U. HT\nTotal HT"]]
    : [["Désignation", "Qté", "P.U. HT", "TVA", "Total HT"]];
  const tableBody = input.lignes.map((l) =>
    compact
      ? [
          l.designation,
          `${l.quantite} ${l.unite}`.trim(),
          `${euros(l.prix_unitaire)}\n${euros(l.quantite * l.prix_unitaire)}`,
        ]
      : [
          l.designation,
          `${l.quantite} ${l.unite}`.trim(),
          euros(l.prix_unitaire),
          tvaRateLabel(l.taux_tva),
          euros(l.quantite * l.prix_unitaire),
        ],
  );
  const tableBodyVide = compact
    ? [["Aucune ligne détaillée", "", ""]]
    : [["Aucune ligne détaillée", "", "", "", ""]];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: tableHead,
    body: tableBody.length ? tableBody : tableBodyVide,
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: compact
      ? {
          1: { halign: "right", cellWidth: 84 },
          2: { halign: "right", cellWidth: 132 },
        }
      : {
          1: { halign: "right", cellWidth: 84 },
          2: { halign: "right", cellWidth: 74 },
          3: { halign: "right", cellWidth: 46 },
          4: { halign: "right", cellWidth: 82 },
        },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  const totalsY = finalY + 22;
  const boxW = 230;
  const boxX = pageW - margin - boxW;

  const tvaTotal = input.totalTTC - input.totalHT;
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(boxX, totalsY, boxW, 86, 6, 6, "F");
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(boxX, totalsY, 4, 86, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 74, 70);
  doc.text("Total HT", boxX + 18, totalsY + 24);
  doc.text(euros(input.totalHT), pageW - margin - 16, totalsY + 24, { align: "right" });
  doc.text("TVA", boxX + 18, totalsY + 46);
  doc.text(euros(tvaTotal), pageW - margin - 16, totalsY + 46, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Total TTC", boxX + 18, totalsY + 70);
  doc.text(euros(input.totalTTC), pageW - margin - 16, totalsY + 70, { align: "right" });

  // Bloc signature (facultatif)
  if (input.signature) {
    const sigY = totalsY + 86 + 26;
    const sigBoxW = 270;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(1);
    doc.roundedRect(margin, sigY, sigBoxW, 96, 6, 6, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("SIGNATURE DU CLIENT", margin + 14, sigY + 17);

    const sigImage = input.signature.image;
    if (sigImage && sigImage.startsWith("data:image")) {
      const size = await loadImageSize(sigImage);
      if (size) {
        const scale = Math.min(210 / size.w, 46 / size.h, 1);
        try {
          doc.addImage(sigImage, imageFormat(sigImage), margin + 14, sigY + 26, Math.round(size.w * scale), Math.round(size.h * scale));
        } catch {
          /* image illisible : on ignore le tracé */
        }
      }
    } else {
      doc.setDrawColor(200, 196, 190);
      doc.line(margin + 14, sigY + 64, margin + sigBoxW - 14, sigY + 64);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 84, 80);
    doc.text(`Signé par ${input.signature.nom} le ${input.signature.dateLabel}`, margin + 14, sigY + 86);
  }

  // Coordonnées de paiement (factures uniquement, si renseignées dans le profil).
  const paiement = input.style?.paiement?.trim();
  if (input.type === "facture" && paiement) {
    let payY = input.signature ? totalsY + 86 + 26 + 96 + 20 : totalsY + 86 + 26;
    const payLines = doc.splitTextToSize(paiement, pageW - margin * 2 - 32) as string[];
    const payH = 30 + payLines.length * 12;
    if (payY + payH > pageH - 80) {
      doc.addPage();
      payY = margin + 20;
    }
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(margin, payY, pageW - margin * 2, payH, 6, 6, "F");
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(margin, payY, 4, payH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("COORDONNÉES DE PAIEMENT", margin + 16, payY + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(80, 74, 70);
    payLines.forEach((line, i) => {
      doc.text(line, margin + 16, payY + 32 + i * 12);
    });
  }

  // Mentions légales (forme juridique / SIRET / TVA / assurance / pénalités de retard)
  const mentions: string[] = [];
  if (input.emetteur.formeJuridique) mentions.push(`Forme juridique : ${input.emetteur.formeJuridique}`);
  if (input.emetteur.siret) mentions.push(`SIRET : ${input.emetteur.siret}`);
  if (input.emetteur.tva) mentions.push(`N° TVA intracommunautaire : ${input.emetteur.tva}`);
  if (input.emetteur.assurance) mentions.push(`Assurance : ${input.emetteur.assurance}`);
  if (input.type === "facture" && input.emetteur.penalitesRetard) {
    mentions.push(`Pénalités de retard : ${input.emetteur.penalitesRetard}`);
  }
  if (input.type === "facture") {
    // Mentions obligatoires depuis la réforme de la facturation électronique.
    mentions.push("Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40 €");
    if (input.emetteur.escompte) mentions.push(`Escompte pour paiement anticipé : ${input.emetteur.escompte}`);
    if (input.style?.mentionElectronique) {
      mentions.push("Facture émise sous forme électronique (Factur-X) — art. 289 bis du CGI");
    }
  }
  (input.style?.mentionsSupplementaires ?? []).forEach((m) => {
    if (m && m.trim()) mentions.push(m.trim());
  });

  // Pied de page
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, pageH - 60, pageW - margin, pageH - 60);

  // Message de pied de page libre (facultatif) puis mentions légales, empilés au-dessus de la ligne.
  const piedPage = input.style?.piedPage?.trim();
  const footerLines: string[] = [];
  if (piedPage || mentions.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
  }
  if (piedPage) {
    const wrapped = doc.splitTextToSize(piedPage, pageW - margin * 2) as string[];
    footerLines.push(...wrapped);
    if (mentions.length) footerLines.push("");
  }
  footerLines.push(...mentions);
  if (footerLines.length) {
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const startY = pageH - 60 - 14 - (footerLines.length - 1) * 10;
    footerLines.forEach((line, i) => {
      if (line) doc.text(line, margin, startY + i * 10);
    });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Document généré avec ArtiFlow-pro", margin, pageH - 42);
  if (input.echeanceLabel) {
    doc.text(`Échéance : ${input.echeanceLabel}`, pageW - margin, pageH - 42, { align: "right" });
  }
  if (input.reference) {
    doc.text(`Réf. devis : ${input.reference}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface PdfFicheDevis {
  numero: string;
  objet: string | null;
  dateLabel: string;
  statut: string;
  totalHT: number;
}

export interface PdfFicheChantier {
  libelle: string | null;
  statut: string;
  montant: number;
  dateLabel: string;
}

export interface PdfFicheFacture {
  numero: string;
  statut: string;
  dateLabel: string;
  totalTTC: number;
}

export interface PdfFicheClientInput {
  emetteur: PdfEmetteur;
  client: {
    nom: string;
    contact?: string | null;
    secteur?: string | null;
    siret?: string | null;
    adresse?: string | null;
    telephone?: string | null;
    email?: string | null;
  };
  devis: PdfFicheDevis[];
  chantiers: PdfFicheChantier[];
  factures: PdfFicheFacture[];
  totals: { caDevis: number; totalFacture: number; chantiersEnCours: number; chantiersTotal: number };
  /** Notes internes attachées à la fiche client (facultatif). */
  notes?: string | null;
  /** Priorité de la note interne (« a_relancer », « sensible », « urgent », « info »). */
  notesPriorite?: string | null;
}

/**
 * Construit un PDF « fiche client » regroupant les devis, chantiers et factures
 * d'un client (professionnel ou particulier), avec un récapitulatif d'activité.
 */
export async function buildClientFichePdf(input: PdfFicheClientInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const isPro = Boolean(input.client.siret || input.client.secteur || input.client.contact);

  // Bandeau supérieur
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  // Logo (facultatif) + émetteur
  let textX = margin;
  const logo = input.emetteur.logo;
  if (logo && logo.startsWith("data:image")) {
    const size = await loadImageSize(logo);
    if (size) {
      const maxW = 132;
      const maxH = 46;
      const scale = Math.min(maxW / size.w, maxH / size.h, 1);
      const lw = Math.round(size.w * scale);
      const lh = Math.round(size.h * scale);
      try {
        doc.addImage(logo, imageFormat(logo), margin, 40, lw, lh);
        textX = margin + lw + 16;
      } catch {
        textX = margin;
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.emetteur.entreprise || "Mon entreprise", textX, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const emetteurLines = [metierLabel(input.emetteur.metier), input.emetteur.telephone, input.emetteur.email].filter(
    (v) => v && v.trim().length > 0,
  );
  emetteurLines.forEach((line, i) => {
    doc.text(line, textX, 74 + i * 13);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(38, 36, 33);
  doc.text("FICHE CLIENT", pageW - margin, 60, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 78, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 100, pageW - margin, 100);

  // Bloc client
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(isPro ? "CLIENT PROFESSIONNEL" : "CLIENT", margin, 122);
  doc.setFontSize(13);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(input.client.nom || "—", margin, 141);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90, 84, 80);
  const clientLines: string[] = [];
  if (input.client.contact) clientLines.push(`Interlocuteur : ${input.client.contact}`);
  if (input.client.secteur) clientLines.push(`Secteur : ${input.client.secteur}`);
  if (input.client.siret) clientLines.push(`SIRET : ${input.client.siret}`);
  if (input.client.adresse) clientLines.push(input.client.adresse);
  if (input.client.telephone) clientLines.push(input.client.telephone);
  if (input.client.email) clientLines.push(input.client.email);
  clientLines.forEach((line, i) => {
    doc.text(String(line), margin, 158 + i * 13);
  });
  let y = 158 + clientLines.length * 13 + 16;

  // Récapitulatif d'activité (3 encadrés)
  const boxGap = 12;
  const boxW = (pageW - margin * 2 - boxGap * 2) / 3;
  const boxH = 46;
  const kpis = [
    { label: "CA devis", value: euros(input.totals.caDevis) },
    { label: "Total facturé", value: euros(input.totals.totalFacture) },
    { label: "Chantiers", value: `${input.totals.chantiersEnCours} / ${input.totals.chantiersTotal}` },
  ];
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + boxGap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, y, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, y, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label.toUpperCase(), bx + 14, y + 18);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, y + 36);
  });
  y += boxH + 26;

  // Notes internes (facultatif) : partagées avec les documents de la fiche.
  const notes = input.notes?.trim();
  if (notes) {
    const prioriteLabel: Record<string, string> = {
      a_relancer: "À RELANCER",
      sensible: "SENSIBLE",
      urgent: "URGENT",
      info: "INFO",
    };
    const tag = input.notesPriorite ? prioriteLabel[input.notesPriorite] : null;
    const noteLines = doc.splitTextToSize(notes, pageW - margin * 2 - 28) as string[];
    const noteBoxH = 30 + noteLines.length * 12 + (tag ? 14 : 0);
    if (y + noteBoxH > pageH - 60) {
      doc.addPage();
      y = margin + 10;
    }
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(margin, y, pageW - margin * 2, noteBoxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(margin, y, 4, noteBoxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("NOTES INTERNES", margin + 14, y + 18);
    if (tag) {
      doc.setTextColor(196, 120, 58);
      doc.text(`PRIORITÉ : ${tag}`, margin + 110, y + 18);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(80, 74, 70);
    noteLines.forEach((line, i) => {
      doc.text(line, margin + 14, y + 34 + i * 12);
    });
    y += noteBoxH + 26;
  }

  const tableStyles = {
    font: "helvetica" as const,
    fontSize: 9,
    cellPadding: 5,
    textColor: [50, 46, 43] as [number, number, number],
    lineColor: [236, 232, 227] as [number, number, number],
    lineWidth: 0.5,
  };
  const headStyles = { fillColor: [38, 36, 33] as [number, number, number], textColor: [249, 247, 244] as [number, number, number], fontStyle: "bold" as const };

  const drawSection = (title: string, count: number, head: string[], body: string[][], columnStyles: Record<number, { halign?: "right"; cellWidth?: number }>) => {
    if (y > pageH - 130) {
      doc.addPage();
      y = margin + 10;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(title, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${count}`, pageW - margin, y, { align: "right" });

    autoTable(doc, {
      startY: y + 6,
      margin: { left: margin, right: margin },
      head: [head],
      body: body.length ? body : [["Aucun élément", ...head.slice(1).map(() => "")]] as string[][],
      styles: tableStyles,
      headStyles,
      alternateRowStyles: { fillColor: [250, 249, 247] },
      columnStyles,
    });
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y = finalY + 28;
  };

  // Largeurs de colonnes explicites, sur la même logique que le tableau du devis/facture :
  // les colonnes de texte (Objet, Statut, Chantier) gardent assez de place pour ne pas être
  // tronquées, et les montants restent alignés à droite sur une largeur fixe.
  drawSection(
    "Devis",
    input.devis.length,
    ["Numéro", "Objet", "Date", "Statut", "Total HT"],
    input.devis.map((d) => [d.numero, d.objet ?? "—", d.dateLabel, d.statut, euros(d.totalHT)]),
    { 0: { cellWidth: 74 }, 2: { cellWidth: 76 }, 3: { cellWidth: 82 }, 4: { halign: "right", cellWidth: 84 } },
  );

  drawSection(
    "Chantiers",
    input.chantiers.length,
    ["Chantier", "Début", "Statut", "Montant"],
    input.chantiers.map((c) => [c.libelle ?? "Chantier", c.dateLabel, c.statut, euros(c.montant)]),
    { 1: { cellWidth: 92 }, 2: { cellWidth: 82 }, 3: { halign: "right", cellWidth: 86 } },
  );

  drawSection(
    "Factures",
    input.factures.length,
    ["Numéro", "Émise le", "Statut", "Total TTC"],
    input.factures.map((f) => [f.numero, f.dateLabel, f.statut, euros(f.totalTTC)]),
    { 1: { cellWidth: 92 }, 2: { cellWidth: 82 }, 3: { halign: "right", cellWidth: 86 } },
  );

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
    doc.text("Fiche générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface PdfAbonnementRow {
  entreprise: string;
  email: string | null;
  metier: string | null;
  ville: string | null;
  offre: string;
  statut: string;
  /** Forme juridique de l'entreprise (libellé lisible), ou null si non renseignée. */
  statut_juridique: string | null;
  /** Taille de l'entreprise (libellé lisible), ou null si non renseignée. */
  taille_entreprise: string | null;
  montant_mensuel: number;
  date_echeance: string | null;
}

export interface PdfAbonnementsArchiveInput {
  kpis: {
    actifs: number;
    mrr: number;
    essais: number;
    impayes: number;
    manqueImpayes: number;
    resilies: number;
    parc: number;
  };
  repartition: { offre: string; count: number; pct: number; mrr: number }[];
  /**
   * Répartition par entreprise (statut juridique + taille), dessinée sous forme de barres
   * empilées et d'un tableau, juste après les indicateurs. Facultative.
   */
  repartitionEntreprise?: {
    total: number;
    statut: { label: string; count: number; pct: number }[];
    taille: { label: string; count: number; pct: number }[];
  };
  mrrEvolution: { label: string; mrr: number }[];
  abonnements: PdfAbonnementRow[];
  filtreLabel: string;
}

/**
 * Construit un PDF d'archive du back-office Abonnements : indicateurs, répartition
 * des offres, évolution du MRR et liste filtrée des abonnements.
 */
export async function buildAbonnementsArchivePdf(input: PdfAbonnementsArchiveInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("ABONNEMENTS ARTIFLOW", margin, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Archive générée le ${new Date().toLocaleDateString("fr-FR")} · ${input.filtreLabel}`, margin, 70);

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 86, pageW - margin, 86);

  // Indicateurs (2 rangées x 3)
  const kpis = [
    { label: "ABONNÉS ACTIFS", value: String(input.kpis.actifs) },
    { label: "MRR", value: euros(input.kpis.mrr) },
    { label: "ESSAIS EN COURS", value: String(input.kpis.essais) },
    { label: "IMPAYÉS", value: `${input.kpis.impayes} · ${euros(input.kpis.manqueImpayes)}` },
    { label: "RÉSILIÉS", value: String(input.kpis.resilies) },
    { label: "PARC TOTAL", value: String(input.kpis.parc) },
  ];
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 44;
  const boxTop = 104;
  kpis.forEach((b, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = margin + col * (boxW + gap);
    const by = boxTop + row * (boxH + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, by, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, by, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, by + 17);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, by + 34);
  });

  let y = boxTop + boxH * 2 + gap + 28;

  const tableStyles = {
    font: "helvetica" as const,
    fontSize: 9,
    cellPadding: 5,
    textColor: [50, 46, 43] as [number, number, number],
    lineColor: [236, 232, 227] as [number, number, number],
    lineWidth: 0.5,
  };
  const headStyles = {
    fillColor: [38, 36, 33] as [number, number, number],
    textColor: [249, 247, 244] as [number, number, number],
    fontStyle: "bold" as const,
  };

  // Répartition par entreprise (statut juridique + taille) : barres empilées + tableau de
  // répartition, placés juste à côté des indicateurs, sur la même page que la synthèse.
  const repEnt = input.repartitionEntreprise;
  if (repEnt && (repEnt.statut.length > 0 || repEnt.taille.length > 0)) {
    const ENT_COLORS: [number, number, number][] = [
      [196, 120, 58],
      [69, 63, 56],
      [120, 150, 110],
      [150, 120, 170],
      [180, 150, 90],
      [123, 124, 120],
    ];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Répartition par entreprise", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Statut juridique et taille des abonnements de la sélection", pageW - margin, y, { align: "right" });
    y += 18;

    const contW = pageW - margin * 2;
    const barH = 16;
    const totalEnt = repEnt.total > 0 ? repEnt.total : 1;
    const blocs: { titre: string; lignes: { label: string; count: number; pct: number }[] }[] = [
      { titre: "Statut juridique", lignes: repEnt.statut },
      { titre: "Taille de l'entreprise", lignes: repEnt.taille },
    ];
    blocs.forEach((bloc) => {
      if (bloc.lignes.length === 0) return;
      if (y > pageH - 150) {
        doc.addPage();
        y = margin + 10;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(bloc.titre, margin, y);
      y += 8;

      // Barre empilée proportionnelle aux effectifs (remplit toute la largeur utile).
      let cx = margin;
      bloc.lignes.forEach((l, i) => {
        const w = (l.count / totalEnt) * contW;
        if (w <= 0) return;
        const c = ENT_COLORS[i % ENT_COLORS.length];
        doc.setFillColor(c[0], c[1], c[2]);
        doc.rect(cx, y, w, barH, "F");
        cx += w;
      });
      y += barH + 6;

      // Tableau de répartition (la cellule « Valeur » reprend la couleur de la barre).
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Valeur", "Pros", "Part"]] as string[][],
        body: bloc.lignes.map((l) => [l.label, String(l.count), `${l.pct} %`]),
        styles: { ...tableStyles, fontSize: 8, cellPadding: 4 },
        headStyles,
        alternateRowStyles: { fillColor: [250, 249, 247] },
        columnStyles: { 1: { halign: "right", cellWidth: 70 }, 2: { halign: "right", cellWidth: 70 } },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 0) {
            const c = ENT_COLORS[data.row.index % ENT_COLORS.length];
            data.cell.styles.fillColor = c;
            data.cell.styles.textColor = [249, 247, 244];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 24;
    });
  }

  // Répartition des offres
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Répartition des offres", margin, y);
  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Offre", "Abonnements", "Part du parc", "MRR"]] as string[][],
    body: input.repartition.map((r) => [r.offre, String(r.count), `${r.pct} %`, euros(r.mrr)]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 28;

  // Évolution du MRR
  if (y > pageH - 130) {
    doc.addPage();
    y = margin + 10;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Évolution du MRR (6 derniers mois)", margin, y);
  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Mois", "MRR cumulé des actifs"]] as string[][],
    body: input.mrrEvolution.map((m) => [m.label, euros(m.mrr)]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: { 1: { halign: "right", cellWidth: 160 } },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 28;

  // Liste filtrée
  if (y > pageH - 130) {
    doc.addPage();
    y = margin + 10;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Abonnements (${input.abonnements.length})`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(input.filtreLabel, pageW - margin, y, { align: "right" });
  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Entreprise", "Contact", "Offre", "Statut", "Statut jur.", "Taille", "MRR", "Échéance"]] as string[][],
    body: input.abonnements.length
      ? input.abonnements.map((a) => [
          a.entreprise,
          [a.metier, a.ville].filter(Boolean).join(" · ") || a.email || "—",
          a.offre,
          a.statut,
          a.statut_juridique || "—",
          a.taille_entreprise || "—",
          a.montant_mensuel > 0 ? euros(a.montant_mensuel) : "—",
          a.date_echeance ? a.date_echeance : "—",
        ])
      : [["Aucun abonnement", "", "", "", "", "", "", ""]],
    styles: { ...tableStyles, fontSize: 8, cellPadding: 4 },
    headStyles,
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      2: { cellWidth: 46 },
      3: { cellWidth: 44 },
      4: { cellWidth: 76 },
      5: { cellWidth: 62 },
      6: { halign: "right", cellWidth: 54 },
      7: { cellWidth: 58 },
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
    doc.text("Archive générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

export interface PdfHistoriqueAbonnementEntree {
  dateLabel: string;
  titre: string;
  detail: string;
  montant: string | null;
}

export interface PdfHistoriqueAbonnementInput {
  emetteur: {
    entreprise: string;
    email: string | null;
    metier: string | null;
    ville: string | null;
  };
  offre: string;
  statut: string;
  montantMensuel: number;
  dateDebut: string | null;
  dateEcheance: string | null;
  entrees: PdfHistoriqueAbonnementEntree[];
  filtreLabel: string;
}

/**
 * Construit un PDF « historique de mon abonnement » : fiche de l'abonnement courant
 * et détail daté de chaque évolution (offre et statut).
 */
export async function buildHistoriqueAbonnementPdf(input: PdfHistoriqueAbonnementInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("HISTORIQUE D'ABONNEMENT", margin, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${input.emetteur.entreprise} · édité le ${new Date().toLocaleDateString("fr-FR")}`, margin, 70);

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 86, pageW - margin, 86);

  // Fiche de l'abonnement courant (2 rangées x 3)
  const infos = [
    { label: "OFFRE EN COURS", value: input.offre },
    { label: "STATUT", value: input.statut },
    { label: "MONTANT MENSUEL", value: input.montantMensuel > 0 ? `${euros(input.montantMensuel)}/mois` : "—" },
    { label: "DÉBUT", value: input.dateDebut ? input.dateDebut : "—" },
    { label: "PROCHAINE ÉCHÉANCE", value: input.dateEcheance ? input.dateEcheance : "—" },
    { label: "CONTACT", value: input.emetteur.email ?? input.emetteur.ville ?? "—" },
  ];
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 44;
  const boxTop = 104;
  infos.forEach((b, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = margin + col * (boxW + gap);
    const by = boxTop + row * (boxH + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, by, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, by, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, by + 17);
    doc.setFontSize(12);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value.length > 22 ? `${b.value.slice(0, 21)}…` : b.value, bx + 14, by + 34);
  });

  const y = boxTop + boxH * 2 + gap + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Étapes (${input.entrees.length})`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(input.filtreLabel, pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Date", "Étape", "Détail", "Montant"]] as string[][],
    body: input.entrees.length
      ? input.entrees.map((e) => [e.dateLabel, e.titre, e.detail, e.montant ?? "—"])
      : [["—", "Aucune étape", "", ""]],
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
      0: { cellWidth: 100 },
      3: { halign: "right", cellWidth: 76 },
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

export interface PdfVolatilRow {
  rang: number;
  entreprise: string;
  metier: string | null;
  ville: string | null;
  email: string | null;
  offre: string;
  changements: number;
  dernierLabel: string | null;
  dernierDate: string | null;
  dernierMontant: number | null;
}

export interface PdfArtisansVolatilsInput {
  rows: PdfVolatilRow[];
  comptesConcernes: number;
  comptesTresVolatils: number;
  totalChangements: number;
  seuilLabel: string;
}

/**
 * Construit un PDF du classement « Artisans les plus volatils » : indicateurs de
 * volatilité et tableau de classement (entreprises, offres, changements, dernier passage).
 */
export async function buildArtisansVolatilsPdf(input: PdfArtisansVolatilsInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("ARTISANS LES PLUS VOLATILS", margin, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `Classement par passages d'une offre à une autre · édité le ${new Date().toLocaleDateString("fr-FR")}`,
    margin,
    70,
  );

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 86, pageW - margin, 86);

  // Indicateurs (3 encadrés)
  const kpis = [
    { label: "COMPTES CONCERNÉS", value: String(input.comptesConcernes) },
    { label: `TRÈS VOLATILS (${input.seuilLabel})`, value: String(input.comptesTresVolatils) },
    { label: "TOTAL CHANGEMENTS", value: String(input.totalChangements) },
  ];
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 44;
  const boxTop = 104;
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 14, boxTop + 17);
    doc.setFontSize(13);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 34);
  });

  const y = boxTop + boxH + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Classement (${input.rows.length})`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Hors activation de compte", pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["#", "Entreprise", "Offre", "Changements", "Dernier passage", "Montant"]] as string[][],
    body: input.rows.length
      ? input.rows.map((r) => [
          String(r.rang),
          [r.entreprise, [r.metier, r.ville].filter(Boolean).join(" · ") || r.email || ""]
            .filter(Boolean)
            .join("\n"),
          r.offre,
          `${r.changements}`,
          r.dernierLabel ? `${r.dernierLabel}${r.dernierDate ? `\n${r.dernierDate}` : ""}` : "—",
          r.dernierMontant && r.dernierMontant > 0 ? `${euros(r.dernierMontant)}/mois` : "—",
        ])
      : [["—", "Aucun changement d'offre", "", "", "", ""]],
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
      0: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 60 },
      3: { halign: "right", cellWidth: 76 },
      5: { halign: "right", cellWidth: 72 },
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
    doc.text("Classement généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

/** Une ligne du journal d'archivage des récaps d'échecs à imprimer dans le PDF. */
export interface PdfJournalArchivageRow {
  dateLabel: string;
  heureLabel: string;
  /** « Automatique » ou « Manuel ». */
  type: string;
  exercice: string;
}

/** Une ligne « mois manquants » par exercice pour le PDF du journal d'archivage. */
export interface PdfJournalArchivageExercice {
  exercice: number;
  total: number;
  moisCouverts: number;
  auto: number;
  manuel: number;
  /** Libellés des mois restés sans archivage. */
  moisManquants: string[];
}

export interface PdfJournalArchivageInput {
  rows: PdfJournalArchivageRow[];
  periodeLabel: string;
  sourceLabel: string;
  exerciceLabel: string;
  /** Détail, par exercice, des mois restés sans archivage (facultatif). */
  moisManquants?: PdfJournalArchivageExercice[];
  /** Synthèse annuelle pour la page de couverture (facultatif). */
  couverture?: PdfJournalArchivageCouverture;
  /**
   * N'exporter QUE la page de couverture (synthèse + badge de tendance + mini-courbe), sans la
   * liste détaillée des envois ni le détail des mois manquants. Alimente le bouton
   * « Exporter la couverture du Journal ».
   */
  couvertureSeule?: boolean;
}

/** Synthèse affichée sur la page de couverture du journal : totaux, taux de régularité et délai moyen. */
export interface PdfJournalArchivageCouverture {
  /** Total de relances annuelles (récaps archivés sur l'exercice ou l'ensemble des exercices). */
  totalRelances: number;
  /** Taux de régularité moyen (0-100) : part des mois de l'exercice couverts par un archivage. */
  tauxRegularite: number;
  /** Délai moyen avant relance (en jours) sur la sélection, ou null si indisponible. */
  delaiMoyen?: number | null;
  /** Détail par exercice (total, taux de régularité et délai moyen avant relance). */
  parExercice: Array<{ exercice: number; total: number; taux: number; delai?: number | null }>;
  /** Série du délai moyen par exercice, reportée sous forme de mini-courbe sur la couverture. */
  delaiSerie?: PdfDelaiMoyenAnnuelPoint[];
  /** Sens de la tendance du délai moyen (pente de la moyenne mobile), affiché en badge sur la couverture. */
  delaiTendance?: "allonge" | "raccourcit" | "stable";
  /** Pente de la moyenne mobile (jours par exercice), reportée dans le badge de tendance. */
  delaiPente?: number;
}

/**
 * Construit un PDF du Journal d'archivage des récaps d'échecs « test à blanc », aligné sur les
 * filtres courants (période, type, exercice) : indicateurs, liste datée des envois archivés et,
 * en complément, le détail des mois restés sans archivage par exercice.
 */
export function buildJournalArchivageEchecsPdf(input: PdfJournalArchivageInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  // ---- Page de COUVERTURE : total de relances annuelles + taux de régularité ----
  const cv = input.couverture;
  {
    doc.setFillColor(38, 36, 33);
    doc.rect(0, 0, pageW, pageH, "F");

    doc.setFillColor(196, 120, 58);
    doc.rect(margin, 96, 64, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(210, 205, 198);
    doc.text("ARTIFLOW-PRO", margin, 88);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(29);
    doc.setTextColor(249, 247, 244);
    doc.text("Journal d'archivage", margin, 156);
    doc.text("des récaps d'échecs", margin, 194);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(200, 194, 186);
    doc.text("Rapport de régularité — vérification des rendus « test à blanc »", margin, 224);

    doc.setFontSize(10);
    doc.setTextColor(168, 162, 154);
    doc.text(
      `Édité le ${new Date().toLocaleDateString("fr-FR")} · Période : ${input.periodeLabel} · Type : ${input.sourceLabel} · Exercice : ${input.exerciceLabel}`,
      margin,
      252,
    );

    // Trois cartes de synthèse : total de relances, taux de régularité et délai moyen avant relance.
    const kpiTop = 300;
    const kpiGap = 14;
    const kpiW = (pageW - margin * 2 - kpiGap * 2) / 3;
    const kpiH = 96;
    const cards = [
      { label: "TOTAL DE RELANCES ANNUELLES", value: cv ? String(cv.totalRelances) : "—" },
      { label: "TAUX DE RÉGULARITÉ", value: cv ? `${Math.round(cv.tauxRegularite)} %` : "—" },
      {
        label: "DÉLAI MOYEN AVANT RELANCE",
        value: cv && cv.delaiMoyen != null ? `${cv.delaiMoyen.toFixed(1)} j` : "—",
      },
    ];
    cards.forEach((c, i) => {
      const bx = margin + i * (kpiW + kpiGap);
      doc.setFillColor(50, 47, 43);
      doc.roundedRect(bx, kpiTop, kpiW, kpiH, 8, 8, "F");
      doc.setFillColor(196, 120, 58);
      doc.rect(bx, kpiTop, 5, kpiH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(190, 184, 176);
      doc.text(c.label, bx + 16, kpiTop + 26);
      doc.setFontSize(26);
      doc.setTextColor(249, 247, 244);
      doc.text(c.value, bx + 16, kpiTop + 72);
    });

    // Mini-courbe du délai moyen avant relance par exercice (report direct de la courbe du Diagnostic).
    let cy = kpiTop + kpiH + 40;
    const serieCourbe = cv && cv.delaiSerie ? [...cv.delaiSerie].sort((a, b) => a.exercice - b.exercice) : [];
    if (serieCourbe.length > 0) {
      const titreCourbe = "Évolution du délai moyen avant relance (jours)";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(249, 247, 244);
      doc.text(titreCourbe, margin, cy);
      const titreW = doc.getTextWidth(titreCourbe);
      // Badge de TENDANCE (déduit de la pente de la moyenne mobile), juste à côté du titre de la
      // mini-courbe : report direct de l'indicateur de tendance affiché dans l'application.
      if (cv && cv.delaiTendance) {
        const badgeLabel =
          cv.delaiTendance === "allonge"
            ? "Relance qui s'allonge"
            : cv.delaiTendance === "raccourcit"
              ? "Relance qui se raccourcit"
              : "Tendance stable";
        const pente = cv.delaiPente;
        const badgePente =
          pente != null
            ? ` · pente ${pente >= 0 ? "+" : ""}${pente.toFixed(2).replace(".", ",")} j/exercice`
            : "";
        const badgeText = `${badgeLabel}${badgePente}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        const bw = doc.getTextWidth(badgeText) + 16;
        const bx = Math.min(margin + titreW + 12, pageW - margin - bw);
        const badgeColor: [number, number, number] =
          cv.delaiTendance === "allonge"
            ? [196, 120, 58]
            : cv.delaiTendance === "raccourcit"
              ? [104, 152, 108]
              : [110, 104, 98];
        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.roundedRect(bx, cy - 10, bw, 14, 7, 7, "F");
        doc.setTextColor(249, 247, 244);
        doc.text(badgeText, bx + 8, cy - 0.5);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(190, 184, 176);
      doc.text("— délai moyen   ·   -- moyenne mobile", margin, cy + 14);
      cy += 26;
      const chLeft = margin + 8;
      const chRight = pageW - margin - 8;
      const chW = chRight - chLeft;
      const chH = 82;
      const chTop = cy;
      const chBottom = chTop + chH;
      // Axe horizontal discret.
      doc.setDrawColor(90, 84, 78);
      doc.setLineWidth(0.5);
      doc.line(chLeft, chBottom, chRight, chBottom);
      const vMin = Math.min(...serieCourbe.map((p) => p.delaiMoyen));
      const vMax = Math.max(...serieCourbe.map((p) => p.delaiMoyen));
      const range = vMax - vMin || 1;
      const xAt = (i: number) =>
        serieCourbe.length > 1 ? chLeft + (i / (serieCourbe.length - 1)) * chW : chLeft + chW / 2;
      const yAt = (v: number) => chBottom - ((v - vMin) / range) * (chH - 18) - 9;
      // Polyligne reliant les points.
      if (serieCourbe.length > 1) {
        doc.setDrawColor(224, 168, 96);
        doc.setLineWidth(1.6);
        for (let i = 0; i < serieCourbe.length - 1; i += 1) {
          doc.line(xAt(i), yAt(serieCourbe[i].delaiMoyen), xAt(i + 1), yAt(serieCourbe[i + 1].delaiMoyen));
        }
      }
      // Ligne de MOYENNE MOBILE (fenêtre de 2 exercices), en pointillés : report direct de la ligne
      // de tendance tracée sur la courbe du Diagnostic, pour rester cohérent d'un écran à l'autre.
      if (serieCourbe.length > 2) {
        const moyennes = serieCourbe.map((_, i) => {
          const debut = Math.max(0, i - 1);
          const tranche = serieCourbe.slice(debut, i + 1);
          return tranche.reduce((s, p) => s + p.delaiMoyen, 0) / tranche.length;
        });
        doc.setDrawColor(196, 120, 58);
        doc.setLineWidth(1);
        doc.setLineDashPattern([3, 2], 0);
        for (let i = 0; i < serieCourbe.length - 1; i += 1) {
          doc.line(xAt(i), yAt(moyennes[i]), xAt(i + 1), yAt(moyennes[i + 1]));
        }
        doc.setLineDashPattern([], 0);
      }
      // Points + valeurs + étiquettes d'exercice.
      serieCourbe.forEach((p, i) => {
        const px = xAt(i);
        const py = yAt(p.delaiMoyen);
        doc.setFillColor(224, 168, 96);
        doc.circle(px, py, 2.6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(236, 228, 216);
        doc.text(`${p.delaiMoyen.toFixed(1)} j`, px, py - 7, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 194, 186);
        doc.text(String(p.exercice), px, chBottom + 11, { align: "center" });
      });
      cy = chBottom + 34;
    }

    // Détail de la régularité par exercice.
    if (cv && cv.parExercice.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(249, 247, 244);
      doc.text("Régularité par exercice", margin, cy);
      cy += 8;
      doc.setDrawColor(78, 73, 68);
      doc.setLineWidth(0.6);
      doc.line(margin, cy, pageW - margin, cy);
      cy += 20;
      cv.parExercice.forEach((ex) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(214, 208, 200);
        doc.text(`Exercice ${ex.exercice}`, margin, cy);
        doc.text(`${ex.total} relance${ex.total > 1 ? "s" : ""}`, pageW - margin - 210, cy);
        doc.setTextColor(190, 184, 176);
        doc.text(
          `Délai moy. : ${ex.delai != null ? `${ex.delai.toFixed(1)} j` : "—"}`,
          pageW - margin - 104,
          cy,
        );
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 165, 95);
        doc.text(`${Math.round(ex.taux)} %`, pageW - margin, cy, { align: "right" });
        cy += 20;
      });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(150, 144, 136);
    doc.text(
      "Le taux de régularité correspond à la part des mois de l'exercice couverts par au moins un archivage.",
      margin,
      pageH - 70,
    );
    doc.text(
      "Le délai moyen avant relance est l'écart (en jours) entre la date d'envoi réglée et la relance effective de l'exercice.",
      margin,
      pageH - 56,
    );
    doc.text("Généré avec ArtiFlow-pro", margin, pageH - 42);
  }

  // Export « couverture seule » : on s'arrête à la page de synthèse (une seule page), sans la
  // liste détaillée des envois ni le détail des mois manquants.
  if (input.couvertureSeule) {
    return doc;
  }

  // ---- Contenu détaillé (à partir de la 2ᵉ page) ----
  doc.addPage();
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("JOURNAL D'ARCHIVAGE DES RÉCAPS D'ÉCHECS", margin, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, margin, 70);

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 86, pageW - margin, 86);

  const total = input.rows.length;
  const manuel = input.rows.filter((r) => r.type !== "Automatique").length;
  const auto = total - manuel;

  const kpis = [
    { label: "ENVOIS ARCHIVÉS", value: String(total) },
    { label: "MANUELS", value: String(manuel) },
    { label: "AUTOMATIQUES", value: String(auto) },
  ];
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 2) / 3;
  const boxH = 44;
  const boxTop = 104;
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
    doc.setFontSize(14);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 14, boxTop + 35);
  });

  let y = boxTop + boxH + 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `Filtres — Période : ${input.periodeLabel} · Type : ${input.sourceLabel} · Exercice : ${input.exerciceLabel}`,
    margin,
    y,
  );
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Envois archivés (${total})`, margin, y);

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Date", "Heure", "Type", "Exercice"]] as string[][],
    body: total
      ? input.rows.map((r) => [r.dateLabel, r.heureLabel, r.type, r.exercice])
      : [["—", "", "Aucun envoi pour ce filtre", ""]],
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
      1: { cellWidth: 70 },
      3: { halign: "right", cellWidth: 90 },
    },
  });

  let lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Détail des mois restés sans archivage, par exercice (facultatif, complément d'information).
  const moisManquants = input.moisManquants ?? [];
  if (moisManquants.length > 0) {
    if (lastY > pageH - 150) {
      doc.addPage();
      lastY = margin + 10;
    }
    const sy = lastY + 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text("Mois sans archivage par exercice", margin, sy);
    autoTable(doc, {
      startY: sy + 6,
      margin: { left: margin, right: margin },
      head: [["Exercice", "Récaps", "Mois couverts", "Auto", "Manuel", "Mois manquants"]] as string[][],
      body: moisManquants.map((m) => [
        String(m.exercice),
        String(m.total),
        `${m.moisCouverts}/12`,
        String(m.auto),
        String(m.manuel),
        m.moisManquants.length ? m.moisManquants.join(", ") : "Aucun",
      ]),
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
        0: { cellWidth: 56 },
        1: { halign: "right", cellWidth: 50 },
        2: { halign: "right", cellWidth: 78 },
        3: { halign: "right", cellWidth: 46 },
        4: { halign: "right", cellWidth: 54 },
      },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let p = 2; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(1);
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Journal généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

/** Un point de la courbe du délai moyen avant relance, pour l'export PDF dédié. */
export interface PdfDelaiMoyenAnnuelPoint {
  exercice: number;
  delaiMoyen: number;
  total: number;
}

export interface PdfDelaiMoyenAnnuelInput {
  points: PdfDelaiMoyenAnnuelPoint[];
  /** Jour (1-28) de l'envoi annuel réglé : sert de référence au calcul du délai. */
  jour: number;
  /** Heure (0-23) de l'envoi annuel réglé : sert de référence au calcul du délai. */
  heure: number;
  /** Afficher la ligne de moyenne mobile (par défaut : oui). */
  afficherMoyenneMobile?: boolean;
  /** Sens de la tendance (pente de la moyenne mobile), reporté dans l'encart de lecture. */
  tendance?: "allonge" | "raccourcit" | "stable";
}

/**
 * Construit un PDF DÉDIÉ à l'évolution du délai moyen avant relance, exercice par exercice :
 * indicateurs de synthèse, courbe dessinée et tableau détaillé (écart vs exercice précédent).
 */
export function buildDelaiMoyenAnnuelPdf(input: PdfDelaiMoyenAnnuelInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  const frJ = (v: number): string => `${v.toFixed(1).replace(".", ",")} j`;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("ÉVOLUTION DU DÉLAI MOYEN AVANT RELANCE", margin, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const sousTitre = doc.splitTextToSize(
    `Récap annuel d'échecs · référence : envoi du ${String(input.jour).padStart(2, "0")} janvier à ${String(input.heure).padStart(2, "0")} h · édité le ${new Date().toLocaleDateString("fr-FR")}`,
    pageW - margin * 2,
  ) as string[];
  sousTitre.forEach((line, i) => doc.text(line, margin, 68 + i * 13));

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 96, pageW - margin, 96);

  const points = [...input.points].sort((a, b) => a.exercice - b.exercice);

  if (points.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Aucune relance enregistrée : le délai moyen ne peut pas être calculé pour l'instant.", margin, 130);
    return doc;
  }

  const totalRelances = points.reduce((s, p) => s + p.total, 0);
  const plusLent = points.reduce((m, p) => (p.delaiMoyen > m.delaiMoyen ? p : m), points[0]);
  const plusRapide = points.reduce((m, p) => (p.delaiMoyen < m.delaiMoyen ? p : m), points[0]);
  const moyenneGlobale =
    totalRelances > 0 ? points.reduce((s, p) => s + p.delaiMoyen * p.total, 0) / totalRelances : 0;
  // La ligne de moyenne mobile n'est tracée que si l'utilisateur la garde affichée (par défaut : oui).
  const montrerMoyenne = input.afficherMoyenneMobile !== false;

  // Indicateurs (4 encadrés)
  const kpis = [
    { label: "DÉLAI MOYEN GLOBAL", value: frJ(moyenneGlobale) },
    { label: "EXERCICE LE PLUS LENT", value: `${plusLent.exercice} · ${frJ(plusLent.delaiMoyen)}` },
    { label: "EXERCICE LE PLUS RAPIDE", value: `${plusRapide.exercice} · ${frJ(plusRapide.delaiMoyen)}` },
    { label: "RELANCE(S) ANALYSÉE(S)", value: String(totalRelances) },
  ];
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 46;
  const boxTop = 114;
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 12, boxTop + 16);
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 12, boxTop + 34);
  });

  let y = boxTop + boxH + 30;

  // Courbe : délai moyen (jours) par exercice.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("Délai moyen (jours) par exercice", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(150, 142, 132);
  doc.text(
    montrerMoyenne ? "— délai moyen   ·   -- moyenne mobile (2 exercices)" : "— délai moyen",
    pageW - margin,
    y,
    { align: "right" },
  );

  const chartH = 150;
  const chartTop = y + 20;
  const chartBottom = chartTop + chartH;
  const chartLeft = margin + 34;
  const chartRight = pageW - margin - 16;
  const chartW = chartRight - chartLeft;

  const vMin = Math.min(...points.map((p) => p.delaiMoyen));
  const vMax = Math.max(...points.map((p) => p.delaiMoyen));
  const range = vMax - vMin || 1;
  const xAt = (i: number) =>
    points.length > 1 ? chartLeft + (i / (points.length - 1)) * chartW : chartLeft + chartW / 2;
  const yAt = (v: number) => chartBottom - ((v - vMin) / range) * (chartH - 24) - 12;

  // Axes
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.6);
  doc.line(chartLeft, chartTop, chartLeft, chartBottom);
  doc.line(chartLeft, chartBottom, chartRight, chartBottom);

  // Grille + valeurs de l'axe
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  [0, 0.5, 1].forEach((frac) => {
    const v = vMin + frac * range;
    const gy = yAt(v);
    doc.setDrawColor(240, 236, 230);
    doc.setLineWidth(0.4);
    doc.line(chartLeft, gy, chartRight, gy);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(v.toFixed(1).replace(".", ","), chartLeft - 6, gy + 2, { align: "right" });
  });

  // Polyligne
  if (points.length > 1) {
    doc.setDrawColor(196, 120, 58);
    doc.setLineWidth(1.8);
    for (let i = 0; i < points.length - 1; i += 1) {
      doc.line(xAt(i), yAt(points[i].delaiMoyen), xAt(i + 1), yAt(points[i + 1].delaiMoyen));
    }
  }

  // Ligne de MOYENNE MOBILE (fenêtre de 2 exercices), en pointillés : lisse les variations
  // d'un exercice à l'autre, comme sur la courbe affichée dans l'application.
  if (montrerMoyenne && points.length > 2) {
    const moyennes = points.map((_, i) => {
      const debut = Math.max(0, i - 1);
      const tranche = points.slice(debut, i + 1);
      return tranche.reduce((s, p) => s + p.delaiMoyen, 0) / tranche.length;
    });
    doc.setDrawColor(150, 142, 132);
    doc.setLineWidth(1.2);
    doc.setLineDashPattern([3, 2], 0);
    for (let i = 0; i < points.length - 1; i += 1) {
      doc.line(xAt(i), yAt(moyennes[i]), xAt(i + 1), yAt(moyennes[i + 1]));
    }
    doc.setLineDashPattern([], 0);
  }

  // Points + étiquettes d'exercice (le plus lent mis en avant)
  points.forEach((p, i) => {
    const px = xAt(i);
    const py = yAt(p.delaiMoyen);
    const estPlusLent = points.length > 1 && p.exercice === plusLent.exercice;
    if (estPlusLent) {
      doc.setFillColor(176, 58, 58);
      doc.circle(px, py, 3.8, "F");
    } else {
      doc.setFillColor(196, 120, 58);
      doc.circle(px, py, 2.6, "F");
    }
    doc.setFont("helvetica", estPlusLent ? "bold" : "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 56, 52);
    doc.text(String(p.exercice), px, chartBottom + 12, { align: "center" });
    if (estPlusLent) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(176, 58, 58);
      doc.text(`Plus lent · ${frJ(p.delaiMoyen)}`, px, py - 8, { align: "center" });
    }
  });

  y = chartBottom + 34;

  // Tableau détaillé par exercice
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Détail par exercice (${points.length})`, margin, y);

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [["Exercice", "Relances", "Délai moyen", "Écart vs précédent", "Repère"]] as string[][],
    body: points.map((p, i) => {
      const prec = i > 0 ? points[i - 1] : null;
      const ecart = prec ? p.delaiMoyen - prec.delaiMoyen : null;
      const repere =
        points.length > 1 && p.exercice === plusLent.exercice
          ? "Le plus lent"
          : points.length > 1 && p.exercice === plusRapide.exercice
            ? "Le plus rapide"
            : "-";
      return [
        String(p.exercice),
        String(p.total),
        frJ(p.delaiMoyen),
        ecart == null ? "-" : `${ecart >= 0 ? "+" : "-"}${Math.abs(ecart).toFixed(1).replace(".", ",")} j`,
        repere,
      ];
    }),
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 6,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: "right", cellWidth: 70 },
      2: { halign: "right", cellWidth: 80 },
      3: { halign: "right", cellWidth: 120 },
    },
  });

  let lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // Lecture / interprétation
  if (lastY < pageH - 90) {
    lastY += 26;
    const tendanceTexte =
      input.tendance === "allonge"
        ? " La tendance de fond s'allonge : la relance met un peu plus de temps d'un exercice à l'autre."
        : input.tendance === "raccourcit"
          ? " La tendance de fond se raccourcit : la relance est de plus en plus rapide."
          : input.tendance === "stable"
            ? " La tendance de fond reste stable d'un exercice à l'autre."
            : "";
    const lecture = doc.splitTextToSize(
      `Délai moyen entre la date d'envoi réglée et la relance effective. L'exercice le plus lent est ${plusLent.exercice} (${frJ(plusLent.delaiMoyen)}).${tendanceTexte}`,
      pageW - margin * 2 - 28,
    ) as string[];
    const lectureBoxH = 28 + lecture.length * 12;
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(margin, lastY, pageW - margin * 2, lectureBoxH, 6, 6, "F");
    doc.setFillColor(196, 120, 58);
    doc.rect(margin, lastY, 4, lectureBoxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("LECTURE", margin + 14, lastY + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(80, 74, 70);
    lecture.forEach((line, i) => doc.text(line, margin + 14, lastY + 30 + i * 12));
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
    doc.text("Courbe générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

/** Déclenche le téléchargement du PDF dans le navigateur. */
export function savePdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

/** Retourne le contenu du PDF encodé en base64 (sans préfixe data URI), pour un envoi en pièce jointe. */
export function pdfToBase64(doc: jsPDF): string {
  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}