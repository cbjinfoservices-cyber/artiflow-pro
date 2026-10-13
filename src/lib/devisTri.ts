/** Tri actif de la liste des devis (mémorisé dans l'URL via ?tri=). */
export type TriDevis = "" | "signes" | "attente" | "client-asc" | "client-desc" | "montant-asc" | "montant-desc";

export const TRIS_VALIDES: TriDevis[] = ["signes", "attente", "client-asc", "client-desc", "montant-asc", "montant-desc"];

/** Valide le tri lu depuis l'URL (?tri=signes, client-asc, montant-desc…). */
export function parseTri(raw: string | null): TriDevis {
  return raw && (TRIS_VALIDES as string[]).includes(raw) ? (raw as TriDevis) : "";
}

/** Libellé lisible du tri actif, affiché dans le mini-récapitulatif sous la barre de filtres. */
export function triLabel(tri: TriDevis): string {
  switch (tri) {
    case "signes":
      return "triés par groupe, signés d'abord";
    case "attente":
      return "triés par groupe, en attente d'abord";
    case "client-asc":
      return "triés par client (A → Z)";
    case "client-desc":
      return "triés par client (Z → A)";
    case "montant-asc":
      return "triés par montant croissant";
    case "montant-desc":
      return "triés par montant décroissant";
    default:
      return "";
  }
}