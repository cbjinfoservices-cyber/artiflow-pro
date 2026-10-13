import { useCallback, useEffect, useState } from "react";
import {
  ajouterExclusionImminente,
  ecrireFenetreImminenteMin,
  IMMINENCE_PREF_EVENT,
  lireExclusionsImminentes,
  lireFenetreImminenteMin,
  reinitialiserExclusionsImminentes,
  retirerExclusionImminente,
  type ExclusionImminente,
  type FenetreImminenteMin,
} from "@/lib/imminencePrefsMemoire";

export interface ImminencePrefs {
  /** Fenêtre d'alerte courante (15 / 30 / 60 min). */
  fenetreMin: FenetreImminenteMin;
  /** Change la fenêtre d'alerte (bandeau, badge et notification suivent immédiatement). */
  setFenetreMin: (m: FenetreImminenteMin) => void;
  /** Automatisations volontairement exclues du signalement. */
  exclusions: ExclusionImminente[];
  /** Ajoute une automatisation aux exclusions (elle n'est plus signalée). */
  exclure: (id: string, nom: string) => void;
  /** Réintègre une automatisation exclue (elle recommence à être signalée). */
  reinclure: (id: string) => void;
  /** Réintègre toutes les automatisations exclues. */
  reinclureTout: () => void;
}

/**
 * Suit les préférences d'interface des signalements imminents : la fenêtre d'alerte et la liste
 * des automatisations exclues. Se met à jour à chaud dès qu'elles changent, y compris depuis un
 * autre onglet, pour que le bandeau, le badge, la notification et l'infobulle restent raccord.
 */
export function useImminencePrefs(): ImminencePrefs {
  const [fenetreMin, setFenetre] = useState<FenetreImminenteMin>(() => lireFenetreImminenteMin());
  const [exclusions, setExclusions] = useState<ExclusionImminente[]>(() => lireExclusionsImminentes());

  useEffect(() => {
    const maj = () => {
      setFenetre(lireFenetreImminenteMin());
      setExclusions(lireExclusionsImminentes());
    };
    window.addEventListener(IMMINENCE_PREF_EVENT, maj);
    window.addEventListener("storage", maj);
    return () => {
      window.removeEventListener(IMMINENCE_PREF_EVENT, maj);
      window.removeEventListener("storage", maj);
    };
  }, []);

  const setFenetreMin = useCallback((m: FenetreImminenteMin) => ecrireFenetreImminenteMin(m), []);
  const exclure = useCallback((id: string, nom: string) => ajouterExclusionImminente(id, nom), []);
  const reinclure = useCallback((id: string) => retirerExclusionImminente(id), []);
  const reinclureTout = useCallback(() => reinitialiserExclusionsImminentes(), []);

  return { fenetreMin, setFenetreMin, exclusions, exclure, reinclure, reinclureTout };
}