/**
 * Mémoire locale des FILTRES du Journal d'archivage des récaps d'échecs : le type d'origine
 * (tous / automatique / manuel) et l'exercice (année) sélectionné. Il ne s'agit que de préférences
 * d'affichage (aucune donnée métier) : le filtre choisi est retrouvé tel quel à la prochaine
 * ouverture du journal, exactement comme la période de la courbe du délai moyen.
 */

const CLE_TYPE = "artiflow.journalArchive.type";
const CLE_EXERCICE = "artiflow.journalArchive.exercice";

/** Types d'origine mémorisables pour le journal. */
export type TypeJournalArchive = "tout" | "auto" | "manuel";

/** Événement diffusé après chaque modification d'un filtre du journal, pour l'affichage à chaud. */
export const JOURNAL_ARCHIVE_FILTRE_EVENT = "artiflow-journal-archive-filtre";

/** Type d'origine mémorisé, ou « tout » si rien n'est conservé. */
export function lireTypeJournalArchive(): TypeJournalArchive {
  try {
    const brut = localStorage.getItem(CLE_TYPE);
    if (brut === "auto" || brut === "manuel") return brut;
    return "tout";
  } catch {
    return "tout";
  }
}

/** Mémorise le type d'origine du journal et prévient les composants intéressés. */
export function ecrireTypeJournalArchive(valeur: TypeJournalArchive): void {
  try {
    localStorage.setItem(CLE_TYPE, valeur);
    window.dispatchEvent(new Event(JOURNAL_ARCHIVE_FILTRE_EVENT));
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}

/** Exercice (année) mémorisé, ou null pour « tous les exercices ». */
export function lireExerciceJournalArchive(): number | null {
  try {
    const brut = localStorage.getItem(CLE_EXERCICE);
    if (brut === null || brut === "tout") return null;
    const n = Number(brut);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  } catch {
    return null;
  }
}

/** Mémorise l'exercice sélectionné (null = tous les exercices) et prévient les composants. */
export function ecrireExerciceJournalArchive(exercice: number | null): void {
  try {
    localStorage.setItem(CLE_EXERCICE, exercice === null ? "tout" : String(exercice));
    window.dispatchEvent(new Event(JOURNAL_ARCHIVE_FILTRE_EVENT));
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}