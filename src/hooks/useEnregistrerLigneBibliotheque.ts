import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createLigneBibliotheque } from "@/lib/bibliothequeLignes";
import { normalizeTvaRate } from "@/lib/artisanApi";

/** Ligne à enregistrer dans la bibliothèque de désignations. */
export interface LigneAEnregistrer {
  designation: string;
  unite: string;
  prix_unitaire: number;
  taux_tva?: number;
}

/**
 * Enregistre une ligne de devis dans la bibliothèque de désignations de l'artisan.
 * Utilisé par le bouton « Enregistrer cette ligne dans ma bibliothèque » posé sur
 * chaque ligne d'un devis en cours.
 */
export function useEnregistrerLigneBibliotheque() {
  const { user } = useAuth();

  const enregistrer = useCallback(
    async (ligne: LigneAEnregistrer, categorie = "Général") => {
      if (!user) throw new Error("Vous devez être connecté pour enregistrer une ligne.");
      if (!ligne.designation.trim()) throw new Error("Cette ligne n'a pas de désignation à enregistrer.");
      await createLigneBibliotheque(user.id, {
        designation: ligne.designation.trim(),
        unite: ligne.unite?.trim() || "u",
        prix_unitaire: Number(ligne.prix_unitaire) || 0,
        taux_tva: normalizeTvaRate(ligne.taux_tva),
        categorie,
      });
    },
    [user],
  );

  /** Enregistre plusieurs lignes d'un coup dans la même catégorie (bouton « Tout enregistrer »). */
  const enregistrerPlusieurs = useCallback(
    async (lignes: LigneAEnregistrer[], categorie = "Général") => {
      if (!user) throw new Error("Vous devez être connecté pour enregistrer une ligne.");
      const propres = lignes.filter((l) => l.designation.trim());
      for (const l of propres) {
        await createLigneBibliotheque(user.id, {
          designation: l.designation.trim(),
          unite: l.unite?.trim() || "u",
          prix_unitaire: Number(l.prix_unitaire) || 0,
          taux_tva: normalizeTvaRate(l.taux_tva),
          categorie,
        });
      }
      return propres.length;
    },
    [user],
  );

  return { enregistrer, enregistrerPlusieurs };
}