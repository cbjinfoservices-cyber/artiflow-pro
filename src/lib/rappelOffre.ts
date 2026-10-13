export type Facturation = "mensuel" | "annuel";

export type RappelOffre = {
  offre: string;
  facturation: Facturation;
  date: string;
};

const STORAGE_KEY = "artiflow.abonnement.rappelOffre";

/**
 * Mémorise l'offre pour laquelle l'utilisateur a demandé à être prévenu.
 * Sert uniquement à afficher un bandeau de rappel dans son espace.
 */
export function enregistrerRappelOffre(offre: string, facturation: Facturation): void {
  if (!offre) return;
  try {
    const payload: RappelOffre = { offre, facturation, date: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* stockage indisponible */
  }
}

export function lireRappelOffre(): RappelOffre | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RappelOffre>;
    if (!parsed || typeof parsed.offre !== "string") return null;
    const facturation: Facturation = parsed.facturation === "annuel" ? "annuel" : "mensuel";
    return { offre: parsed.offre, facturation, date: parsed.date ?? "" };
  } catch {
    return null;
  }
}

export function effacerRappelOffre(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible */
  }
}