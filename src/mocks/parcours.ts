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
      "Les postes qu'on oublie et les métrés qu'on bâcle : cinq guides concrets pour des devis qui tiennent, du premier coup, sans rogner votre marge.",
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
    slug: "devis-et-paiement",
    name: "Devis et paiement",
    icon: "ri-money-euro-circle-line",
    niveau: "Intermédiaire",
    description:
      "Du chiffrage à l'argent encaissé : les métrés, les postes oubliés, l'acompte à la signature et sa rédaction sur le devis. Six guides pour un devis juste et payé.",
    articleSlugs: [
      "devis-mise-aux-normes-postes-oublies",
      "calculer-reserve-chutes-carrelage",
      "devis-peinture-au-m2-methode-simple",
      "devis-faux-plafond-sans-erreur",
      "devis-salle-de-bain-structurer",
      "acompte-ou-arrhes-devis",
    ],
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20quotes%20and%20deposit%20payments%20for%20building%20tradespeople%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20quote%20sheet%20with%20percentage%20badge%2C%20euro%20coin%20and%20handshake%20silhouettes%2C%20thin%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-parcours-devis-paiement-n1&orientation=landscape",
  },
  {
    slug: "facturation-et-relances",
    name: "Facturation et relances",
    icon: "ri-bill-line",
    niveau: "Intermédiaire",
    description:
      "De la signature au règlement : acompte, jalons et échéances d'une commande, puis les relances qui transforment un devis en argent encaissé.",
    articleSlugs: [
      "acompte-ou-arrhes-devis",
      "suivre-commande-sur-mesure-du-devis-a-la-pose",
      "relance-apres-depannage-urgent",
      "messages-relance-devis-electricite",
      "pourquoi-devis-facade-partent-trop-tard",
    ],
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20invoicing%20and%20payment%20follow-ups%20for%20building%20contractors%2C%20abstract%20invoice%20sheet%20with%20a%20euro%20coin%2C%20calendar%20markers%20and%20envelope%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20over%20a%20deep%20charcoal%20background%2C%20thin%20blueprint%20lines%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-parcours-facturation-relances-n1&orientation=landscape",
  },
  {
    slug: "relancer-et-conclure",
    name: "Relancer et conclure",
    icon: "ri-hand-coin-line",
    niveau: "Intermédiaire",
    description:
      "Un devis envoyé n'est pas un devis signé : ces guides donnent le bon rythme, le bon canal et les bons messages pour conclure sans forcer.",
    articleSlugs: [
      "relance-apres-depannage-urgent",
      "messages-relance-devis-electricite",
      "pourquoi-devis-facade-partent-trop-tard",
      "suivre-commande-sur-mesure-du-devis-a-la-pose",
    ],
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20following%20up%20quotes%20and%20closing%20deals%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20paper%20plane%2C%20envelope%20and%20handshake%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-parcours-relances-n1&orientation=landscape",
  },
  {
    slug: "devis-climatisation",
    name: "Devis climatisation",
    icon: "ri-temp-cold-line",
    niveau: "Intermédiaire",
    description:
      "Deux étapes pour transformer une visite technique en chantier signé : chiffrer la pose sans oublier un poste, puis relancer le devis au bon rythme, sans laisser filer le dossier.",
    articleSlugs: [
      "chiffrer-pose-split-climatisation",
      "relancer-devis-pompe-a-chaleur",
    ],
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20an%20air%20conditioning%20quote%20guided%20path%2C%20a%20wall%20mounted%20split%20unit%20and%20a%20heat%20pump%20silhouette%20connected%20by%20a%20dotted%20path%20with%20numbered%20steps%2C%20a%20document%20sheet%20and%20message%20bubbles%2C%20cool%20teal%20and%20warm%20amber%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-parcours-devis-climatisation&orientation=landscape",
  },
  {
    slug: "facturer-et-transmettre",
    name: "Facturer et transmettre",
    icon: "ri-send-plane-line",
    niveau: "Intermédiaire",
    description:
      "Trois étapes pour transformer un chantier terminé en argent encaissé, puis en revenu récurrent : comprendre ce que la facture électronique change vraiment, sécuriser la somme demandée à la signature, et vendre le contrat d'entretien annuel qui fait revenir le client.",
    articleSlugs: [
      "facture-electronique-ce-qui-change-artisan",
      "acompte-ou-arrhes-devis",
      "contrat-entretien-climatisation",
    ],
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20a%20guided%20path%20about%20invoicing%2C%20sending%20electronic%20invoices%20and%20yearly%20maintenance%20contracts%2C%20a%20quote%20sheet%20and%20an%20invoice%20sheet%20connected%20by%20a%20dotted%20path%20with%20numbered%20steps%2C%20a%20maintenance%20calendar%20and%20a%20recurring%20circular%20arrow%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20thin%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-parcours-facturer-transmettre-recurrent&orientation=landscape",
  },
];

/** Retrouve un parcours par son slug. */
export function getParcours(slug?: string): Parcours | undefined {
  return parcours.find((p) => p.slug === slug);
}