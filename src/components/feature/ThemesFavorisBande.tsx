import { Link } from "react-router-dom";
import { sujets, type Sujet } from "@/mocks/sujets";
import { sujetDateRecente } from "@/mocks/ressources";
import BadgeNouveau from "@/components/base/BadgeNouveau";
import { basculerThemeFavori, effacerThemesFavoris, themesEnAvant } from "@/lib/themesFavoris";
import { useThemesFavoris } from "@/hooks/useThemesFavoris";

type ThemesFavorisBandeProps = {
  /** Referme le déroulant après un clic sur un thème (sans effet sur une page). */
  onNavigate?: () => void;
  /** Affiche l'intitulé « Les plus consultés » (masquable quand un titre de section est fourni). */
  showLabel?: boolean;
  /** Classes additionnelles portées par le conteneur. */
  className?: string;
  /**
   * Slugs de thèmes à afficher en plus des épinglés et des plus consultés
   * (ex. « Sécurité du compte », mis en avant en permanence sur le hub).
   */
  themesSupplementaires?: string[];
};

/**
 * Bande « Les plus consultés » : elle met en tête les thèmes épinglés par
 * l'utilisateur, puis les thèmes les plus parcourus par défaut. Un bouton dédié
 * sur chaque pilule permet d'épingler ou de retirer un thème, et un bouton
 * « Tout désépingler » (visible seulement quand des thèmes sont épinglés)
 * remet la bande à zéro d'un seul clic.
 */
export default function ThemesFavorisBande({
  onNavigate,
  showLabel = true,
  className = "",
  themesSupplementaires = [],
}: ThemesFavorisBandeProps) {
  const favoris = useThemesFavoris();
  const themes = themesEnAvant(favoris);

  // Ajoute les thèmes « toujours visibles » demandés, sans doublon avec les
  // thèmes épinglés ou les plus consultés déjà listés.
  const slugsAffiches = new Set(themes.map((t) => t.sujet.slug));
  const themesEnPlus = themesSupplementaires
    .map((slug) => sujets.find((s) => s.slug === slug))
    .filter((s): s is Sujet => Boolean(s) && !slugsAffiches.has((s as Sujet).slug))
    .map((sujet) => ({ sujet, epingle: false }));
  const liste = [...themes, ...themesEnPlus];

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${
        showLabel ? "px-2 pt-1 pb-2.5 mb-1 border-b border-background-200" : ""
      } ${className}`}
    >
      {showLabel && (
        <span className="inline-flex items-center gap-1 mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
          <i className="ri-star-line text-accent-500"></i>
          Les plus consultés
        </span>
      )}
      {liste.map(({ sujet, epingle }) => {
        const dateNouveau = sujetDateRecente(sujet.slug);
        return (
        <span
          key={sujet.slug}
          className={`inline-flex items-center h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            epingle ? "bg-accent-100 text-accent-900" : "bg-secondary-100 text-secondary-900"
          }`}
        >
          <Link
            to={`/ressources/sujets#sujet-${sujet.slug}`}
            onClick={onNavigate}
            className="inline-flex items-center gap-1.5 h-full pl-1.5 pr-1.5 cursor-pointer"
          >
            <span
              className={`w-6 h-6 flex items-center justify-center rounded-full text-background-50 ${
                epingle ? "bg-accent-500" : "bg-secondary-500"
              }`}
            >
              <i className={`${sujet.icon} text-[13px]`}></i>
            </span>
            {sujet.name}
            <BadgeNouveau dateISO={dateNouveau} compact />
          </Link>
          <button
            type="button"
            onClick={() => basculerThemeFavori(sujet.slug)}
            aria-pressed={epingle}
            aria-label={
              epingle
                ? `Retirer ${sujet.name} des thèmes épinglés`
                : `Épingler ${sujet.name} en tête des plus consultés`
            }
            title={epingle ? "Retirer ce thème épinglé" : "Épingler ce thème"}
            className={`inline-flex items-center justify-center w-7 h-7 mr-0.5 rounded-full cursor-pointer transition-colors ${
              epingle ? "text-accent-700 hover:bg-accent-200" : "text-secondary-600 hover:bg-secondary-200"
            }`}
          >
            <i className={epingle ? "ri-pushpin-fill" : "ri-pushpin-line"}></i>
          </button>
        </span>
        );
      })}

      {favoris.length > 0 && (
        <button
          type="button"
          onClick={effacerThemesFavoris}
          title="Retirer tous les thèmes épinglés"
          className="ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-background-100 text-foreground-600 hover:bg-background-200 hover:text-foreground-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors"
        >
          <i className="ri-pushpin-2-line"></i>
          Tout désépingler
        </button>
      )}
    </div>
  );
}