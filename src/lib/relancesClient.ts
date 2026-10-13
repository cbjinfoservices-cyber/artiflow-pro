import { supabase } from "@/lib/supabase";
import { addDays, toISODate } from "@/lib/dates";

/**
 * Relance client programmée à une date choisie : elle est enregistrée ici puis
 * envoyée automatiquement par la tâche planifiée quotidienne le jour venu.
 */
export interface RelanceClientItem {
  id: number;
  client_id: number;
  message: string | null;
  /** Date prévue de l'envoi (ISO, YYYY-MM-DD). */
  date_prevue: string;
  /** « Programmée », « Envoyée », « Annulée » ou « Échec ». */
  statut: string;
  created_at: string;
  envoye_le: string | null;
  /** Motif d'échec renvoyé par la fonction d'envoi quand la relance a raté (null sinon). */
  motif_echec: string | null;
}

/** Délai (en jours) au-delà duquel on considère qu'un client peut être relancé sans doublon. */
export const RELANCE_CLIENT_DELAI_ALERTE = 7;

/** Nombre de jours entiers écoulés depuis la dernière relance d'un client (null si jamais relancé). */
export function joursDepuisDerniereRelance(derniere: string | null | undefined): number | null {
  if (!derniere) return null;
  const d = new Date(derniere);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/** Liste les relances client programmées de l'artisan (les plus proches d'abord). */
export async function fetchRelancesClient(userId: string): Promise<RelanceClientItem[]> {
  const { data, error } = await supabase
    .from("relances_client")
    .select("id, client_id, message, date_prevue, statut, created_at, envoye_le, motif_echec")
    .eq("user_id", userId)
    .order("date_prevue", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    client_id: Number(row.client_id),
    message: row.message === null || row.message === undefined ? null : String(row.message),
    date_prevue: String(row.date_prevue ?? ""),
    statut: String(row.statut ?? "Programmée"),
    created_at: String(row.created_at ?? ""),
    envoye_le: row.envoye_le === null || row.envoye_le === undefined ? null : String(row.envoye_le),
    motif_echec: row.motif_echec === null || row.motif_echec === undefined ? null : String(row.motif_echec),
  }));
}

/** Programme une relance email pour un client à une date donnée. */
export async function createRelanceClient(
  userId: string,
  clientId: number,
  datePrevue: string,
  message: string,
): Promise<void> {
  const { error } = await supabase.from("relances_client").insert({
    user_id: userId,
    client_id: clientId,
    date_prevue: datePrevue,
    message: message.trim() || null,
    statut: "Programmée",
  });
  if (error) throw error;
}

/** Modifie la date (et le message) d'une relance client programmée. */
export async function updateRelanceClient(
  id: number,
  payload: { date_prevue: string; message: string },
): Promise<void> {
  const { error } = await supabase
    .from("relances_client")
    .update({ date_prevue: payload.date_prevue, message: payload.message.trim() || null, statut: "Programmée" })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Marque une relance client comme envoyée immédiatement (envoi manuel déclenché depuis
 * l'aperçu, sans attendre la date prévue). Horodate l'envoi pour l'historique.
 */
export async function markRelanceClientEnvoyee(id: number): Promise<void> {
  const { error } = await supabase
    .from("relances_client")
    .update({ statut: "Envoyée", envoye_le: new Date().toISOString(), motif_echec: null })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Marque une relance client comme étant en échec et conserve le motif renvoyé par la
 * fonction d'envoi (ex. « Ce client n'a pas d'adresse email », refus de Resend…), afin
 * que l'artisan comprenne pourquoi l'envoi a raté et puisse le re-tenter.
 */
export async function markRelanceClientEchec(id: number, motif: string): Promise<void> {
  const { error } = await supabase
    .from("relances_client")
    .update({ statut: "Échec", motif_echec: motif.trim() || "Envoi impossible." })
    .eq("id", id);
  if (error) throw error;
}

/** Annule (supprime) une relance client programmée. */
export async function deleteRelanceClient(id: number): Promise<void> {
  const { error } = await supabase.from("relances_client").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Reprogramme en une seule fois plusieurs relances client vers la même date d'envoi
 * (reprogrammation en lot depuis la page « Relances programmées »).
 */
export async function bulkRescheduleRelancesClient(ids: number[], datePrevue: string): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("relances_client")
    .update({ date_prevue: datePrevue, statut: "Programmée" })
    .in("id", ids);
  if (error) throw error;
}

/**
 * Décale plusieurs relances client de N jours à partir de leur date actuelle (au lieu d'une
 * date fixe commune). Chaque relance conserve donc son espacement relatif : par exemple +7 jours
 * décale chacune d'une semaine plus tard. Un nombre de jours négatif avance les relances.
 */
export async function bulkShiftRelancesClient(ids: number[], days: number): Promise<void> {
  if (!ids.length || !days) return;
  const { data, error } = await supabase.from("relances_client").select("id, date_prevue").in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: number; date_prevue: string }>;
  await Promise.all(
    rows.map((row) => {
      const base = new Date(row.date_prevue);
      const from = Number.isNaN(base.getTime()) ? new Date() : base;
      const next = toISODate(addDays(from, days));
      return supabase.from("relances_client").update({ date_prevue: next, statut: "Programmée" }).eq("id", row.id);
    }),
  );
}

/** Action choisie pour reprogrammer un lot de relances. */
export type BulkReschedulePayload =
  | { mode: "date"; datePrevue: string }
  | { mode: "shift"; days: number };