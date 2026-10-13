import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { compterComptableEnvois, fetchComptableEnvois, type ComptableEnvoi } from "@/lib/artisanApi";

interface ComptableEnvoisResult {
  envois: ComptableEnvoi[];
  /** Nombre total d'envois disponibles (au-delà de ceux déjà chargés), pour le compteur. */
  total: number;
  loading: boolean;
  /** Chargement d'une page supplémentaire (« Charger plus ») en cours. */
  loadingMore: boolean;
  /** Reste-t-il des envois plus anciens à remonter ? */
  hasMore: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Remonte la page suivante d'envois plus anciens. */
  loadMore: () => Promise<void>;
}

/**
 * Charge l'historique des envois du journal comptable au comptable (automatiques
 * ou manuels), de la plus récente à la plus ancienne, pour l'afficher sur la carte
 * d'envoi automatique. La pagination permet de remonter au-delà de la première page
 * via « Charger plus ». RLS garantit qu'un artisan ne voit que ses propres envois.
 */
export function useComptableEnvois(pageSize = 12): ComptableEnvoisResult {
  const { user } = useAuth();
  const [envois, setEnvois] = useState<ComptableEnvoi[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(pageSize);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const run = useCallback(
    async (cible: number, more: boolean) => {
      if (!user) {
        setEnvois([]);
        setTotal(0);
        setHasMore(false);
        return;
      }
      if (more) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const rows = await fetchComptableEnvois(user.id, cible);
        setEnvois(rows);
        setHasMore(rows.length >= cible);
        // Le total n'est compté qu'au premier chargement / rechargement : il ne change pas
        // pendant qu'on remonte des pages plus anciennes via « Charger plus ».
        if (!more) {
          try {
            setTotal(await compterComptableEnvois(user.id));
          } catch {
            /* best effort : le compteur reste sur la dernière valeur connue */
          }
        }
      } catch {
        setError("Impossible de charger l'historique des envois.");
      } finally {
        if (more) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    setLimit(pageSize);
    run(pageSize, false);
  }, [run, pageSize, reloadKey]);

  const reload = useCallback(async () => {
    setLimit(pageSize);
    await run(pageSize, false);
  }, [pageSize, run]);

  const loadMore = useCallback(async () => {
    const cible = limit + pageSize;
    setLimit(cible);
    await run(cible, true);
  }, [limit, pageSize, run]);

  return { envois, total, loading, loadingMore, hasMore, error, reload, loadMore };
}