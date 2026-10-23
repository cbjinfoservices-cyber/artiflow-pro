import { downloadCsv, toCsv } from "@/lib/csv";
import {
  dureeMinutes,
  etatPointage,
  formatDuree,
  formatHeurePointage,
  type Pointage,
} from "@/lib/pointage";
import type { Intervenant } from "@/lib/intervenants";

/** Récapitulatif d'heures pour une personne sur une période donnée. */
export interface RecapHeuresIntervenant {
  /** Identifiant de l'intervenant, ou null pour les pointages non affectés. */
  intervenantId: number | null;
  nom: string;
  /** Couleur d'identification (clé de la palette intervenant), ou null. */
  couleur: string | null;
  /** Total travaillé sur la période, en minutes (pause déduite). */
  minutes: number;
  /** Nombre d'interventions pointées (hors pointages vides). */
  nbPointages: number;
  /** Nombre de jours distincts réellement pointés. */
  nbJours: number;
  /** Vrai si au moins une intervention est encore en cours sur la période. */
  enCours: boolean;
}

/** Clé interne stable d'une ligne de récap (intervenant ou « non affecté »). */
function cleIntervenant(id: number | null): string {
  return id === null ? "non-affecte" : `i-${id}`;
}

/**
 * Agrège les pointages d'une période (liste de dates ISO) par intervenant.
 * Tous les intervenants transmis apparaissent, même à zéro, pour que la vue patron
 * montre d'un coup d'œil qui n'a rien pointé. Les pointages sans intervenant sont
 * regroupés dans une ligne « Non affecté ».
 */
export function recapHeuresParIntervenant(
  pointages: Pointage[],
  intervenants: Intervenant[],
  dates: string[],
  maintenant: number = Date.now(),
): RecapHeuresIntervenant[] {
  const dansPeriode = pointages.filter((p) => dates.includes(p.date));
  const lignes = new Map<string, RecapHeuresIntervenant>();
  const jours = new Map<string, Set<string>>();

  intervenants.forEach((i) => {
    lignes.set(cleIntervenant(i.id), {
      intervenantId: i.id,
      nom: i.nom,
      couleur: i.couleur,
      minutes: 0,
      nbPointages: 0,
      nbJours: 0,
      enCours: false,
    });
  });

  dansPeriode.forEach((p) => {
    const etat = etatPointage(p);
    if (etat === "absent") return;
    const cle = cleIntervenant(p.intervenant_id);
    if (!lignes.has(cle)) {
      lignes.set(cle, {
        intervenantId: p.intervenant_id,
        nom: "Non affecté",
        couleur: null,
        minutes: 0,
        nbPointages: 0,
        nbJours: 0,
        enCours: false,
      });
    }
    const ligne = lignes.get(cle);
    if (!ligne) return;
    ligne.minutes += dureeMinutes(p, maintenant);
    ligne.nbPointages += 1;
    ligne.enCours = ligne.enCours || etat === "en-cours";
    const set = jours.get(cle) ?? new Set<string>();
    set.add(p.date);
    jours.set(cle, set);
  });

  lignes.forEach((ligne, cle) => {
    ligne.nbJours = jours.get(cle)?.size ?? 0;
  });

  return Array.from(lignes.values()).sort((a, b) => {
    // Les personnes avec des heures d'abord, puis par ordre alphabétique ; « Non affecté » à la fin.
    if (a.intervenantId === null && b.intervenantId !== null) return 1;
    if (b.intervenantId === null && a.intervenantId !== null) return -1;
    if (b.minutes !== a.minutes) return b.minutes - a.minutes;
    return a.nom.localeCompare(b.nom, "fr");
  });
}

/** Total des minutes d'un récap (toutes personnes confondues). */
export function totalRecap(recap: RecapHeuresIntervenant[]): number {
  return recap.reduce((somme, l) => somme + l.minutes, 0);
}

/** Convertit des minutes en heures décimales arrondies (« 7,25 »). */
export function heuresDecimales(minutes: number): string {
  return (Math.max(0, minutes) / 60).toFixed(2).replace(".", ",");
}

/** Nettoyage simple d'un libellé pour un nom de fichier. */
function slugFichier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export interface ExportHeuresParams {
  pointages: Pointage[];
  intervenants: Intervenant[];
  /** Dates ISO de la période exportée. */
  dates: string[];
  /** Interventions du planning (pour retrouver libellé et ville d'un pointage). */
  creneaux: { id: number; libelle: string; ville: string | null }[];
  /** Libellé lisible de la période (« Semaine du 19 octobre 2026 », « Octobre 2026 »). */
  periodeLabel: string;
  /** Nom de fichier sans extension (sinon dérivé du libellé de période). */
  fichier?: string;
}

/**
 * Exporte les heures pointées d'une période dans un CSV prêt pour la paie :
 * une ligne par intervention (arrivée, départ, pause, durée en h:min et en heures
 * décimales), puis un total par intervenant. Séparateur point-virgule et BOM UTF-8
 * pour une ouverture directe dans Excel / LibreOffice.
 * Renvoie le nombre de lignes détaillées exportées.
 */
export function exporterHeuresCsv(params: ExportHeuresParams): number {
  const { pointages, intervenants, dates, creneaux, periodeLabel } = params;
  const noms = new Map<number, string>();
  intervenants.forEach((i) => noms.set(i.id, i.nom));
  const creneauxParId = new Map<number, { libelle: string; ville: string | null }>();
  creneaux.forEach((c) => creneauxParId.set(c.id, { libelle: c.libelle, ville: c.ville }));

  const lignes = pointages
    .filter((p) => dates.includes(p.date) && Boolean(p.arrivee_le))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const na = noms.get(a.intervenant_id ?? -1) ?? "Non affecté";
      const nb = noms.get(b.intervenant_id ?? -1) ?? "Non affecté";
      return na.localeCompare(nb, "fr");
    });

  const maintenant = Date.now();
  const rows = lignes.map((p) => {
    const creneau = creneauxParId.get(p.creneau_id);
    const minutes = dureeMinutes(p, maintenant);
    return [
      (p.intervenant_id !== null ? noms.get(p.intervenant_id) : null) ?? "Non affecté",
      p.date,
      creneau?.libelle ?? "Intervention",
      creneau?.ville ?? "",
      formatHeurePointage(p.arrivee_le),
      formatHeurePointage(p.depart_le),
      p.pause_minutes,
      formatDuree(minutes),
      heuresDecimales(minutes),
      p.depart_le ? "Terminé" : "En cours",
    ];
  });

  const recap = recapHeuresParIntervenant(pointages, intervenants, dates, maintenant);
  const lignesRecap = recap
    .filter((l) => l.nbPointages > 0)
    .map((l) => [l.nom, l.nbJours, l.nbPointages, formatDuree(l.minutes), heuresDecimales(l.minutes)]);

  const contenu = [
    `Heures pointées — ${periodeLabel}`,
    toCsv(
      [
        "Intervenant",
        "Date",
        "Intervention",
        "Ville",
        "Arrivée",
        "Départ",
        "Pause (min)",
        "Durée (h:min)",
        "Durée (heures décimales)",
        "État",
      ],
      rows,
    ),
    "",
    toCsv(["Total par intervenant", "Jours pointés", "Interventions", "Heures", "Heures décimales"], lignesRecap),
  ].join("\r\n");

  const nom = params.fichier ?? `heures-${slugFichier(periodeLabel) || "periode"}`;
  downloadCsv(`${nom}.csv`, contenu);
  return rows.length;
}