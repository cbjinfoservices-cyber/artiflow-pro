/**
 * Traduit les messages d'erreur techniques de l'authentification
 * en messages clairs et rassurants pour l'artisan.
 */
export function translateAuthError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirmez d'abord votre adresse email (vérifiez votre boîte mail).";
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Un compte existe déjà avec cette adresse email.";
  }
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("valid email") || m.includes("unable to validate email")) return "Cette adresse email n'est pas valide.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (m.includes("token has expired") || m.includes("otp")) return "Le lien n'est plus valide. Demandez-en un nouveau.";
  if (m.includes("user not found")) return "Aucun compte n'est associé à cette adresse email.";
  if (m.includes("auth session missing")) return "Votre lien de réinitialisation a expiré. Demandez-en un nouveau.";
  return message || "Une erreur est survenue. Réessayez dans un instant.";
}