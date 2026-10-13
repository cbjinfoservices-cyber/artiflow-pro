import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { addDays, toISODate, todayISO } from "@/lib/dates";

export interface RelancesRetardCount {
  /** Nombre total de relances en retard (non envoyées, date prévue dépassée). */
  enRetard: number;
  /** Parmi elles, celles en retard de 30 jours ou plus (dossiers critiques). */
  critiques: number;
  /** Montant HT cumulé des devis rattachés aux relances en retard. */
  montantRetard: number;
}

const SEUIL_CRITIQUE_JOURS = 30;

/**
 * Compte léger des relances en retard, utilisé pour le point de notification du menu.
 * Renvoie le nombre, les dossiers critiques et le montant en jeu (devis rattachés).
 */
export function useRelancesRetard(refreshKey?: string): RelancesRetardCount {
  const { user } = useAuth();
  const [enRetard, setEnRetard] = useState(0);
  const [critiques, setCritiques] = useState(0);
  const [montantRetard, setMontantRetard] = useState(0);

  useEffect(() => {
    if (!user) {
      setEnRetard(0);
      setCritiques(0);
      setMontantRetard(0);
      return;
    }
    let cancelled = false;
    const today = todayISO();
    const seuilCritique = toISODate(addDays(new Date(), -SEUIL_CRITIQUE_JOURS));
    (async () => {
      try {
        const [allRes, critRes] = await Promise.all([
          supabase
            .from("relances")
            .select("id, devis(total_ht)")
            .neq("statut", "Envoyée")
            .lt("date_prevue", today),
          supabase
            .from("relances")
            .select("id", { count: "exact", head: true })
            .neq("statut", "Envoyée")
            .lt("date_prevue", seuilCritique),
        ]);
        if (cancelled) return;
        const rows = (allRes.data ?? []) as Array<{
          devis: { total_ht: number | null } | Array<{ total_ht: number | null }> | null;
        }>;
        const montant = rows.reduce((sum, row) => {
          const embed = Array.isArray(row.devis) ? row.devis[0] : row.devis;
          return sum + Number(embed?.total_ht ?? 0);
        }, 0);
        setEnRetard(rows.length);
        setCritiques(critRes.count ?? 0);
        setMontantRetard(montant);
      } catch {
        if (cancelled) return;
        setEnRetard(0);
        setCritiques(0);
        setMontantRetard(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return { enRetard, critiques, montantRetard };
}