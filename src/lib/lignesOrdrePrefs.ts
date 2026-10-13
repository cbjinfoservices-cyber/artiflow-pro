/**
 * Préférences d'ordre des lignes de désignation personnelles, à l'intérieur de
 * leur catégorie. Comme les préférences de catégories, ce sont de simples
 * préférences locales (aucun impact sur les données en base) : la bibliothèque
 * reste propre à chaque artisan.
 */

import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";

/** Clé de stockage de l'ordre personnalisé des lignes. */
export const LIGNES_ORDRE_KEY = "artiflow:biblio:lignes:ordre";
export const LIGNES_ORDRE_EVENT = "artiflow:biblio:lignes-ordre";

/** Liste ordonnée des identifiants de lignes personnelles. */
export function lireOrdreLignes(): number[] {
  try {
    const brut = window.localStorage.getItem(LIGNES_ORDRE_KEY);
    if (!brut) return [];
    const parsed: unknown = JSON.parse(brut);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => typeof x === "number");
  } catch {
    return [];
  }
}

/** Mémorise l'ordre des lignes et prévient les écrans ouverts. */
export function ecrireOrdreLignes(ordre: number[]): void {
  try {
    window.localStorage.setItem(LIGNES_ORDRE_KEY, JSON.stringify(ordre));
    window.dispatchEvent(new Event(LIGNES_ORDRE_EVENT));
    marquerPreferenceModifiee("ordres");
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/**
 * Trie des lignes selon l'ordre mémorisé. Les lignes non listées passent à la
 * fin, triées par désignation, pour garder un rendu stable.
 */
export function trierParOrdre<T extends { id: number; designation: string }>(lignes: T[], ordre: number[]): T[] {
  const index = new Map<number, number>();
  ordre.forEach((id, i) => {
    if (!index.has(id)) index.set(id, i);
  });
  return [...lignes].sort((a, b) => {
    const ia = index.has(a.id) ? (index.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
    const ib = index.has(b.id) ? (index.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    return a.designation.localeCompare(b.designation, "fr");
  });
}

/**
 * Déplace un identifiant juste avant un autre dans l'ordre (ou à la fin si la
 * cible est nulle). Utilisé pour réordonner les lignes d'une même catégorie.
 */
export function deplacerDansOrdre(ordre: number[], id: number, avantId: number | null): number[] {
  const sans = ordre.filter((x) => x !== id);
  if (avantId == null) return [...sans, id];
  const i = sans.indexOf(avantId);
  if (i < 0) return [...sans, id];
  return [...sans.slice(0, i), id, ...sans.slice(i)];
}

/** Nombre de lignes dont l'ordre personnalisé est actuellement mémorisé (aperçu des préférences). */
export function compterOrdreLignes(): number {
  return lireOrdreLignes().length;
}

/**
 * Efface l'ordre personnalisé des lignes : elles repasseront par l'ordre par
 * défaut (catégorie puis désignation). Renvoie true si un ordre existait.
 */
export function effacerOrdreLignes(): boolean {
  try {
    const existait = window.localStorage.getItem(LIGNES_ORDRE_KEY) !== null;
    window.localStorage.removeItem(LIGNES_ORDRE_KEY);
    window.dispatchEvent(new Event(LIGNES_ORDRE_EVENT));
    if (existait) marquerPreferenceModifiee("ordres");
    return existait;
  } catch {
    return false;
  }
}