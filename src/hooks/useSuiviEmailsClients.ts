import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { debutPeriodeSuivi, type PeriodeSuiviEmails } from "@/lib/chantiers";

/** Ce qui a été envoyé au client pendant la période observée. */
export interface SuiviEmailsPeriode {
  /** Nombre d'emails réellement partis au client sur la période. */
  total: number;
  /** Nombre de chantiers distincts qui ont reçu au moins un email. */
  chantiers: number;
  /** Détail par chantier : nombre d'emails et date du dernier envoi de la période. */
  parChantier: Record<number, { total: number; dernier: string }>;
  loading: boolean;
  error: string | null;
}

/**
 * Compte les emails réellement envoyés aux clients sur « cette semaine » ou « ce mois-ci ».
 * Une seule requête légère (chantier + date) : on ne rapatrie jamais le contenu des emails.
 */
export function useSuiviEmailsClients(periode: PeriodeSuiviEmails, refreshKey?: string): SuiviEmailsPeriode {
  const { user } = useAuth();
  const [etat, setEtat] = useState<SuiviEmailsPeriode>({
    total: 0,
    chantiers: 0,
    parChantier: {},
    loading: true,
    error: null,
  });

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setEtat({ total: 0, chantiers: 0, parChantier: {}, loading: false, error: null });
        return;
      }
      setEtat((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data, error } = await supabase
          .from("suivi_notifications")
          .select("chantier_id, created_at")
          .eq("user_id", user.id)
          .eq("statut", "envoye")
          .gte("created_at", debutPeriodeSuivi(periode).toISOString())
          .order("created_at", { ascending: false })
          .limit(1000);
        if (error) throw error;

        const parChantier: Record<number, { total: number; dernier: string }> = {};
        let total = 0;
        ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
          const id = Number(row.chantier_id);
          if (!Number.isFinite(id)) return;
          const date = String(row.created_at ?? "");
          total += 1;
          const item = parChantier[id] ?? { total: 0, dernier: date };
          item.total += 1;
          if (date > item.dernier) item.dernier = date;
          parChantier[id] = item;
        });

        if (annule) return;
        setEtat({
          total,
          chantiers: Object.keys(parChantier).length,
          parChantier,
          loading: false,
          error: null,
        });
      } catch {
        if (annule) return;
        setEtat({
          total: 0,
          chantiers: 0,
          parChantier: {},
          loading: false,
          error: "Le suivi des emails n'a pas pu être chargé.",
        });
      }
    };

    void charger();
    return () => {
      annule = true;
    };
  }, [user, periode, refreshKey]);

  return etat;
}