/**
 * Réglage d'affichage « seuil d'alerte » du suivi des liens d'authentification : en dessous
 * de ce nombre d'essais relancés sur 30 jours, le compteur s'affiche en rouge pour signaler
 * une vérification trop espacée. Il ne s'agit que d'une préférence d'interface (aucune donnée
 * métier), mémorisée localement.
 */

const CLE = "artiflow.liens-auth.seuil30";

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const SEUIL_LIENS_AUTH_EVENT = "artiflow-liens-auth-seuil";

/** Seuil par défaut : environ un essai par semaine sur le mois glissant. */
export const SEUIL_LIENS_AUTH_DEFAUT = 4;

/** Bornes acceptées pour le seuil. */
export const SEUIL_LIENS_AUTH_MIN = 1;
export const SEUIL_LIENS_AUTH_MAX = 30;

/** Ramène une valeur quelconque dans les bornes du seuil. */
export function bornerSeuilLiensAuth(valeur: number): number {
  if (!Number.isFinite(valeur)) return SEUIL_LIENS_AUTH_DEFAUT;
  return Math.min(SEUIL_LIENS_AUTH_MAX, Math.max(SEUIL_LIENS_AUTH_MIN, Math.round(valeur)));
}

/** Seuil courant, ou la valeur par défaut si rien n'est mémorisé (robuste au stockage corrompu). */
export function lireSeuilLiensAuth(): number {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut === null) return SEUIL_LIENS_AUTH_DEFAUT;
    return bornerSeuilLiensAuth(Number(brut));
  } catch {
    return SEUIL_LIENS_AUTH_DEFAUT;
  }
}

/** Mémorise le seuil et prévient les composants intéressés. */
export function ecrireSeuilLiensAuth(valeur: number): void {
  try {
    localStorage.setItem(CLE, String(bornerSeuilLiensAuth(valeur)));
    window.dispatchEvent(new Event(SEUIL_LIENS_AUTH_EVENT));
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}