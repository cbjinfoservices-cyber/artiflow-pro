/**
 * Rôles applicatifs — reconnaissance des comptes « gestionnaire » (back-office).
 *
 * Le rôle est déterminé par l'adresse email du compte connecté. Le gestionnaire
 * « principal » est fixe (constante ci-dessous) : c'est le seul qui peut gérer la liste
 * des gestionnaires et leurs préférences. Les autres gestionnaires sont stockés dans la
 * table `gestionnaires` du Backend et gérés depuis la page « Mon compte gestionnaire ».
 *
 * Rappel important : les identifiants (email + mot de passe) ne sont jamais créés par le
 * code — ils se créent dans Backend → Authentification avec exactement la même adresse.
 */
export const GESTIONNAIRE_PRINCIPAL_EMAIL = "cbj.infoservices@gmail.com";

/** Normalise une adresse email pour comparaison (minuscules, sans espaces autour). */
export function normaliseEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

/** Indique si une adresse correspond au compte gestionnaire principal. */
export function estGestionnairePrincipal(email?: string | null): boolean {
  return normaliseEmail(email) === GESTIONNAIRE_PRINCIPAL_EMAIL;
}