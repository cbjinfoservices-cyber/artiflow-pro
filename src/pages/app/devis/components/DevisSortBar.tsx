import type { TriDevis } from "@/lib/devisTri";

type DevisSortBarProps = {
  /** Tri actif de la liste. */
  tri: TriDevis;
  /** Applique un nouveau tri (utilise "" pour retirer le tri actif). */
  onSort: (next: TriDevis) => void;
  /** Classes supplémentaires optionnelles (espacement, largeur…). */
  className?: string;
};

/**
 * Barre de tri réutilisable avec indicateurs (flèches de direction).
 * Pensée pour la vue empilée mobile, où l'en-tête de tableau n'est pas affiché :
 * on retrouve les mêmes colonnes triables (client, montant, groupe de statuts) avec la flèche qui
 * indique le sens actif et se met à jour au clic.
 */
export default function DevisSortBar({ tri, onSort, className = "" }: DevisSortBarProps) {
  // Calcule le tri suivant pour une colonne : ascendant → descendant → aucun.
  const suivant = (col: "client" | "montant" | "groupe"): TriDevis => {
    if (col === "client") return tri === "client-asc" ? "client-desc" : tri === "client-desc" ? "" : "client-asc";
    if (col === "montant") return tri === "montant-asc" ? "montant-desc" : tri === "montant-desc" ? "" : "montant-asc";
    return tri === "signes" ? "attente" : tri === "attente" ? "" : "signes";
  };

  // Flèche d'état : sens actif si la colonne est triée, icône double sinon.
  const fleche = (actif: boolean, ascendant: boolean) =>
    actif ? (ascendant ? "ri-sort-asc" : "ri-sort-desc") : "ri-arrow-up-down-line";

  const classe = (actif: boolean) =>
    `inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
      actif
        ? "bg-accent-100 text-accent-800 ring-1 ring-accent-300"
        : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
    }`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide whitespace-nowrap">
        <i className="ri-sort-asc"></i>
        Trier
      </span>
      <button
        type="button"
        onClick={() => onSort(suivant("client"))}
        className={classe(tri === "client-asc" || tri === "client-desc")}
        title="Trier par nom de client (croissant / décroissant)"
        aria-label="Trier par client"
      >
        Client
        <i className={fleche(tri === "client-asc" || tri === "client-desc", tri === "client-asc")}></i>
      </button>
      <button
        type="button"
        onClick={() => onSort(suivant("montant"))}
        className={classe(tri === "montant-asc" || tri === "montant-desc")}
        title="Trier par montant HT (croissant / décroissant)"
        aria-label="Trier par montant"
      >
        Montant
        <i className={fleche(tri === "montant-asc" || tri === "montant-desc", tri === "montant-asc")}></i>
      </button>
      <button
        type="button"
        onClick={() => onSort(suivant("groupe"))}
        className={classe(tri === "signes" || tri === "attente")}
        title="Trier par groupe de statuts (Signés / En attente)"
        aria-label="Trier par groupe de statuts"
      >
        Groupe
        <i className={fleche(tri === "signes" || tri === "attente", tri === "signes")}></i>
      </button>
      {tri && (
        <button
          type="button"
          onClick={() => onSort("")}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer text-foreground-500 hover:bg-background-200 hover:text-accent-700 transition-colors"
          title="Retirer le tri actif"
        >
          <i className="ri-close-line"></i>
          Retirer
        </button>
      )}
    </div>
  );
}