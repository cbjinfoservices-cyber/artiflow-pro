import { supabase } from "@/lib/supabase";

/**
 * Signalement d'une astuce d'aide devenue fausse.
 *
 * Une astuce qui décrit un comportement que le code n'a plus est pire qu'une absence d'astuce :
 * elle induit en erreur. Depuis le panneau Aide, l'utilisateur peut donc désigner l'astuce
 * concernée ; le signalement est enregistré côté Backend (table `astuces_signalements`) avec
 * l'écran, le titre de l'astuce et un commentaire facultatif.
 *
 * Chaque ligne est rattachée à son auteur : les règles d'accès ne laissent voir à une personne
 * que ses propres signalements. Le commentaire reste donc privé.
 */

export interface SignalementAstuce {
  /** Route de l'écran concerné (préfixe d'aide). */
  chemin: string;
  /** Titre de l'écran, pour lire le signalement sans retrouver la route. */
  pageTitre: string;
  /** Titre exact de l'astuce signalée. */
  astuceTitre: string;
  /** Précision facultative de l'utilisateur. */
  commentaire?: string;
}

/** Enregistre un signalement. Retourne un message d'erreur lisible, ou null si tout s'est bien passé. */
export async function signalerAstuceObsolete(signalement: SignalementAstuce): Promise<string | null> {
  try {
    const commentaire = signalement.commentaire?.trim();
    const { error } = await supabase.from("astuces_signalements").insert({
      chemin: signalement.chemin,
      page_titre: signalement.pageTitre,
      astuce_titre: signalement.astuceTitre,
      commentaire: commentaire ? commentaire.slice(0, 300) : null,
    });
    if (error) {
      return "Le signalement n'a pas pu être enregistré. Réessayez dans un instant.";
    }
    return null;
  } catch {
    return "Le signalement n'a pas pu être enregistré. Vérifiez votre connexion et réessayez.";
  }
}

/** Titres des astuces déjà signalées par la personne connectée sur un écran donné. */
export async function signalementsDejaFaits(chemin: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("astuces_signalements")
      .select("astuce_titre")
      .eq("chemin", chemin);
    if (error || !data) return [];
    return data
      .map((ligne) => (ligne as { astuce_titre?: string }).astuce_titre)
      .filter((titre): titre is string => Boolean(titre));
  } catch {
    return [];
  }
}