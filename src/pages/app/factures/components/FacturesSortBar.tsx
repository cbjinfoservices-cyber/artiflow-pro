import type { TriFacture } from "@/lib/facturesTri";

type FacturesSortBarProps = {
  /** Tri actif de la liste. */
  tri: TriFacture;
  /** Applique un nouveau tri (utilise "" pour retirer le tri actif). */
  onSort: (next: TriFacture) => void;
  /** Classes supplémentaires optionnelles (espacement, largeur…). */
  className?: string;
};

/**
 * Barre de tri réutilisable pour la liste des factures (date, montant, client, échéance).
 * Chaque bouton bascule ascendant → descendant → aucun, avec la flèche qui indique le sens actif.
 */
export default function FacturesSortBar({ tri, onSort, className = "" }: FacturesSortBarProps) {
  const suivantDate = (): TriFacture =>
    tri === "date-desc" ? "date-asc" : tri === "date-asc" ? "" : "date-desc";
  const suivantMontant = (): TriFacture =>
    tri === "montant-desc" ? "montant-asc" : tri === "montant-asc" ? "" : "montant-desc";
  const suivantClient = (): TriFacture =>
    tri === "client-asc" ? "client-desc" : tri === "client-desc" ? "" : "client-asc";

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
        onClick={() => onSort(suivantDate())}
        className={classe(tri === "date-desc" || tri === "date-asc")}
        title="Trier par date d'émission (récentes / anciennes d'abord)"
        aria-label="Trier par date"
      >
        Date
        <i className={fleche(tri === "date-desc" || tri === "date-asc", tri === "date-asc")}></i>
      </button>
      <button
        type="button"
        onClick={() => onSort(suivantMontant())}
        className={classe(tri === "montant-desc" || tri === "montant-asc")}
        title="Trier par montant TTC (croissant / décroissant)"
        aria-label="Trier par montant"
      >
        Montant
        <i className={fleche(tri === "montant-desc" || tri === "montant-asc", tri === "montant-asc")}></i>
      </button>
      <button
        type="button"
        onClick={() => onSort(suivantClient())}
        className={classe(tri === "client-asc" || tri === "client-desc")}
        title="Trier par nom de client (croissant / décroissant)"
        aria-label="Trier par client"
      >
        Client
        <i className={fleche(tri === "client-asc" || tri === "client-desc", tri === "client-asc")}></i>
      </button>
      <button
        type="button"
        onClick={() => onSort(tri === "echeance-asc" ? "" : "echeance-asc")}
        className={classe(tri === "echeance-asc")}
        title="Trier par échéance la plus proche"
        aria-label="Trier par échéance"
      >
        Échéance
        <i className={tri === "echeance-asc" ? "ri-sort-asc" : "ri-arrow-up-down-line"}></i>
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