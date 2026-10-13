/**
 * Gestion centralisée du consentement aux cookies.
 * Un seul emplacement de stockage et un seul événement partagé,
 * utilisés à la fois par la bannière, le footer, la page cookies et la mesure d'audience.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "artiflow-cookie-consent";

/** Émis quand le visiteur change son choix (accepte / refuse). */
export const COOKIE_CONSENT_CHANGE_EVENT = "artiflow:cookie-consent-changed";

/** Émis pour rouvrir la bannière de consentement depuis n'importe où. */
export const COOKIE_CONSENT_OPEN_EVENT = "artiflow:open-cookie-consent";

export type ConsentValue = "all" | "essential";

/** Lit le choix mémorisé, ou null si le visiteur n'a pas encore décidé. */
export function getStoredConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return value === "all" || value === "essential" ? value : null;
  } catch {
    return null;
  }
}

/** Mémorise le choix et prévient les abonnés (ex. la mesure d'audience). */
export function setStoredConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
  } catch {
    // Stockage indisponible : on applique quand même le choix côté mémoire.
  }
  window.dispatchEvent(new CustomEvent<ConsentValue>(COOKIE_CONSENT_CHANGE_EVENT, { detail: value }));
}

/** Indique si le visiteur a accepté la mesure d'audience. */
export function hasAnalyticsConsent(): boolean {
  return getStoredConsent() === "all";
}

/** Rouvre la bannière de consentement (bouton « Gérer mes cookies »). */
export function openCookieConsent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
}