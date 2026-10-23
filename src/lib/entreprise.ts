/**
 * Profil d'entreprise de l'artisan — deux informations collectées à l'inscription :
 *
 * 1. `STATUTS_JURIDIQUES` : la forme juridique de l'entreprise (auto-entrepreneur,
 *    EI, EURL, SARL, SASU/SAS).
 * 2. `TAILLES_ENTREPRISE` : le nombre de personnes qui travaillent dans l'entreprise.
 *
 * Les valeurs (`value`) sont stockées telles quelles dans la colonne `profiles`.
 * Les libellés (`label`) sont ceux affichés à l'artisan.
 */

export const STATUTS_JURIDIQUES = [
  { value: "auto-entrepreneur", label: "Auto-entrepreneur / Micro-entreprise" },
  { value: "entreprise-individuelle", label: "Entreprise individuelle (EI)" },
  { value: "eurl", label: "EURL" },
  { value: "sarl", label: "SARL" },
  { value: "sasu-sas", label: "SASU / SAS" },
] as const;

export const TAILLES_ENTREPRISE = [
  { value: "seul", label: "Je travaille seul" },
  { value: "2-5", label: "2 à 5 personnes" },
  { value: "6-20", label: "6 à 20 personnes" },
  { value: "plus-20", label: "Plus de 20 personnes" },
] as const;

/** Libellé lisible d'un statut juridique à partir de sa clé stockée. */
export function statutJuridiqueLabel(value: string | null | undefined): string {
  if (!value) return "";
  const found = STATUTS_JURIDIQUES.find((s) => s.value === value);
  return found ? found.label : value;
}

/** Libellé lisible d'une taille d'entreprise à partir de sa clé stockée. */
export function tailleEntrepriseLabel(value: string | null | undefined): string {
  if (!value) return "";
  const found = TAILLES_ENTREPRISE.find((t) => t.value === value);
  return found ? found.label : value;
}