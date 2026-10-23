import { supabase } from "@/lib/supabase";

/** Résultat de l'alerte envoyée au responsable quand une intervention tombe un jour de congé. */
export interface ResultatAlerteConflit {
  /** Vrai si l'email est bien parti (ou déjà parti pour cette intervention). */
  envoye: boolean;
  /** Adresse du responsable réellement prévenue, ou null. */
  destinataire: string | null;
  /** Raison lisible en cas d'absence d'envoi, ou null. */
  raison: string | null;
}

/**
 * Prévient le responsable par email qu'une intervention vient d'être posée (ou réaffectée)
 * un jour où la personne affectée est absente. L'envoi part du Backend (Resend) : la clé
 * reste côté serveur et le responsable est retrouvé depuis le profil du compte.
 * Ne lève jamais d'exception : l'intervention reste enregistrée même si l'email échoue.
 */
export async function prevenirConflitConge(params: {
  /** Intervention concernée (identifiant en base). */
  creneauId: number;
  /** Personne affectée, absente ce jour-là. */
  intervenantId: number;
}): Promise<ResultatAlerteConflit> {
  try {
    const { data, error } = await supabase.functions.invoke("notifier-conflit-conge", {
      body: params,
    });
    if (error) throw new Error(error.message);
    const payload = data as { ok?: boolean; to?: string; error?: string; dejaEnvoye?: boolean } | null;
    if (payload?.ok) {
      return { envoye: true, destinataire: payload.to ?? null, raison: null };
    }
    return { envoye: false, destinataire: null, raison: payload?.error ?? "envoi indisponible" };
  } catch (e) {
    return {
      envoye: false,
      destinataire: null,
      raison: e instanceof Error ? e.message : "envoi indisponible",
    };
  }
}

/** Une alerte de conflit réellement tentée vers le responsable, telle que journalisée côté Backend. */
export interface AlerteConflitHistorique {
  id: number;
  creneauId: number;
  intervenantId: number | null;
  destinataire: string | null;
  statut: string;
  /** Date et heure de l'envoi (ISO). */
  createdAt: string;
}

/** Clé d'association entre une intervention et la personne absente concernée. */
export function cleAlerteConflit(creneauId: number, intervenantId: number | null): string {
  return `${creneauId}:${intervenantId ?? "null"}`;
}

/**
 * Récupère l'historique des alertes de conflit de congé envoyées au responsable.
 * La lecture est restreinte au compte courant par le Backend : on ne voit que ses propres envois.
 * Ne lève jamais d'exception : une liste vide suffit si le journal est indisponible.
 */
export async function fetchHistoriqueAlertesConflit(): Promise<AlerteConflitHistorique[]> {
  try {
    const { data, error } = await supabase
      .from("alertes_conflit_conge")
      .select("id, creneau_id, intervenant_id, destinataire, statut, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((ligne) => {
      const row = ligne as Record<string, unknown>;
      return {
        id: Number(row.id),
        creneauId: Number(row.creneau_id),
        intervenantId: row.intervenant_id === null ? null : Number(row.intervenant_id),
        destinataire: (row.destinataire as string | null) ?? null,
        statut: String(row.statut ?? "envoye"),
        createdAt: String(row.created_at ?? ""),
      };
    });
  } catch {
    return [];
  }
}

/** Indexe la dernière alerte connue par intervention et personne absente. */
export function indexerAlertesConflit(
  alertes: AlerteConflitHistorique[],
): Map<string, AlerteConflitHistorique> {
  const map = new Map<string, AlerteConflitHistorique>();
  alertes.forEach((alerte) => {
    const cle = cleAlerteConflit(alerte.creneauId, alerte.intervenantId);
    if (!map.has(cle)) map.set(cle, alerte);
  });
  return map;
}

/** Un conflit de congé marqué comme « traité » (déjà vu en réunion, réaffectation faite ou décidée). */
export interface ConflitTraite {
  /** Intervention concernée. */
  creneauId: number;
  /** Personne absente au moment du marquage. */
  intervenantId: number;
  /** Date et heure du marquage (ISO). */
  traiteLe: string;
}

/**
 * Récupère les conflits de congé déjà marqués comme traités par le compte courant.
 * Le Backend restreint la lecture au propriétaire : chacun ne voit que ses propres marquages.
 * Ne lève jamais d'exception : une liste vide suffit si le suivi est indisponible.
 */
export async function fetchConflitsTraites(): Promise<ConflitTraite[]> {
  try {
    const { data, error } = await supabase
      .from("conflits_conges_traites")
      .select("creneau_id, intervenant_id, traite_le")
      .order("traite_le", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((ligne) => {
      const row = ligne as Record<string, unknown>;
      return {
        creneauId: Number(row.creneau_id),
        intervenantId: Number(row.intervenant_id),
        traiteLe: String(row.traite_le ?? ""),
      };
    });
  } catch {
    return [];
  }
}

/** Indexe la date de traitement par couple (intervention, personne absente). */
export function indexerConflitsTraites(traites: ConflitTraite[]): Map<string, string> {
  const map = new Map<string, string>();
  traites.forEach((t) => {
    const cle = cleAlerteConflit(t.creneauId, t.intervenantId);
    if (!map.has(cle)) map.set(cle, t.traiteLe);
  });
  return map;
}

/**
 * Marque un conflit de congé comme traité (ou met à jour la date s'il l'était déjà),
 * pour garder la trace de ce qui a déjà été vu pendant la réunion d'équipe.
 */
export async function marquerConflitTraite(params: {
  /** Compte propriétaire du marquage. */
  userId: string;
  creneauId: number;
  intervenantId: number;
  /** Jour de l'intervention (AAAA-MM-JJ), conservé pour l'export. */
  date: string;
}): Promise<void> {
  const { error } = await supabase.from("conflits_conges_traites").upsert(
    {
      user_id: params.userId,
      creneau_id: params.creneauId,
      intervenant_id: params.intervenantId,
      date_intervention: params.date,
      traite_le: new Date().toISOString(),
    },
    { onConflict: "user_id,creneau_id,intervenant_id" },
  );
  if (error) throw new Error(error.message);
}

/** Retire le marquage « traité » d'un conflit (la ligne redevient à traiter). */
export async function demarquerConflitTraite(params: {
  userId: string;
  creneauId: number;
  intervenantId: number;
}): Promise<void> {
  const { error } = await supabase
    .from("conflits_conges_traites")
    .delete()
    .eq("user_id", params.userId)
    .eq("creneau_id", params.creneauId)
    .eq("intervenant_id", params.intervenantId);
  if (error) throw new Error(error.message);
}

/**
 * Marque d'un seul geste tous les conflits encore à traiter comme « traités » :
 * utile juste après la réunion d'équipe pour vider la liste.
 * Une seule requête, donc rapide même sur un mois chargé.
 */
export async function marquerConflitsTraitesEnLot(params: {
  userId: string;
  conflits: { creneauId: number; intervenantId: number; date: string }[];
}): Promise<void> {
  if (params.conflits.length === 0) return;
  const maintenant = new Date().toISOString();
  const { error } = await supabase.from("conflits_conges_traites").upsert(
    params.conflits.map((c) => ({
      user_id: params.userId,
      creneau_id: c.creneauId,
      intervenant_id: c.intervenantId,
      date_intervention: c.date,
      traite_le: maintenant,
    })),
    { onConflict: "user_id,creneau_id,intervenant_id" },
  );
  if (error) throw new Error(error.message);
}

/** Résultat de l'envoi de la liste des conflits par email au responsable. */
export interface ResultatEnvoiConflits {
  /** Vrai si l'email est parti. */
  envoye: boolean;
  /** Adresse du responsable réellement prévenue, ou null. */
  destinataire: string | null;
  /** Raison lisible en cas d'échec, ou null. */
  raison: string | null;
}

/**
 * Envoie la liste des conflits de congé (CSV en pièce jointe) au responsable, pour
 * préparer la réunion d'équipe. L'email part du Backend : la clé Resend reste côté serveur
 * et le destinataire est retrouvé depuis le profil du compte connecté.
 * Ne lève jamais d'exception.
 */
export async function envoyerConflitsCongeEmail(params: {
  /** Contenu CSV déjà construit côté interface. */
  csv: string;
  /** Nom du fichier joint, par exemple conflits-conges-2026-10-22.csv. */
  filename: string;
  /** Nombre total de conflits listés. */
  total: number;
  /** Nombre de conflits encore à réaffecter. */
  restants: number;
  /** « manuel » depuis la carte, « relance » depuis une ligne de l'historique. */
  mode?: "manuel" | "relance";
}): Promise<ResultatEnvoiConflits> {
  try {
    const { data, error } = await supabase.functions.invoke("envoyer-conflits-conge", {
      body: { ...params, mode: params.mode ?? "manuel" },
    });
    if (error) throw new Error(error.message);
    const payload = data as { ok?: boolean; to?: string; error?: string } | null;
    if (payload?.ok) {
      return { envoye: true, destinataire: payload.to ?? null, raison: null };
    }
    return { envoye: false, destinataire: null, raison: payload?.error ?? "envoi indisponible" };
  } catch (e) {
    return {
      envoye: false,
      destinataire: null,
      raison: e instanceof Error ? e.message : "envoi indisponible",
    };
  }
}

/** Un envoi de la liste des conflits au responsable (manuel ou automatique). */
export interface EnvoiListeConflits {
  id: number;
  /** Adresse du responsable prévenue. */
  destinataire: string | null;
  /** Nombre d'interventions listées dans le CSV joint. */
  total: number;
  /** Nombre de conflits encore à réaffecter au moment de l'envoi. */
  restants: number;
  /** « manuel » (bouton), « relance » (renvoi depuis l'historique) ou « auto » (veille). */
  mode: string;
  /** « envoye » ou « echec ». */
  statut: string;
  /** Nom du fichier CSV envoyé, quand il est connu. */
  fichier: string | null;
  /** Raison de l'échec, ou null. */
  message: string | null;
  /** Date et heure de l'envoi (ISO). */
  createdAt: string;
}

/**
 * Récupère l'historique des envois de la liste des conflits (date, destinataire, nombre
 * d'interventions), pour vérifier que le responsable l'a bien reçue avant la réunion.
 * La lecture est restreinte au compte courant par le Backend.
 * Ne lève jamais d'exception : une liste vide suffit si le journal est indisponible.
 */
export async function fetchEnvoisListeConflits(limite = 12): Promise<EnvoiListeConflits[]> {
  try {
    const { data, error } = await supabase
      .from("envois_liste_conflits")
      .select("id, destinataire, total_conflits, restants, mode, statut, message, created_at, fichier")
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw new Error(error.message);
    return (data ?? []).map((ligne) => {
      const row = ligne as Record<string, unknown>;
      return {
        id: Number(row.id),
        destinataire: (row.destinataire as string | null) ?? null,
        total: Number(row.total_conflits ?? 0),
        restants: Number(row.restants ?? 0),
        mode: String(row.mode ?? "manuel"),
        statut: String(row.statut ?? "envoye"),
        fichier: (row.fichier as string | null) ?? null,
        message: (row.message as string | null) ?? null,
        createdAt: String(row.created_at ?? ""),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Retire d'un seul geste tous les marquages « traité » effectués aujourd'hui.
 * Sert de filet de sécurité après un « Tout marquer comme traité » cliqué par erreur.
 * Renvoie le nombre de marquages annulés.
 */
export async function annulerMarquagesDuJour(params: { userId: string }): Promise<number> {
  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("conflits_conges_traites")
    .select("id")
    .eq("user_id", params.userId)
    .gte("traite_le", debutJour.toISOString());
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((ligne) => Number((ligne as Record<string, unknown>).id));
  if (ids.length === 0) return 0;
  const { error: erreurSuppression } = await supabase
    .from("conflits_conges_traites")
    .delete()
    .in("id", ids);
  if (erreurSuppression) throw new Error(erreurSuppression.message);
  return ids.length;
}

/** Réglage du rappel automatique de la liste des conflits avant la réunion d'équipe. */
export interface RappelConflitsConfig {
  /** Jour de la réunion d'équipe au format ISO : 1 = lundi … 7 = dimanche. */
  jourReunion: number;
  /** Heure d'envoi du rappel (0-23, heure de Paris). 7 h par défaut. */
  heureRappel: number;
  /** Vrai si le rappel de la veille est actif. */
  actif: boolean;
}

/** Valeurs par défaut : réunion le lundi, rappel actif la veille (dimanche) à 7 h. */
export const RAPPEL_CONFLITS_DEFAUT: RappelConflitsConfig = {
  jourReunion: 1,
  heureRappel: 7,
  actif: true,
};

/**
 * Récupère le réglage du rappel automatique du compte courant.
 * Renvoie les valeurs par défaut quand aucun réglage n'a encore été enregistré.
 */
export async function fetchRappelConflitsConfig(userId: string): Promise<RappelConflitsConfig | null> {
  try {
    const { data, error } = await supabase
      .from("rappels_conflits_config")
      .select("jour_reunion, heure_rappel, actif")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as Record<string, unknown>;
    const jour = Number(row.jour_reunion ?? RAPPEL_CONFLITS_DEFAUT.jourReunion);
    const heure = Number(row.heure_rappel ?? RAPPEL_CONFLITS_DEFAUT.heureRappel);
    return {
      jourReunion: jour >= 1 && jour <= 7 ? jour : RAPPEL_CONFLITS_DEFAUT.jourReunion,
      heureRappel: heure >= 0 && heure <= 23 ? heure : RAPPEL_CONFLITS_DEFAUT.heureRappel,
      actif: row.actif === null || row.actif === undefined ? true : Boolean(row.actif),
    };
  } catch {
    return null;
  }
}

/** Enregistre le réglage du rappel automatique (jour de réunion + activation). */
export async function enregistrerRappelConflitsConfig(params: {
  userId: string;
  config: RappelConflitsConfig;
}): Promise<void> {
  const { error } = await supabase.from("rappels_conflits_config").upsert(
    {
      user_id: params.userId,
      jour_reunion: params.config.jourReunion,
      heure_rappel: params.config.heureRappel,
      actif: params.config.actif,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}