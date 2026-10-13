import { useCallback, useEffect, useState } from "react";
import {
  JOURNAL_ERREURS_EVENT,
  lireJournalErreurs,
  viderJournalErreurs,
  type ErreurChargement,
} from "@/lib/journalErreursChargement";

/**
 * Accès réactif au journal local des erreurs de chargement.
 * Relit le journal à chaque nouvelle entrée journalisée (événement interne dans l'onglet)
 * et expose une action pour le vider.
 */
export function useJournalErreursChargement() {
  const [erreurs, setErreurs] = useState<ErreurChargement[]>(() => lireJournalErreurs());

  const rafraichir = useCallback(() => setErreurs(lireJournalErreurs()), []);

  useEffect(() => {
    window.addEventListener(JOURNAL_ERREURS_EVENT, rafraichir);
    return () => window.removeEventListener(JOURNAL_ERREURS_EVENT, rafraichir);
  }, [rafraichir]);

  const vider = useCallback(() => {
    viderJournalErreurs();
    setErreurs([]);
  }, []);

  return { erreurs, rafraichir, vider };
}