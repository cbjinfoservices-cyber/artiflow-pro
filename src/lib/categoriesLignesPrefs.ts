/**
 * Préférences d'affichage des catégories de lignes de désignation :
 * ordre choisi, catégories masquées des filtres et sélecteurs, et renommages
 * d'affichage. Ce sont de simples préférences locales (aucun impact sur les
 * données en base), sur le même principe que les autres préférences d'affichage.
 * Elles sont sauvegardées sur le compte (Backend) pour être retrouvées sur tout appareil.
 *
 * Toutes les lectures / écritures passent par `src/lib/stockageLocal.ts` (jamais localStorage en direct).
 */

import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";
import { ecrireJson, lireJson } from "@/lib/stockageLocal";

export interface CategoriesLignesPrefs {
  /** Ordre choisi des catégories (noms canoniques). */
  ordre: string[];
  /** Catégories retirées des filtres et sélecteurs (nom canonique). */
  masquees: string[];
  /** Renommages d'affichage : nom canonique → libellé affiché. */
  renommages: Record<string, string>;
}

const KEY = "artiflow:biblio:lignes:categories";
export const CATEGORIES_LIGNES_EVENT = "artiflow:biblio:lignes-categories";

/** Préférences par défaut : aucun réglage. */
export const CATEGORIES_LIGNES_PREFS_VIDES: CategoriesLignesPrefs = { ordre: [], masquees: [], renommages: {} };

/** Ramène une donnée brute (issue du stockage) vers des préférences valides. */
function nettoyer(valeur: unknown): CategoriesLignesPrefs {
  const src = (valeur ?? {}) as Record<string, unknown>;
  const ordre = Array.isArray(src.ordre) ? src.ordre.filter((x): x is string => typeof x === "string") : [];
  const masquees = Array.isArray(src.masquees)
    ? src.masquees.filter((x): x is string => typeof x === "string")
    : [];
  const renommages: Record<string, string> = {};
  if (src.renommages && typeof src.renommages === "object") {
    Object.entries(src.renommages as Record<string, unknown>).forEach(([cle, val]) => {
      if (typeof val === "string" && val.trim()) renommages[cle] = val;
    });
  }
  return { ordre, masquees, renommages };
}

/** Relit les préférences de catégories mémorisées localement. */
export function lireCategoriesLignesPrefs(): CategoriesLignesPrefs {
  return lireJson<CategoriesLignesPrefs>(KEY, (brut) => nettoyer(brut));
}

/** Mémorise les préférences de catégories et prévient les écrans ouverts. */
export function ecrireCategoriesLignesPrefs(prefs: CategoriesLignesPrefs): void {
  if (!ecrireJson(KEY, prefs)) return;
  try {
    window.dispatchEvent(new Event(CATEGORIES_LIGNES_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
  marquerPreferenceModifiee("lignes");
}

/** Une catégorie prête à afficher : nom canonique, libellé et état de masquage. */
export interface CategorieAffichee {
  /** Nom canonique servant de clé (ce qui est réellement stocké sur les lignes). */
  nom: string;
  /** Libellé affiché (renommé si besoin). */
  affichage: string;
  /** Retirée des filtres et sélecteurs. */
  masquee: boolean;
}

/**
 * Construit la liste ordonnée des catégories à afficher : on suit l'ordre choisi
 * par l'artisan, puis on ajoute les catégories restantes dans leur ordre naturel.
 */
export function construireCategories(
  nomsCanoniques: string[],
  prefs: CategoriesLignesPrefs,
): CategorieAffichee[] {
  const presents = new Set(nomsCanoniques);
  const vus = new Set<string>();
  const ordonnes: string[] = [];
  prefs.ordre.forEach((nom) => {
    if (presents.has(nom) && !vus.has(nom)) {
      vus.add(nom);
      ordonnes.push(nom);
    }
  });
  nomsCanoniques.forEach((nom) => {
    if (!vus.has(nom)) {
      vus.add(nom);
      ordonnes.push(nom);
    }
  });
  return ordonnes.map((nom) => ({
    nom,
    affichage: prefs.renommages[nom] ?? nom,
    masquee: prefs.masquees.includes(nom),
  }));
}

/** Libellé d'affichage d'une catégorie (renommée si besoin). */
export function afficherCategorie(nom: string, prefs: CategoriesLignesPrefs): string {
  return prefs.renommages[nom] ?? nom;
}

/** Compte les réglages de catégories qui s'écartent des valeurs par défaut (aperçu des préférences). */
export function compterCategoriesLignesPrefs(): number {
  const p = lireCategoriesLignesPrefs();
  let n = 0;
  if (p.ordre.length > 0) n += 1;
  if (p.masquees.length > 0) n += 1;
  if (Object.keys(p.renommages).length > 0) n += 1;
  return n;
}