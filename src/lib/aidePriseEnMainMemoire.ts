/**
 * Mémoire du guide de prise en main : on retient si l'assistant d'accueil (le panneau « Aide »
 * qui s'ouvre au tout premier passage) a déjà été montré, pour ne plus l'imposer ensuite.
 *
 * C'est un pur réglage d'interface, propre au poste et au navigateur, sans aucune donnée métier.
 * L'artisan peut revoir le guide à tout moment via le bouton « Aide », et le réinitialiser depuis
 * ce même panneau pour qu'il réapparaisse au prochain démarrage.
 */

const CLE = "artiflow.aide-prise-en-main-vue";

/** Le guide de prise en main a-t-il déjà été montré ? */
export function aidePriseEnMainDejaVue(): boolean {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

/** Mémorise que le guide de prise en main a été montré. */
export function marquerAidePriseEnMainVue(): void {
  try {
    localStorage.setItem(CLE, "1");
  } catch {
    /* stockage indisponible : le guide pourra se rouvrir, ce n'est pas bloquant */
  }
}

/** Oublie le guide : il se rouvrira automatiquement au prochain démarrage. */
export function reinitialiserAidePriseEnMain(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible : rien à réinitialiser */
  }
}