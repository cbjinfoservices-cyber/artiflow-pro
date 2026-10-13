import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import {
  fetchTestsPaiementBlanc,
  type TestPaiementBlancItem,
} from "@/lib/testPaiementBlancApi";

/**
 * Charge l'historique des « tests à blanc » du tunnel de paiement Stripe pour le
 * back-office, avec action de rafraîchissement. La lecture est réservée aux
 * gestionnaires (règle d'accès de la table `test_paiement_blanc_historique`) : pour
 * tout autre profil, on renvoie une liste vide sans requête.
 */
export function useHistoriqueTestPaiementBlanc(limite = 50) {
  const { user, isGestionnaire } = useAuth();
  const [items, setItems] = useState<TestPaiementBlancItem[]>([]);
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
      setItems(await fetchTestsPaiementBlanc(limite));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Back-office · Tests à blanc",
        source: "test_paiement_blanc_historique",
        error: e,
      });
      setError("Impossible de charger l'historique des tests à blanc pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [user, isGestionnaire, limite]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}