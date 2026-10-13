import { supabase } from "@/lib/supabase";

export interface OnboardingMetier {
  entreprise: string;
  metier: string;
  telephone: string;
}

/**
 * Enregistre le métier (et l'entreprise / le téléphone) saisi pendant le parcours de
 * démarrage, sans toucher aux autres réglages du profil (emails, comptabilité…).
 */
export async function saveOnboardingMetier(userId: string, payload: OnboardingMetier): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      entreprise: payload.entreprise.trim() || null,
      metier: payload.metier || null,
      telephone: payload.telephone.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Marque le parcours de démarrage comme terminé (ou l'annule) pour l'artisan courant.
 * Tant qu'il n'est pas terminé, l'Espace artisan propose l'écran de démarrage guidé.
 */
export async function setOnboardingDone(userId: string, done = true): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_done: done, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}