import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/** Fenêtre d'observation des emails clients en échec, en jours. */
export const FENETRE_ECHECS_CLIENTS_JOURS = 45;

/** Le dernier email client qu'il n'a pas été possible d'expédier, pour un chantier. */
export interface EchecEnvoiClient {
  /** Identifiant de la ligne du journal (dernière tentative en échec). */
  id: number;
  chantierId: number;
  /** Fiche client rattachée au chantier, pour corriger l'adresse depuis le carnet. */
  clientId: number | null;
  destinataire: string | null;
  erreur: string | null;
  /** Message réellement rédigé pour le client lors de la tentative. */
  motif: string | null;
  created_at: string;
}

interface Etat {
  /** Une entrée par chantier concerné (le dernier échec connu). */
  parChantier: Record<number, EchecEnvoiClient>;
  /** Nombre total de tentatives en échec sur la fenêtre. */
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Repère les chantiers dont un email client a échoué récemment (adresse refusée, boîte
 * pleine, domaine invalide…), afin de ne relancer que les clients réellement non joignables.
 * On lit le journal déjà écrit par l'envoi : aucun appel supplémentaire au service d'email.
 */
export function useEchecsEnvoisClients(refreshKey?: string): Etat {
  const { user } = useAuth();
  const [etat, setEtat] = useState<Omit<Etat, "reload">>({
    parChantier: {},
    total: 0,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setEtat({ parChantier: {}, total: 0, loading: false, error: null });
        return;
      }
      setEtat((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const depuis = new Date(Date.now() - FENETRE_ECHECS_CLIENTS_JOURS * 86_400_000).toISOString();
        const { data, error } = await supabase
          .from("suivi_notifications")
          .select("id, chantier_id, destinataire, erreur, motif, statut, created_at")
          .eq("user_id", user.id)
          .in("statut", ["envoye", "echec"])
          .gte("created_at", depuis)
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) throw error;

        const parChantier: Record<number, EchecEnvoiClient> = {};
        // Un chantier n'est « non joignable » que si sa dernière tentative a échoué : un renvoi
        // réussi plus tard le sort de la liste, sans effacer l'historique des renvois.
        const dejaVu = new Set<number>();
        let total = 0;
        ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
          const id = Number(row.chantier_id);
          if (!Number.isFinite(id)) return;
          if (row.statut === "echec") total += 1;
          if (dejaVu.has(id)) return;
          dejaVu.add(id);
          if (row.statut !== "echec") return;
          parChantier[id] = {
            id: Number(row.id) || 0,
            chantierId: id,
            clientId: null,
            destinataire:
              row.destinataire === null || row.destinataire === undefined ? null : String(row.destinataire),
            erreur: row.erreur === null || row.erreur === undefined ? null : String(row.erreur),
            motif: row.motif === null || row.motif === undefined ? null : String(row.motif),
            created_at: String(row.created_at ?? ""),
          };
        });

        if (annule) return;

        const idsChantiers = Object.keys(parChantier).map((cle) => Number(cle)).filter((id) => id > 0);
        // Rattache chaque chantier à sa fiche client : depuis la cloche, on peut ouvrir
        // directement la fiche pour corriger l'adresse sans passer par la page Chantiers.
        const clientParChantier: Record<number, number> = {};
        if (idsChantiers.length > 0) {
          const { data: chantiersData } = await supabase
            .from("chantiers")
            .select("id, client_id")
            .eq("user_id", user.id)
            .in("id", idsChantiers);
          ((chantiersData ?? []) as Array<Record<string, unknown>>).forEach((row) => {
            const idChantier = Number(row.id);
            const idClient = Number(row.client_id);
            if (Number.isFinite(idChantier) && Number.isFinite(idClient) && idClient > 0) {
              clientParChantier[idChantier] = idClient;
            }
          });
        }
        Object.values(parChantier).forEach((echec) => {
          echec.clientId = clientParChantier[echec.chantierId] ?? null;
        });

        if (annule) return;
        setEtat({
          parChantier,
          total,
          loading: false,
          error: null,
        });
      } catch {
        if (annule) return;
        setEtat({
          parChantier: {},
          total: 0,
          loading: false,
          error: "Les emails clients en échec n'ont pas pu être vérifiés.",
        });
      }
    };

    void charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey, tick]);

  return { ...etat, reload };
}