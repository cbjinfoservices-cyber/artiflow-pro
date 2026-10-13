/**
 * Mémoire du dernier export utilisé depuis le catalogue métier de la bibliothèque
 * de lignes : « Copier les épinglées » ou « Tout copier chez moi ». Elle permet de
 * proposer un raccourci « Reprendre » en un clic au retour sur la page. Simple
 * préférence locale, sans aucun impact sur les données en base.
 */

/** Type d'export groupé depuis le catalogue. */
export type TypeExportLignes = "epinglees" | "tout";

/** Dernier export mémorisé (type, nombre de lignes importées, date). */
export interface DernierExportLignes {
  type: TypeExportLignes;
  nombre: number;
  date: string;
}

const KEY = "artiflow:biblio:lignes:dernierExport";

/** Libellé lisible d'un type d'export. */
export function libelleExportLignes(type: TypeExportLignes): string {
  return type === "epinglees" ? "Copier les épinglées" : "Tout copier chez moi";
}

/** Relit le dernier export mémorisé (ou null si aucun). */
export function lireDernierExportLignes(): DernierExportLignes | null {
  try {
    const brut = window.localStorage.getItem(KEY);
    if (!brut) return null;
    const parsed = JSON.parse(brut) as Partial<DernierExportLignes>;
    if (parsed?.type !== "epinglees" && parsed?.type !== "tout") return null;
    return {
      type: parsed.type,
      nombre: Number(parsed.nombre) || 0,
      date: typeof parsed.date === "string" ? parsed.date : "",
    };
  } catch {
    return null;
  }
}

/** Mémorise le dernier export utilisé. */
export function ecrireDernierExportLignes(valeur: DernierExportLignes): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(valeur));
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}

/** Oublie le dernier export mémorisé. */
export function effacerDernierExportLignes(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* Stockage indisponible : on ignore. */
  }
}