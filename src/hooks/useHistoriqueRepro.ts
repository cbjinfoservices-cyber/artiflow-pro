import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RelanceItem } from "@/hooks/useArtisanData";
import { fetchReprogrammationsForRelances, type ReprogrammationFullItem } from "@/lib/artisanApi";
import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

// Dernier id de reprogrammation déjà consulté (persisté pour survivre aux rechargements),
// pour signaler les nouvelles reprogrammations arrivées depuis la dernière visite.
const SEEN_REPRO_KEY = "artiflow.relances.dernierReproVu";

export interface HistoriqueRepro {
  /** Toutes les reprogrammations (toutes relances confondues). */
  rows: ReprogrammationFullItem[];
  loading: boolean;
  error: string | null;
  /** Nombre total de reprogrammations. */
  total: number;
  /** Nombre de nouvelles reprogrammations depuis la dernière consultation de l'onglet. */
  fresh: number;
  /** Marque les reprogrammations courantes comme vues (à l'ouverture de l'onglet). */
  markSeen: () => void;
  /** Force une nouvelle récupération. */
  reload: () => void;
}

/**
 * Charge l'historique agrégé des reprogrammations et calcule le nombre de nouveautés
 * non encore consultées. Recharge dès qu'un report est enregistré (détecté via le
 * compteur de reprogrammations de chaque relance).
 */
export function useHistoriqueRepro(relances: RelanceItem[]): HistoriqueRepro {
  const [rows, setRows] = useState<ReprogrammationFullItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const baselineRef = useRef<number | null>(null);

  // Signature « id:compteur de reprogrammations » : change dès qu'un report est enregistré,
  // ce qui déclenche une nouvelle récupération (et donc la détection des nouveautés).
  const signature = useMemo(
    () => relances.map((r) => `${r.id}:${r.reprogrammations}`).join(","),
    [relances],
  );

  useEffect(() => {
    let cancelled = false;
    const ids = signature ? signature.split(",").map((pair) => Number(pair.split(":")[0])) : [];
    if (ids.length === 0) {
      setRows([]);
      setFresh(0);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchReprogrammationsForRelances(ids);
        if (cancelled) return;
        setRows(data);
        const maxId = data.reduce((m, h) => (h.id > m ? h.id : m), 0);
        // Première récupération : on pose la ligne de base sans signaler de « nouveauté ».
        if (baselineRef.current === null) {
          const stored = Number(lireBrut(SEEN_REPRO_KEY));
          const base = Number.isFinite(stored) && stored > 0 ? stored : maxId;
          baselineRef.current = base;
          ecrireBrut(SEEN_REPRO_KEY, String(base));
          setFresh(0);
        } else {
          setFresh(data.filter((h) => h.id > (baselineRef.current ?? 0)).length);
        }
      } catch {
        if (!cancelled) setError("Impossible de charger l'historique des reprogrammations pour l'instant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signature, reloadTick]);

  const markSeen = useCallback(() => {
    const maxId = rows.reduce((m, h) => (h.id > m ? h.id : m), 0);
    baselineRef.current = maxId;
    ecrireBrut(SEEN_REPRO_KEY, String(maxId));
    setFresh(0);
  }, [rows]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  return { rows, loading, error, total: rows.length, fresh, markSeen, reload };
}