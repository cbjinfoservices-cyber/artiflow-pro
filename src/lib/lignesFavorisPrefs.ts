/**
 * Préférences d'épinglage des lignes de désignation. Une ligne épinglée remonte
 * en tête de sa catégorie pour être retrouvée plus vite. Cela fonctionne pour les
 * lignes personnelles (identifiant numérique) comme pour les lignes du catalogue
 * métier (clé texte). Ce sont de simples préférences locales (aucun impact sur
 * les données en base).
 */

const KEY = "artiflow:biblio:lignes:favoris";
export const LIGNES_FAVORIS_EVENT = "artiflow:biblio:lignes-favoris";

/** Clé d'une ligne épinglée : id numérique (perso) ou clé texte (catalogue). */
export type FavoriCle = number | string;

/** Vrai si la valeur lue ressemble à une clé d'épinglage exploitable. */
function estCleValide(x: unknown): x is FavoriCle {
  return typeof x === "number" || typeof x === "string";
}

/** Liste des clés de lignes épinglées. */
export function lireLignesFavoris(): FavoriCle[] {
  try {
    const brut = window.localStorage.getItem(KEY);
    if (!brut) return [];
    const parsed: unknown = JSON.parse(brut);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(estCleValide);
  } catch {
    return [];
  }
}

/** Mémorise la liste des lignes épinglées et prévient les écrans ouverts. */
export function ecrireLignesFavoris(cles: FavoriCle[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cles));
    window.dispatchEvent(new Event(LIGNES_FAVORIS_EVENT));
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Ajoute ou retire une clé de la liste des épingles. */
export function basculerFavori(cles: FavoriCle[], cle: FavoriCle): FavoriCle[] {
  return cles.includes(cle) ? cles.filter((x) => x !== cle) : [...cles, cle];
}

/** Vrai si la ligne est épinglée. */
export function estFavori(cles: FavoriCle[], cle: FavoriCle): boolean {
  return cles.includes(cle);
}

/**
 * Trie des lignes pour placer les épinglées en tête, en conservant l'ordre
 * fourni (déjà trié par préférence d'ordre) à l'intérieur de chaque groupe.
 * La clé d'épinglage de chaque ligne est obtenue via `cleDe`.
 */
export function trierParFavoris<T>(
  lignes: T[],
  favoris: FavoriCle[],
  cleDe: (item: T) => FavoriCle,
): T[] {
  const epinglees = new Set<FavoriCle>(favoris);
  return [
    ...lignes.filter((l) => epinglees.has(cleDe(l))),
    ...lignes.filter((l) => !epinglees.has(cleDe(l))),
  ];
}