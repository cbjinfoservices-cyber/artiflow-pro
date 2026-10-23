export type TriPro = "nom" | "ca";

interface Props {
  secteurs: string[];
  secteur: string;
  onSecteurChange: (secteur: string) => void;
  tri: TriPro;
  onTriChange: (tri: TriPro) => void;
  /** Filtre « fiche pro incomplète » (SIRET, interlocuteur ou secteur manquant). */
  incomplet: boolean;
  onIncompletChange: (incomplet: boolean) => void;
  /** Nombre de fiches pro auxquelles il manque au moins une information. */
  nbIncomplets: number;
}

/**
 * Barre de filtres propre à la vue professionnels : secteur d'activité et tri.
 * Le tri par CA n'a de sens que côté entreprises, c'est pourquoi il n'apparaît pas dans « Tous ».
 */
export default function ClientsProFiltres({
  secteurs,
  secteur,
  onSecteurChange,
  tri,
  onTriChange,
  incomplet,
  onIncompletChange,
  nbIncomplets,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {secteurs.length > 0 && (
        <div className="relative">
          <i className="ri-price-tag-3-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
          <select
            value={secteur}
            onChange={(e) => onSecteurChange(e.target.value)}
            aria-label="Filtrer par secteur d'activité"
            className="h-9 pl-9 pr-9 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
          >
            <option value="">Tous les secteurs</option>
            {secteurs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
        <button
          type="button"
          onClick={() => onTriChange("nom")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            tri === "nom" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
          }`}
        >
          <i className="ri-sort-asc"></i>
          Nom
        </button>
        <button
          type="button"
          onClick={() => onTriChange("ca")}
          title="Trier les entreprises par chiffre d'affaires décroissant"
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            tri === "ca" ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
          }`}
        >
          <i className="ri-sort-desc"></i>
          CA décroissant
        </button>
      </div>

      <button
        type="button"
        onClick={() => onIncompletChange(!incomplet)}
        aria-pressed={incomplet}
        disabled={nbIncomplets === 0}
        title={
          nbIncomplets === 0
            ? "Toutes vos fiches pro sont complètes (SIRET, interlocuteur et secteur renseignés)"
            : "Isoler les fiches pro auxquelles il manque au moins une information : SIRET, interlocuteur ou secteur"
        }
        className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors ${
          nbIncomplets === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${
          incomplet
            ? "bg-secondary-500 border-secondary-500 text-background-50"
            : "bg-background-100 border-background-200 text-foreground-700 hover:border-secondary-300"
        }`}
      >
        <i className="ri-error-warning-line"></i>
        Fiche incomplète
        <span
          className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${
            incomplet ? "bg-background-50/25 text-background-50" : "bg-secondary-100 text-secondary-800"
          }`}
        >
          {nbIncomplets}
        </span>
      </button>
    </div>
  );
}