/**
 * Préférence d'export de la carte « Livraison des liens d'authentification » (Diagnostic) :
 * faut-il demander une confirmation avant de télécharger le CSV du périmètre courant ?
 * Mémorisée localement pour être retrouvée telle quelle à la prochaine visite, comme les
 * autres préférences de la carte. Les habitués peuvent la désactiver pour revenir au
 * téléchargement direct ; elle se réactive d'un clic au besoin. Aucune donnée métier ici.
 */

const CLE = "artiflow.liens-auth.confirmation-csv";

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const CONFIRMATION_CSV_LIENS_AUTH_EVENT = "artiflow-liens-auth-confirmation-csv";

/**
 * Demander une confirmation avant l'export CSV ? Vrai par défaut (protection contre les
 * téléchargements accidentels) tant que l'utilisateur n'a pas choisi de s'en passer.
 */
export function lireConfirmationCsvLiensAuth(): boolean {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut === null) return true;
    return brut === "1";
  } catch {
    return true;
  }
}

/** Mémorise le choix pour le retrouver à la prochaine visite. */
export function ecrireConfirmationCsvLiensAuth(actif: boolean): void {
  try {
    localStorage.setItem(CLE, actif ? "1" : "0");
    window.dispatchEvent(new Event(CONFIRMATION_CSV_LIENS_AUTH_EVENT));
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}