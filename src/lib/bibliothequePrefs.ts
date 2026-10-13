/**
 * Préférences de la page « Ma bibliothèque » : on mémorise le tri et la page
 * choisis afin de les retrouver à la prochaine visite. Ce sont de simples
 * préférences d'affichage locales, sans impact sur les données.
 */

import { enregistrerRemiseAZero, marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";

export type TriBiblio = "recents" | "metier" | "temps" | "titre" | "manuel";

const TRIS_IDS: TriBiblio[] = ["recents", "metier", "temps", "titre", "manuel"];

const TRI_KEY = "artiflow:biblio:tri";
const PAGE_KEY = "artiflow:biblio:page";

export type TriNotesBiblio = "recents" | "titre" | "manuel";

const TRIS_NOTES_IDS: TriNotesBiblio[] = ["recents", "titre", "manuel"];
const TRI_NOTES_KEY = "artiflow:biblio:trinotes";

/** Relit le tri mémorisé (« recents » par défaut). */
export function lireTriBiblio(): TriBiblio {
  try {
    const valeur = window.localStorage.getItem(TRI_KEY);
    if (valeur && TRIS_IDS.includes(valeur as TriBiblio)) return valeur as TriBiblio;
  } catch {
    /* Stockage indisponible : on ignore. */
  }
  return "recents";
}

/** Mémorise le tri courant. */
export function ecrireTriBiblio(tri: TriBiblio): void {
  try {
    if (lireTriBiblio() === tri) return;
    window.localStorage.setItem(TRI_KEY, tri);
    marquerPreferenceModifiee("biblio");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Relit le numéro de page mémorisé (1 par défaut). */
export function lirePageBiblio(): number {
  try {
    const valeur = Number(window.localStorage.getItem(PAGE_KEY));
    if (Number.isFinite(valeur) && valeur >= 1) return Math.floor(valeur);
  } catch {
    /* Stockage indisponible : on ignore. */
  }
  return 1;
}

/** Mémorise la page courante. */
export function ecrirePageBiblio(page: number): void {
  try {
    window.localStorage.setItem(PAGE_KEY, String(Math.max(1, Math.floor(page))));
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Relit le tri de la vue Notes mémorisé (« recents » par défaut). */
export function lireTriNotesBiblio(): TriNotesBiblio {
  try {
    const valeur = window.localStorage.getItem(TRI_NOTES_KEY);
    if (valeur && TRIS_NOTES_IDS.includes(valeur as TriNotesBiblio)) return valeur as TriNotesBiblio;
  } catch {
    /* Stockage indisponible : on ignore. */
  }
  return "recents";
}

/** Mémorise le tri de la vue Notes. */
export function ecrireTriNotesBiblio(tri: TriNotesBiblio): void {
  try {
    if (lireTriNotesBiblio() === tri) return;
    window.localStorage.setItem(TRI_NOTES_KEY, tri);
    marquerPreferenceModifiee("biblio");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/* ------------------------ Ordre manuel des favoris ------------------------- */

const ORDRE_FAV_KEY = "artiflow:biblio:ordrefav";
/** Clé de stockage de l'ordre personnalisé des favoris (bibliothèque de ressources). */
export const ORDRE_FAVORIS_KEY = ORDRE_FAV_KEY;

/** Relit l'ordre manuel des favoris (liste ordonnée de slugs), vide si aucun. */
export function lireOrdreFavoris(): string[] {
  try {
    const brut = window.localStorage.getItem(ORDRE_FAV_KEY);
    if (!brut) return [];
    const valeur = JSON.parse(brut);
    if (Array.isArray(valeur)) return valeur.filter((x): x is string => typeof x === "string");
  } catch {
    /* Stockage indisponible ou données illisibles : on ignore. */
  }
  return [];
}

/** Mémorise l'ordre manuel des favoris. */
export function ecrireOrdreFavoris(ordre: string[]): void {
  try {
    window.localStorage.setItem(ORDRE_FAV_KEY, JSON.stringify(ordre));
    marquerPreferenceModifiee("ordres");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Nombre de guides favoris dont l'ordre personnalisé est mémorisé (aperçu des préférences). */
export function compterOrdreFavoris(): number {
  return lireOrdreFavoris().length;
}

/**
 * Efface l'ordre manuel des favoris de la bibliothèque de ressources : ils
 * repasseront par l'ordre « Plus récents ». Renvoie true si un ordre existait.
 */
export function effacerOrdreFavoris(): boolean {
  try {
    const existait = window.localStorage.getItem(ORDRE_FAV_KEY) !== null;
    window.localStorage.removeItem(ORDRE_FAV_KEY);
    if (existait) marquerPreferenceModifiee("ordres");
    return existait;
  } catch {
    return false;
  }
}

/* -------------------- Ordre manuel des notes libres ------------------------ */

const ORDRE_NOTES_KEY = "artiflow:biblio:ordrenotes";

/** Relit l'ordre manuel des notes libres (liste ordonnée d'identifiants), vide si aucun. */
export function lireOrdreNotes(): string[] {
  try {
    const brut = window.localStorage.getItem(ORDRE_NOTES_KEY);
    if (!brut) return [];
    const valeur = JSON.parse(brut);
    if (Array.isArray(valeur)) return valeur.filter((x): x is string => typeof x === "string");
  } catch {
    /* Stockage indisponible ou données illisibles : on ignore. */
  }
  return [];
}

/** Mémorise l'ordre manuel des notes libres. */
export function ecrireOrdreNotes(ordre: string[]): void {
  try {
    window.localStorage.setItem(ORDRE_NOTES_KEY, JSON.stringify(ordre));
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/* ------------------- Épinglage des barres de tri --------------------------- */

const EPINGLE_FAV_KEY = "artiflow:biblio:epinglefav";
const EPINGLE_NOTES_KEY = "artiflow:biblio:epinglenotes";

/** Vrai si la barre de tri des favoris est épinglée au défilement. */
export function lireEpingleTriFav(): boolean {
  try {
    return window.localStorage.getItem(EPINGLE_FAV_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mémorise l'épinglage de la barre de tri des favoris. */
export function ecrireEpingleTriFav(valeur: boolean): void {
  try {
    if (lireEpingleTriFav() === valeur) return;
    window.localStorage.setItem(EPINGLE_FAV_KEY, valeur ? "1" : "0");
    marquerPreferenceModifiee("biblio");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Vrai si la barre de tri des notes est épinglée au défilement. */
export function lireEpingleTriNotes(): boolean {
  try {
    return window.localStorage.getItem(EPINGLE_NOTES_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mémorise l'épinglage de la barre de tri des notes. */
export function ecrireEpingleTriNotes(valeur: boolean): void {
  try {
    if (lireEpingleTriNotes() === valeur) return;
    window.localStorage.setItem(EPINGLE_NOTES_KEY, valeur ? "1" : "0");
    marquerPreferenceModifiee("biblio");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/* ------------- Vitesse du défilement automatique de l'aperçu -------------- */

export type VitesseApercu = "lent" | "normal" | "rapide";

const VITESSES_IDS: VitesseApercu[] = ["lent", "normal", "rapide"];

const VITESSE_FAV_KEY = "artiflow:biblio:vitessefav";
const VITESSE_NOTES_KEY = "artiflow:biblio:vitessenotes";

/** Relit la vitesse d'aperçu des favoris (« normal » par défaut). */
export function lireVitesseFav(): VitesseApercu {
  try {
    const valeur = window.localStorage.getItem(VITESSE_FAV_KEY);
    if (valeur && VITESSES_IDS.includes(valeur as VitesseApercu)) return valeur as VitesseApercu;
  } catch {
    /* Stockage indisponible : on ignore. */
  }
  return "normal";
}

/** Mémorise la vitesse d'aperçu des favoris. */
export function ecrireVitesseFav(vitesse: VitesseApercu): void {
  try {
    if (lireVitesseFav() === vitesse) return;
    window.localStorage.setItem(VITESSE_FAV_KEY, vitesse);
    marquerPreferenceModifiee("biblio");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Relit la vitesse d'aperçu des notes (« normal » par défaut). */
export function lireVitesseNotes(): VitesseApercu {
  try {
    const valeur = window.localStorage.getItem(VITESSE_NOTES_KEY);
    if (valeur && VITESSES_IDS.includes(valeur as VitesseApercu)) return valeur as VitesseApercu;
  } catch {
    /* Stockage indisponible : on ignore. */
  }
  return "normal";
}

/** Mémorise la vitesse d'aperçu des notes. */
export function ecrireVitesseNotes(vitesse: VitesseApercu): void {
  try {
    if (lireVitesseNotes() === vitesse) return;
    window.localStorage.setItem(VITESSE_NOTES_KEY, vitesse);
    marquerPreferenceModifiee("biblio");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/* ------------ Position d'ouverture de l'aperçu des éléments déplacés ------- */

const APERCU_FAV_KEY = "artiflow:biblio:apercufav";
const APERCU_NOTES_KEY = "artiflow:biblio:apercunotes";

/** Relit la position d'aperçu mémorisée des favoris (null si aucune). */
export function lireApercuFavPosition(): number | null {
  try {
    const brut = window.localStorage.getItem(APERCU_FAV_KEY);
    if (brut === null) return null;
    const valeur = Number(brut);
    if (Number.isFinite(valeur) && valeur >= 0) return Math.floor(valeur);
  } catch {
    /* Stockage indisponible : on ignore. */
  }
  return null;
}

/** Mémorise la position d'aperçu des favoris (null pour effacer). */
export function ecrireApercuFavPosition(position: number | null): void {
  try {
    if (position === null) window.localStorage.removeItem(APERCU_FAV_KEY);
    else window.localStorage.setItem(APERCU_FAV_KEY, String(Math.max(0, Math.floor(position))));
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Relit la position d'aperçu mémorisée des notes libres (null si aucune). */
export function lireApercuNotesPosition(): number | null {
  try {
    const brut = window.localStorage.getItem(APERCU_NOTES_KEY);
    if (brut === null) return null;
    const valeur = Number(brut);
    if (Number.isFinite(valeur) && valeur >= 0) return Math.floor(valeur);
  } catch {
    /* Stockage indisponible : on ignore. */
  }
  return null;
}

/** Mémorise la position d'aperçu des notes libres (null pour effacer). */
export function ecrireApercuNotesPosition(position: number | null): void {
  try {
    if (position === null) window.localStorage.removeItem(APERCU_NOTES_KEY);
    else window.localStorage.setItem(APERCU_NOTES_KEY, String(Math.max(0, Math.floor(position))));
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/* --------------- Mode lecture/pause mémorisé de l'aperçu ------------------- */

const APERCU_AUTO_FAV_KEY = "artiflow:biblio:apercuautofav";
const APERCU_AUTO_NOTES_KEY = "artiflow:biblio:apercuautonotes";

/** Vrai si l'aperçu des favoris était en lecture automatique à la dernière visite. */
export function lireApercuFavAuto(): boolean {
  try {
    return window.localStorage.getItem(APERCU_AUTO_FAV_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mémorise le mode lecture/pause de l'aperçu des favoris. */
export function ecrireApercuFavAuto(valeur: boolean): void {
  try {
    window.localStorage.setItem(APERCU_AUTO_FAV_KEY, valeur ? "1" : "0");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Vrai si l'aperçu des notes libres était en lecture automatique à la dernière visite. */
export function lireApercuNotesAuto(): boolean {
  try {
    return window.localStorage.getItem(APERCU_AUTO_NOTES_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mémorise le mode lecture/pause de l'aperçu des notes libres. */
export function ecrireApercuNotesAuto(valeur: boolean): void {
  try {
    window.localStorage.setItem(APERCU_AUTO_NOTES_KEY, valeur ? "1" : "0");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/* ---------------- Synchronisation par profil (Backend) -------------------- */

/** Préférences d'affichage de la bibliothèque sauvegardées sur le compte. */
export interface PreferencesBiblio {
  tri: TriBiblio;
  triNotes: TriNotesBiblio;
  vitesseFav: VitesseApercu;
  vitesseNotes: VitesseApercu;
  epingleFav: boolean;
  epingleNotes: boolean;
}

/** Rassemble les préférences d'affichage de la bibliothèque (pour les sauvegarder sur le compte). */
export function collecterPreferencesBiblio(): PreferencesBiblio {
  return {
    tri: lireTriBiblio(),
    triNotes: lireTriNotesBiblio(),
    vitesseFav: lireVitesseFav(),
    vitesseNotes: lireVitesseNotes(),
    epingleFav: lireEpingleTriFav(),
    epingleNotes: lireEpingleTriNotes(),
  };
}

/**
 * Applique une photographie de préférences bibliothèque reçue du compte (sans
 * horodater ni synchroniser : c'est une simple restitution de l'état).
 */
export function appliquerPreferencesBiblio(p: PreferencesBiblio): void {
  try {
    const ls = window.localStorage;
    if (TRIS_IDS.includes(p.tri)) ls.setItem(TRI_KEY, p.tri);
    if (TRIS_NOTES_IDS.includes(p.triNotes)) ls.setItem(TRI_NOTES_KEY, p.triNotes);
    if (VITESSES_IDS.includes(p.vitesseFav)) ls.setItem(VITESSE_FAV_KEY, p.vitesseFav);
    if (VITESSES_IDS.includes(p.vitesseNotes)) ls.setItem(VITESSE_NOTES_KEY, p.vitesseNotes);
    ls.setItem(EPINGLE_FAV_KEY, p.epingleFav ? "1" : "0");
    ls.setItem(EPINGLE_NOTES_KEY, p.epingleNotes ? "1" : "0");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Compte les réglages bibliothèque qui s'écartent des valeurs par défaut (aperçu des préférences). */
export function compterPreferencesBiblio(): number {
  let n = 0;
  if (lireTriBiblio() !== "recents") n += 1;
  if (lireTriNotesBiblio() !== "recents") n += 1;
  if (lireVitesseFav() !== "normal") n += 1;
  if (lireVitesseNotes() !== "normal") n += 1;
  if (lireEpingleTriFav()) n += 1;
  if (lireEpingleTriNotes()) n += 1;
  return n;
}

/* ------------- Réinitialisation de toutes les préférences d'affichage ------ */

/**
 * Remet à zéro les préférences d'affichage de la bibliothèque : tris, vitesses
 * d'aperçu, épinglages des barres de tri, position d'ouverture et mode
 * lecture/pause de l'aperçu.
 * L'ordre manuel des favoris/notes n'est volontairement pas touché (il dispose
 * de ses propres boutons « Rétablir l'ordre d'origine »).
 */
export function reinitialiserPreferencesBiblio(): void {
  const avant = collecterPreferencesBiblio();
  const avaitPersonnalisation = compterPreferencesBiblio() > 0;
  try {
    [
      TRI_KEY,
      TRI_NOTES_KEY,
      EPINGLE_FAV_KEY,
      EPINGLE_NOTES_KEY,
      VITESSE_FAV_KEY,
      VITESSE_NOTES_KEY,
      APERCU_FAV_KEY,
      APERCU_NOTES_KEY,
      APERCU_AUTO_FAV_KEY,
      APERCU_AUTO_NOTES_KEY,
    ].forEach((cle) => window.localStorage.removeItem(cle));
  } catch {
    /* Stockage indisponible : on ignore. */
  }
  if (avaitPersonnalisation) enregistrerRemiseAZero("biblio", avant);
}