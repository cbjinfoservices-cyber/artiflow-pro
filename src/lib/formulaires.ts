import { supabase } from "@/lib/supabase";

/** Formulaires publics du site, reçus par la fonction Backend `recevoir-formulaire`. */
export type TypeFormulaire = "demo" | "contact" | "candidature" | "podcast";

/** Champ « pot de miel » des formulaires : invisible, il n'est rempli que par les robots. */
const CHAMPS_PIEGES = ["website_alt", "contact_alt"];

/**
 * Envoie un formulaire du site : la demande est enregistrée dans la base d'ArtiFlow-pro puis
 * notifiée par email à l'équipe. Renvoie un message d'erreur lisible, ou null si tout s'est bien passé.
 */
export async function envoyerFormulaire(type: TypeFormulaire, formData: FormData, extras: Record<string, string> = {}): Promise<string | null> {
  const champs: Record<string, string> = {};
  formData.forEach((valeur, cle) => {
    if (!CHAMPS_PIEGES.includes(cle) && typeof valeur === "string") champs[cle] = valeur;
  });
  Object.assign(champs, extras);

  const { data, error } = await supabase.functions.invoke("recevoir-formulaire", { body: { type, champs } });
  if (error) {
    const contexte = (error as { context?: Response } | null)?.context;
    if (contexte && typeof contexte.json === "function") {
      const corps = (await contexte.json().catch(() => null)) as { error?: string } | null;
      if (corps?.error) return corps.error;
    }
    return "Connexion impossible pour le moment. Réessayez dans un instant.";
  }
  const resultat = data as { ok?: boolean; error?: string } | null;
  return resultat?.ok ? null : resultat?.error || "L'envoi n'a pas abouti. Vérifiez vos informations puis réessayez.";
}
