import type { ReactNode } from "react";
import { formatEuros } from "@/lib/format";

/**
 * Carte d'une ligne de désignation dans la bibliothèque : désignation, unité,
 * catégorie, prix unitaire et TVA, avec une zone d'actions optionnelle.
 */
export default function LigneItem({
  designation,
  unite,
  prix,
  taux,
  categorie,
  origine,
  favori = false,
  dejaImportee = false,
  actions,
  dragHandle,
}: {
  designation: string;
  unite: string;
  prix: number;
  taux: number;
  categorie: string;
  origine: "perso" | "catalogue";
  /** Ligne épinglée : affiche une pastille et remonte en tête de catégorie. */
  favori?: boolean;
  /** Ligne du catalogue déjà présente dans « Mes lignes » : affiche une pastille de repérage. */
  dejaImportee?: boolean;
  actions?: ReactNode;
  /** Poignée optionnelle de glisser-déposer affichée en tête de carte. */
  dragHandle?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg bg-background-100 border border-background-200 hover:border-primary-200 transition-colors">
      {dragHandle && <div className="shrink-0 flex items-center justify-center">{dragHandle}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {favori && (
            <span className="shrink-0 mt-0.5 inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold whitespace-nowrap">
              <i className="ri-pushpin-2-fill text-[10px]"></i> Épinglée
            </span>
          )}
          <p className="text-sm font-semibold text-foreground-950 leading-snug">{designation}</p>
          {origine === "catalogue" && (
            <span className="shrink-0 mt-0.5 inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold whitespace-nowrap">
              <i className="ri-book-2-line"></i> Catalogue
            </span>
          )}
          {dejaImportee && (
            <span
              className="shrink-0 mt-0.5 inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap"
              title="Cette ligne est déjà présente dans vos propres lignes"
            >
              <i className="ri-checkbox-circle-line"></i> Déjà dans Mes lignes
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-price-tag-3-line text-[11px]"></i>
            {categorie}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-foreground-500 whitespace-nowrap">
            <i className="ri-ruler-line"></i>
            {unite}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <p className="text-sm font-bold text-foreground-950 whitespace-nowrap">{formatEuros(prix)}</p>
          <p className="text-[11px] text-foreground-500 whitespace-nowrap">
            HT · TVA {String(taux).replace(".", ",")} %
          </p>
        </div>
        {actions}
      </div>
    </div>
  );
}