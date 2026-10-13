/**
 * Accès Backend aux préférences d'affichage d'un compte, pour les retrouver sur n'importe quel
 * appareil. Une seule ligne par utilisateur (clé `user_id`), protégée par une règle de sécurité :
 * chacun n'accède qu'à ses propres préférences (voir la table `preferences_affichage`).
 */

import { supabase } from "@/lib/supabase";
import type { PreferencesAffichage } from "@/lib/preferencesAffichage";
import type { MajPreferences } from "@/lib/preferencesAffichageNotif";

/** Ligne de préférences telle que stockée côté Backend. */
export interface LignePreferencesAffichage {
  donnees: PreferencesAffichage | null;
  maj: MajPreferences | null;
  updated_at: string | null;
}

/** Charge les préférences d'affichage du compte (null si le compte n'en a jamais enregistré). */
export async function chargerPreferencesAffichage(
  userId: string,
): Promise<LignePreferencesAffichage | null> {
  const { data, error } = await supabase
    .from("preferences_affichage")
    .select("donnees, maj, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as LignePreferencesAffichage) ?? null;
}

/** Enregistre (crée ou met à jour) les préférences d'affichage du compte. */
export async function enregistrerPreferencesAffichage(
  userId: string,
  donnees: PreferencesAffichage,
  maj: MajPreferences,
): Promise<void> {
  const { error } = await supabase.from("preferences_affichage").upsert(
    {
      user_id: userId,
      donnees,
      maj,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}