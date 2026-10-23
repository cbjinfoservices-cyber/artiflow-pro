import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { joursSansEmailClient, SEUIL_SANS_NOUVELLES_JOURS } from "@/lib/chantiers";
import { normalizeChantierStatut } from "@/lib/statuts";

/** Un chantier dont le client n'a plus de nouvelles depuis au moins 14 jours. */
export interface ChantierSansNouvellesItem {
  id: number;
  libelle: string;
  /** Jours écoulés depuis le dernier email (ou depuis la création du chantier). */
  jours: number;
  /** Vrai quand aucun email n'est jamais parti au client. */
  jamaisEnvoye: boolean;
  /** Date du dernier email au client (ISO), ou null. */
  dernierEmailAt: string | null;
}

interface ChantiersSansNouvellesResult {
  chantiers: ChantierSansNouvellesItem[];
  loading: boolean;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Repère les chantiers en cours dont le client est sans nouvelles depuis 14 jours ou plus.
 * Requête volontairement légère (une seule table, quatre colonnes) pour pouvoir être montée
 * dans la coquille de l'espace : l'alerte remonte ainsi dans la cloche depuis n'importe
 * quelle page, et pas seulement depuis l'écran Chantiers.
 */
export function useChantiersSansNouvelles(refreshKey?: string): ChantiersSansNouvellesResult {
  const { user } = useAuth();
  const [chantiers, setChantiers] = useState<ChantierSansNouvellesItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setChantiers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("chantiers")
          .select("id, libelle, statut, suivi_dernier_email_at, created_at")
          .order("created_at", { ascending: true });
        if (error) throw error;

        const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
        const silencieux: ChantierSansNouvellesItem[] = [];
        rows.forEach((row) => {
          // Un chantier terminé n'a plus besoin de nouvelles : on ne le signale pas.
          if (normalizeChantierStatut(toStr(row.statut)) === "Terminé") return;
          const dernierEmailAt = toStr(row.suivi_dernier_email_at);
          const jours = joursSansEmailClient({ suivi_dernier_email_at: dernierEmailAt, created_at: toStr(row.created_at) });
          if (jours === null || jours < SEUIL_SANS_NOUVELLES_JOURS) return;
          silencieux.push({
            id: Number(row.id),
            libelle: toStr(row.libelle) ?? "Chantier",
            jours,
            jamaisEnvoye: dernierEmailAt === null,
            dernierEmailAt,
          });
        });

        if (annule) return;
        setChantiers(silencieux.sort((a, b) => b.jours - a.jours));
      } catch {
        // Un incident ici ne doit jamais bloquer la page en cours : la cloche reste muette.
        if (!annule) setChantiers([]);
      } finally {
        if (!annule) setLoading(false);
      }
    };

    charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey]);

  return { chantiers, loading };
}