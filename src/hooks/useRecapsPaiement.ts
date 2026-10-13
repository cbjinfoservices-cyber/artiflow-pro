import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import {
  fetchRecapsPaiementEnvoyes,
  type RecapPaiementEnvoi,
} from "@/lib/recapsPaiementApi";

/**
 * Charge l'historique des récaps hebdo de paiement déjà envoyés aux gestionnaires
 * (date, nombre d'échecs, destinataires). La lecture est réservée aux gestionnaires
 * (règle d'accès de la table) : pour tout autre profil, on renvoie une liste vide.
 */
export function useRecapsPaiement(limite = 50) {
  const { user, isGestionnaire } = useAuth();
  const [items, setItems] = useState<RecapPaiementEnvoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !isGestionnaire) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchRecapsPaiementEnvoyes(limite));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Back-office · Récap paiements",
        source: "recap_echecs_paiement_envois",
        error: e,
      });
      setError("Impossible de charger l'historique des récaps pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [user, isGestionnaire, limite]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}