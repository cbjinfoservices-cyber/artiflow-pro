import { supabase } from "@/lib/supabase";
import {
  calculerRecapMois,
  cleMoisDecale,
  libelleMoisCourt,
  libelleMoisRecap,
  listeMoisRecents,
  type RecapMoisStats,
  type SuiviNotificationRow,
} from "@/lib/recapEnvoisGroupeesStats";
import type { PdfComparaisonPoint } from "@/lib/recapEnvoisGroupeesPdf";

/** Ce qu'il advient du récap mensuel : envoyer au comptable, ou seulement l'archiver. */
export type RecapAutoMode = "envoi" | "archive";

/** Réglages du récap mensuel automatique des envois groupés. */
export interface RecapAutoSettings {
  actif: boolean;
  mode: RecapAutoMode;
  /** Jour du mois (1-28) de préparation / envoi. */
  jour: number;
  /** Heure (0-23, heure de Paris). */
  heure: number;
  /** Clé « AAAA-MM » du dernier mois déjà traité, ou null. */
  dernierMois: string | null;
}

const DEFAUT: RecapAutoSettings = {
  actif: false,
  mode: "envoi",
  jour: 1,
  heure: 8,
  dernierMois: null,
};

export async function fetchRecapAutoSettings(userId: string): Promise<RecapAutoSettings> {
  const { data, error } = await supabase
    .from("profiles")
    .select("recap_groupe_auto_actif, recap_groupe_auto_mode, recap_groupe_auto_jour, recap_groupe_auto_heure, recap_groupe_auto_dernier_mois")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const jour = Number(row.recap_groupe_auto_jour);
  const heure = Number(row.recap_groupe_auto_heure);
  return {
    actif: row.recap_groupe_auto_actif === true,
    mode: row.recap_groupe_auto_mode === "archive" ? "archive" : "envoi",
    jour: Number.isFinite(jour) ? Math.min(28, Math.max(1, Math.round(jour))) : DEFAUT.jour,
    heure: Number.isFinite(heure) ? Math.min(23, Math.max(0, Math.round(heure))) : DEFAUT.heure,
    dernierMois:
      row.recap_groupe_auto_dernier_mois === null || row.recap_groupe_auto_dernier_mois === undefined
        ? null
        : String(row.recap_groupe_auto_dernier_mois),
  };
}

export async function updateRecapAutoSettings(
  userId: string,
  patch: Partial<Omit<RecapAutoSettings, "dernierMois">>,
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.actif !== undefined) payload.recap_groupe_auto_actif = patch.actif;
  if (patch.mode !== undefined) payload.recap_groupe_auto_mode = patch.mode === "archive" ? "archive" : "envoi";
  if (patch.jour !== undefined) payload.recap_groupe_auto_jour = Math.min(28, Math.max(1, Math.round(patch.jour)));
  if (patch.heure !== undefined) payload.recap_groupe_auto_heure = Math.min(23, Math.max(0, Math.round(patch.heure)));
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

/** Mois visé par le récap automatique : toujours le mois écoulé. */
export function cleCibleRecap(): string {
  return cleMoisDecale(-1);
}

/** Vrai quand la date programmée du mois en cours est passée (jour + heure). */
export function recapAutoDu(settings: Pick<RecapAutoSettings, "jour" | "heure">, maintenant = new Date()): boolean {
  const jour = Math.min(28, Math.max(1, Math.round(settings.jour)));
  const echeance = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    jour,
    Math.min(23, Math.max(0, Math.round(settings.heure))),
    0,
    0,
    0,
  );
  return maintenant.getTime() >= echeance.getTime();
}

/** Libellé court du rendez-vous mensuel (« le 1er à 08 h »). */
export function libelleEcheanceRecap(settings: Pick<RecapAutoSettings, "jour" | "heure">): string {
  const jour = settings.jour === 1 ? "le 1er" : `le ${settings.jour}`;
  return `${jour} à ${String(settings.heure).padStart(2, "0")} h`;
}

/** Charge le journal des emails clients autour d'un mois (avant et après, pour les délais). */
export async function fetchRowsRecapMois(userId: string, cle: string): Promise<SuiviNotificationRow[]> {
  const [annee, mois] = cle.split("-").map((v) => Number(v));
  const debut = new Date(annee, mois - 1, 1);
  const depuis = new Date(debut.getTime() - 45 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("suivi_notifications")
    .select("chantier_id, created_at, origine, destinataire")
    .eq("user_id", userId)
    .eq("statut", "envoye")
    .gte("created_at", depuis)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as SuiviNotificationRow[];
}

/** Récap complet d'un mois donné, prêt à être mis en PDF. */
export async function chargerRecapMois(userId: string, cle: string): Promise<RecapMoisStats> {
  const rows = await fetchRowsRecapMois(userId, cle);
  return calculerRecapMois(rows, cle);
}

/**
 * Construit la série de tendance des N derniers mois (emails groupés et clients relancés),
 * du plus ancien au plus récent. Sert à dessiner la courbe dans le PDF du récap mensuel.
 * N'échoue jamais bruyamment : en cas d'erreur de lecture, renvoie une série vide.
 */
export async function chargerSerieRecapMois(
  userId: string,
  chantiers: Array<{ id: number; client_id?: number | null }>,
  nombreMois = 12,
): Promise<PdfComparaisonPoint[]> {
  try {
    const cles = listeMoisRecents(nombreMois);
    const [annee, mois] = cles[cles.length - 1].split("-").map((v) => Number(v));
    const depuis = new Date(annee, mois - 1, 1);
    depuis.setDate(depuis.getDate() - 45);
    const { data, error } = await supabase
      .from("suivi_notifications")
      .select("chantier_id, created_at, origine, destinataire")
      .eq("user_id", userId)
      .eq("statut", "envoye")
      .gte("created_at", depuis.toISOString())
      .order("created_at", { ascending: true })
      .limit(4000);
    if (error) throw error;

    const rows = (data ?? []) as unknown as SuiviNotificationRow[];
    return cles.map((cle) => {
      const stats = calculerRecapMois(rows, cle);
      const clients = new Set<number>();
      stats.chantiersRelances.forEach((id) => {
        const chantier = chantiers.find((c) => c.id === id);
        clients.add(chantier?.client_id ?? -id);
      });
      return {
        moisLabel: libelleMoisCourt(cle),
        emailsGroupees: stats.emailsGroupees,
        clientsRelances: clients.size,
      };
    });
  } catch {
    return [];
  }
}

/** Marque un mois comme traité par le récap automatique (anti-doublon). */
export async function marquerRecapTraite(userId: string, cle: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ recap_groupe_auto_dernier_mois: cle, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Résultat d'un essai du récap mensuel : le PDF part à l'adresse de l'artisan. */
export interface EssaiRecapMoisResultat {
  destinataire: string | null;
  moisLabel: string;
  emails: number;
  clients: number;
  chantiers: number;
}

/**
 * Demande l'envoi immédiat du récap du mois écoulé à sa propre adresse, pour vérifier le
 * rendu du PDF avant la date programmée. Rien n'est marqué comme traité côté Backend.
 */
export async function envoyerEssaiRecapMois(): Promise<EssaiRecapMoisResultat> {
  const { data, error } = await supabase.functions.invoke("recap-envois-groupees-mensuel", {
    body: { test: true },
  });
  if (error) {
    let message = "L'essai n'a pas pu être envoyé.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const payload = (await ctx.json()) as { error?: string } | null;
        if (payload?.error) message = payload.error;
      }
    } catch {
      // On garde le message générique.
    }
    throw new Error(message);
  }
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        destinataire?: string;
        monthLabel?: string;
        emails?: number;
        clients?: number;
        chantiers?: number;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error ?? "L'essai n'a pas pu être envoyé.");
  return {
    destinataire: payload.destinataire ?? null,
    moisLabel: payload.monthLabel ?? libelleMoisRecap(cleCibleRecap()),
    emails: Number(payload.emails ?? 0),
    clients: Number(payload.clients ?? 0),
    chantiers: Number(payload.chantiers ?? 0),
  };
}