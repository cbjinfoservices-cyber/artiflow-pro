import { useCallback, useEffect, useState } from "react";
import { fetchFactureModeles, type FactureModele } from "@/lib/artisanApi";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

interface UseFactureModelesResult {
  modeles: FactureModele[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Charge les modèles de factures personnalisés de l'artisan connecté.
 * RLS garantit côté base que seuls les modèles de l'utilisateur courant remontent.
 */
export function useFactureModeles(userId: string | null): UseFactureModelesResult {
  const [modeles, setModeles] = useState<FactureModele[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setModeles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setModeles(await fetchFactureModeles(userId));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Factures · Modèles de factures",
        source: "facture_modeles",
        error: e,
      });
      setError("Impossible de charger vos modèles de factures pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { modeles, loading, error, reload: load };
}