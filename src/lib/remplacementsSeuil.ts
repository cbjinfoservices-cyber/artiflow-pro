/**
 * Réglage partagé du seuil de renvois par mois du mini-graphe des remplacements.
 *
 * Le mini-graphe « Renvois par mois » de l'Espace comptable laisse l'artisan régler le seuil
 * sous lequel il considère qu'un mois est « à faible activité » (peu de renvois), et le
 * conserve localement. Le filtre « sous le seuil » lit la même valeur pour rester cohérent
 * avec ce choix : les deux composants partagent donc cette petite façade (lecture + écriture +
 * événement), exactement comme le seuil d'alerte du score de santé.
 */

import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

/** Clé de mémorisation locale du seuil de renvois par mois (partagée). */
export const SEUIL_REMPLACEMENTS_STORAGE_KEY = "artiflow.compta.remplacements-seuil";

/** Événement émis quand le seuil change, pour synchroniser les composants de la même page. */
export const SEUIL_REMPLACEMENTS_EVENT = "artiflow:remplacements-seuil";

/** Seuil par défaut (nombre de renvois par mois sous lequel on considère un mois peu actif). */
export const SEUIL_REMPLACEMENTS_DEFAUT = 2;

/** Seuils proposés (nombre de renvois par mois sous lequel un mois est jugé « sous le seuil »). */
export const SEUILS_REMPLACEMENTS = [1, 2, 3, 5, 8];

/** Relit le seuil choisi par l'artisan (retombe sur la valeur par défaut si absent ou invalide). */
export function lireSeuilRemp(): number {
  try {
    const value = Number(lireBrut(SEUIL_REMPLACEMENTS_STORAGE_KEY));
    if (SEUILS_REMPLACEMENTS.includes(value)) return value;
  } catch {
    /* stockage indisponible : on retombe sur la valeur par défaut */
  }
  return SEUIL_REMPLACEMENTS_DEFAUT;
}

/**
 * Enregistre le seuil choisi et prévient les composants de la même page
 * (le filtre du mini-graphe suit ainsi immédiatement le réglage).
 */
export function ecrireSeuilRemp(value: number): void {
  try {
    ecrireBrut(SEUIL_REMPLACEMENTS_STORAGE_KEY, String(value));
    window.dispatchEvent(new CustomEvent(SEUIL_REMPLACEMENTS_EVENT, { detail: value }));
  } catch {
    /* stockage indisponible : la préférence ne sera pas conservée, l'événement non plus */
  }
}