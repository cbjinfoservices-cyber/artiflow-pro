/**
 * Mémorise la dernière consultation de l'historique des vérifications de configuration
 * email, pour pouvoir signaler les nouvelles entrées « non lues » (pastille).
 * On ne stocke qu'un identifiant technique (dernier id vu), pas de donnée sensible.
 */
const CLE = "artiflow_diag_histo_vu";

/** Événement diffusé après chaque consultation, pour rafraîchir les pastilles à chaud. */
export const HISTO_CONSULTATION_EVENT = "artiflow-diag-histo-consulte";

/** Relit l'identifiant de la dernière entrée d'historique consultée (null si jamais consulté). */
export function lireDernierIdHistoVu(): number | null {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Marque l'historique comme consulté jusqu'à l'identifiant fourni. */
export function marquerHistoVu(id: number): void {
  try {
    localStorage.setItem(CLE, String(id));
    window.dispatchEvent(new Event(HISTO_CONSULTATION_EVENT));
  } catch {
    /* stockage indisponible : la pastille restera indicative dans la session */
  }
}

/** Identifiant le plus élevé d'une liste d'entrées (0 si vide). */
export function idMax(entrees: { id: number }[]): number {
  return entrees.reduce((max, e) => (e.id > max ? e.id : max), 0);
}

/**
 * Compte les entrées plus récentes que la dernière consultation.
 * Si l'historique n'a jamais été consulté, on considère qu'il n'y a rien « de nouveau »
 * (pour ne pas afficher une pastille géante à la première visite).
 */
export function compterEntreesNonLues(entrees: { id: number }[], dernierId: number | null): number {
  if (dernierId === null) return 0;
  return entrees.filter((e) => e.id > dernierId).length;
}