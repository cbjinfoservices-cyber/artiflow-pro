import { supabase } from "@/lib/supabase";

/**
 * Un pointage d'intervention : l'heure d'arrivée et de départ de l'intervenant sur un créneau,
 * avec une pause éventuelle (déjeuner). Une seule ligne de pointage par intervention.
 */
export interface Pointage {
  id: number;
  creneau_id: number;
  intervenant_id: number | null;
  /** Jour de l'intervention (AAAA-MM-JJ), dupliqué pour les récapitulatifs par jour. */
  date: string;
  /** Heure d'arrivée réelle (ISO), ou null si le pointage n'a pas encore commencé. */
  arrivee_le: string | null;
  /** Heure de départ réelle (ISO), ou null si l'intervention est encore en cours. */
  depart_le: string | null;
  /** Pause déduite du temps travaillé, en minutes. */
  pause_minutes: number;
  note: string | null;
}

/** État d'un pointage, pour l'affichage. */
export type EtatPointage = "absent" | "en-cours" | "termine";

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function toNullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapPointage(row: Record<string, unknown>): Pointage {
  return {
    id: Number(row.id),
    creneau_id: Number(row.creneau_id),
    intervenant_id: toNullableNum(row.intervenant_id),
    date: toStr(row.date) ?? "",
    arrivee_le: toStr(row.arrivee_le),
    depart_le: toStr(row.depart_le),
    pause_minutes: Number(row.pause_minutes ?? 0),
    note: toStr(row.note),
  };
}

/**
 * Récupère les pointages visibles pour le compte connecté (RLS : ses propres pointages,
 * ou ceux des interventions de l'intervenant rattaché à son adresse email).
 * Les filtres sont facultatifs : par intervenant, par semaine (dates ISO) ou par créneaux.
 */
export async function fetchPointages(
  options: {
    intervenantId?: number | null;
    creneauIds?: number[];
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<Pointage[]> {
  let requete = supabase
    .from("pointages")
    .select("id, creneau_id, intervenant_id, date, arrivee_le, depart_le, pause_minutes, note")
    .order("date", { ascending: true });

  if (typeof options.intervenantId === "number") {
    requete = requete.eq("intervenant_id", options.intervenantId);
  }
  if (options.creneauIds && options.creneauIds.length > 0) {
    requete = requete.in("creneau_id", options.creneauIds);
  }
  if (options.dateFrom) requete = requete.gte("date", options.dateFrom);
  if (options.dateTo) requete = requete.lte("date", options.dateTo);

  const { data, error } = await requete;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapPointage);
}

/**
 * Démarre le pointage d'une intervention (heure d'arrivée = maintenant).
 * `proprietaireId` est le compte de l'entreprise propriétaire du planning : c'est lui qui
 * porte la ligne en base, y compris quand c'est l'intervenant qui pointe depuis son espace.
 */
export async function demarrerPointage(params: {
  proprietaireId: string;
  creneauId: number;
  intervenantId: number | null;
  date: string;
}): Promise<void> {
  const maintenant = new Date().toISOString();
  const { error } = await supabase.from("pointages").upsert(
    {
      user_id: params.proprietaireId,
      creneau_id: params.creneauId,
      intervenant_id: params.intervenantId,
      date: params.date,
      arrivee_le: maintenant,
      depart_le: null,
      updated_at: maintenant,
    },
    { onConflict: "creneau_id" },
  );
  if (error) throw error;
}

/** Enregistre l'heure de départ (fin d'intervention) d'un pointage. */
export async function terminerPointage(pointageId: number): Promise<void> {
  const maintenant = new Date().toISOString();
  const { error } = await supabase
    .from("pointages")
    .update({ depart_le: maintenant, updated_at: maintenant })
    .eq("id", pointageId);
  if (error) throw error;
}

/** Rouvre un pointage terminé (efface l'heure de départ, la durée repart « en cours »). */
export async function rouvrirPointage(pointageId: number): Promise<void> {
  const { error } = await supabase
    .from("pointages")
    .update({ depart_le: null, updated_at: new Date().toISOString() })
    .eq("id", pointageId);
  if (error) throw error;
}

/** Renseigne la pause (en minutes) déduite du temps travaillé. */
export async function majPausePointage(pointageId: number, minutes: number): Promise<void> {
  const pause = Number.isFinite(minutes) ? Math.min(600, Math.max(0, Math.round(minutes))) : 0;
  const { error } = await supabase
    .from("pointages")
    .update({ pause_minutes: pause, updated_at: new Date().toISOString() })
    .eq("id", pointageId);
  if (error) throw error;
}

/** Supprime un pointage (remise à zéro : l'intervention redevient « non pointée »). */
export async function supprimerPointage(pointageId: number): Promise<void> {
  const { error } = await supabase.from("pointages").delete().eq("id", pointageId);
  if (error) throw error;
}

/** État d'un pointage : pas commencé, en cours, ou terminé. */
export function etatPointage(pointage: Pointage | undefined | null): EtatPointage {
  if (!pointage || !pointage.arrivee_le) return "absent";
  if (!pointage.depart_le) return "en-cours";
  return "termine";
}

/**
 * Durée travaillée en minutes (départ − arrivée − pause). Pour un pointage encore en cours,
 * la durée court jusqu'à `maintenant`.
 */
export function dureeMinutes(pointage: Pointage | undefined | null, maintenant: number = Date.now()): number {
  if (!pointage || !pointage.arrivee_le) return 0;
  const debut = new Date(pointage.arrivee_le).getTime();
  const fin = pointage.depart_le ? new Date(pointage.depart_le).getTime() : maintenant;
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin < debut) return 0;
  return Math.max(0, Math.round((fin - debut) / 60000) - Math.max(0, pointage.pause_minutes ?? 0));
}

/** Formate une durée en minutes en libellé court (« 4 h 05 », « 45 min »). */
export function formatDuree(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** Formate une heure ISO en « 07:58 » (heure locale). */
export function formatHeurePointage(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Total des minutes pointées sur une liste de pointages. */
export function totalMinutes(pointages: Pointage[], maintenant: number = Date.now()): number {
  return pointages.reduce((somme, p) => somme + dureeMinutes(p, maintenant), 0);
}

/** Récapitulatif des heures par jour (jours sans pointage compris, à zéro). */
export interface RecapJourPointage {
  date: string;
  minutes: number;
  enCours: boolean;
  nbPointages: number;
}

/**
 * Regroupe les pointages par jour et renvoie, pour chaque date demandée,
 * le total travaillé et l'éventuelle intervention encore en cours.
 */
export function recapParJour(
  pointages: Pointage[],
  dates: string[],
  maintenant: number = Date.now(),
): RecapJourPointage[] {
  return dates.map((date) => {
    const duJour = pointages.filter((p) => p.date === date);
    return {
      date,
      minutes: totalMinutes(duJour, maintenant),
      enCours: duJour.some((p) => etatPointage(p) === "en-cours"),
      nbPointages: duJour.filter((p) => etatPointage(p) !== "absent").length,
    };
  });
}