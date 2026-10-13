import { useCallback, useEffect, useState } from "react";
import {
  JOURNAL_IMMINENTES_EVENT,
  lireJournalImminentes,
  viderJournalImminentes,
  type EntreeJournalImminent,
} from "@/lib/journalImminentesMemoire";

export interface JournalImminentes {
  /** Lignes du journal, de la plus récente à la plus ancienne. */
  entrees: EntreeJournalImminent[];
  /** Vide le journal des signalements. */
  vider: () => void;
}

/**
 * Suit le journal local des notifications imminentes déjà envoyées. Se met à jour à chaud à chaque
 * nouveau signalement (y compris depuis un autre onglet), pour vérifier ce qui a déjà été signalé.
 */
export function useJournalImminentes(): JournalImminentes {
  const [entrees, setEntrees] = useState<EntreeJournalImminent[]>(() => lireJournalImminentes());

  useEffect(() => {
    const maj = () => setEntrees(lireJournalImminentes());
    window.addEventListener(JOURNAL_IMMINENTES_EVENT, maj);
    window.addEventListener("storage", maj);
    return () => {
      window.removeEventListener(JOURNAL_IMMINENTES_EVENT, maj);
      window.removeEventListener("storage", maj);
    };
  }, []);

  const vider = useCallback(() => viderJournalImminentes(), []);

  return { entrees, vider };
}