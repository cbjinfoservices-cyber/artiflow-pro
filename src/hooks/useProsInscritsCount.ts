import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Compteurs de la page « Pros inscrits », pour la pastille du menu de navigation. */
export interface ProsInscritsStats {
  /** Nombre total de pros inscrits à la plateforme. */
  total: number;
  /** Nombre de pros inscrits durant le mois calendaire courant (les nouvelles arrivées). */
  nouveauxMois: number;
}

/** Vrai si la date donnée tombe dans le mois calendaire courant. */
function estCeMois(raw: string | null): boolean {
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Compteur léger des pros inscrits, utilisé pour la pastille de l'entrée « Pros inscrits » du menu
 * (barre latérale et tiroir mobile). Il expose le total et le nombre de nouvelles inscriptions du
 * mois, afin de repérer d'un coup d'œil l'arrivée de nouveaux comptes sans ouvrir la page.
 *
 * Le chargement n'a lieu que lorsque `actif` est vrai (compte gestionnaire), pour ne pas solliciter
 * le Backend inutilement depuis les autres profils. `refreshKey` (typiquement le chemin courant)
 * provoque une remise à jour à chaque navigation.
 */
export function useProsInscritsCount(actif: boolean, refreshKey?: string): ProsInscritsStats {
  const [stats, setStats] = useState<ProsInscritsStats>({ total: 0, nouveauxMois: 0 });

  useEffect(() => {
    if (!actif) {
      setStats({ total: 0, nouveauxMois: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("abonnements").select("created_at");
        if (cancelled) return;
        if (error) {
          setStats({ total: 0, nouveauxMois: 0 });
          return;
        }
        const rows = (data ?? []) as Array<{ created_at: string | null }>;
        setStats({
          total: rows.length,
          nouveauxMois: rows.filter((r) => estCeMois(r.created_at)).length,
        });
      } catch {
        if (!cancelled) setStats({ total: 0, nouveauxMois: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actif, refreshKey]);

  return stats;
}