import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  annulerSuppressionCompte,
  chargerSuppressionEnCours,
  type SuppressionProgrammee,
} from "@/lib/compte";

/**
 * Suit la demande de suppression de compte en cours (période de grâce de 30 jours).
 *
 * Utilisé à deux endroits : le bandeau du haut de l'espace (pour que l'artisan ne puisse
 * pas oublier une suppression programmée) et la zone « Supprimer mon compte » du profil.
 */
export function useSuppressionProgrammee() {
  const { user } = useAuth();
  const [demande, setDemande] = useState<SuppressionProgrammee | null>(null);
  const [chargement, setChargement] = useState(true);
  const [annulationEnCours, setAnnulationEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [annulee, setAnnulee] = useState(false);

  const rafraichir = useCallback(async () => {
    if (!user) {
      setDemande(null);
      setChargement(false);
      return;
    }
    try {
      const enCours = await chargerSuppressionEnCours();
      setDemande(enCours);
    } catch {
      setDemande(null);
    } finally {
      setChargement(false);
    }
  }, [user]);

  useEffect(() => {
    setAnnulee(false);
    void rafraichir();
  }, [rafraichir]);

  const annuler = useCallback(async (motif: "action-manuelle" | "connexion" = "action-manuelle") => {
    setAnnulationEnCours(true);
    setErreur(null);
    try {
      const message = await annulerSuppressionCompte(motif);
      setDemande(null);
      setAnnulee(true);
      return message;
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'annulation a échoué.");
      return null;
    } finally {
      setAnnulationEnCours(false);
    }
  }, []);

  return { demande, chargement, annulationEnCours, erreur, annulee, annuler, rafraichir };
}