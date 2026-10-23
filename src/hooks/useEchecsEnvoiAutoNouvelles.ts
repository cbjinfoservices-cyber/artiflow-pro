import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/** Fenêtre d'observation des échecs d'envoi automatique, en jours. */
export const FENETRE_ECHECS_AUTO_JOURS = 30;

/** Un email automatique que Resend n'a pas accepté. */
export interface EchecEnvoiAutoNouvelles {
  id: number;
  chantierId: number | null;
  chantierLibelle: string;
  destinataire: string | null;
  erreur: string | null;
  created_at: string;
}

/**
 * Échecs récents de l'envoi groupé AUTOMATIQUE (motif Resend, adresse refusée…).
 * On lit uniquement le journal déjà écrit par la fonction d'envoi : aucune requête lourde.
 */
export function useEchecsEnvoiAutoNouvelles(refreshKey?: string): {
  echecs: EchecEnvoiAutoNouvelles[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const { user } = useAuth();
  const [echecs, setEchecs] = useState<EchecEnvoiAutoNouvelles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setEchecs([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const depuis = new Date(Date.now() - FENETRE_ECHECS_AUTO_JOURS * 86_400_000).toISOString();
        const { data, error: err } = await supabase
          .from("suivi_notifications")
          .select("id, chantier_id, destinataire, erreur, created_at")
          .eq("user_id", user.id)
          .eq("statut", "echec")
          .eq("origine", "auto")
          .gte("created_at", depuis)
          .order("created_at", { ascending: false })
          .limit(100);
        if (err) throw err;

        const rows = (data ?? []) as Array<Record<string, unknown>>;
        const ids = Array.from(
          new Set(
            rows
              .map((r) => Number(r.chantier_id))
              .filter((id) => Number.isFinite(id) && id > 0),
          ),
        );
        const libelles = new Map<number, string>();
        if (ids.length > 0) {
          const { data: chantiersData } = await supabase.from("chantiers").select("id, libelle").in("id", ids);
          ((chantiersData ?? []) as Array<Record<string, unknown>>).forEach((c) => {
            const id = Number(c.id);
            const libelle = c.libelle === null || c.libelle === undefined ? "" : String(c.libelle);
            if (Number.isFinite(id)) libelles.set(id, libelle || "Chantier");
          });
        }

        if (annule) return;
        setEchecs(
          rows.map((r) => {
            const chantierId = Number(r.chantier_id);
            return {
              id: Number(r.id),
              chantierId: Number.isFinite(chantierId) ? chantierId : null,
              chantierLibelle: libelles.get(chantierId) ?? "Chantier",
              destinataire: r.destinataire === null || r.destinataire === undefined ? null : String(r.destinataire),
              erreur: r.erreur === null || r.erreur === undefined ? null : String(r.erreur),
              created_at: String(r.created_at ?? ""),
            };
          }),
        );
        setError(null);
      } catch {
        if (!annule) {
          setEchecs([]);
          setError("Les échecs d'envoi automatique n'ont pas pu être vérifiés.");
        }
      } finally {
        if (!annule) setLoading(false);
      }
    };

    void charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey, tick]);

  return { echecs, loading, error, reload };
}