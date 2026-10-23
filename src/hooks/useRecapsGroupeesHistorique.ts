import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  calculerRecapMois,
  libelleMoisRecap,
  listeMoisRecents,
  type RecapMoisStats,
  type SuiviNotificationRow,
} from "@/lib/recapEnvoisGroupeesStats";

/** Un mois de l'historique, avec son récap déjà calculé. */
export interface MoisRecapGroupe {
  cle: string;
  label: string;
  stats: RecapMoisStats;
}

interface Etat {
  /** Mois du plus récent au plus ancien (mois en cours inclus). */
  mois: MoisRecapGroupe[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Charge une seule fois le journal des emails clients sur les derniers mois, puis en
 * déduit le récap de chaque mois. Sert à comparer deux mois d'envois groupés sans
 * multiplier les requêtes.
 */
export function useRecapsGroupeesHistorique(refreshKey?: string, nombreMois = 12): Etat {
  const { user } = useAuth();
  const [mois, setMois] = useState<MoisRecapGroupe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const cles = useMemo(() => listeMoisRecents(nombreMois), [nombreMois]);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setMois([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [annee, moisNum] = cles[cles.length - 1].split("-").map((v) => Number(v));
        const depuis = new Date(annee, moisNum - 1, 1);
        depuis.setDate(depuis.getDate() - 45);
        const { data, error: err } = await supabase
          .from("suivi_notifications")
          .select("chantier_id, created_at, origine, destinataire")
          .eq("user_id", user.id)
          .eq("statut", "envoye")
          .gte("created_at", depuis.toISOString())
          .order("created_at", { ascending: true })
          .limit(4000);
        if (err) throw err;

        const rows = (data ?? []) as unknown as SuiviNotificationRow[];
        const resultat = cles.map((cle) => ({
          cle,
          label: libelleMoisRecap(cle),
          stats: calculerRecapMois(rows, cle),
        }));

        if (annule) return;
        setMois(resultat);
        setError(null);
      } catch {
        if (annule) return;
        setMois([]);
        setError("L'historique des récaps mensuels n'a pas pu être chargé.");
      } finally {
        if (!annule) setLoading(false);
      }
    };

    void charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey, cles, tick]);

  return { mois, loading, error, reload: () => setTick((t) => t + 1) };
}