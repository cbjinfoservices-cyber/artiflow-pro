/**
 * Mémoire des « guides de première visite » posés sur chaque grande page de l'espace artisan.
 *
 * Contrairement au guide global de prise en main (le panneau « Aide »), ces petits guides sont
 * propres à une page : ils expliquent, pas à pas, comment se servir de CET écran la première fois.
 * On retient, page par page, si le guide a déjà été vu, pour ne plus le réimposer ensuite.
 *
 * C'est un pur réglage d'affichage, propre au poste et au navigateur, sans aucune donnée métier.
 * L'artisan peut revoir un guide à tout moment, ou le réinitialiser pour qu'il réapparaisse.
 */

const PREFIXE = "artiflow.guide-premiere-visite.";

/**
 * Registre des pages dotées d'un guide de première visite (clé technique + libellé lisible).
 * Sert de source unique pour proposer la réinitialisation de tous les guides depuis le
 * panneau « Aide » : quand on ajoute un guide sur une nouvelle page, on l'enregistre ici.
 */
export const PAGES_GUIDE: { cle: string; label: string }[] = [
  { cle: "tableau-de-bord", label: "Tableau de bord" },
  { cle: "clients", label: "Clients" },
  { cle: "devis", label: "Devis" },
  { cle: "factures", label: "Factures" },
  { cle: "relances", label: "Relances" },
  { cle: "chantiers", label: "Chantiers" },
  { cle: "planning", label: "Planning" },
  { cle: "comptabilite", label: "Comptabilité" },
  { cle: "envois-automatiques", label: "Envois automatiques" },
  { cle: "profil", label: "Mon profil" },
];

/** Le guide d'une page (identifiée par sa clé) a-t-il déjà été vu ? */
export function guidePremiereVisiteVu(cle: string): boolean {
  try {
    return localStorage.getItem(`${PREFIXE}${cle}`) === "1";
  } catch {
    return false;
  }
}

/** Mémorise que le guide d'une page a été vu. */
export function marquerGuidePremiereVisiteVu(cle: string): void {
  try {
    localStorage.setItem(`${PREFIXE}${cle}`, "1");
  } catch {
    /* stockage indisponible : le guide pourra se rouvrir, ce n'est pas bloquant */
  }
}

/** Oublie le guide d'une page : il se rouvrira automatiquement à la prochaine visite. */
export function reinitialiserGuidePremiereVisite(cle: string): void {
  try {
    localStorage.removeItem(`${PREFIXE}${cle}`);
  } catch {
    /* stockage indisponible : rien à réinitialiser */
  }
}

/**
 * Oublie TOUS les guides de première visite d'un coup : chacun se rouvrira automatiquement
 * la prochaine fois que l'artisan ouvrira la page correspondante. Pratique pour repartir de
 * zéro ou faire découvrir l'outil à quelqu'un.
 */
export function reinitialiserTousLesGuidesPremiereVisite(): void {
  PAGES_GUIDE.forEach((p) => reinitialiserGuidePremiereVisite(p.cle));
}