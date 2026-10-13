/**
 * Réglage partagé du seuil de notification du taux de réussite des envois.
 *
 * L'indicateur de taux (TauxReussiteEnvoi) laisse l'artisan choisir le seuil sous lequel il
 * veut être prévenu, et le conserve localement. Le bandeau d'alerte du tableau de bord
 * (AlerteTauxSemaine) lit la même valeur pour rester cohérent avec le choix de l'artisan :
 * les deux composants partagent donc cette petite façade (lecture + écriture + événement).
 */

import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

/** Clé de mémorisation locale du seuil de notification (partagée par les deux composants). */
export const SEUIL_TAUX_STORAGE_KEY = "artiflow.taux.seuilAlerte";

/** Événement émis quand le seuil change, pour synchroniser les composants de la même page. */
export const SEUIL_TAUX_EVENT = "artiflow:taux-seuil";

/** Seuil de notification par défaut (taux hebdomadaire), en dessous duquel on prévient. */
export const SEUIL_TAUX_DEFAUT = 50;

/** Seuils de notification proposés (taux hebdomadaire sous lequel on prévient). */
export const SEUILS_TAUX = [30, 40, 50, 60, 70];

/** Relit le seuil choisi par l'artisan (retombe sur la valeur par défaut si absent ou invalide). */
export function lireSeuilTaux(): number {
  try {
    const value = Number(lireBrut(SEUIL_TAUX_STORAGE_KEY));
    if (SEUILS_TAUX.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return SEUIL_TAUX_DEFAUT;
}

/**
 * Enregistre le seuil choisi et prévient les composants de la même page
 * (le bandeau d'alerte suit ainsi immédiatement le réglage de l'indicateur).
 */
export function ecrireSeuilTaux(value: number): void {
  try {
    ecrireBrut(SEUIL_TAUX_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(SEUIL_TAUX_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée, l'événement non plus */
  }
}