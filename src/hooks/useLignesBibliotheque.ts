import { useCallback, useEffect, useState } from "react";
import { fetchLignesBibliotheque, type LigneBibliotheque } from "@/lib/bibliothequeLignes";

interface UseLignesBibliothequeResult {
  lignes: LigneBibliotheque[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Charge les lignes de désignation personnelles de l'artisan connecté.
 * RLS garantit côté base que seules ses propres lignes remontent.
 */
export function useLignesBibliotheque(userId: string | null): UseLignesBibliothequeResult {
  const [lignes, setLignes] = useState<LigneBibliotheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLignes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setLignes(await fetchLignesBibliotheque(userId));
    } catch {
      setError("Impossible de charger votre bibliothèque de lignes pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { lignes, loading, error, reload: load };
}