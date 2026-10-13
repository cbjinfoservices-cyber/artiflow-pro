import { useCallback, useEffect, useState } from "react";
import {
  CATEGORIES_LIGNES_EVENT,
  ecrireCategoriesLignesPrefs,
  lireCategoriesLignesPrefs,
  type CategoriesLignesPrefs,
} from "@/lib/categoriesLignesPrefs";

interface UseCategoriesLignesResult {
  prefs: CategoriesLignesPrefs;
  enregistrer: (next: CategoriesLignesPrefs) => void;
}

/**
 * Gère les préférences d'affichage des catégories de lignes de désignation
 * (ordre, masquage, renommages). Les préférences sont locales et synchronisées
 * entre les écrans ouverts via un événement.
 */
export function useCategoriesLignes(): UseCategoriesLignesResult {
  const [prefs, setPrefs] = useState<CategoriesLignesPrefs>(() => lireCategoriesLignesPrefs());

  useEffect(() => {
    const refresh = () => setPrefs(lireCategoriesLignesPrefs());
    window.addEventListener(CATEGORIES_LIGNES_EVENT, refresh);
    return () => window.removeEventListener(CATEGORIES_LIGNES_EVENT, refresh);
  }, []);

  const enregistrer = useCallback((next: CategoriesLignesPrefs) => {
    ecrireCategoriesLignesPrefs(next);
    setPrefs(next);
  }, []);

  return { prefs, enregistrer };
}