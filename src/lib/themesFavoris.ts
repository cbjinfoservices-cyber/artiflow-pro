/**
 * Thèmes de ressources épinglés manuellement (stockés dans le navigateur).
 * Un même jeu de favoris alimente :
 *   - la bande « Les plus consultés » des déroulants (thèmes épinglés en tête) ;
 *   - l'ordre des sections de la page « Ressources par sujet » (épinglés d'abord).
 */
import { sujets, sujetsPopulaires, type Sujet } from "@/mocks/sujets";

/** Clé de stockage (une seule entrée : la liste ordonnée des slugs épinglés). */
const CLE = "artiflow:themes-favoris";

/** Événement diffusé à chaque changement d'épinglage, pour rafraîchir l'interface à chaud. */
const EVENT_NAME = "artiflow:themes-favoris-change";

const SLUGS_VALIDES = new Set(sujets.map((s) => s.slug));

/** Relit la liste des thèmes épinglés (dans l'ordre d'épinglage). */
export function lireThemesFavoris(): string[] {
  try {
    const raw = window.localStorage.getItem(CLE);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string" && SLUGS_VALIDES.has(s));
  } catch {
    return [];
  }
}

/** Vrai si le thème est épinglé. */
export function estThemeFavori(slug: string): boolean {
  return lireThemesFavoris().includes(slug);
}

/** Ajoute ou retire un thème des épinglés, puis prévient l'interface. */
export function basculerThemeFavori(slug: string): void {
  if (!SLUGS_VALIDES.has(slug)) return;
  const actuels = lireThemesFavoris();
  const suivants = actuels.includes(slug)
    ? actuels.filter((s) => s !== slug)
    : [...actuels, slug];
  try {
    window.localStorage.setItem(CLE, JSON.stringify(suivants));
  } catch {
    /* stockage indisponible : on ignore silencieusement */
  }
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* ignore */
  }
}

/** Retire d'un coup tous les thèmes épinglés, puis prévient l'interface. */
export function effacerThemesFavoris(): void {
  try {
    window.localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible : on ignore silencieusement */
  }
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* ignore */
  }
}

/** S'abonne aux changements d'épinglage (même onglet et autres onglets). */
export function subscribeThemesFavoris(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * Réordonne une liste selon les thèmes épinglés : les épinglés passent en tête
 * (dans leur ordre d'épinglage), le reste garde son ordre d'origine.
 */
export function ordonnerSujetsParFavoris<T extends { slug: string }>(
  liste: T[],
  favoris: string[]
): T[] {
  const position = new Map(favoris.map((slug, index) => [slug, index]));
  return [...liste].sort((a, b) => {
    const pa = position.has(a.slug) ? (position.get(a.slug) as number) : Number.POSITIVE_INFINITY;
    const pb = position.has(b.slug) ? (position.get(b.slug) as number) : Number.POSITIVE_INFINITY;
    return pa - pb;
  });
}

export type ThemeEnAvant = { sujet: Sujet; epingle: boolean };

/**
 * Thèmes mis en avant dans la bande « Les plus consultés » : d'abord les thèmes
 * épinglés (personnalisation), puis les thèmes les plus consultés par défaut.
 */
export function themesEnAvant(favoris: string[]): ThemeEnAvant[] {
  const epingles = new Set(favoris);
  const choisis = sujets
    .filter((s) => epingles.has(s.slug))
    .sort((a, b) => favoris.indexOf(a.slug) - favoris.indexOf(b.slug));
  const populaires = sujetsPopulaires.filter((s) => !epingles.has(s.slug));
  return [
    ...choisis.map((sujet) => ({ sujet, epingle: true })),
    ...populaires.map((sujet) => ({ sujet, epingle: false })),
  ];
}