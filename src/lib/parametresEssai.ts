import { supabase } from "@/lib/supabase";

/**
 * Réglages généraux de la plateforme, stockés dans la table `parametres_app`
 * (ligne unique id = 1). Le premier réglage est la durée de la période d'essai
 * offerte à la prise d'abonnement, modifiable depuis le back-office par les
 * gestionnaires. La même valeur est lue par la fonction Backend de paiement pour
 * configurer le véritable essai Stripe (aucun débit avant la fin de l'essai).
 */

/** Durée d'essai utilisée par défaut si le réglage n'est pas (encore) renseigné. */
export const DUREE_ESSAI_DEFAUT = 14;

/** Bornes de sécurité du réglage : 0 = aucun essai, 90 = maximum. */
export const DUREE_ESSAI_MIN = 0;
export const DUREE_ESSAI_MAX = 90;

/** Ramène une valeur quelconque à une durée d'essai valide (entière, bornée). */
export function normaliserDureeEssai(jours: unknown): number {
  const n = Math.round(Number(jours));
  if (!Number.isFinite(n)) return DUREE_ESSAI_DEFAUT;
  return Math.min(DUREE_ESSAI_MAX, Math.max(DUREE_ESSAI_MIN, n));
}

/** Cache mémoire : évite de relire le réglage à chaque composant affiché. */
let cache: number | null = null;

/**
 * Lit la durée d'essai enregistrée côté Backend. Lecture publique : la valeur est
 * partagée par tous les visiteurs. En cas d'indisponibilité, on retombe sur la
 * valeur par défaut (14 jours) pour ne jamais bloquer l'affichage.
 */
export async function fetchDureeEssai(): Promise<number> {
  if (cache !== null) return cache;
  try {
    const { data, error } = await supabase
      .from("parametres_app")
      .select("essai_jours")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    const jours = normaliserDureeEssai((data as { essai_jours?: number } | null)?.essai_jours);
    cache = jours;
    return jours;
  } catch {
    return DUREE_ESSAI_DEFAUT;
  }
}

/** Vide le cache mémoire (après une modification du réglage). */
export function viderCacheDureeEssai(): void {
  cache = null;
}

/**
 * Enregistre une nouvelle durée d'essai. Écriture réservée aux gestionnaires par
 * les règles de sécurité côté Backend. Met à jour le cache en cas de succès.
 */
export async function enregistrerDureeEssai(jours: number, auteurEmail: string | null): Promise<number> {
  const propre = normaliserDureeEssai(jours);
  const { error } = await supabase
    .from("parametres_app")
    .upsert(
      {
        id: 1,
        essai_jours: propre,
        updated_by: auteurEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) throw error;
  cache = propre;
  return propre;
}