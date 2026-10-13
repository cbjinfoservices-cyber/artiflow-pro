import { useCallback, useEffect, useState } from "react";
import { fetchModeleUsageEvents, type ModeleUsageEvent } from "@/lib/artisanApi";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

interface UseModeleUsageEventsResult {
  events: ModeleUsageEvent[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Charge l'historique daté des utilisations de modèles de devis pour l'artisan
 * connecté, afin de tracer l'évolution mensuelle dans le temps.
 * RLS garantit que seuls les événements de l'utilisateur courant remontent.
 */
export function useModeleUsageEvents(userId: string | null): UseModeleUsageEventsResult {
  const [events, setEvents] = useState<ModeleUsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setEvents(await fetchModeleUsageEvents(userId));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Modèles de devis",
        source: "devis_modele_usage_events",
        error: e,
      });
      setError("Impossible de charger l'évolution des usages.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { events, loading, error, reload: load };
}