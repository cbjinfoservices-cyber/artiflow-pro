/** Tri actif de la liste des factures (mémorisé dans l'URL via ?tri=). */
export type TriFacture =
  | ""
  | "date-desc"
  | "date-asc"
  | "montant-desc"
  | "montant-asc"
  | "client-asc"
  | "client-desc"
  | "echeance-asc";

export const TRIS_FACTURES_VALIDES: TriFacture[] = [
  "date-desc",
  "date-asc",
  "montant-desc",
  "montant-asc",
  "client-asc",
  "client-desc",
  "echeance-asc",
];

/** Valide le tri lu depuis l'URL (?tri=date-desc, montant-asc, client-asc…). */
export function parseTriFacture(raw: string | null): TriFacture {
  return raw && (TRIS_FACTURES_VALIDES as string[]).includes(raw) ? (raw as TriFacture) : "";
}

/** Libellé lisible du tri actif, affiché dans la bannière de vue filtrée. */
export function triFactureLabel(tri: TriFacture): string {
  switch (tri) {
    case "date-desc":
      return "récentes d'abord";
    case "date-asc":
      return "anciennes d'abord";
    case "montant-desc":
      return "montant décroissant";
    case "montant-asc":
      return "montant croissant";
    case "client-asc":
      return "client (A → Z)";
    case "client-desc":
      return "client (Z → A)";
    case "echeance-asc":
      return "échéance la plus proche";
    default:
      return "";
  }
}