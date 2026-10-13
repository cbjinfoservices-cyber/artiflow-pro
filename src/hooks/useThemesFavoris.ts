import { useEffect, useMemo, useState } from "react";
import { estThemeFavori, lireThemesFavoris, subscribeThemesFavoris } from "@/lib/themesFavoris";

/** Version incrémentée à chaque changement d'épinglage, pour recalculer ce qui en dépend. */
export function useThemesFavorisVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeThemesFavoris(() => setVersion((v) => v + 1)), []);
  return version;
}

/** Liste des thèmes épinglés (dans l'ordre d'épinglage). */
export function useThemesFavoris(): string[] {
  const version = useThemesFavorisVersion();
  return useMemo(() => lireThemesFavoris(), [version]);
}

/** Vrai si le thème est épinglé. */
export function useThemeFavori(slug: string): boolean {
  const version = useThemesFavorisVersion();
  return useMemo(() => estThemeFavori(slug), [slug, version]);
}