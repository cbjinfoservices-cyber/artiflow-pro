import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/** Une facture électronique rejetée, telle qu'affichée dans la cloche d'alertes. */
export interface RejetEfactureItem {
  id: number;
  numero: string;
  clientNom: string | null;
  motif: string | null;
  totalTtc: number;
  dateEmission: string | null;
}

interface RejetsEfacturesResult {
  rejets: RejetEfactureItem[];
  loading: boolean;
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Liste les factures électroniques rejetées de l'artisan connecté, tous mois confondus :
 * un rejet de septembre reste à corriger en octobre. Le hook est volontairement léger
 * (deux requêtes) pour pouvoir être monté dans la coquille de l'espace, afin que les
 * rejets remontent dans la cloche d'alertes depuis n'importe quelle page.
 */
export function useRejetsEfactures(refreshKey?: string): RejetsEfacturesResult {
  const { user } = useAuth();
  const [rejets, setRejets] = useState<RejetEfactureItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setRejets([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("factures")
          .select("id, numero, total_ttc, date_emission, client_id, efacture_statut, efacture_motif")
          .eq("efacture_statut", "rejetee")
          .order("date_emission", { ascending: false });
        if (error) throw error;

        const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
        const clientIds = Array.from(
          new Set(
            rows
              .map((r) => Number(r.client_id))
              .filter((id) => Number.isFinite(id)),
          ),
        );

        const noms = new Map<number, string>();
        if (clientIds.length > 0) {
          const { data: clientsData, error: clientsError } = await supabase
            .from("clients")
            .select("id, nom")
            .in("id", clientIds);
          if (clientsError) throw clientsError;
          ((clientsData ?? []) as unknown as Array<Record<string, unknown>>).forEach((c) => {
            noms.set(Number(c.id), toStr(c.nom) ?? "");
          });
        }

        if (annule) return;
        setRejets(
          rows.map((row) => ({
            id: Number(row.id),
            numero: toStr(row.numero) ?? "",
            clientNom: noms.get(Number(row.client_id)) ?? null,
            motif: toStr(row.efacture_motif),
            totalTtc: toNum(row.total_ttc),
            dateEmission: toStr(row.date_emission),
          })),
        );
      } catch {
        // Un incident sur cette liste ne doit jamais bloquer la page en cours :
        // la cloche reste simplement muette et la page Facturation électronique
        // affiche l'erreur complète si besoin.
        if (!annule) setRejets([]);
      } finally {
        if (!annule) setLoading(false);
      }
    };

    charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey]);

  return { rejets, loading };
}