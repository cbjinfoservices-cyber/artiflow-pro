import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import {
  fetchTestsAbonnementEssai,
  type TestAbonnementEssaiItem,
} from "@/lib/testAbonnementEssaiApi";

/**
 * Charge l'historique des tests d'essai reconductible pour le back-office, avec action
 * de rafraîchissement. La lecture est réservée aux gestionnaires (règle d'accès de la
 * table `test_abonnement_essai_historique`) : pour tout autre profil, liste vide sans requête.
 */
export function useHistoriqueTestAbonnementEssai(limite = 40) {
  const { user, isGestionnaire } = useAuth();
  const [items, setItems] = useState<TestAbonnementEssaiItem[]>([]);
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
      setItems(await fetchTestsAbonnementEssai(limite));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Back-office · Test essai abonnement",
        source: "test_abonnement_essai_historique",
        error: e,
      });
      setError("Impossible de charger l'historique des tests d'essai pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [user, isGestionnaire, limite]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}