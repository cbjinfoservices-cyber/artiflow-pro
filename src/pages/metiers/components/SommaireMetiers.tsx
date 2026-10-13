import PageSectionNav, { type PageSection } from "@/components/feature/PageSectionNav";

const SECTIONS: PageSection[] = [
  { id: "metiers", label: "Tous les métiers", icon: "ri-tools-line" },
  { id: "pourquoi", label: "Pourquoi ça marche", icon: "ri-sparkling-2-line" },
  { id: "faq", label: "FAQ", icon: "ri-question-answer-line" },
];

export default function SommaireMetiers() {
  return <PageSectionNav sections={SECTIONS} ariaLabel="Sommaire de la page métiers" />;
}