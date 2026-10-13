import PageSectionNav, { type PageSection } from "@/components/feature/PageSectionNav";

const SECTIONS: PageSection[] = [
  { id: "offres", label: "Offres", icon: "ri-price-tag-3-line" },
  { id: "recap-12-mois", label: "Mensuel ou annuel", icon: "ri-calendar-2-line" },
  { id: "calculatrice-roi", label: "Retour sur investissement", icon: "ri-line-chart-line" },
  { id: "comparatif", label: "Comparatif", icon: "ri-list-check-2" },
  { id: "simulateur", label: "Simulateur équipe", icon: "ri-team-line" },
  { id: "faq", label: "FAQ", icon: "ri-question-answer-line" },
];

export default function SommaireTarifs() {
  return <PageSectionNav sections={SECTIONS} ariaLabel="Sommaire de la page tarifs" />;
}