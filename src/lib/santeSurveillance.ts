/**
 * Préférences de surveillance du mini-graphe de tendance de « Santé du compte ».
 *
 * Deux réglages, mémorisés localement (ce sont des préférences d'affichage, pas des données
 * métier) :
 *  - la semaine « épinglée à surveiller » : une semaine que l'artisan veut garder à l'œil en
 *    permanence, marquée d'un repère visuel sur sa barre ;
 *  - le filtre « semaines sous le seuil » : n'éclairer que les semaines problématiques, pour les
 *    repérer d'un coup d'œil.
 *
 * Écriture + événement, sur le même modèle que le seuil de santé (synchronisation des composants
 * de la même page et entre onglets).
 */

/** Clé de mémorisation locale de la semaine épinglée (lundi « AAAA-MM-JJ », ou absente). */
const SANTE_EPINGLE_STORAGE_KEY = "artiflow.sante.semaineEpinglee";

/** Événement émis quand la semaine épinglée change. */
export const SANTE_EPINGLE_EVENT = "artiflow:sante-epingle";

/** Clé de mémorisation locale du filtre « semaines sous le seuil ». */
const SANTE_SOUSSEUIL_STORAGE_KEY = "artiflow.sante.filtreSousSeuil";

/** Événement émis quand le filtre « sous le seuil » change. */
export const SANTE_SOUSSEUIL_EVENT = "artiflow:sante-filtre-sous-seuil";

/** Relit la semaine épinglée (null si aucune ou valeur invalide). */
export function lireSemaineEpinglee(): string | null {
  try {
    const raw = localStorage.getItem(SANTE_EPINGLE_STORAGE_KEY);
    if (!raw) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Enregistre la semaine épinglée (null pour détacher) et prévient les composants. */
export function ecrireSemaineEpinglee(semaine: string | null): void {
  try {
    if (semaine) localStorage.setItem(SANTE_EPINGLE_STORAGE_KEY, semaine);
    else localStorage.removeItem(SANTE_EPINGLE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(SANTE_EPINGLE_EVENT, { detail: semaine }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/** Épingle une semaine (ou la détache si elle est déjà épinglée). Renvoie la semaine active. */
export function basculerSemaineEpinglee(semaine: string): string | null {
  const actuelle = lireSemaineEpinglee();
  const suivante = actuelle === semaine ? null : semaine;
  ecrireSemaineEpinglee(suivante);
  return suivante;
}

/** Relit l'état du filtre « semaines sous le seuil » (désactivé par défaut). */
export function lireFiltreSousSeuil(): boolean {
  try {
    return localStorage.getItem(SANTE_SOUSSEUIL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Active ou désactive le filtre « semaines sous le seuil » et prévient les composants. */
export function ecrireFiltreSousSeuil(value: boolean): void {
  try {
    localStorage.setItem(SANTE_SOUSSEUIL_STORAGE_KEY, value ? "1" : "0");
    window.dispatchEvent(new CustomEvent(SANTE_SOUSSEUIL_EVENT, { detail: value }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}