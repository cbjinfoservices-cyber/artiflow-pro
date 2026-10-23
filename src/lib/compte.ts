import { supabase } from "@/lib/supabase";

/** Extrait le message d'erreur réel renvoyé par une fonction Backend (statut non-2xx). */
async function messageErreurBackend(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = (await ctx.json()) as { error?: string; meta?: { message?: string; detail?: string } } | null;
      const message = body?.error || body?.meta?.message || body?.meta?.detail;
      if (message) return message;
    } catch {
      /* corps non JSON : on garde le message de repli */
    }
  }
  return fallback;
}

export interface RemboursementProrata {
  montant: number;
  devise: string;
  effectue: boolean;
}

export interface ResultatResiliation {
  message: string;
  remboursement: RemboursementProrata | null;
}

/** Durée de la période de grâce avant la suppression réelle du compte. */
export const JOURS_GRACE_SUPPRESSION = 30;

/** Une demande de suppression encore dans sa période de grâce. */
export interface SuppressionProgrammee {
  id: number;
  demandee_le: string;
  prevue_le: string;
  statut: string;
  /** Fin de la période d'abonnement déjà payée (l'abonnement s'arrête là). */
  fin_de_periode_le?: string | null;
  /** Marqueurs techniques (rappels J-7 / J-1 déjà envoyés, etc.). */
  details?: Record<string, unknown> | null;
}

/** Date d'envoi d'un rappel (clé `details`), ou null s'il n'est pas encore parti. */
export function dateRappelSuppression(
  details: Record<string, unknown> | null | undefined,
  cle: "rappel_j7_envoye_le" | "rappel_j1_envoye_le",
): string | null {
  const valeur = details?.[cle];
  return typeof valeur === "string" ? valeur : null;
}

/** Résultat d'une demande de suppression programmée. */
export interface ResultatDemandeSuppression {
  message: string;
  /** Date réelle de suppression (ISO), ou null si l'information manque. */
  dateSuppression: string | null;
  /** Nombre de jours restants avant la suppression réelle. */
  joursRestants: number;
  /** La demande existait déjà : rien n'a été recréé. */
  dejaProgrammee: boolean;
}

/**
 * Résilie immédiatement l'abonnement de l'artisan connecté.
 * Le Backend annule l'abonnement Stripe, déclenche le remboursement au prorata
 * de la période non consommée, puis enregistre le statut « Résilié ».
 */
export async function resilierAbonnement(): Promise<ResultatResiliation> {
  const { data, error } = await supabase.functions.invoke("resilier-abonnement", { body: {} });
  if (error) {
    throw new Error(
      await messageErreurBackend(error, "La résiliation n'a pas pu être effectuée. Réessayez dans un instant."),
    );
  }
  const result = data as
    | { ok?: boolean; message?: string; remboursement?: RemboursementProrata | null; error?: string }
    | null;
  if (!result?.ok) {
    throw new Error(result?.error || "La résiliation n'a pas pu être effectuée.");
  }
  return {
    message: result.message || "Votre abonnement est résilié.",
    remboursement: result.remboursement ?? null,
  };
}

/**
 * Enregistre la demande de suppression du compte de l'artisan connecté.
 *
 * La suppression n'est PAS immédiate : elle est programmée à J+30. Pendant cette période
 * l'espace reste entièrement utilisable, et se reconnecter annule la demande.
 * Le mot de passe est revérifié côté serveur, et la confirmation doit valoir « SUPPRIMER ».
 */
export async function demanderSuppressionCompte(
  motDePasse: string,
  confirmation: string,
): Promise<ResultatDemandeSuppression> {
  const { data, error } = await supabase.functions.invoke("supprimer-compte", {
    body: { motDePasse, confirmation },
  });
  if (error) {
    throw new Error(
      await messageErreurBackend(
        error,
        "La demande n'a pas pu être enregistrée. Vérifiez votre mot de passe et réessayez.",
      ),
    );
  }
  const result = data as
    | {
        ok?: boolean;
        message?: string;
        dateSuppression?: string | null;
        joursRestants?: number;
        dejaProgrammee?: boolean;
        error?: string;
      }
    | null;
  if (!result?.ok) {
    throw new Error(result?.error || "La demande n'a pas pu être enregistrée.");
  }
  return {
    message: result.message || "Votre demande de suppression est enregistrée.",
    dateSuppression: result.dateSuppression ?? null,
    joursRestants: result.joursRestants ?? JOURS_GRACE_SUPPRESSION,
    dejaProgrammee: !!result.dejaProgrammee,
  };
}

/**
 * Annule une demande de suppression encore dans sa période de grâce.
 * Le motif « connexion » est transmis quand l'annulation vient d'une simple reconnexion.
 */
export async function annulerSuppressionCompte(motif: "action-manuelle" | "connexion" = "action-manuelle"): Promise<string> {
  const { data, error } = await supabase.functions.invoke("annuler-suppression-compte", { body: { motif } });
  if (error) {
    throw new Error(
      await messageErreurBackend(error, "L'annulation n'a pas pu être effectuée. Réessayez dans un instant."),
    );
  }
  const result = data as { ok?: boolean; message?: string; error?: string } | null;
  if (!result?.ok) {
    throw new Error(result?.error || "L'annulation n'a pas pu être effectuée.");
  }
  return result.message || "La suppression de votre compte est annulée.";
}

/** Lit la demande de suppression en cours de l'artisan connecté (null si aucune). */
export async function chargerSuppressionEnCours(): Promise<SuppressionProgrammee | null> {
  const { data, error } = await supabase
    .from("suppressions_compte")
    .select("id, demandee_le, prevue_le, statut, fin_de_periode_le, details")
    .eq("statut", "programmee")
    .order("demandee_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as SuppressionProgrammee;
}

/** Une demande de suppression déjà traitée (annulée, ou supprimée le cas échéant). */
export interface DemandeSuppressionHistorique {
  id: number;
  demandee_le: string;
  prevue_le: string;
  statut: string;
  annulee_le: string | null;
  motif_annulation: string | null;
  fin_de_periode_le: string | null;
}

/**
 * Historique des demandes de suppression de l'artisan connecté.
 *
 * Sert à la section « Historique des demandes annulées » de l'onglet Sécurité : l'artisan
 * voit ce qui s'est passé sur son compte, quand il a demandé la fermeture, quand elle a été
 * annulée et par quel moyen (lui, une reconnexion, ou l'équipe).
 */
export async function chargerHistoriqueSuppressions(): Promise<DemandeSuppressionHistorique[]> {
  const { data, error } = await supabase
    .from("suppressions_compte")
    .select("id, demandee_le, prevue_le, statut, annulee_le, motif_annulation, fin_de_periode_le")
    .in("statut", ["annulee", "supprimee"])
    .order("demandee_le", { ascending: false })
    .limit(10);
  if (error || !Array.isArray(data)) return [];
  return data as DemandeSuppressionHistorique[];
}

/** Libellé lisible du motif d'annulation enregistré côté Backend. */
export function libelleMotifAnnulation(motif: string | null | undefined): string {
  if (motif === "connexion") return "Annulée automatiquement à votre reconnexion";
  if (motif === "gestionnaire") return "Annulée par notre équipe, à votre demande";
  if (motif === "action-manuelle") return "Annulée par vous, depuis votre espace";
  return "Annulée";
}

/** Formate une date ISO en français (jour mois année). */
export function formaterDateFr(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Nombre de jours restants avant la suppression réelle (0 si l'échéance est passée). */
export function joursRestantsAvant(valeur: string | null | undefined): number {
  if (!valeur) return 0;
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return 0;
  const diff = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}