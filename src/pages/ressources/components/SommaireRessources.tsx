import { metiers } from "@/mocks/metiers";
import { CATEGORIES_GUIDES_PRATIQUES } from "@/mocks/ressources";
import PageSectionNav, { type PageSection } from "@/components/feature/PageSectionNav";

const ICON_BY_SLUG: Record<string, string> = {
  "plombier-chauffagiste": "ri-water-flash-line",
  electricien: "ri-plug-2-line",
  macon: "ri-building-2-line",
  "peintre-finitions": "ri-paint-brush-line",
  menuisier: "ri-hammer-line",
  carreleur: "ri-layout-grid-line",
  couvreur: "ri-home-4-line",
  platrier: "ri-layout-4-line",
  "securite-du-compte": "ri-shield-keyhole-line",
};

/** Transforme une liste de slugs de catégories (métiers et guides pratiques) en sections de sommaire. */
export function categoriesToSections(slugs: string[]): PageSection[] {
  return slugs.map((slug) => {
    const metier = metiers.find((m) => m.slug === slug);
    const pratique = CATEGORIES_GUIDES_PRATIQUES[slug];
    return {
      id: slug,
      label: metier?.shortName ?? pratique?.shortName ?? slug,
      icon: ICON_BY_SLUG[slug] ?? "ri-tools-line",
    };
  });
}

export default function SommaireRessources({ sections }: { sections: PageSection[] }) {
  if (sections.length === 0) return null;
  return <PageSectionNav sections={sections} ariaLabel="Sommaire des catégories d'articles" />;
}