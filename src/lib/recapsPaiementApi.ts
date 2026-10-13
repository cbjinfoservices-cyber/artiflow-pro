import { supabase } from "@/lib/supabase";

/**
 * Une trace d'un récap hebdomadaire des échecs de paiement réellement envoyé aux gestionnaires.
 * Chaque envoi (automatique hebdo ou test manuel) est consigné par la fonction Backend
 * `recap-hebdo-echecs-paiement` dans la table `recap_echecs_paiement_envois`.
 */
export interface RecapPaiementEnvoi {
  id: number;
  nb_echecs: number;
  periode_jours: number | null;
  destinataires: string[];
  created_at: string;
}

const COLONNES = "id, nb_echecs, periode_jours, destinataires, created_at";

function toStrArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);
}

function mapRow(row: Record<string, unknown>): RecapPaiementEnvoi {
  return {
    id: Number(row.id) || 0,
    nb_echecs: Number(row.nb_echecs) || 0,
    periode_jours:
      row.periode_jours === null || row.periode_jours === undefined ? null : Number(row.periode_jours),
    destinataires: toStrArray(row.destinataires),
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * Charge l'historique des récaps hebdo de paiement déjà envoyés (le plus récent en premier).
 * Lecture réservée aux gestionnaires (règle d'accès de la table `recap_echecs_paiement_envois`).
 */
export async function fetchRecapsPaiementEnvoyes(limite = 50): Promise<RecapPaiementEnvoi[]> {
  const { data, error } = await supabase
    .from("recap_echecs_paiement_envois")
    .select(COLONNES)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

/**
 * Une ligne de la répartition par famille des échecs résumés dans l'aperçu.
 * `famille` reprend la classification du back-office : configuration / carte / autre.
 */
export interface RecapPaiementFamille {
  famille: string;
  count: number;
}

/** Aperçu (aucun envoi) de l'email de récap hebdo des échecs de paiement. */
export interface RecapPaiementPreview {
  html: string;
  subject: string;
  /** Nombre d'échecs résumés dans l'aperçu (fenêtre des 7 derniers jours). */
  total: number;
  /** Adresses qui recevront l'email réel. */
  destinataires: string[];
  /** Répartition des échecs par famille, pour afficher les pastilles sans ouvrir l'email. */
  familles: RecapPaiementFamille[];
}

function toFamilles(value: unknown): RecapPaiementFamille[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const row = (v ?? Object.create(null)) as Record<string, unknown>;
      return { famille: String(row.famille ?? ""), count: Number(row.count ?? 0) || 0 };
    })
    .filter((f) => f.famille.length > 0);
}

/**
 * Génère l'aperçu HTML de l'email de récap hebdo des échecs de paiement, sans rien envoyer
 * (mode `preview` de la fonction Backend).
 */
export async function previewRecapPaiement(): Promise<RecapPaiementPreview> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-echecs-paiement", {
    body: { preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (RecapPaiementPreview & { ok?: boolean; error?: string })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu du récap hebdo a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    total: Number(payload.total ?? 0),
    destinataires: toStrArray(payload.destinataires),
    familles: toFamilles(payload.familles),
  };
}

/** Résultat d'un envoi immédiat du récap hebdo de paiement (« Tester maintenant »). */
export interface RecapPaiementRunResult {
  sent: number;
  total: number;
  reason?: string;
}

/**
 * Déclenche immédiatement l'envoi du récap hebdo des échecs de paiement aux gestionnaires
 * (mode `force` de la fonction Backend), sans attendre le jour/heure programmés ni l'anti-doublon.
 * Pratique pour vérifier la réception de l'email depuis le back-office.
 */
export async function testerRecapPaiement(): Promise<RecapPaiementRunResult> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-echecs-paiement", {
    body: { force: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        configured?: boolean;
        sent?: number;
        total?: number;
        reason?: string;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du récap hebdo a échoué.");
  return {
    sent: Number(payload.sent ?? 0),
    total: Number(payload.total ?? 0),
    reason: payload.reason ? String(payload.reason) : undefined,
  };
}