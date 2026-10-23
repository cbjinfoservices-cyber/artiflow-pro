import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  calculerRecapMois,
  cleMoisDecale,
  type SuiviNotificationRow,
} from "@/lib/recapEnvoisGroupeesStats";

export type { RecapEnvoiGroupeDetail } from "@/lib/recapEnvoisGroupeesStats";

/** Récapitulatif d'un mois pour les envois groupés aux clients silencieux. */
export interface RecapMensuelEnvoisGroupees {
  /** Nombre d'emails réellement partis via un envoi groupé ce mois-ci. */
  emailsGroupees: number;
  /** Identifiants des chantiers distincts relancés par un envoi groupé ce mois-ci. */
  chantiersRelances: number[];
  /** Détail daté des envois groupés du mois (du plus récent au plus ancien). */
  details: Array<{ chantierId: number; destinataire: string | null; at: string }>;
  /** Délai moyen (en jours) entre un envoi groupé et l'email suivant sur le même chantier. */
  delaiMoyenJours: number | null;
  /** Nombre d'envois groupés du mois encore sans email suivant. */
  enAttente: number;
  /** Ancienneté moyenne (en jours) de ces envois en attente de suite. */
  attenteMoyenneJours: number | null;
  loading: boolean;
  error: string | null;
}

const VIDE: Omit<RecapMensuelEnvoisGroupees, "loading" | "error"> = {
  emailsGroupees: 0,
  chantiersRelances: [],
  details: [],
  delaiMoyenJours: null,
  enAttente: 0,
  attenteMoyenneJours: null,
};

/**
 * Résume les envois groupés d'un mois (par défaut le mois en cours) : combien de clients
 * ont été relancés, et quel délai sépare un envoi groupé de l'email suivant sur le même
 * chantier. `decalageMois` permet de consulter un mois passé (-1 = le mois précédent).
 */
export function useRecapMensuelEnvoisGroupees(
  refreshKey?: string,
  decalageMois = 0,
): RecapMensuelEnvoisGroupees {
  const { user } = useAuth();
  const cle = cleMoisDecale(decalageMois);
  const [etat, setEtat] = useState<RecapMensuelEnvoisGroupees>({
    ...VIDE,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setEtat({ ...VIDE, loading: false, error: null });
        return;
      }
      setEtat((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const [annee, mois] = cle.split("-").map((v) => Number(v));
        const debutMois = new Date(annee, mois - 1, 1);
        // On remonte un peu avant le mois pour retrouver l'email suivant d'un envoi groupé
        // qui aurait eu lieu en tout début de mois, et on regarde aussi après le mois pour
        // mesurer le délai sur un mois passé.
        const depuis = new Date(debutMois.getTime() - 45 * 86_400_000).toISOString();
        const { data, error } = await supabase
          .from("suivi_notifications")
          .select("chantier_id, created_at, origine, destinataire")
          .eq("user_id", user.id)
          .eq("statut", "envoye")
          .gte("created_at", depuis)
          .order("created_at", { ascending: true })
          .limit(2000);
        if (error) throw error;

        const rows = (data ?? []) as unknown as SuiviNotificationRow[];
        if (annule) return;
        const stats = calculerRecapMois(rows, cle);
        setEtat({
          emailsGroupees: stats.emailsGroupees,
          chantiersRelances: stats.chantiersRelances,
          details: stats.details,
          delaiMoyenJours: stats.delaiMoyenJours,
          enAttente: stats.enAttente,
          attenteMoyenneJours: stats.attenteMoyenneJours,
          loading: false,
          error: null,
        });
      } catch {
        if (annule) return;
        setEtat({
          ...VIDE,
          loading: false,
          error: "Le récap mensuel des envois groupés n'a pas pu être chargé.",
        });
      }
    };

    void charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey, cle]);

  return etat;
}