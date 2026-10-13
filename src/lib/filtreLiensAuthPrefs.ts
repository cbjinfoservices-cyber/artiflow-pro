/**
 * Préférence d'affichage du filtre de l'historique des liens d'authentification (Diagnostic).
 * Simple mémorisation locale du dernier filtre choisi (tous / connexion / réinitialisation)
 * pour le retrouver tel quel à la prochaine visite. Aucune donnée métier ici.
 */

/** Filtre d'affichage de la liste d'historique des liens de test. */
export type FiltreLienAuth = "tous" | "connexion" | "reset";

const CLE = "artiflow.liens-auth.filtre";

/** Vérifie qu'une valeur lue est un filtre valide (robuste au stockage corrompu). */
function estFiltreLiensAuth(valeur: unknown): valeur is FiltreLienAuth {
  return valeur === "tous" || valeur === "connexion" || valeur === "reset";
}

/** Filtre courant, ou « tous » par défaut si rien n'est mémorisé. */
export function lireFiltreLiensAuth(): FiltreLienAuth {
  try {
    const brut = localStorage.getItem(CLE);
    return estFiltreLiensAuth(brut) ? brut : "tous";
  } catch {
    return "tous";
  }
}

/** Mémorise le filtre choisi pour le retrouver à la prochaine visite. */
export function ecrireFiltreLiensAuth(filtre: FiltreLienAuth): void {
  try {
    localStorage.setItem(CLE, filtre);
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}

/** Filtre rapide de tendance mémorisable (semaines en hausse ou en baisse). */
export type FiltreTendanceLienAuth = "hausse" | "baisse";

const CLE_TENDANCE = "artiflow.liens-auth.filtre-tendance";

/** Vérifie qu'une valeur lue est un filtre de tendance valide (robuste au stockage corrompu). */
function estFiltreTendance(valeur: unknown): valeur is FiltreTendanceLienAuth {
  return valeur === "hausse" || valeur === "baisse";
}

/**
 * Filtre rapide de tendance courant (« hausse » ou « baisse »), ou null si aucun n'est mémorisé.
 * Comme les autres préférences de la carte, il est retrouvé tel quel à la prochaine visite.
 */
export function lireFiltreTendanceLiensAuth(): FiltreTendanceLienAuth | null {
  try {
    const brut = localStorage.getItem(CLE_TENDANCE);
    return estFiltreTendance(brut) ? brut : null;
  } catch {
    return null;
  }
}

/** Mémorise le filtre de tendance (ou l'efface quand on revient à aucun filtre). */
export function ecrireFiltreTendanceLiensAuth(filtre: FiltreTendanceLienAuth | null): void {
  try {
    if (filtre) localStorage.setItem(CLE_TENDANCE, filtre);
    else localStorage.removeItem(CLE_TENDANCE);
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}