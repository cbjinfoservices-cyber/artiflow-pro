/**
 * Origine publique du site, utilisée pour construire les URL absolues des
 * données SEO (canonique, Open Graph, JSON-LD…).
 *
 * L'origine est lue depuis la variable d'environnement `VITE_SITE_URL` quand
 * elle est fournie par la plateforme. À défaut, on retombe sur l'origine réelle
 * du navigateur pour ne jamais inventer de domaine.
 */
function lireOrigineEnv(): string {
  const brut = import.meta.env.VITE_SITE_URL;
  return typeof brut === "string" ? brut.trim() : "";
}

export function getSiteOrigin(): string {
  const depuisEnv = lireOrigineEnv();
  if (depuisEnv) return depuisEnv.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export const SITE_URL = getSiteOrigin();