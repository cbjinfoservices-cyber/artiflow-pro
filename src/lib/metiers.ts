export const METIERS = [
  { value: "plombier-chauffagiste", label: "Plombier chauffagiste" },
  { value: "electricien", label: "Électricien" },
  { value: "macon", label: "Maçon" },
  { value: "peintre", label: "Peintre" },
  { value: "menuisier", label: "Menuisier" },
  { value: "carreleur", label: "Carreleur" },
  { value: "couvreur", label: "Couvreur" },
  { value: "installateur-climatisation", label: "Frigoriste / climaticien" },
  { value: "autre", label: "Autre métier" },
] as const;

/** Retourne le libellé lisible d'un métier à partir de sa clé stockée. */
export function metierLabel(value: string | null | undefined): string {
  if (!value) return "";
  const found = METIERS.find((m) => m.value === value);
  return found ? found.label : value;
}