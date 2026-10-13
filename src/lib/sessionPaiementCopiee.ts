/**
 * Mémoire locale du DERNIER identifiant de session Stripe copié (cs_…).
 *
 * Quand un gestionnaire copie l'identifiant de session depuis le bouton « Tester le
 * paiement » (page Tarifs) ou depuis le « Test à blanc » du guide de dépannage du
 * back-office, on mémorise cet identifiant pour pouvoir le réafficher au retour sur la
 * page — afin de ne pas le perdre entre deux visites. Stockage navigateur uniquement,
 * aucune donnée sensible.
 */

const CLE = "artiflow.derniereSessionPaiementCopiee";

/** Événement diffusé quand l'identifiant mémorisé change. */
export const SESSION_PAIEMENT_COPIEE_EVENT = "artiflow-session-paiement-copiee";

/** Identifiant de session mémorisé, avec sa date de copie. */
export interface SessionPaiementCopiee {
  sessionId: string;
  /** Horodatage ISO de la copie. */
  at: string;
}

/** Relit le dernier identifiant de session copié, ou null si rien de valide. */
export function lireSessionPaiementCopiee(): SessionPaiementCopiee | null {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionPaiementCopiee>;
    const sessionId = typeof parsed?.sessionId === "string" ? parsed.sessionId.trim() : "";
    if (!sessionId) return null;
    return {
      sessionId,
      at: typeof parsed.at === "string" ? parsed.at : "",
    };
  } catch {
    return null;
  }
}

/** Mémorise l'identifiant de session qui vient d'être copié. */
export function memoriserSessionPaiementCopiee(sessionId: string): void {
  const valeur = sessionId.trim();
  if (!valeur) return;
  try {
    const payload: SessionPaiementCopiee = { sessionId: valeur, at: new Date().toISOString() };
    localStorage.setItem(CLE, JSON.stringify(payload));
    window.dispatchEvent(new Event(SESSION_PAIEMENT_COPIEE_EVENT));
  } catch {
    /* stockage indisponible : l'identifiant n'est pas persistant */
  }
}

/** Oublie l'identifiant de session mémorisé. */
export function effacerSessionPaiementCopiee(): void {
  try {
    localStorage.removeItem(CLE);
    window.dispatchEvent(new Event(SESSION_PAIEMENT_COPIEE_EVENT));
  } catch {
    /* ignore */
  }
}