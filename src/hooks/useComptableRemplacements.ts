import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchComptableRemplacements, type ComptableRemplacement } from "@/lib/artisanApi";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

interface ComptableRemplacementsResult {
  remplacements: ComptableRemplacement[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Charge les renvois de remplacement déjà effectués (adresse ponctuelle, libellé, exercice,
 * nature et date) pour la vue « Remplacements » de l'Espace comptable. RLS garantit qu'un
 * artisan ne voit que ses propres renvois.
 */
export function useComptableRemplacements(limit = 100): ComptableRemplacementsResult {
  const { user } = useAuth();
  const [remplacements, setRemplacements] = useState<ComptableRemplacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRemplacements([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRemplacements(await fetchComptableRemplacements(user.id, limit));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Remplacements",
        source: "comptable_remplacements",
        error: e,
      });
      setError("Impossible de charger les remplacements.");
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { remplacements, loading, error, reload: load };
}