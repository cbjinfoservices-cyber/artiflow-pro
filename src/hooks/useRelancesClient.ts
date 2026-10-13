import { useCallback, useEffect, useState } from "react";
import { fetchRelancesClient, type RelanceClientItem } from "@/lib/relancesClient";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

/**
 * Charge les relances client programmées de l'artisan (envois différés à une date choisie).
 * Elles sont ensuite expédiées automatiquement le jour venu par la tâche planifiée quotidienne.
 */
export function useRelancesClient(userId: string | null) {
  const [relances, setRelances] = useState<RelanceClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setRelances([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRelancesClient(userId);
      setRelances(data);
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Relances",
        source: "relances_client",
        error: e,
      });
      setError("Impossible de charger les relances programmées pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { relances, loading, error, reload: load };
}