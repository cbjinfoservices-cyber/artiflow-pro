import { supabase } from "@/lib/supabase";

/** Statut de traitement d'une alerte de configuration : à traiter ou déjà traitée. */
export type StatutAlerte = "nouvelle" | "traitee";

/**
 * Une alerte automatique déclenchée quand le diagnostic a détecté une configuration de
 * paiement Stripe incomplète (la carte en euros ne peut pas être encaissée). Chaque
 * détection est journalisée par la fonction Backend `verifier-paiement-eur` dans la table
 * `alerte_config_stripe`, avec un anti-spam de 6 heures.
 */
export interface DetailAlerteConfigStripe {
  /** La devise EUR est acceptée par le pays du compte Stripe. */
  eurSupportee: boolean;
  /** La carte bancaire est supportée dans le pays du compte Stripe. */
  carteSupporteePays: boolean;
  /** La carte est activée à l'affichage (préférence différente de « off »). */
  carteActive: boolean;
  /** Stripe marque la carte comme « disponible » (false si le compte n'est pas activé). */
  carteDisponible: boolean;
  /** Préférence d'affichage de la carte : "on", "off", "none" ou "". */
  cartePreference: string;
  /** Le compte Stripe peut encaisser (charges activées). */
  chargesActives: boolean;
  /** Pays du compte Stripe (code ISO minuscule). */
  pays: string;
}

export interface AlerteConfigStripeItem {
  id: number;
  /** Origine du blocage : "pays" (devise/moyen non supporté) ou "carte" (carte non activée). */
  motif: "pays" | "carte" | "";
  /** Pays déclaré du compte Stripe (code ISO minuscule), quand connu. */
  pays: string;
  /** Détail brut de chaque contrôle au moment de la détection (pour diagnostiquer plus vite). */
  detail: DetailAlerteConfigStripe | null;
  /** Adresses email des gestionnaires prévenus par l'alerte. */
  destinataires: string[];
  created_at: string;
  /** Statut de traitement : « nouvelle » (à traiter) ou « traitee ». */
  statut: StatutAlerte;
  /** Email du gestionnaire qui a marqué l'alerte comme traitée (vide si non traitée). */
  traite_par: string;
  /** Horodatage ISO du marquage « traitée » (vide si non traitée). */
  traite_at: string;
}

const COLONNES =
  "id, motif, pays, destinataires, created_at, statut, traite_par, traite_at, detail";

function toMotif(value: unknown): "pays" | "carte" | "" {
  const v = String(value ?? "");
  return v === "pays" || v === "carte" ? v : "";
}

function toStr(value: unknown): string {
  return String(value ?? "").trim();
}

function toStrArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);
}

function toStatut(value: unknown): StatutAlerte {
  return String(value ?? "") === "traitee" ? "traitee" : "nouvelle";
}

function toBool(value: unknown, defaut = true): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return defaut;
  return Boolean(value);
}

function toDetail(value: unknown): DetailAlerteConfigStripe | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return {
    eurSupportee: toBool(v.eurSupportee),
    carteSupporteePays: toBool(v.carteSupporteePays),
    carteActive: toBool(v.carteActive),
    carteDisponible: toBool(v.carteDisponible),
    cartePreference: toStr(v.cartePreference),
    chargesActives: toBool(v.chargesActives),
    pays: toStr(v.pays),
  };
}

function mapRow(row: Record<string, unknown>): AlerteConfigStripeItem {
  return {
    id: Number(row.id) || 0,
    motif: toMotif(row.motif),
    pays: toStr(row.pays),
    detail: toDetail(row.detail),
    destinataires: toStrArray(row.destinataires),
    created_at: toStr(row.created_at),
    statut: toStatut(row.statut),
    traite_par: toStr(row.traite_par),
    traite_at: toStr(row.traite_at),
  };
}

/**
 * Charge l'historique des alertes de configuration Stripe (la plus récente en premier).
 * Lecture réservée aux gestionnaires (règle d'accès de la table `alerte_config_stripe`).
 */
export async function fetchAlertesConfigStripe(limite = 50): Promise<AlerteConfigStripeItem[]> {
  const { data, error } = await supabase
    .from("alerte_config_stripe")
    .select(COLONNES)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

/**
 * Marque une alerte comme traitée : enregistre le statut « traitee », l'auteur du geste
 * (email du gestionnaire) et l'horodatage. Écriture réservée aux gestionnaires par les
 * règles de sécurité côté Backend.
 */
export async function marquerAlerteTraitee(id: number, auteurEmail: string): Promise<void> {
  const { error } = await supabase
    .from("alerte_config_stripe")
    .update({
      statut: "traitee",
      traite_par: auteurEmail.trim() || null,
      traite_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Marque PLUSIEURS alertes comme traitées en une seule opération (action groupée).
 * Enregistre le même auteur (email du gestionnaire) et le même horodatage pour toutes
 * les alertes ciblées. Écriture réservée aux gestionnaires par les règles de sécurité.
 */
export async function marquerAlertesTraitees(ids: number[], auteurEmail: string): Promise<void> {
  const cibles = ids.filter((id) => Number.isFinite(id));
  if (cibles.length === 0) return;
  const { error } = await supabase
    .from("alerte_config_stripe")
    .update({
      statut: "traitee",
      traite_par: auteurEmail.trim() || null,
      traite_at: new Date().toISOString(),
    })
    .in("id", cibles);
  if (error) throw error;
}

/**
 * Rouvre une alerte marquée par erreur : repasse le statut à « nouvelle » et efface
 * l'auteur et la date de traitement.
 */
export async function rouvrirAlerteConfigStripe(id: number): Promise<void> {
  const { error } = await supabase
    .from("alerte_config_stripe")
    .update({ statut: "nouvelle", traite_par: null, traite_at: null })
    .eq("id", id);
  if (error) throw error;
}