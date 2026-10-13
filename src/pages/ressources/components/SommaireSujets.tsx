import { useMemo } from "react";
import { sujets } from "@/mocks/sujets";
import { ordonnerSujetsParFavoris } from "@/lib/themesFavoris";
import { useThemesFavoris } from "@/hooks/useThemesFavoris";
import PageSectionNav, { type PageSection } from "@/components/feature/PageSectionNav";

export default function SommaireSujets() {
  const favoris = useThemesFavoris();
  // Le sommaire suit le même ordre que les sections (thèmes épinglés d'abord).
  const sections: PageSection[] = useMemo(
    () =>
      ordonnerSujetsParFavoris(sujets, favoris).map((sujet) => ({
        id: `sujet-${sujet.slug}`,
        label: sujet.name,
        icon: sujet.icon,
      })),
    [favoris]
  );

  return <PageSectionNav sections={sections} ariaLabel="Sommaire des thèmes d'articles" />;
}