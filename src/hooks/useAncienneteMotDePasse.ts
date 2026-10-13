import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { historiserChangementMotDePasse } from "@/lib/motDePasse";
import {
  SEUIL_ANCIENNETE_MOT_DE_PASSE_JOURS,
  dateLaPlusRecente,
  fusionnerHistorique,
  joursDepuis,
  lireHistoriqueLocal,
  marquerMotDePasseChange,
} from "@/lib/ancienneteMotDePasse";

/**
 * Estime l'ancienneté du mot de passe du compte connecté et indique s'il mérite d'être
 * renouvelé. La date de référence est relue à chaque rendu (historique du profil +
 * historique local + date Backend), donc l'alerte disparaît d'elle-même dès qu'un
 * changement a eu lieu. Expose aussi l'historique des derniers changements.
 */
export function useAncienneteMotDePasse() {
  const { user, profile, refreshProfile } = useAuth();

  const historique = user
    ? fusionnerHistorique(profile?.mot_de_passe_changements, lireHistoriqueLocal(user.id))
    : [];
  const dateRef = user
    ? dateLaPlusRecente(historique[0], user.updated_at, user.created_at)
    : null;
  const jours = joursDepuis(dateRef);
  const ancien = jours !== null && jours >= SEUIL_ANCIENNETE_MOT_DE_PASSE_JOURS;

  // Mémorise le changement : historique local (immédiat) + historique du profil (durable).
  const enregistrerChangement = useCallback(async () => {
    if (!user) return;
    marquerMotDePasseChange(user.id);
    try {
      await historiserChangementMotDePasse(user.id);
      await refreshProfile();
    } catch {
      /* confort : l'historique local prend le relais même si le Backend tarde */
    }
  }, [user, refreshProfile]);

  return {
    jours,
    ancien,
    dateRef,
    historique,
    seuilJours: SEUIL_ANCIENNETE_MOT_DE_PASSE_JOURS,
    enregistrerChangement,
  };
}