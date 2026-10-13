import { useCallback, useEffect, useState } from "react";
import { chargerHistoriqueRecapRecontact, type RecapRecontactEnvoi } from "@/lib/recontactSeuil";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

/**
 * Historique des récaps hebdomadaires de recontact envoyés par la tâche planifiée.
 * Fournit la liste (date + nombre de comptes concernés) la plus récente d'abord.
 */
export function useRecapRecontactHistorique(userId: string | null | undefined, limit = 12) {
  const [items, setItems] = useState<RecapRecontactEnvoi[]>([]);
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
      setItems(await chargerHistoriqueRecapRecontact(userId, limit));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Récaps hebdo",
        source: "recap_recontact_envois",
        error: e,
      });
      setError("Impossible de charger l'historique des récaps hebdomadaires pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}