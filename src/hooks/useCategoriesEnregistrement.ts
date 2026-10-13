import { useMemo } from "react";
import { useLignesBibliotheque } from "@/hooks/useLignesBibliotheque";
import { useCategoriesLignes } from "@/hooks/useCategoriesLignes";
import { CATEGORIES_LIGNES } from "@/lib/bibliothequeLignes";
import { construireCategories } from "@/lib/categoriesLignesPrefs";

/** Une catégorie proposée dans le menu « Enregistrer dans… ». */
export interface CategorieEnregistrement {
  /** Nom canonique réellement stocké sur la ligne. */
  valeur: string;
  /** Libellé affiché (renommé si besoin). */
  label: string;
}

/**
 * Catégories disponibles pour le menu « Enregistrer dans… » posé sur les lignes
 * d'un devis ou d'une facture : « Général », les catégories déjà utilisées dans la
 * bibliothèque et celles du catalogue métier. L'ordre et les renommages suivent les
 * préférences d'affichage ; les catégories masquées sont retirées.
 */
export function useCategoriesEnregistrement(userId: string | null): CategorieEnregistrement[] {
  const { lignes } = useLignesBibliotheque(userId);
  const { prefs } = useCategoriesLignes();

  return useMemo(() => {
    const noms = new Set<string>();
    noms.add("Général");
    lignes.forEach((l) => noms.add(l.categorie));
    CATEGORIES_LIGNES.forEach((c) => noms.add(c));
    return construireCategories([...noms], prefs)
      .filter((c) => !c.masquee)
      .map((c) => ({ valeur: c.nom, label: c.affichage }));
  }, [lignes, prefs]);
}