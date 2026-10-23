export const TYPES_CLIENTS = ["Tous", "Particuliers", "Professionnels"] as const;
export type TypeClientFiltre = (typeof TYPES_CLIENTS)[number];

interface Props {
  valeur: string;
  onChanger: (type: TypeClientFiltre) => void;
  nbParticuliers: number;
  nbEntreprises: number;
}

/**
 * Filtre de type du carnet : Tous / Particuliers / Professionnels.
 *
 * Chaque pastille porte son compteur, et un rappel discret à côté résume la répartition
 * (X entreprises / Y particuliers) pour qu'on sache ce qu'on va trouver avant de cliquer.
 */
export default function ClientsFiltreType({
  valeur,
  onChanger,
  nbParticuliers,
  nbEntreprises,
}: Props) {
  const compteurs: Record<TypeClientFiltre, number> = {
    Tous: nbParticuliers + nbEntreprises,
    Particuliers: nbParticuliers,
    Professionnels: nbEntreprises,
  };

  const descriptions: Record<TypeClientFiltre, string> = {
    Tous: `${compteurs.Tous} fiche${compteurs.Tous > 1 ? "s" : ""} au total`,
    Particuliers: `${nbParticuliers} particulier${nbParticuliers > 1 ? "s" : ""}`,
    Professionnels: `${nbEntreprises} entreprise${nbEntreprises > 1 ? "s" : ""}`,
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
        {TYPES_CLIENTS.map((t) => {
          const actif = valeur === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChanger(t)}
              aria-pressed={actif}
              title={`Afficher : ${descriptions[t]}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                actif ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {t}
              <span
                className={`inline-flex items-center justify-center min-w-5 h-4 px-1 rounded-full text-[10px] font-bold ${
                  actif ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                }`}
              >
                {compteurs[t]}
              </span>
            </button>
          );
        })}
      </div>
      <span
        className="inline-flex items-center gap-1 text-[11px] text-foreground-500 whitespace-nowrap"
        title="Répartition du carnet entre entreprises et particuliers"
      >
        <i className="ri-building-2-line text-accent-600"></i>
        {nbEntreprises} entreprise{nbEntreprises > 1 ? "s" : ""}
        <span className="text-foreground-300">/</span>
        <i className="ri-user-line text-secondary-700"></i>
        {nbParticuliers} particulier{nbParticuliers > 1 ? "s" : ""}
      </span>
    </div>
  );
}