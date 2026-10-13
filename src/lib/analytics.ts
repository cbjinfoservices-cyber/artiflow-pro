import { COOKIE_CONSENT_CHANGE_EVENT, hasAnalyticsConsent } from "@/lib/consent";

/**
 * Mesure d'audience à chargement conditionnel.
 *
 * Le script de mesure n'est JAMAIS injecté tant que le visiteur n'a pas accepté
 * explicitement les cookies de mesure d'audience. Si le visiteur refuse
 * (ou change d'avis), aucune mesure n'est activée.
 *
 * L'identifiant de mesure est un identifiant public côté navigateur, fourni via
 * la variable d'environnement VITE_PUBLIC_GA_ID. Tant qu'aucun identifiant n'est
 * configuré, le chargement reste simplement en attente d'un consentement.
 */

const GA_MEASUREMENT_ID = import.meta.env.VITE_PUBLIC_GA_ID as string | undefined;

let analyticsLoaded = false;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

/** Injecte le script de mesure, uniquement après acceptation. */
export function loadAnalytics(): void {
  if (analyticsLoaded || typeof window === "undefined") return;
  analyticsLoaded = true;

  if (!GA_MEASUREMENT_ID) {
    // Aucun identifiant de mesure configuré : la mesure reste inactive.
    return;
  }

  const win = window as AnalyticsWindow;

  win.dataLayer = win.dataLayer || [];
  win.gtag = (...args: unknown[]) => {
    win.dataLayer?.push(args);
  };

  win.gtag("js", new Date());
  win.gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/** Coupe la mesure si le visiteur retire son consentement. */
export function disableAnalytics(): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
}

/**
 * Branche la mesure d'audience sur le consentement.
 * Renvoie une fonction de nettoyage à appeler au démontage.
 */
export function initAnalyticsConsent(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const sync = () => {
    if (hasAnalyticsConsent()) {
      loadAnalytics();
    } else {
      disableAnalytics();
    }
  };

  sync();
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync);
  return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync);
}