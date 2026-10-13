export type Parcours = {
  slug: string;
  name: string;
  icon: string;
  niveau: string;
  description: string;
  articleSlugs: string[];
  /** Visuel de partage social (Open Graph / Twitter) dédié au parcours. */
  shareImage: string;
};

/**
 * Parcours guidés : des collections ordonnées de guides qui s'enchaînent
 * logiquement. La progression est déduite du suivi de lecture local.
 */
export const parcours: Parcours[] = [
  {
    slug: "premiers-pas",
    name: "Premiers pas avec ArtiFlow-pro",
    icon: "ri-rocket-line",
    niveau: "Débutant",
    description:
      "Le socle à maîtriser quand on démarre : rédiger un devis complet, organiser ses chantiers et relancer un client au bon moment.",
    articleSlugs: [
      "devis-chaudiere-en-5-minutes",
      "organiser-chantiers-par-zone",
      "relance-apres-depannage-urgent",
      "messages-relance-devis-electricite",
    ],
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20a%20beginner%20guided%20path%20in%20construction%20software%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20winding%20path%20with%20numbered%20stepping%20stones%20and%20tool%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-parcours-premiers-pas-n1&orientation=landscape",
  },
  {
    slug: "chiffrer-sans-perdre-de-marge",
    name: "Chiffrer sans perdre de marge",
    icon: "ri-scales-3-line",
    niveau: "Intermédiaire",
    description:
      "Les postes qu'on oublie et les métrés qu'on bâcle : cinq guides pour des devis qui tiennent, du premier coup.",
    articleSlugs: [
      "devis-mise-aux-normes-postes-oublies",
      "calculer-reserve-chutes-carrelage",
      "devis-peinture-au-m2-methode-simple",
      "devis-faux-plafond-sans-erreur",
      "devis-salle-de-bain-structurer",
    ],
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20estimating%20construction%20work%20without%20losing%20margin%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20balance%20scale%2C%20calculator%20and%20blueprint%20silhouettes%2C%20thin%20grid%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-parcours-chiffrage-n1&orientation=landscape",
  },
  {
    slug: "relancer-et-conclure",
    name: "Relancer et conclure",
    icon: "ri-hand-coin-line",
    niveau: "Intermédiaire",
    description:
      "Un devis envoyé n'est pas un devis signé. Ces guides vous donnent le bon rythme, le bon canal et les bons messages.",
    articleSlugs: [
      "relance-apres-depannage-urgent",
      "messages-relance-devis-electricite",
      "pourquoi-devis-facade-partent-trop-tard",
      "suivre-commande-sur-mesure-du-devis-a-la-pose",
    ],
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20following%20up%20quotes%20and%20closing%20deals%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20paper%20plane%2C%20envelope%20and%20handshake%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-parcours-relances-n1&orientation=landscape",
  },
];

/** Retrouve un parcours par son slug. */
export function getParcours(slug?: string): Parcours | undefined {
  return parcours.find((p) => p.slug === slug);
}