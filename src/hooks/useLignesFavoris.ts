import { useCallback, useEffect, useState } from "react";
import {
  LIGNES_FAVORIS_EVENT,
  basculerFavori,
  ecrireLignesFavoris,
  lireLignesFavoris,
  type FavoriCle,
} from "@/lib/lignesFavorisPrefs";

interface UseLignesFavorisResult {
  /** Clés des lignes épinglées (id perso ou clé catalogue). */
  favoris: FavoriCle[];
  /** Épingle ou désépingle une ligne. */
  basculer: (cle: FavoriCle) => void;
  enregistrer: (next: FavoriCle[]) => void;
}

/**
 * Gère les lignes épinglées (favoris) de la bibliothèque de désignations, qu'elles
 * viennent des lignes personnelles ou du catalogue métier.
 * Préférence locale synchronisée entre les écrans ouverts via un événement.
 */
export function useLignesFavoris(): UseLignesFavorisResult {
  const [favoris, setFavoris] = useState<FavoriCle[]>(() => lireLignesFavoris());

  useEffect(() => {
    const refresh = () => setFavoris(lireLignesFavoris());
    window.addEventListener(LIGNES_FAVORIS_EVENT, refresh);
    return () => window.removeEventListener(LIGNES_FAVORIS_EVENT, refresh);
  }, []);

  const enregistrer = useCallback((next: FavoriCle[]) => {
    ecrireLignesFavoris(next);
    setFavoris(next);
  }, []);

  const basculer = useCallback((cle: FavoriCle) => {
    const next = basculerFavori(lireLignesFavoris(), cle);
    ecrireLignesFavoris(next);
    setFavoris(next);
  }, []);

  return { favoris, basculer, enregistrer };
}