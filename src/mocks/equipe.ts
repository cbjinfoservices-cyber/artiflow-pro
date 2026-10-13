import {
  IMAGE_PARTAGE_AUTEUR_ANTOINE,
  IMAGE_PARTAGE_AUTEUR_CAMILLE,
  IMAGE_PARTAGE_AUTEUR_JULIEN,
  IMAGE_PARTAGE_AUTEUR_KARIM,
  IMAGE_PARTAGE_AUTEUR_LEA,
  IMAGE_PARTAGE_AUTEUR_SOPHIE,
} from "@/lib/imagesPartage";

export type CategorieMembre =
  | "direction"
  | "technique"
  | "produit"
  | "data"
  | "relation"
  | "croissance";

export type MembreEquipe = {
  id: string;
  name: string;
  role: string;
  categorie: CategorieMembre;
  bio: string;
  photo: string;
  /** Visuel de partage social dédié (Open Graph / Twitter), format 1200×630. */
  shareImage?: string;
  tone: "primary" | "accent" | "secondary";
  linkedin: string;
  ville: string;
  depuis: string;
  expertises: string[];
  parcours: string[];
  citation: string;
};

export type ValeurEquipe = {
  icon: string;
  title: string;
  description: string;
  tone: "primary" | "accent" | "secondary";
};

export type EtapeHistoire = {
  year: string;
  title: string;
  description: string;
};

export const equipe: MembreEquipe[] = [
  {
    id: "lea-marchand",
    name: "Léa Marchand",
    role: "Cofondatrice & Directrice générale",
    categorie: "direction",
    bio: "Ancienne conductrice de travaux, Léa connaît le quotidien des artisans parce qu'elle l'a vécu. Elle veille à ce que chaque décision serve le terrain avant tout.",
    photo:
      "https://readdy.ai/api/search-image?query=Professional%20editorial%20portrait%20of%20a%20confident%20friendly%20French%20businesswoman%20in%20her%20forties%20with%20short%20dark%20hair%2C%20warm%20orange%20and%20deep%20teal%20accent%20lighting%2C%20clean%20warm%20neutral%20background%2C%20natural%20soft%20window%20light%2C%20modern%20corporate%20photography%2C%20shallow%20depth%20of%20field%2C%20high%20detail&width=600&height=750&seq=artiflow-team-lea&orientation=portrait",
    shareImage: IMAGE_PARTAGE_AUTEUR_LEA,
    tone: "primary",
    linkedin: "https://www.linkedin.com/company/artiflow-pro",
    ville: "Paris",
    depuis: "2023",
    expertises: ["Conduite de travaux", "Stratégie produit", "Relation artisans", "Second œuvre"],
    parcours: [
      "Dix ans en conduite de travaux sur des chantiers de rénovation et de second œuvre, du chiffrage à la réception.",
      "Cofonde ArtiFlow-pro après avoir vu trop d'artisans noyés sous l'administratif en fin de journée.",
      "Porte la vision produit au quotidien et garde un contact direct avec les artisans pilotes.",
    ],
    citation:
      "Un bon outil ne se remarque pas : il fait simplement gagner une heure à la fin de la journée.",
  },
  {
    id: "karim-benali",
    name: "Karim Benali",
    role: "Cofondateur & Directeur technique",
    categorie: "technique",
    bio: "Ingénieur logiciel, Karim transforme des idées ambitieuses en outils simples. Il passe son temps à rendre l'IA utile et discrète pour les artisans.",
    photo:
      "https://readdy.ai/api/search-image?query=Professional%20editorial%20portrait%20of%20a%20friendly%20North%20African%20French%20software%20engineer%20man%20in%20his%20thirties%20with%20a%20short%20beard%2C%20warm%20orange%20and%20deep%20teal%20accent%20lighting%2C%20clean%20warm%20neutral%20background%2C%20natural%20soft%20window%20light%2C%20modern%20corporate%20photography%2C%20shallow%20depth%20of%20field%2C%20high%20detail&width=600&height=750&seq=artiflow-team-karim&orientation=portrait",
    shareImage: IMAGE_PARTAGE_AUTEUR_KARIM,
    tone: "accent",
    linkedin: "https://www.linkedin.com/company/artiflow-pro",
    ville: "Paris",
    depuis: "2023",
    expertises: ["Architecture logicielle", "IA appliquée", "Sécurité des données", "Scalabilité"],
    parcours: [
      "Ingénieur logiciel passé par des plateformes à forte charge, obsédé par la fiabilité et la lisibilité du code.",
      "Conçoit l'architecture d'ArtiFlow-pro et les services qui génèrent des milliers de devis chaque semaine.",
      "Encadre l'équipe technique et veille à ce que la sécurité et la conformité RGPD restent non négociables.",
    ],
    citation:
      "L'IA doit être discrète. Si l'artisan doit y penser, c'est qu'on a raté quelque chose.",
  },
  {
    id: "sophie-renard",
    name: "Sophie Renard",
    role: "Responsable produit",
    categorie: "produit",
    bio: "Sophie dessine les parcours de l'application. Elle part toujours d'une vraie situation de chantier pour concevoir des écrans qui vont droit au but.",
    photo:
      "https://readdy.ai/api/search-image?query=Professional%20editorial%20portrait%20of%20a%20warm%20approachable%20French%20woman%20product%20designer%20in%20her%20thirties%20with%20light%20brown%20hair%2C%20warm%20orange%20and%20deep%20teal%20accent%20lighting%2C%20clean%20warm%20neutral%20background%2C%20natural%20soft%20window%20light%2C%20modern%20corporate%20photography%2C%20shallow%20depth%20of%20field%2C%20high%20detail&width=600&height=750&seq=artiflow-team-sophie&orientation=portrait",
    shareImage: IMAGE_PARTAGE_AUTEUR_SOPHIE,
    tone: "secondary",
    linkedin: "https://www.linkedin.com/company/artiflow-pro",
    ville: "Lyon",
    depuis: "2024",
    expertises: ["Design produit", "Recherche utilisateur", "Accessibilité", "Parcours mobile"],
    parcours: [
      "Designer produit qui commence toujours par observer le terrain avant d'ouvrir un outil de maquette.",
      "Mène les recherches utilisateurs auprès d'artisans réels et priorise la feuille de route produit.",
      "Veille à ce que chaque écran reste utilisable avec des gants, en plein soleil et sur un chantier.",
    ],
    citation:
      "On conçoit d'abord pour un artisan avec des gants et du réseau, pas pour un bureau bien éclairé.",
  },
  {
    id: "antoine-lefevre",
    name: "Antoine Lefèvre",
    role: "Responsable relation artisans",
    categorie: "relation",
    bio: "Antoine répond aux artisans du matin au soir. Il transforme leurs retours en améliorations concrètes, souvent dès la semaine suivante.",
    photo:
      "https://readdy.ai/api/search-image?query=Professional%20editorial%20portrait%20of%20a%20friendly%20approachable%20French%20support%20manager%20man%20in%20his%20forties%20with%20short%20greying%20hair%2C%20warm%20orange%20and%20deep%20teal%20accent%20lighting%2C%20clean%20warm%20neutral%20background%2C%20natural%20soft%20window%20light%2C%20modern%20corporate%20photography%2C%20shallow%20depth%20of%20field%2C%20high%20detail&width=600&height=750&seq=artiflow-team-antoine&orientation=portrait",
    shareImage: IMAGE_PARTAGE_AUTEUR_ANTOINE,
    tone: "primary",
    linkedin: "https://www.linkedin.com/company/artiflow-pro",
    ville: "Lyon",
    depuis: "2024",
    expertises: ["Support client", "Onboarding", "Formation", "Métiers du bâtiment"],
    parcours: [
      "Ancien responsable support dans des logiciels métiers, habitué à expliquer simplement des choses complexes.",
      "Pilote l'accompagnement des artisans de l'essai à la maîtrise complète de l'outil.",
      "Centralise chaque retour du terrain et le transforme en améliorations concrètes pour l'équipe produit.",
    ],
    citation: "Chaque retour d'artisan est un cadeau : il nous dit exactement où on progresse.",
  },
  {
    id: "camille-dufour",
    name: "Camille Dufour",
    role: "Lead data & IA",
    categorie: "data",
    bio: "Camille entraîne nos modèles de chiffrage sur des milliers de devis réels. Son obsession : des estimations justes, quel que soit votre corps d'état.",
    photo:
      "https://readdy.ai/api/search-image?query=Professional%20editorial%20portrait%20of%20a%20focused%20French%20woman%20data%20scientist%20in%20her%20late%20twenties%20with%20curly%20dark%20hair%2C%20warm%20orange%20and%20deep%20teal%20accent%20lighting%2C%20clean%20warm%20neutral%20background%2C%20natural%20soft%20window%20light%2C%20modern%20corporate%20photography%2C%20shallow%20depth%20of%20field%2C%20high%20detail&width=600&height=750&seq=artiflow-team-camille&orientation=portrait",
    shareImage: IMAGE_PARTAGE_AUTEUR_CAMILLE,
    tone: "accent",
    linkedin: "https://www.linkedin.com/company/artiflow-pro",
    ville: "Paris",
    depuis: "2025",
    expertises: ["Modèles de chiffrage", "Évaluation IA", "Données de chantier", "Python"],
    parcours: [
      "Data scientist spécialisée dans les modèles de langage appliqués à des métiers techniques.",
      "Entraîne et évalue les modèles de chiffrage d'ArtiFlow-pro sur des milliers de devis réels anonymisés.",
      "Mesure la justesse métier des estimations afin qu'un devis de plomberie soit aussi fiable qu'un devis de peinture.",
    ],
    citation: "Un devis juste, c'est la différence entre une marge tenue et une soirée perdue.",
  },
  {
    id: "julien-barbier",
    name: "Julien Barbier",
    role: "Responsable croissance",
    categorie: "croissance",
    bio: "Julien fait connaître ArtiFlow-pro auprès des artisans. Il préfère une démonstration honnête à n'importe quel argument marketing.",
    photo:
      "https://readdy.ai/api/search-image?query=Professional%20editorial%20portrait%20of%20a%20friendly%20French%20marketing%20manager%20man%20in%20his%20thirties%20with%20glasses%20and%20light%20stubble%2C%20warm%20orange%20and%20deep%20teal%20accent%20lighting%2C%20clean%20warm%20neutral%20background%2C%20natural%20soft%20window%20light%2C%20modern%20corporate%20photography%2C%20shallow%20depth%20of%20field%2C%20high%20detail&width=600&height=750&seq=artiflow-team-julien&orientation=portrait",
    shareImage: IMAGE_PARTAGE_AUTEUR_JULIEN,
    tone: "secondary",
    linkedin: "https://www.linkedin.com/company/artiflow-pro",
    ville: "Nantes",
    depuis: "2025",
    expertises: ["SEO", "Acquisition", "Contenu", "Partenariats"],
    parcours: [
      "Responsable croissance qui mise sur la pédagogie plus que sur les promesses creuses.",
      "Produit les guides, la newsletter et les ressources qui aident vraiment les artisans à se repérer.",
      "Construit des partenariats durables avec les organismes et fédérations du bâtiment.",
    ],
    citation:
      "Je préfère une démonstration honnête à n'importe quel argument marketing.",
  },
];

export const valeursEquipe: ValeurEquipe[] = [
  {
    icon: "ri-hammer-line",
    title: "Le terrain avant tout",
    description:
      "Chaque fonctionnalité part d'une situation de chantier réelle. Si un outil ne fait pas gagner du temps sur le terrain, il ne sort pas.",
    tone: "primary",
  },
  {
    icon: "ri-eye-line",
    title: "La clarté, toujours",
    description:
      "Des prix lisibles, des devis compréhensibles, aucune petite ligne cachée. On applique aux autres la transparence qu'on attend d'un bon artisan.",
    tone: "accent",
  },
  {
    icon: "ri-chat-smile-2-line",
    title: "On reste humains",
    description:
      "L'IA nous libère du temps, elle ne remplace personne. Derrière chaque écran, une équipe joignable qui connaît vraiment le bâtiment.",
    tone: "secondary",
  },
  {
    icon: "ri-flag-2-line",
    title: "Conçu en France",
    description:
      "Une équipe française, une conformité RGPD stricte et des données hébergées avec soin. Vos informations restent les vôtres.",
    tone: "primary",
  },
];

export const histoireEquipe: EtapeHistoire[] = [
  {
    year: "2023",
    title: "Une évidence sur un chantier",
    description:
      "Léa et Karim constatent qu'un artisan consacre près de 6 heures par semaine à des tâches administratives évitables : rédiger des devis, relancer des clients, recaler un planning.",
  },
  {
    year: "2024",
    title: "La première version d'ArtiFlow-pro",
    description:
      "Le premier devis généré par IA et signé en ligne voit le jour. Trente artisans testent l'outil et passent la barre des 1 000 devis rédigés en quelques mois.",
  },
  {
    year: "2025",
    title: "Les relances en pilote automatique",
    description:
      "ArtiFlow-pro apprend à relancer tout seul par SMS et WhatsApp. Les artisans récupèrent l'argent qui dormait dans leurs devis non signés.",
  },
  {
    year: "2026",
    title: "Plus de 2 400 artisans équipés",
    description:
      "Huit corps d'état, des milliers de devis par semaine et une équipe qui grandit — toujours guidée par la même obsession : le temps rendu aux artisans.",
  },
];

export const chiffresEquipe = [
  { value: "2 400+", label: "artisans équipés", icon: "ri-user-star-line" },
  { value: "8", label: "corps d'état couverts", icon: "ri-tools-line" },
  { value: "18 min", label: "gagnées par devis", icon: "ri-time-line" },
  { value: "4,8/5", label: "satisfaction moyenne", icon: "ri-star-line" },
];

/** Retrouve un membre de l'équipe par son identifiant (ancre utilisée dans /a-propos#id). */
export function membreParId(id: string): MembreEquipe | undefined {
  return equipe.find((membre) => membre.id === id);
}