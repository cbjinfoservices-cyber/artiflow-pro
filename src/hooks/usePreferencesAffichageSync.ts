import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  demarrerSyncPreferences,
  pousserPreferences,
  souscrireSyncPreferences,
  type EtatSyncPreferences,
} from "@/lib/preferencesAffichageSync";

/**
 * Suit et pilote la synchronisation des préférences d'affichage vers le Backend.
 * Monté une fois dans la coque de l'espace : il démarre la synchro dès que le compte est connu
 * et l'arrête à la déconnexion. Renvoie l'état courant et un moyen de forcer l'enregistrement.
 */
export function usePreferencesAffichageSync(): EtatSyncPreferences & {
  synchroniser: () => Promise<void>;
} {
  const { user } = useAuth();
  const [etat, setEtat] = useState<EtatSyncPreferences>({
    connecte: false,
    enCours: false,
    derniereSynchro: null,
    erreur: null,
  });

  useEffect(() => souscrireSyncPreferences(setEtat), []);

  useEffect(() => {
    demarrerSyncPreferences(user?.id ?? null);
  }, [user?.id]);

  return { ...etat, synchroniser: pousserPreferences };
}