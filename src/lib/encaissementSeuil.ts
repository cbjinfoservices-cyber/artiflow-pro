/**
 * Réglage partagé du seuil d'alerte du taux d'encaissement mensuel.
 *
 * L'indicateur « Facturé vs encaissé » du tableau de bord laisse l'artisan choisir le seuil
 * sous lequel il veut être prévenu, et le conserve localement. Le bandeau d'alerte du tableau
 * de bord (AlerteEncaissementMois) lit la même valeur pour rester cohérent avec ce choix :
 * les deux composants partagent donc cette petite façade (lecture + écriture + événement),
 * exactement comme le seuil du taux de réussite des envois.
 */

import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

/** Clé de mémorisation locale du seuil d'alerte d'encaissement (partagée). */
export const SEUIL_ENCAISSEMENT_STORAGE_KEY = "artiflow.encaissement.seuilAlerte";

/** Événement émis quand le seuil change, pour synchroniser les composants de la même page. */
export const SEUIL_ENCAISSEMENT_EVENT = "artiflow:encaissement-seuil";

/** Seuil d'alerte par défaut (taux d'encaissement mensuel), en dessous duquel on prévient. */
export const SEUIL_ENCAISSEMENT_DEFAUT = 60;

/** Seuils d'alerte proposés (taux d'encaissement mensuel sous lequel on prévient). */
export const SEUILS_ENCAISSEMENT = [40, 50, 60, 70, 80];

/** Relit le seuil choisi par l'artisan (retombe sur la valeur par défaut si absent ou invalide). */
export function lireSeuilEncaissement(): number {
  try {
    const value = Number(lireBrut(SEUIL_ENCAISSEMENT_STORAGE_KEY));
    if (SEUILS_ENCAISSEMENT.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return SEUIL_ENCAISSEMENT_DEFAUT;
}

/**
 * Enregistre le seuil choisi et prévient les composants de la même page
 * (le bandeau d'alerte suit ainsi immédiatement le réglage de l'indicateur).
 */
export function ecrireSeuilEncaissement(value: number): void {
  try {
    ecrireBrut(SEUIL_ENCAISSEMENT_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(SEUIL_ENCAISSEMENT_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée, l'événement non plus */
  }
}