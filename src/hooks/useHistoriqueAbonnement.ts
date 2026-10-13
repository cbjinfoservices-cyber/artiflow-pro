import { useCallback, useEffect, useState } from "react";
import { fetchAbonnementHistorique, type AbonnementHistoriqueItem } from "@/lib/abonnementsApi";

/**
 * Charge l'historique des changements (offre et statut) d'un abonnement.
 * Ne dépend d'aucun branchement externe : lecture directe depuis le Backend.
 */
export function useHistoriqueAbonnement(abonnementId: number | null | undefined) {
  const [historique, setHistorique] = useState<AbonnementHistoriqueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!abonnementId) {
      setHistorique([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAbonnementHistorique(abonnementId);
      setHistorique(data);
    } catch {
      setError("Impossible de charger l'historique de votre abonnement pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [abonnementId]);

  useEffect(() => {
    load();
  }, [load]);

  return { historique, loading, error, reload: load };
}