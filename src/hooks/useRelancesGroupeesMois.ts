import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/** Un email client réellement parti ce mois-ci, avec son origine. */
export interface EnvoiClientMois {
  chantierId: number;
  /** « manuel », « groupe » (bouton Nouvelles groupées) ou « auto » (envoi programmé). */
  origine: string;
}

interface Etat {
  envois: EnvoiClientMois[];
  loading: boolean;
  error: string | null;
}

/**
 * Liste les emails réellement envoyés aux clients depuis le 1er du mois en cours, avec leur
 * origine. Sert à mesurer la part de clients relancés grâce aux nouvelles groupées.
 */
export function useRelancesGroupeesMois(refreshKey?: string): Etat {
  const { user } = useAuth();
  const [etat, setEtat] = useState<Etat>({ envois: [], loading: true, error: null });

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setEtat({ envois: [], loading: false, error: null });
        return;
      }
      setEtat((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const now = new Date();
        const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
        const { data, error } = await supabase
          .from("suivi_notifications")
          .select("chantier_id, origine")
          .eq("user_id", user.id)
          .eq("statut", "envoye")
          .gte("created_at", debutMois.toISOString())
          .limit(2000);
        if (error) throw error;

        const envois: EnvoiClientMois[] = ((data ?? []) as Array<Record<string, unknown>>)
          .map((row) => ({
            chantierId: Number(row.chantier_id),
            origine: String(row.origine ?? "manuel"),
          }))
          .filter((e) => Number.isFinite(e.chantierId));

        if (annule) return;
        setEtat({ envois, loading: false, error: null });
      } catch {
        if (annule) return;
        setEtat({ envois: [], loading: false, error: "Les relances du mois n'ont pas pu être chargées." });
      }
    };

    void charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey]);

  return etat;
}