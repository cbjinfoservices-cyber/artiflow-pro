import type { ChantierItem } from "@/hooks/useArtisanData";

export function chantierProgress(c: ChantierItem): number {
  if (c.etapes.length === 0) return c.statut === "Terminé" ? 100 : 0;
  const done = c.etapes.filter((e) => e.fait).length;
  return Math.round((done / c.etapes.length) * 100);
}

/** Nombre de jours sans email au client au-delà duquel un rappel s'affiche. */
export const SEUIL_SANS_NOUVELLES_JOURS = 14;

/** Ce qu'il faut savoir d'un chantier pour juger de son silence côté client. */
export interface SuiviEmailChantier {
  suivi_dernier_email_at: string | null;
  created_at: string | null;
}

/**
 * Nombre de jours écoulés depuis le dernier email réellement parti au client.
 * Sans aucun email, on part de la création du chantier : un chantier ouvert il y a
 * trois semaines sans nouvelles est bien un oubli, même si rien n'a jamais été envoyé.
 */
export function joursSansEmailClient(chantier: SuiviEmailChantier): number | null {
  const reference = chantier.suivi_dernier_email_at ?? chantier.created_at;
  if (!reference) return null;
  const date = new Date(reference);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

/** Vrai quand le client n'a reçu aucune nouvelle depuis au moins le seuil (14 jours). */
export function chantierSansNouvelles(chantier: SuiviEmailChantier): boolean {
  const jours = joursSansEmailClient(chantier);
  return jours !== null && jours >= SEUIL_SANS_NOUVELLES_JOURS;
}

/** Période d'observation du suivi des emails clients. */
export type PeriodeSuiviEmails = "semaine" | "mois";

/**
 * Début de la période en cours : lundi 00:00 pour « cette semaine », 1er du mois 00:00
 * pour « ce mois ». Sert au compteur d'emails envoyés et au classement des silencieux.
 */
export function debutPeriodeSuivi(periode: PeriodeSuiviEmails): Date {
  const now = new Date();
  if (periode === "mois") return new Date(now.getFullYear(), now.getMonth(), 1);
  const jour = now.getDay();
  const decalage = jour === 0 ? 6 : jour - 1;
  const lundi = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  lundi.setDate(lundi.getDate() - decalage);
  return lundi;
}

/** Libellé lisible d'une période de suivi. */
export function libellePeriodeSuivi(periode: PeriodeSuiviEmails): string {
  return periode === "mois" ? "ce mois-ci" : "cette semaine";
}