import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { todayISO } from "@/lib/dates";

export interface RelanceJourJ {
  id: number;
  client_id: number;
  clientNom: string;
}

/**
 * Relances client programmées dont la date d'envoi tombe aujourd'hui : elles servent
 * à afficher une notification in-app le jour J (avant l'envoi automatique par la tâche
 * quotidienne). Requête légère, rechargée à chaque changement de page.
 */
export function useRelancesDuJour(refreshKey?: string): { duJour: RelanceJourJ[]; count: number } {
  const { user } = useAuth();
  const [duJour, setDuJour] = useState<RelanceJourJ[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setDuJour([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("relances_client")
        .select("id, client_id")
        .eq("user_id", user.id)
        .eq("statut", "Programmée")
        .eq("date_prevue", todayISO());
      if (error) throw error;
      const rows = (data ?? []) as Array<{ id: number; client_id: number | null }>;
      const clientIds = Array.from(
        new Set(rows.map((r) => r.client_id).filter((id): id is number => id !== null && id !== undefined)),
      );
      let nomsParId = new Map<number, string>();
      if (clientIds.length > 0) {
        const { data: clients, error: clientsError } = await supabase
          .from("clients")
          .select("id, nom")
          .in("id", clientIds);
        if (clientsError) throw clientsError;
        nomsParId = new Map(
          ((clients ?? []) as Array<{ id: number; nom: string | null }>).map((c) => [Number(c.id), c.nom ?? "Client"]),
        );
      }
      setDuJour(
        rows.map((row) => ({
          id: Number(row.id),
          client_id: Number(row.client_id),
          clientNom: nomsParId.get(Number(row.client_id)) ?? "Client",
        })),
      );
    } catch {
      setDuJour([]);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { duJour, count: duJour.length };
}