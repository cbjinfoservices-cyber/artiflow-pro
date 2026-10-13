/**
 * Regroupement des « ordres personnalisés » de l'espace, pour pouvoir les
 * réinitialiser d'un seul bloc depuis les Préférences d'affichage :
 * — l'ordre des lignes de la bibliothèque de lignes (glisser-déposer),
 * — l'ordre des favoris de la bibliothèque de ressources (glisser-déposer).
 *
 * Ce sont de simples préférences locales (poste + navigateur) : aucune donnée
 * métier n'est touchée. Les épinglages/favoris eux-mêmes ne sont PAS supprimés,
 * seul le rangement manuel est remis à l'ordre d'origine.
 */

import { enregistrerRemiseAZero } from "@/lib/preferencesAffichageNotif";
import { compterOrdreLignes, effacerOrdreLignes, lireOrdreLignes } from "@/lib/lignesOrdrePrefs";
import { compterOrdreFavoris, effacerOrdreFavoris, lireOrdreFavoris } from "@/lib/bibliothequePrefs";

/** Nombre de listes dont l'ordre personnalisé est actuellement actif (0 à 2). */
export function compterOrdresPersonnalises(): number {
  let n = 0;
  if (compterOrdreLignes() > 0) n += 1;
  if (compterOrdreFavoris() > 0) n += 1;
  return n;
}

/**
 * Réinitialise d'un bloc l'ordre personnalisé des lignes et des favoris.
 * Renvoie le nombre de listes réellement remises à l'ordre d'origine.
 */
export function reinitialiserOrdresPersonnalises(): number {
  // Photographie de l'état d'avant (ordre des lignes et ordre des favoris), pour le rétablir.
  const avant = { lignes: lireOrdreLignes(), favoris: lireOrdreFavoris() };
  let n = 0;
  if (effacerOrdreLignes()) n += 1;
  if (effacerOrdreFavoris()) n += 1;
  if (n > 0) enregistrerRemiseAZero("ordres", avant);
  return n;
}