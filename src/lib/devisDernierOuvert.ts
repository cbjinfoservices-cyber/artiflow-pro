/** Devis le plus récemment ouvert par l'artisan (préférence locale, non partagée). */
export interface DernierDevisOuvert {
  id: number;
  numero: string;
  objet: string | null;
  /** Date ISO de la dernière ouverture, pour un éventuel affichage « il y a x jours ». */
  at: string;
}

const CLE = "artiflow_dernier_devis_ouvert";

/** Relit le dernier devis ouvert depuis la mémoire locale, ou null si rien de valide. */
export function lireDernierDevis(): DernierDevisOuvert | null {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DernierDevisOuvert>;
    if (typeof parsed?.id !== "number" || !Number.isFinite(parsed.id)) return null;
    return {
      id: parsed.id,
      numero: typeof parsed.numero === "string" ? parsed.numero : "",
      objet: typeof parsed.objet === "string" ? parsed.objet : null,
      at: typeof parsed.at === "string" ? parsed.at : "",
    };
  } catch {
    return null;
  }
}

/** Mémorise le devis qui vient d'être ouvert (id, numéro, objet). */
export function memoriserDernierDevis(d: { id: number; numero: string; objet: string | null }): void {
  try {
    const payload: DernierDevisOuvert = {
      id: d.id,
      numero: d.numero,
      objet: d.objet,
      at: new Date().toISOString(),
    };
    localStorage.setItem(CLE, JSON.stringify(payload));
  } catch {
    /* préférence non persistée : l'app reste utilisable */
  }
}

/** Oublie le dernier devis mémorisé (retire le raccourci « Reprendre »). */
export function effacerDernierDevis(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* ignore */
  }
}

/**
 * Libellé d'ancienneté du dernier devis ouvert, à partir de sa date de mémorisation :
 * « ouvert aujourd'hui », « ouvert hier », « ouvert il y a 3 jours », « il y a 2 mois »…
 * Renvoie null si la date est absente ou invalide.
 */
export function ancienneteDevisOuvert(at: string): string | null {
  if (!at) return null;
  const date = new Date(at);
  const t = date.getTime();
  if (Number.isNaN(t)) return null;
  const jours = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (jours <= 0) return "ouvert aujourd'hui";
  if (jours === 1) return "ouvert hier";
  if (jours < 30) return `ouvert il y a ${jours} jours`;
  const mois = Math.floor(jours / 30);
  if (mois < 12) return `ouvert il y a ${mois} mois`;
  const ans = Math.floor(mois / 12);
  return `ouvert il y a ${ans} an${ans > 1 ? "s" : ""}`;
}