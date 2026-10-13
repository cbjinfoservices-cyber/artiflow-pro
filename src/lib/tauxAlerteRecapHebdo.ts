import { supabase } from "@/lib/supabase";

/** Réglage du récapitulatif hebdomadaire des alertes de taux de réussite. */
export interface TauxAlerteRecapHebdoSettings {
  /** Récap hebdomadaire par email activé. */
  actif: boolean;
  /** Jour de la semaine (1 = lundi … 7 = dimanche). */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
}

/**
 * Enregistre le réglage du récapitulatif hebdomadaire des alertes de taux (interrupteur,
 * jour de la semaine, heure). La tâche planifiée côté serveur lit ces valeurs pour expédier,
 * une fois par semaine, un email résumant les alertes de taux envoyées dans la semaine.
 */
export async function updateTauxAlerteRecapHebdoSettings(
  userId: string,
  settings: TauxAlerteRecapHebdoSettings,
): Promise<void> {
  const jour = Math.min(7, Math.max(1, Math.round(Number.isFinite(settings.jour) ? settings.jour : 1)));
  const heure = Math.min(23, Math.max(0, Math.round(Number.isFinite(settings.heure) ? settings.heure : 8)));
  const { error } = await supabase
    .from("profiles")
    .update({
      taux_alerte_recap_hebdo_actif: settings.actif,
      taux_alerte_recap_hebdo_jour: jour,
      taux_alerte_recap_hebdo_heure: heure,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

export interface TauxAlerteRecapHebdoPreview {
  /** HTML complet de l'email, identique à celui réellement envoyé. */
  html: string;
  /** Objet de l'email. */
  subject: string;
  /** Nombre d'alertes résumées dans l'aperçu (7 derniers jours). */
  alertes: number;
}

/**
 * Génère l'aperçu du récap hebdomadaire des alertes de taux, sans rien envoyer : renvoie le
 * HTML exact qui serait expédié (bouton « Aperçu »), même si Resend n'est pas encore configuré.
 */
export async function previewTauxAlerteRecapHebdo(userId: string): Promise<TauxAlerteRecapHebdoPreview> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-alertes-taux", {
    body: { userId, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as (TauxAlerteRecapHebdoPreview & { ok?: boolean; error?: string }) | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'aperçu du récap hebdomadaire a échoué.");
  return {
    html: String(payload.html ?? ""),
    subject: String(payload.subject ?? ""),
    alertes: Number(payload.alertes ?? 0),
  };
}

export interface TauxAlerteRecapHebdoRunResult {
  /** Resend est-il configuré (clé API + domaine d'envoi) ? */
  configured: boolean;
  /** Nombre d'emails réellement envoyés. */
  sent: number;
  /** Nombre de profils ignorés. */
  skipped: number;
  /** Raison de l'ignorance éventuelle (utile pour un test immédiat). */
  reason?: string;
}

/**
 * Déclenche immédiatement l'envoi du récap hebdomadaire des alertes de taux pour l'artisan
 * courant (bouton « Tester maintenant »), sans attendre le jour/heure programmés. On peut
 * ainsi valider le rendu et la réception avant de compter sur l'envoi automatique.
 */
export async function runTauxAlerteRecapHebdoNow(
  userId: string,
): Promise<TauxAlerteRecapHebdoRunResult> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-alertes-taux", {
    body: { userId, force: true, ignoreTime: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | (TauxAlerteRecapHebdoRunResult & {
        ok?: boolean;
        error?: string;
        details?: Array<{ sent?: boolean; reason?: string }>;
      })
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du récap hebdomadaire a échoué.");
  const detail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  return {
    configured: Boolean(payload.configured),
    sent: Number(payload.sent ?? 0),
    skipped: Number(payload.skipped ?? 0),
    reason: detail?.reason ? String(detail.reason) : undefined,
  };
}

/** Libellés des jours de la semaine pour les sélecteurs (1 = lundi … 7 = dimanche). */
export const JOURS_SEMAINE: { value: number; label: string }[] = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
];

/** Prochaine occurrence (ISO) du récap hebdo pour un jour/heure donnés (heure locale). */
export function prochainRecapTauxHebdo(jour: number, heure: number, now: Date = new Date()): string {
  const cible = Math.min(7, Math.max(1, Math.round(Number.isFinite(jour) && jour > 0 ? jour : 1)));
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  const jsCible = cible % 7; // 7 (dimanche) → 0
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
  let delta = (jsCible - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString();
}