import { useCallback, useEffect, useState } from "react";
import { LIGNES_ORDRE_EVENT, ecrireOrdreLignes, lireOrdreLignes } from "@/lib/lignesOrdrePrefs";

interface UseOrdreLignesResult {
  /** Ordre mémorisé des identifiants de lignes personnelles. */
  ordre: number[];
  enregistrer: (next: number[]) => void;
}

/**
 * Gère l'ordre d'affichage des lignes personnelles à l'intérieur de leur
 * catégorie (glisser-déposer). Préférence locale synchronisée entre les écrans
 * ouverts via un événement.
 */
export function useOrdreLignes(): UseOrdreLignesResult {
  const [ordre, setOrdre] = useState<number[]>(() => lireOrdreLignes());

  useEffect(() => {
    const refresh = () => setOrdre(lireOrdreLignes());
    window.addEventListener(LIGNES_ORDRE_EVENT, refresh);
    return () => window.removeEventListener(LIGNES_ORDRE_EVENT, refresh);
  }, []);

  const enregistrer = useCallback((next: number[]) => {
    ecrireOrdreLignes(next);
    setOrdre(next);
  }, []);

  return { ordre, enregistrer };
}