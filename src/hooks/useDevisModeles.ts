import { useCallback, useEffect, useState } from "react";
import { fetchDevisModeles, type DevisModele } from "@/lib/artisanApi";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

interface UseDevisModelesResult {
  modeles: DevisModele[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Charge les modèles de devis personnalisés de l'artisan connecté.
 * RLS garantit côté base que seuls les modèles de l'utilisateur courant remontent.
 */
export function useDevisModeles(userId: string | null): UseDevisModelesResult {
  const [modeles, setModeles] = useState<DevisModele[]>([]);
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
      setModeles(await fetchDevisModeles(userId));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Modèles de devis",
        source: "devis_modeles",
        error: e,
      });
      setError("Impossible de charger vos modèles enregistrés pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { modeles, loading, error, reload: load };
}