/**
 * Rassemble les préférences d'affichage de la bibliothèque de lignes, pour les sauvegarder sur le
 * compte (Backend) et les retrouver sur n'importe quel appareil, puis les réappliquer :
 * — les catégories (ordre, masquage, renommages d'affichage),
 * — la vue active (onglet « Mes lignes » / « Catalogue métier », filtre de catégorie, filtre
 *   « épinglées uniquement ») — la recherche texte en cours reste locale,
 * — l'onglet mémorisé de la fenêtre « Bibliothèque de lignes » d'un devis.
 *
 * Aucune donnée métier ici : uniquement des préférences d'interface, propres au compte.
 */

import {
  CATEGORIES_LIGNES_PREFS_VIDES,
  compterCategoriesLignesPrefs,
  ecrireCategoriesLignesPrefs,
  lireCategoriesLignesPrefs,
  type CategoriesLignesPrefs,
} from "@/lib/categoriesLignesPrefs";
import {
  CATEGORIE_TOUTES,
  ecrireCategorieLignes,
  ecrireEpingleesLignes,
  ecrireOngletLignes,
  lireCategorieLignes,
  lireEpingleesLignes,
  lireOngletLignes,
  type OngletLignes,
} from "@/lib/lignesVuePrefs";
import {
  effacerOngletBiblioDevis,
  ecrireOngletBiblioDevis,
  lireOngletBiblioDevis,
  type OngletBiblioDevis,
} from "@/lib/devisBiblioOngletPrefs";
import { enregistrerRemiseAZero } from "@/lib/preferencesAffichageNotif";

/** Préférences d'affichage de la bibliothèque de lignes, sauvegardables sur le compte. */
export interface PreferencesLignes {
  /** Ordre, masquage et renommages d'affichage des catégories de lignes. */
  categories: CategoriesLignesPrefs;
  /** Vue active : onglet, filtre de catégorie et filtre épinglées. */
  vue: {
    onglet: OngletLignes;
    categorie: string;
    epinglees: boolean;
  };
  /** Onglet mémorisé de la fenêtre de bibliothèque de lignes d'un devis. */
  ongletDevis: OngletBiblioDevis;
}

/** Rassemble les préférences d'affichage de la bibliothèque de lignes (pour le compte). */
export function collecterPreferencesLignes(): PreferencesLignes {
  return {
    categories: lireCategoriesLignesPrefs(),
    vue: {
      onglet: lireOngletLignes(),
      categorie: lireCategorieLignes(),
      epinglees: lireEpingleesLignes(),
    },
    ongletDevis: lireOngletBiblioDevis(),
  };
}

/**
 * Applique une photographie de préférences de bibliothèque de lignes reçue du compte.
 * Si elle est appelée depuis l'application d'un état Backend, les notifications sont suspendues
 * par l'appelant (pour ne pas re-synchroniser en boucle).
 */
export function appliquerPreferencesLignes(p: PreferencesLignes): void {
  if (!p) return;
  if (p.categories) ecrireCategoriesLignesPrefs(p.categories);
  ecrireOngletLignes(p.vue?.onglet === "catalogue" ? "catalogue" : "perso");
  ecrireCategorieLignes(typeof p.vue?.categorie === "string" && p.vue.categorie ? p.vue.categorie : CATEGORIE_TOUTES);
  ecrireEpingleesLignes(Boolean(p.vue?.epinglees));
  if (p.ongletDevis === "perso" || p.ongletDevis === "catalogue") ecrireOngletBiblioDevis(p.ongletDevis);
}

/** Compte les réglages de la bibliothèque de lignes qui s'écartent des valeurs par défaut. */
export function compterPreferencesLignes(): number {
  let n = 0;
  if (compterCategoriesLignesPrefs() > 0) n += 1;
  if (lireOngletLignes() !== "perso") n += 1;
  if (lireCategorieLignes() !== CATEGORIE_TOUTES) n += 1;
  if (lireEpingleesLignes()) n += 1;
  if (lireOngletBiblioDevis() !== "perso") n += 1;
  return n;
}

/**
 * Remet à zéro les préférences de la bibliothèque de lignes : catégories, vue active et onglet du
 * devis. Renvoie le nombre de réglages réellement remis à leur valeur par défaut (0 si rien à faire).
 */
export function reinitialiserPreferencesLignes(): number {
  const avant = collecterPreferencesLignes();
  const avait = compterPreferencesLignes() > 0;
  ecrireCategoriesLignesPrefs({ ...CATEGORIES_LIGNES_PREFS_VIDES });
  ecrireOngletLignes("perso");
  ecrireCategorieLignes(CATEGORIE_TOUTES);
  ecrireEpingleesLignes(false);
  effacerOngletBiblioDevis();
  if (avait) enregistrerRemiseAZero("lignes", avant);
  return avait ? 1 : 0;
}