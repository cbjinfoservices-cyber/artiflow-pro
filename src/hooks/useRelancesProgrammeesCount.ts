import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { todayISO } from "@/lib/dates";

/** Indicateurs légers des relances client programmées, utilisés pour la pastille du menu de navigation. */
export interface RelancesProgrammeesStats {
  /** Nombre total de relances client en attente d'envoi (statut « Programmée »). */
  total: number;
  /** Montant TTC cumulé des factures impayées des clients concernés par ces relances. */
  montant: number;
  /** Parmi les relances programmées, celles dont la date prévue est déjà dépassée. */
  enRetard: number;
}

/**
 * Compteur léger des relances client programmées à venir, utilisé pour la pastille
 * du menu de navigation. Il expose le nombre, le montant en jeu (factures impayées
 * des clients concernés) et le nombre de relances déjà en retard, afin d'alimenter
 * une infobulle détaillée sans surcharger les pages de l'espace artisan.
 */
export function useRelancesProgrammeesCount(refreshKey?: string): RelancesProgrammeesStats {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const [montant, setMontant] = useState(0);
  const [enRetard, setEnRetard] = useState(0);

  useEffect(() => {
    if (!user) {
      setTotal(0);
      setMontant(0);
      setEnRetard(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const today = todayISO();
        const { data } = await supabase
          .from("relances_client")
          .select("client_id, date_prevue")
          .eq("user_id", user.id)
          .eq("statut", "Programmée");
        if (cancelled) return;
        const rows = (data ?? []) as Array<{ client_id: number | string; date_prevue: string | null }>;
        const clientIds = [...new Set(rows.map((r) => Number(r.client_id)).filter((n) => Number.isFinite(n)))];
        const retard = rows.filter((r) => String(r.date_prevue ?? "") < today).length;
        let sum = 0;
        // Montant concerné : factures encore impayées des clients visés par une relance programmée.
        if (clientIds.length > 0) {
          const { data: facs } = await supabase
            .from("factures")
            .select("total_ttc")
            .eq("user_id", user.id)
            .neq("statut", "Payée")
            .in("client_id", clientIds);
          if (cancelled) return;
          sum = ((facs ?? []) as Array<{ total_ttc: number | null }>).reduce(
            (acc, f) => acc + Number(f.total_ttc ?? 0),
            0,
          );
        }
        setTotal(rows.length);
        setEnRetard(retard);
        setMontant(sum);
      } catch {
        if (cancelled) return;
        setTotal(0);
        setEnRetard(0);
        setMontant(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return { total, montant, enRetard };
}