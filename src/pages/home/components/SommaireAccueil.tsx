import PageSectionNav, { type PageSection } from "@/components/feature/PageSectionNav";

/** Repères de la page d'accueil : un sommaire collant pour naviguer d'un bloc à l'autre. */
const SECTIONS: PageSection[] = [
  { id: "apercu", label: "L'application", icon: "ri-window-line" },
  { id: "nouveautes", label: "Nouveautés", icon: "ri-sparkling-2-line" },
  { id: "fonctionnalites", label: "Vos espaces", icon: "ri-apps-2-line" },
  { id: "avant-apres", label: "Bénéfices", icon: "ri-arrow-left-right-line" },
  { id: "workflow", label: "En 4 étapes", icon: "ri-route-line" },
  { id: "tarifs", label: "Tarifs", icon: "ri-price-tag-3-line" },
  { id: "simulateur", label: "Simulateur", icon: "ri-calculator-line" },
  { id: "avis", label: "Avis", icon: "ri-heart-3-line" },
  { id: "faq", label: "FAQ", icon: "ri-question-answer-line" },
  { id: "contact", label: "Démo", icon: "ri-calendar-check-line" },
];

export default function SommaireAccueil() {
  return <PageSectionNav sections={SECTIONS} ariaLabel="Sommaire de la page d'accueil" />;
}