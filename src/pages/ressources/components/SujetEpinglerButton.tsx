import { basculerThemeFavori } from "@/lib/themesFavoris";
import { useThemeFavori } from "@/hooks/useThemesFavoris";

type SujetEpinglerButtonProps = {
  /** Slug du thème à épingler. */
  slug: string;
  /** Nom du thème, utilisé dans les libellés accessibles. */
  name: string;
};

/**
 * Bouton d'épinglage d'un thème : une fois épinglé, le thème remonte en tête de
 * la page « Par sujet » et dans la bande « Les plus consultés » des déroulants.
 */
export default function SujetEpinglerButton({ slug, name }: SujetEpinglerButtonProps) {
  const epingle = useThemeFavori(slug);

  return (
    <button
      type="button"
      onClick={() => basculerThemeFavori(slug)}
      aria-pressed={epingle}
      title={epingle ? `Retirer ${name} des thèmes épinglés` : `Épingler ${name} en tête`}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
        epingle
          ? "bg-accent-500 text-background-50 border-accent-500"
          : "bg-background-50 text-foreground-600 border-background-200 hover:border-accent-300 hover:text-accent-700"
      }`}
    >
      <i className={epingle ? "ri-pushpin-fill" : "ri-pushpin-line"}></i>
      {epingle ? "Épinglé" : "Épingler"}
    </button>
  );
}