/**
 * Mémoire des filtres du récapitulatif des annonces (catégorie + année).
 *
 * Il ne s'agit que d'une préférence d'affichage : l'artisan ou le visiteur retrouve la même
 * sélection de filtres à sa prochaine visite, sans avoir à la refaire. Toutes les lectures et
 * écritures passent par `@/lib/stockageLocal` (accès sûrs, jamais localStorage en direct).
 */
import { ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";

export interface FiltresRecapNouveautes {
  /** Catégorie sélectionnée, ou « toutes » quand aucun filtre n'est actif. */
  categorie: string;
  /** Année sélectionnée au format « YYYY », ou « toutes ». */
  annee: string;
}

const CLE = "artiflow_recap_nouveautes_filtres";

/** Valeur neutre : aucun filtre appliqué. */
export const FILTRES_RECAP_VIDE: FiltresRecapNouveautes = {
  categorie: "toutes",
  annee: "toutes",
};

/** Relit la sélection mémorisée, ou la valeur neutre si rien n'est exploitable. */
export function lireFiltresRecap(): FiltresRecapNouveautes {
  const raw = lireBrut(CLE);
  if (!raw) return FILTRES_RECAP_VIDE;
  try {
    const parsed = JSON.parse(raw) as Partial<FiltresRecapNouveautes>;
    return {
      categorie: typeof parsed.categorie === "string" && parsed.categorie ? parsed.categorie : "toutes",
      annee: typeof parsed.annee === "string" && parsed.annee ? parsed.annee : "toutes",
    };
  } catch {
    return FILTRES_RECAP_VIDE;
  }
}

/** Mémorise la sélection courante pour la proposer au prochain retour sur la page. */
export function memoriserFiltresRecap(filtres: FiltresRecapNouveautes): void {
  const payload: FiltresRecapNouveautes = {
    categorie: filtres.categorie || "toutes",
    annee: filtres.annee || "toutes",
  };
  ecrireBrut(CLE, JSON.stringify(payload));
}

/** Oublie la sélection mémorisée : le récapitulatif rouvrira sans filtre. */
export function oublierFiltresRecap(): void {
  supprimer(CLE);
}