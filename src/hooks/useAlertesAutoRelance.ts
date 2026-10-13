import { useCallback, useEffect, useState } from "react";
import { chargerHistoriqueAlertesArtisan, type AlerteAutoRelance } from "@/lib/recontactSeuil";

/**
 * Historique des alertes email réellement envoyées à l'artisan quand l'auto-relance des
 * oubliés a expédié des relances (date + comptes concernés). Fournit la liste la plus
 * récente d'abord, avec rechargement à la demande.
 */
export function useAlertesAutoRelance(userId: string | null | undefined, limit = 12) {
  const [items, setItems] = useState<AlerteAutoRelance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await chargerHistoriqueAlertesArtisan(userId, limit));
    } catch {
      setError("Impossible de charger l'historique des alertes pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}