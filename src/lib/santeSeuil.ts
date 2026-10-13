/**
 * Réglage partagé du seuil d'alerte du score de santé du compte.
 *
 * Le mini-graphe de tendance (SanteHistoriqueChart) laisse l'artisan choisir le seuil sous lequel
 * il veut être prévenu, et le conserve localement. Le bandeau d'alerte (AlerteSanteBaisse) lit la
 * même valeur pour rester cohérent : les deux composants partagent donc cette petite façade
 * (lecture + écriture + événement), sur le même modèle que le seuil du taux de réussite.
 */

import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

/** Clé de mémorisation locale du seuil d'alerte du score de santé. */
export const SEUIL_SANTE_STORAGE_KEY = "artiflow.sante.seuilAlerte";

/** Événement émis quand le seuil change, pour synchroniser les composants de la même page. */
export const SEUIL_SANTE_EVENT = "artiflow:sante-seuil";

/** Seuil par défaut, en dessous duquel on considère que la santé du compte se dégrade. */
export const SEUIL_SANTE_DEFAUT = 60;

/** Seuils d'alerte proposés (score sur 100 sous lequel on prévient). */
export const SEUILS_SANTE = [40, 50, 60, 70, 80];

/** Relit le seuil choisi par l'artisan (retombe sur la valeur par défaut si absent ou invalide). */
export function lireSeuilSante(): number {
  try {
    const value = Number(lireBrut(SEUIL_SANTE_STORAGE_KEY));
    if (SEUILS_SANTE.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return SEUIL_SANTE_DEFAUT;
}

/**
 * Enregistre le seuil choisi et prévient les composants de la même page
 * (le bandeau d'alerte suit ainsi immédiatement le réglage du mini-graphe).
 */
export function ecrireSeuilSante(value: number): void {
  try {
    ecrireBrut(SEUIL_SANTE_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(SEUIL_SANTE_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée, l'événement non plus */
  }
}