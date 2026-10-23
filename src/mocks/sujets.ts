export const sujets = [
  {
    slug: "chiffrage",
    name: "Chiffrage & devis",
    icon: "ri-calculator-line",
    description:
      "Bien chiffrer du premier coup : métrés, postes à ne pas oublier, prix au m² et variantes de matériaux. Les guides qui protègent votre marge et font envoyer le devis le jour même.",
    articleSlugs: [
      "devis-chaudiere-en-5-minutes",
      "devis-mise-aux-normes-postes-oublies",
      "chiffrer-extension-sans-erreur-metres",
      "devis-peinture-au-m2-methode-simple",
      "variantes-materiaux-dans-un-seul-devis",
      "calculer-reserve-chutes-carrelage",
      "devis-salle-de-bain-structurer",
      "devis-sinistre-assurance-clair",
      "devis-faux-plafond-sans-erreur",
      "chiffrer-pose-split-climatisation",
      "acompte-ou-arrhes-devis",
    ],
  },
  {
    slug: "relances",
    name: "Relances clients",
    icon: "ri-notification-3-line",
    description:
      "Le bon message, au bon moment, sur le bon canal. Comment transformer un devis envoyé en chantier signé, sans passer pour un vendeur insistant.",
    articleSlugs: [
      "relance-apres-depannage-urgent",
      "messages-relance-devis-electricite",
      "pourquoi-devis-facade-partent-trop-tard",
      "relancer-devis-pompe-a-chaleur",
      "contrat-entretien-climatisation",
    ],
  },
  {
    slug: "planning",
    name: "Planning & organisation",
    icon: "ri-calendar-2-line",
    description:
      "Organiser ses chantiers, regrouper les trajets et suivre chaque commande jusqu'à la pose : moins de trous dans l'agenda, plus de marge à la fin du mois.",
    articleSlugs: [
      "organiser-chantiers-par-zone",
      "suivre-commande-sur-mesure-du-devis-a-la-pose",
      "apres-orage-prioriser-urgences-toiture",
      "renovation-appartement-piece-par-piece",
    ],
  },
  {
    slug: "securite-du-compte",
    name: "Sécurité du compte",
    icon: "ri-shield-keyhole-line",
    description:
      "Protéger votre espace, c'est protéger vos devis, vos clients et vos factures. Un thème à part, sans jargon, pour choisir un bon mot de passe et garder la main sur votre compte.",
    articleSlugs: ["creer-mot-de-passe-solide"],
  },
  {
    slug: "facturation",
    name: "Facturation & règlement",
    icon: "ri-file-code-line",
    description:
      "De la facture au règlement : ce qui change avec la facture électronique, les mentions à ne pas oublier et les réflexes qui font rentrer l'argent plus vite.",
    articleSlugs: ["facture-electronique-ce-qui-change-artisan"],
  },
];

/** Un thème de ressources (chiffrage, relances, planning…). */
export type Sujet = (typeof sujets)[number];

/** Nombre de thèmes mis en avant comme « les plus consultés » dans la navigation. */
const POPULAIRES_NOMBRE = 2;

/**
 * Les thèmes les plus consultés, mis en avant en tête du déroulant
 * « Ressources ». Le volume de guides d'un thème sert d'indicateur : plus un
 * thème rassemble de guides, plus il est parcouru par les artisans.
 */
export const sujetsPopulaires = [...sujets]
  .sort((a, b) => b.articleSlugs.length - a.articleSlugs.length)
  .slice(0, POPULAIRES_NOMBRE);

/** Vrai si le thème fait partie des plus consultés. */
export function isSujetPopulaire(slug: string): boolean {
  return sujetsPopulaires.some((s) => s.slug === slug);
}