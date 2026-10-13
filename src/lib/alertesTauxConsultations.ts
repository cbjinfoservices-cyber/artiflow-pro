/**
 * Mémorise la dernière alerte de taux « vue » par l'artisan, afin de pouvoir signaler
 * les nouvelles alertes automatiques arrivées depuis la dernière visite (pastille).
 * On ne stocke qu'un identifiant technique (dernier id vu), pas de donnée sensible.
 */
const CLE = "artiflow.taux_alerte_dernier_vu";

/** Événement diffusé après chaque consultation, pour rafraîchir la pastille à chaud. */
export const ALERTE_TAUX_VUE_EVENT = "artiflow-taux-alerte-vue";

/**
 * Raccourci clavier global permettant de tout marquer comme lu depuis n'importe quelle
 * page de l'espace (voir le gestionnaire de touches dans AppLayout).
 */
export const RACCOURCI_MARQUER_LU = "Maj + U";

/** Relit l'identifiant de la dernière alerte de taux vue (null si jamais consulté). */
export function lireDernierIdAlerteVu(): number | null {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Marque les alertes comme vues jusqu'à l'identifiant fourni. */
export function marquerAlerteVue(id: number): void {
  try {
    localStorage.setItem(CLE, String(id));
    window.dispatchEvent(new Event(ALERTE_TAUX_VUE_EVENT));
  } catch {
    /* stockage indisponible : la pastille restera indicative dans la session */
  }
}

/** Identifiant le plus élevé d'une liste d'alertes (0 si vide). */
export function idMaxAlerte(entrees: { id: number }[]): number {
  return entrees.reduce((max, e) => (e.id > max ? e.id : max), 0);
}

/**
 * Compte les alertes AUTOMATIQUES (hors tests manuels) plus récentes que la dernière
 * consultation. Si l'historique n'a jamais été consulté, on considère qu'il n'y a rien
 * « de nouveau » (pour ne pas afficher une pastille géante à la première visite).
 */
export function compterNouvellesAlertesAuto(
  entrees: { id: number; manuel: boolean }[],
  dernierId: number | null,
): number {
  if (dernierId === null) return 0;
  return entrees.filter((e) => !e.manuel && e.id > dernierId).length;
}