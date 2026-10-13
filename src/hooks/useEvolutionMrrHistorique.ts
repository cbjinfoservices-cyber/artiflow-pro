import { useCallback, useEffect, useState } from "react";
import { fetchEvolutionMrrHistorique, type MrrHistoriquePoint } from "@/lib/abonnementsApi";

/**
 * Évolution du MRR estimé sur les `mois` derniers mois, reconstituée depuis
 * l'historique des changements d'offre. Lecture directe depuis le Backend.
 */
export function useEvolutionMrrHistorique(mois = 12) {
  const [data, setData] = useState<MrrHistoriquePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchEvolutionMrrHistorique(mois));
    } catch {
      setError("Impossible de charger l'évolution du MRR pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [mois]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}