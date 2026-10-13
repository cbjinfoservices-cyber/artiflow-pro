import { useCallback, useEffect, useState } from "react";
import { fetchModeleUsages, type ModeleUsage } from "@/lib/artisanApi";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

interface UseModeleUsagesResult {
  usages: Record<string, ModeleUsage>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Charge le nombre d'utilisations de chaque modèle de devis (perso et métier)
 * pour l'artisan connecté. RLS garantit que seuls ses propres compteurs remontent.
 */
export function useModeleUsages(userId: string | null): UseModeleUsagesResult {
  const [usages, setUsages] = useState<Record<string, ModeleUsage>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setUsages({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setUsages(await fetchModeleUsages(userId));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Modèles de devis",
        source: "devis_modele_usages",
        error: e,
      });
      setError("Impossible de charger l'historique d'utilisation des modèles.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { usages, loading, error, reload: load };
}