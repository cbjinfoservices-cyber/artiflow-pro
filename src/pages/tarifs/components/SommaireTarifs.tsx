import PageSectionNav, { type PageSection } from "@/components/feature/PageSectionNav";
import { estNouveau } from "@/lib/dates";
import { nouveautes } from "@/mocks/nouveautes";

// Identifiant de l'annonce mise en avant dans les mocks (personnalisation des documents).
const ANNONCE_ID = "personnalisation-documents";
// Ancre dédiée à la bannière « Annonce à la une » sur la page Tarifs.
const ANNONCE_ANCRE = "annonce";

/** Construit le sommaire de la page Tarifs, en tête duquel on glisse l'annonce à la une
 * tant qu'elle est fraîche (moins de 7 jours), pour y accéder d'un clic depuis n'importe où. */
function sectionsTarifs(): PageSection[] {
  const sections: PageSection[] = [{ id: "offres", label: "Offres", icon: "ri-price-tag-3-line" }];

  const annonce = nouveautes.find((n) => n.id === ANNONCE_ID);
  if (annonce?.lien && estNouveau(annonce.dateIso, 7)) {
    sections.push({ id: ANNONCE_ANCRE, label: "Annonce à la une", icon: "ri-megaphone-line" });
  }

  sections.push(
    { id: "documents", label: "À votre image", icon: "ri-palette-line" },
    { id: "recap-12-mois", label: "Mensuel ou annuel", icon: "ri-calendar-2-line" },
    { id: "calculatrice-roi", label: "Retour sur investissement", icon: "ri-line-chart-line" },
    { id: "comparatif", label: "Comparatif", icon: "ri-list-check-2" },
    { id: "metiers", label: "Selon votre métier", icon: "ri-hammer-line" },
    { id: "simulateur", label: "Simulateur équipe", icon: "ri-team-line" },
    { id: "faq", label: "FAQ", icon: "ri-question-answer-line" }
  );

  return sections;
}

export default function SommaireTarifs() {
  return <PageSectionNav sections={sectionsTarifs()} ariaLabel="Sommaire de la page tarifs" />;
}