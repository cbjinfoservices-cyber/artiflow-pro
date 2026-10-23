import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/** Un email réellement parti au client, tel que consigné dans le journal des notifications. */
export interface EnvoiClientReussi {
  /** Identifiant de la ligne du journal. */
  id: number;
  /** Objet réellement envoyé (à défaut, le message rédigé). */
  sujet: string | null;
  /** Adresse réellement destinataire. */
  destinataire: string | null;
  /** Horodatage ISO de l'envoi. */
  created_at: string;
}

interface Etat {
  /** Nombre total d'emails réellement partis au client (toutes dates confondues). */
  total: number;
  /** Les derniers emails partis, du plus récent au plus ancien. */
  derniers: EnvoiClientReussi[];
  loading: boolean;
  /** Message d'erreur de lecture, pour ne pas afficher une liste vide trompeuse. */
  error: string | null;
}

/**
 * Compte et liste les emails réellement partis vers un client, à partir du journal des
 * notifications de ses chantiers. Sert de repère sur la fiche : on voit d'un coup d'œil que
 * le client a bien été joint, avec l'objet et l'adresse de chaque envoi, même quand le
 * dernier essai vient d'être refusé.
 * Silencieux en cas d'erreur de lecture : on retombe sur une liste vide plutôt que de
 * bloquer la fiche, mais l'erreur est signalée.
 */
export function useEnvoisReussisClient(chantierIds: number[], refreshKey = 0): Etat {
  const { user } = useAuth();
  const [etat, setEtat] = useState<Etat>({ total: 0, derniers: [], loading: true, error: null });
  // Clé stable : la liste d'identifiants est recréée à chaque rendu.
  const cle = chantierIds
    .filter((id) => Number.isFinite(id) && id > 0)
    .slice()
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    let annule = false;
    const charger = async () => {
      const ids = cle === "" ? [] : cle.split(",").map((v) => Number(v)).filter((n) => n > 0);
      if (!user || ids.length === 0) {
        setEtat({ total: 0, derniers: [], loading: false, error: null });
        return;
      }
      setEtat((prev) => ({ ...prev, loading: true, error: null }));
      try {
        // count exact = total réel, indépendamment de la limite appliquée à la liste.
        const { data, count, error } = await supabase
          .from("suivi_notifications")
          .select("id, sujet, motif, destinataire, created_at", { count: "exact" })
          .eq("user_id", user.id)
          .in("chantier_id", ids)
          .eq("statut", "envoye")
          .order("created_at", { ascending: false })
          .limit(8);
        if (error) throw error;
        if (annule) return;
        const derniers = ((data ?? []) as Array<Record<string, unknown>>)
          .map((row) => {
            const sujet = typeof row.sujet === "string" && row.sujet.trim() !== "" ? row.sujet.trim() : null;
            const motif = typeof row.motif === "string" && row.motif.trim() !== "" ? row.motif.trim() : null;
            return {
              id: Number(row.id) || 0,
              sujet: sujet ?? motif,
              destinataire:
                row.destinataire === null || row.destinataire === undefined
                  ? null
                  : String(row.destinataire),
              created_at: String(row.created_at ?? ""),
            };
          })
          .filter((entree) => entree.created_at !== "");
        setEtat({ total: count ?? derniers.length, derniers, loading: false, error: null });
      } catch {
        if (annule) return;
        setEtat({
          total: 0,
          derniers: [],
          loading: false,
          error: "L'historique des emails partis n'a pas pu être lu.",
        });
      }
    };
    void charger();
    return () => {
      annule = true;
    };
  }, [user, cle, refreshKey]);

  return etat;
}