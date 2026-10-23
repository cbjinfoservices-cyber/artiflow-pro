import { jsPDF } from "jspdf";
import type { CreneauItem } from "@/hooks/useArtisanData";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { suffixePeriode, type Indisponibilite } from "@/lib/indisponibilites";
import { listerConflitsConges, type ConflitConge } from "@/lib/conflitsConges";
import { formatMonth, startOfWeek, toISODate, addDays } from "@/lib/dates";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [222, 216, 208];
const ACCENT: [number, number, number] = [196, 120, 58];

const JOURS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];

function hexToRgb(hex: string): [number, number, number] {
  const propre = hex.replace("#", "");
  const n = parseInt(propre.length === 3 ? propre.split("").map((c) => c + c).join("") : propre, 16);
  if (!Number.isFinite(n)) return [120, 113, 108];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Coupe un texte pour qu'il tienne dans une largeur donnée, avec des points de suspension. */
function tronque(doc: jsPDF, texte: string, largeur: number): string {
  if (doc.getTextWidth(texte) <= largeur) return texte;
  let coupe = texte;
  while (coupe.length > 1 && doc.getTextWidth(`${coupe}…`) > largeur) {
    coupe = coupe.slice(0, -1);
  }
  return `${coupe.trim()}…`;
}

/** Date courte « 12 oct. » pour les lignes compactes du PDF. */
function dateCourte(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export interface PlanningMoisPdfInput {
  /** Nom de l'entreprise affiché en en-tête. */
  entreprise: string;
  /** Mois affiché (le 1er du mois). */
  mois: Date;
  creneaux: CreneauItem[];
  indisponibilites: Indisponibilite[];
  intervenants: Intervenant[];
}

/**
 * Construit le planning mensuel au format paysage, pensé pour être imprimé et punaisé
 * au mur de l'atelier : une case par jour, les interventions avec leur heure et la
 * personne affectée (code couleur), et les congés clairement signalés.
 */
export function buildPlanningMoisPdf(input: PlanningMoisPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 30;

  const intervenantParId = new Map<number, Intervenant>();
  input.intervenants.forEach((i) => intervenantParId.set(i.id, i));

  // Cases du mois : semaines complètes du lundi au dimanche.
  const debut = startOfWeek(input.mois);
  const dernierJour = new Date(input.mois.getFullYear(), input.mois.getMonth() + 1, 0);
  const indexFin = (dernierJour.getDay() + 6) % 7;
  const fin = addDays(dernierJour, 6 - indexFin);
  const jours: Date[] = [];
  for (let d = debut; d.getTime() <= fin.getTime(); d = addDays(d, 1)) jours.push(d);
  const nbRangees = Math.ceil(jours.length / 7);

  const cleMois = `${input.mois.getFullYear()}-${input.mois.getMonth()}`;
  const dansMois = (d: Date) => `${d.getFullYear()}-${d.getMonth()}` === cleMois;

  const parJour = new Map<string, CreneauItem[]>();
  input.creneaux.forEach((c) => {
    parJour.set(c.date, [...(parJour.get(c.date) ?? []), c]);
  });
  parJour.forEach((liste) => liste.sort((a, b) => a.heure.localeCompare(b.heure)));

  const congesParJour = new Map<string, Indisponibilite[]>();
  input.indisponibilites.forEach((i) => {
    congesParJour.set(i.date, [...(congesParJour.get(i.date) ?? []), i]);
  });

  // Interventions de ce mois qui tombent un jour d'absence de la personne affectée :
  // c'est exactement ce qu'il faut réaffecter pendant la réunion d'équipe.
  const conflitsMois: ConflitConge[] = listerConflitsConges(input.creneaux, input.indisponibilites, input.intervenants, {
    inclurePasse: true,
  }).filter((conflit) => {
    const d = new Date(`${conflit.creneau.date}T00:00:00`);
    return !Number.isNaN(d.getTime()) && dansMois(d);
  });

  // --- En-tête ---
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text((input.entreprise || "Mon entreprise").toUpperCase(), margin, 34);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Planning de ${formatMonth(input.mois).toLowerCase()}`, margin, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `Affiché dans l'atelier · édité le ${new Date().toLocaleDateString("fr-FR")}`,
    pageW - margin,
    40,
    { align: "right" },
  );

  const totalMois = input.creneaux.filter((c) => {
    const d = new Date(`${c.date}T00:00:00`);
    return !Number.isNaN(d.getTime()) && dansMois(d);
  }).length;
  const congesMois = input.indisponibilites.filter((i) => {
    const d = new Date(`${i.date}T00:00:00`);
    return !Number.isNaN(d.getTime()) && dansMois(d);
  }).length;
  doc.text(`${totalMois} intervention${totalMois > 1 ? "s" : ""} · ${congesMois} jour${congesMois > 1 ? "s" : ""} d'absence`, pageW - margin, 56, {
    align: "right",
  });

  // --- Légende des intervenants ---
  let legendeX = margin;
  const legendeY = 78;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  input.intervenants.slice(0, 12).forEach((i) => {
    const rgb = hexToRgb(couleurIntervenant(i.couleur));
    const label = i.nom;
    const largeur = doc.getTextWidth(label) + 16;
    if (legendeX + largeur > pageW - margin) return;
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(legendeX, legendeY - 5, 6, 6, 1.5, 1.5, "F");
    doc.setTextColor(90, 84, 80);
    doc.text(label, legendeX + 10, legendeY);
    legendeX += largeur + 8;
  });
  if (legendeX + 90 < pageW - margin) {
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.roundedRect(legendeX, legendeY - 5, 6, 6, 1.5, 1.5, "F");
    doc.setTextColor(90, 84, 80);
    doc.text("Congé / absence", legendeX + 10, legendeY);
  }

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, legendeY + 10, pageW - margin, legendeY + 10);

  // --- Grille du calendrier ---
  const gridTop = legendeY + 22;
  // Encadré « conflits de congé » réservé juste au-dessus du pied de page quand il y en a.
  const maxLignesConflits = 4;
  const nbAffichesConflits = Math.min(conflitsMois.length, maxLignesConflits * 2);
  const nbLignesConflits = Math.ceil(nbAffichesConflits / 2);
  const boxH = conflitsMois.length > 0 ? 22 + nbLignesConflits * 10 + 6 : 0;
  const footerLineY = pageH - 32;
  const boxTop = footerLineY - 6 - boxH;
  const gridBottom = conflitsMois.length > 0 ? boxTop - 6 : pageH - 44;
  const gridW = pageW - margin * 2;
  const cellW = gridW / 7;
  const enteteH = 14;
  const cellH = (gridBottom - gridTop - enteteH) / nbRangees;

  // En-tête des jours de la semaine.
  JOURS.forEach((j, i) => {
    const x = margin + i * cellW;
    doc.setFillColor(38, 36, 33);
    doc.rect(x, gridTop, cellW, enteteH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(249, 247, 244);
    doc.text(j, x + cellW / 2, gridTop + 9.5, { align: "center" });
  });

  const aujourdHui = toISODate(new Date());

  jours.forEach((jour, index) => {
    const ligne = Math.floor(index / 7);
    const colonne = index % 7;
    const x = margin + colonne * cellW;
    const y = gridTop + enteteH + ligne * cellH;
    const iso = toISODate(jour);
    const horsMois = !dansMois(jour);
    const estWeekend = colonne >= 5;

    // Fond de la case : les jours hors mois restent très clairs, le week-end légèrement teinté.
    doc.setFillColor(
      horsMois ? 252 : estWeekend ? 250 : 255,
      horsMois ? 251 : estWeekend ? 248 : 255,
      horsMois ? 249 : estWeekend ? 244 : 255,
    );
    doc.rect(x, y, cellW, cellH, "F");
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.6);
    doc.rect(x, y, cellW, cellH);

    // Numéro du jour.
    const estAujourdHui = iso === aujourdHui;
    if (estAujourdHui) {
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.circle(x + 13, y + 12, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(String(jour.getDate()), x + 13, y + 15, { align: "center" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(horsMois ? 200 : 60, horsMois ? 196 : 56, horsMois ? 192 : 52);
      doc.text(String(jour.getDate()), x + 8, y + 15);
    }

    // Absences du jour : bandeau en haut de case, bien visible.
    const conges = congesParJour.get(iso) ?? [];
    let curseurY = y + 24;
    conges.slice(0, 2).forEach((c) => {
      const nom = c.intervenant_id !== null ? intervenantParId.get(c.intervenant_id)?.nom ?? "Équipe" : "Équipe";
      doc.setFillColor(252, 240, 228);
      doc.rect(x + 1, curseurY - 7.5, cellW - 2, 11, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(170, 92, 32);
      const texte = `${c.motif}${suffixePeriode(c.periode)} · ${nom}`;
      doc.text(tronque(doc, texte, cellW - 8), x + 4, curseurY);
      curseurY += 12;
    });
    if (conges.length > 2) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(170, 92, 32);
      doc.text(`+ ${conges.length - 2} autre(s) absence(s)`, x + 4, curseurY);
      curseurY += 10;
    }

    // Interventions du jour.
    const slots = parJour.get(iso) ?? [];
    const places = Math.max(0, Math.floor((y + cellH - curseurY - 4) / 10));
    // On réserve une ligne pour le compteur « + N autres » quand tout ne tient pas.
    const resteAPlacer = Math.max(0, slots.length - places);
    const visibles = slots.slice(0, Math.max(0, places - (resteAPlacer > 0 ? 1 : 0)));
    visibles.forEach((slot) => {
      const interv = slot.intervenant_id !== null ? intervenantParId.get(slot.intervenant_id) : undefined;
      const rgb = hexToRgb(interv ? couleurIntervenant(interv.couleur) : "#a8a29e");
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(x + 4, curseurY - 5.5, 2.2, 7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(50, 46, 43);
      const texte = `${slot.heure.slice(0, 5)} · ${slot.libelle}${interv ? ` · ${interv.nom}` : ""}`;
      doc.text(tronque(doc, texte, cellW - 16), x + 8.5, curseurY);
      curseurY += 9.5;
    });
    const reste = slots.length - visibles.length;
    if (reste > 0 && curseurY < y + cellH - 3) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(150, 142, 132);
      doc.text(`+ ${reste} autre${reste > 1 ? "s" : ""}`, x + 8.5, curseurY);
    }
  });

  // --- Encadré « conflits de congé » (repérage rapide en réunion d'équipe) ---
  if (conflitsMois.length > 0) {
    doc.setFillColor(252, 246, 240);
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(0.9);
    doc.roundedRect(margin, boxTop, gridW, boxH, 4, 4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(150, 78, 24);
    doc.text("CONFLITS DE CONGÉ · À RÉAFFECTER PENDANT LA RÉUNION D'ÉQUIPE", margin + 8, boxTop + 13);

    const largeurColonne = (gridW - 20) / 2;
    conflitsMois.slice(0, nbAffichesConflits).forEach((conflit, index) => {
      const colonne = index < maxLignesConflits ? 0 : 1;
      const ligne = index % maxLignesConflits;
      const x = margin + 8 + colonne * largeurColonne;
      const y = boxTop + 26 + ligne * 10;
      const nom = conflit.intervenant?.nom ?? "Équipe";
      const texte = `${dateCourte(conflit.creneau.date)} · ${conflit.creneau.heure.slice(0, 5)} · ${
        conflit.creneau.libelle
      } · ${nom} (${conflit.absence.motif}${suffixePeriode(conflit.absence.periode)})`;
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.circle(x + 2, y - 2.2, 1.7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(76, 66, 58);
      doc.text(tronque(doc, texte, largeurColonne - 16), x + 7, y);
    });

    if (conflitsMois.length > nbAffichesConflits) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(150, 78, 24);
      doc.text(
        `+ ${conflitsMois.length - nbAffichesConflits} autre(s) intervention(s) en conflit ce mois-ci`,
        margin + 8,
        boxTop + boxH - 5,
      );
    }
  }

  // --- Pied de page ---
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, pageH - 32, pageW - margin, pageH - 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Planning généré avec ArtiFlow-pro", margin, pageH - 18);
  doc.text(
    "Les absences sont indiquées en haut des cases : ne pas affecter ces personnes.",
    pageW - margin,
    pageH - 18,
    { align: "right" },
  );

  return doc;
}