import { supabase } from "@/lib/supabase";

/**
 * Une tentative d'ouverture de paiement Stripe qui a échoué.
 * Journalisée par la fonction Backend `create-stripe-checkout` à chaque erreur,
 * pour permettre aux gestionnaires de tracer les incidents de paiement.
 */
export interface PaiementEchecItem {
  id: number;
  artisan_id: string | null;
  artisan_email: string | null;
  entreprise: string | null;
  offre: string | null;
  facturation: string | null;
  montant_mensuel: number | null;
  montant_total: number | null;
  message: string | null;
  source: string | null;
  created_at: string;
}

const COLONNES =
  "id, artisan_id, artisan_email, entreprise, offre, facturation, montant_mensuel, montant_total, message, source, created_at";

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row: Record<string, unknown>): PaiementEchecItem {
  return {
    id: Number(row.id) || 0,
    artisan_id: toStr(row.artisan_id),
    artisan_email: toStr(row.artisan_email),
    entreprise: toStr(row.entreprise),
    offre: toStr(row.offre),
    facturation: toStr(row.facturation),
    montant_mensuel: toNumOrNull(row.montant_mensuel),
    montant_total: toNumOrNull(row.montant_total),
    message: toStr(row.message),
    source: toStr(row.source),
    created_at: toStr(row.created_at) ?? new Date().toISOString(),
  };
}

/**
 * Charge les dernières tentatives de paiement échouées (le plus récent en premier).
 * Lecture réservée aux gestionnaires (règle d'accès de la table `paiements_echecs`).
 */
export async function fetchPaiementsEchecs(limite = 20): Promise<PaiementEchecItem[]> {
  const { data, error } = await supabase
    .from("paiements_echecs")
    .select(COLONNES)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

/** Un rappel de paiement (relance « impayé ») déjà envoyé avec succès à un artisan. */
export interface RelanceImpayeItem {
  artisan_id: string | null;
  email: string | null;
  created_at: string;
}

/** Index des relances de paiement déjà envoyées, pour repérer les doublons d'envoi. */
export interface RelanceImpayeIndex {
  parArtisan: Record<string, string>;
  parEmail: Record<string, string>;
}

/**
 * Charge le journal des rappels de paiement (origine « impaye ») envoyés avec succès.
 * Sert au badge « déjà relancé » de chaque échec, pour éviter de renvoyer deux fois
 * la même relance à un artisan.
 */
export async function fetchRelancesImpaye(): Promise<RelanceImpayeItem[]> {
  const { data, error } = await supabase
    .from("recontacts_artisans")
    .select("artisan_id, email, created_at")
    .eq("origine", "impaye")
    .eq("statut", "envoye")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    artisan_id: toStr(row.artisan_id),
    email: toStr(row.email),
    created_at: toStr(row.created_at) ?? "",
  }));
}

/** Indexe les relances par identifiant artisan et par email, en gardant la plus récente. */
export function indexerRelancesImpaye(items: RelanceImpayeItem[]): RelanceImpayeIndex {
  const parArtisan: Record<string, string> = {};
  const parEmail: Record<string, string> = {};
  const plusRecent = (ancien: string | undefined, nouveau: string) => {
    if (!ancien) return nouveau;
    return new Date(nouveau).getTime() > new Date(ancien).getTime() ? nouveau : ancien;
  };
  items.forEach((it) => {
    if (it.artisan_id) parArtisan[it.artisan_id] = plusRecent(parArtisan[it.artisan_id], it.created_at);
    const email = (it.email ?? "").trim().toLowerCase();
    if (email) parEmail[email] = plusRecent(parEmail[email], it.created_at);
  });
  return { parArtisan, parEmail };
}

/**
 * Date de la dernière relance de paiement déjà envoyée pour cet échec (null si aucune).
 * L'identification se fait d'abord par l'identifiant artisan, puis par l'email.
 */
export function derniereRelanceImpaye(it: PaiementEchecItem, index: RelanceImpayeIndex): string | null {
  if (it.artisan_id && index.parArtisan[it.artisan_id]) return index.parArtisan[it.artisan_id];
  const email = (it.artisan_email ?? "").trim().toLowerCase();
  if (email && index.parEmail[email]) return index.parEmail[email];
  return null;
}

/**
 * Famille d'un échec de paiement, pour un diagnostic plus rapide en back-office :
 * - `configuration` : le tunnel Stripe n'a pas pu s'ouvrir (moyen de paiement non
 *   activé, clé ou compte mal configuré). Rien à voir avec l'artisan : c'est à nous
 *   de corriger côté Stripe.
 * - `carte` : l'artisan est bien arrivé au paiement mais sa carte a été refusée
 *   (fonds insuffisants, carte expirée, opposition…). À relancer auprès de lui.
 * - `autre` : cause non reconnue, à examiner au cas par cas.
 */
export type FamilleEchecPaiement = "configuration" | "carte" | "autre";

/** Libellé, icône et tonalité associés à une famille d'échec. */
export interface FamilleEchecMeta {
  famille: FamilleEchecPaiement;
  label: string;
  icon: string;
  tone: string;
}

const META_CONFIGURATION: FamilleEchecMeta = {
  famille: "configuration",
  label: "Configuration Stripe",
  icon: "ri-settings-3-line",
  tone: "bg-secondary-100 text-secondary-800",
};
const META_CARTE: FamilleEchecMeta = {
  famille: "carte",
  label: "Carte refusée",
  icon: "ri-bank-card-line",
  tone: "bg-accent-100 text-accent-900",
};
const META_AUTRE: FamilleEchecMeta = {
  famille: "autre",
  label: "Autre cause",
  icon: "ri-question-line",
  tone: "bg-background-200 text-foreground-600",
};

/** Motifs (dans le message Stripe) qui trahissent un problème de configuration du tunnel. */
const MOTIFS_CONFIGURATION = [
  "no valid payment method",
  "payment_method_types",
  "payment method type",
  "payment method configuration",
  "not configured",
  "pas encore configuré",
  "n'est pas encore configuré",
  "no such api key",
  "api key",
  "api_key",
  "not allowed",
  "forbidden",
  "permission",
  "unsupported currency",
  "currency is not supported",
  "activer les paiements",
];

/** Motifs (dans le message Stripe) qui trahissent une carte refusée côté artisan. */
const MOTIFS_CARTE = [
  "card was declined",
  "declined",
  "refusée",
  "refuse",
  "do not honor",
  "insufficient",
  "fonds insuffisants",
  "expired",
  "expirée",
  "pickup",
  "stolen",
  "lost card",
  "incorrect number",
  "incorrect cvc",
  "generic_decline",
  "authentication required",
  "3d secure",
];

/**
 * Range un échec de paiement dans sa famille (configuration / carte / autre) à partir
 * du message renvoyé par Stripe. Sert au filtre et au badge du journal back-office.
 */
export function classifierEchecPaiement(it: PaiementEchecItem): FamilleEchecMeta {
  const message = (it.message ?? "").toLowerCase();
  if (!message) return META_AUTRE;
  // La carte refusée prime : un message « card declined » ne doit jamais être rangé
  // en problème de configuration, même s'il contient un mot vague qui matcherait.
  if (MOTIFS_CARTE.some((m) => message.includes(m))) return META_CARTE;
  if (MOTIFS_CONFIGURATION.some((m) => message.includes(m))) return META_CONFIGURATION;
  return META_AUTRE;
}

/**
 * Métadonnées (libellé, icône, tonalité) d'une famille d'échec à partir de sa clé.
 * Utilisé pour afficher les pastilles de répartition dans l'aperçu du récap hebdo.
 */
export function metaFamilleEchec(famille: string): FamilleEchecMeta {
  if (famille === "configuration") return META_CONFIGURATION;
  if (famille === "carte") return META_CARTE;
  return META_AUTRE;
}