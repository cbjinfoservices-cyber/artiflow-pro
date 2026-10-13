/**
 * Mémoire locale du DERNIER récap d'échecs « test à blanc » envoyé par email.
 *
 * On garde simplement l'horodatage du dernier récap d'échecs expédié par email (depuis la
 * page Envois automatiques ou la fenêtre de rejeu global du Diagnostic), pour pouvoir
 * l'afficher dans le bandeau « Prêt à publier ». Stockage navigateur uniquement : aucune
 * donnée sensible, aucune synchronisation Backend.
 */

const CLE = "artiflow.envoisAuto.testABlancRecapEmail";
/** Événement diffusé quand la date du dernier récap envoyé par email change. */
export const TEST_A_BLANC_RECAP_EVENT = "artiflow-envoisauto-testablanc-recap-email";

/** Lit l'horodatage ISO du dernier récap d'échecs envoyé par email, ou null si aucun. */
export function lireDernierRecapEmail(): string | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const valeur = brut.trim();
    if (!valeur) return null;
    return Number.isNaN(new Date(valeur).getTime()) ? null : valeur;
  } catch {
    return null;
  }
}

/** Enregistre la date du dernier récap d'échecs envoyé par email et prévient l'affichage. */
export function enregistrerRecapEmail(date: string = new Date().toISOString()): void {
  try {
    localStorage.setItem(CLE, date);
    window.dispatchEvent(new Event(TEST_A_BLANC_RECAP_EVENT));
  } catch {
    /* stockage indisponible : la date n'est pas persistante */
  }
}