import { supabase } from "@/lib/supabase";

/**
 * Réglages et déclenchements du récapitulatif HEBDOMADAIRE des invitations d'intervenants.
 *
 * Le récap liste les fiches « invitées sans compte » (invitation partie, compte jamais créé)
 * pour que le responsable puisse les relancer d'un coup d'œil. Il part tout seul à l'échéance
 * réglée (jour + heure), mais on peut aussi le prévisualiser ou l'envoyer immédiatement.
 */

/** Réglage du récapitulatif hebdomadaire des invitations d'intervenants. */
export interface RecapInvitationsSettings {
  /** Récap hebdomadaire par email activé. */
  actif: boolean;
  /** Jour de la semaine (1 = lundi … 7 = dimanche). */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
}

/** Jour d'envoi par défaut : lundi (1 = lundi … 7 = dimanche). */
export const RECAP_INVITATIONS_JOUR_DEFAUT = 1;
/** Heure d'envoi par défaut (heure de Paris). */
export const RECAP_INVITATIONS_HEURE_DEFAUT = 8;

/**
 * Enregistre le réglage du récapitulatif hebdomadaire des invitations (interrupteur, jour,
 * heure). La tâche planifiée côté Backend lit ces valeurs pour expédier, une fois par semaine,
 * l'email listant les fiches invitées sans compte à relancer.
 */
export async function updateRecapInvitationsSettings(
  userId: string,
  settings: RecapInvitationsSettings,
): Promise<void> {
  const jour = Math.min(7, Math.max(1, Math.round(Number.isFinite(settings.jour) ? settings.jour : 1)));
  const heure = Math.min(23, Math.max(0, Math.round(Number.isFinite(settings.heure) ? settings.heure : 8)));
  const { error } = await supabase
    .from("profiles")
    .update({
      intervenants_recap_actif: settings.actif,
      intervenants_recap_jour: jour,
      intervenants_recap_heure: heure,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export interface RecapInvitationsPreview {
  /** HTML complet de l'email, identique à celui réellement envoyé. */
  html: string;
  /** Objet de l'email. */
  subject: string;
  /** Nombre de fiches « invitées sans compte » listées. */
  nbFiches: number;
}

/**
 * Génère l'aperçu du récapitulatif des invitations, sans rien envoyer : renvoie le HTML exact
 * qui serait expédié (bouton « Aperçu »), même si Resend n'est pas configuré.
 */
export async function previewRecapInvitations(userId: string): Promise<RecapInvitationsPreview> {
  const { data, error } = await supabase.functions.invoke("recap-invitations-intervenants", {
    body: { userId, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as (RecapInvitationsPreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu du récap a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    nbFiches: Number(payload.nbFiches ?? 0),
  };
}

export interface RecapInvitationsRunResult {
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configured: boolean;
  /** Nombre d'emails réellement envoyés. */
  sent: number;
  /** Nombre de profils ignorés. */
  skipped: number;
  /** Nombre de fiches listées pour le responsable courant. */
  nbFiches: number;
  /** Raison de l'ignorance éventuelle (utile pour un envoi immédiat). */
  reason?: string;
}

/**
 * Déclenche immédiatement l'envoi du récapitulatif des invitations pour le responsable courant
 * (bouton « Envoyer maintenant »), sans attendre le jour/heure programmés. On peut ainsi
 * vérifier le rendu et la réception sans patienter jusqu'au lundi.
 */
export async function runRecapInvitationsNow(userId: string): Promise<RecapInvitationsRunResult> {
  const { data, error } = await supabase.functions.invoke("recap-invitations-intervenants", {
    body: { userId, force: true, ignoreTime: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (RecapInvitationsRunResult & {
        ok?: boolean;
        error?: string;
        details?: Array<{ fiches?: number; sent?: boolean; reason?: string }>;
      })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du récap a échoué.");
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  return {
    configured: Boolean(payload.configured),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    nbFiches: Number(detail?.fiches ?? 0),
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

/** Prochaine occurrence (ISO) du récap pour un jour/heure donnés (heure locale). */
export function prochainRecapInvitations(jour: number, heure: number, now: Date = new Date()): string {
  const cible = Math.min(7, Math.max(1, Math.round(Number.isFinite(jour) && jour > 0 ? jour : 1)));
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  const jsCible = cible % 7; // 7 (dimanche) → 0
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
  let delta = (jsCible - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString();
}