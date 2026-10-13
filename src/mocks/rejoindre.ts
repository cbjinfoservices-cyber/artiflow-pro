export type PosteOuvert = {
  id: string;
  title: string;
  equipe: string;
  contrat: string;
  lieu: string;
  description: string;
  tags: string[];
  /** Valeur Schema.org employmentType (FULL_TIME, INTERN, CONTRACTOR…). */
  employmentType: string;
  /** Ville du poste (absente pour un poste entièrement en télétravail). */
  ville?: string;
  /** Poste entièrement à distance → jobLocationType TELECOMMUTE. */
  teletravail: boolean;
};

export const postesOuverts: PosteOuvert[] = [
  {
    id: "ingenieur-backend",
    title: "Ingénieur(e) backend",
    equipe: "Plateforme",
    contrat: "CDI",
    lieu: "Paris · Hybride",
    description:
      "Vous concevez les services qui génèrent et envoient les devis et relances de milliers d'artisans. Vous aimez les systèmes fiables, lisibles et bien testés.",
    tags: ["TypeScript", "Node", "PostgreSQL"],
    employmentType: "FULL_TIME",
    ville: "Paris",
    teletravail: false,
  },
  {
    id: "developpeur-frontend",
    title: "Développeur(se) frontend React",
    equipe: "Produit",
    contrat: "CDI",
    lieu: "Télétravail",
    description:
      "Vous transformez des parcours de chantier complexes en écrans simples, rapides et agréables, pensés pour être utilisés depuis un téléphone sur un chantier.",
    tags: ["React", "TypeScript", "Tailwind"],
    employmentType: "FULL_TIME",
    teletravail: true,
  },
  {
    id: "data-scientist-ia",
    title: "Data scientist · IA",
    equipe: "Data & IA",
    contrat: "CDI",
    lieu: "Paris · Hybride",
    description:
      "Vous entraînez et évaluez nos modèles de chiffrage pour qu'un devis de plomberie soit aussi juste qu'un devis de peinture, quel que soit le métier.",
    tags: ["Python", "LLM", "Évaluation"],
    employmentType: "FULL_TIME",
    ville: "Paris",
    teletravail: false,
  },
  {
    id: "relation-artisans",
    title: "Chargé(e) de relation artisans",
    equipe: "Support",
    contrat: "CDI",
    lieu: "Lyon · Hybride",
    description:
      "Vous êtes la voix d'ArtiFlow-pro pour les artisans : répondre, former, rassurer, et remonter chaque friction pour qu'elle soit corrigée vite.",
    tags: ["Support", "Onboarding", "Bâtiment"],
    employmentType: "FULL_TIME",
    ville: "Lyon",
    teletravail: false,
  },
  {
    id: "growth-marketing",
    title: "Responsable croissance & marketing digital",
    equipe: "Croissance",
    contrat: "CDI",
    lieu: "Télétravail",
    description:
      "Vous faites connaître ArtiFlow-pro auprès des bons artisans, avec des contenus et campagnes honnêtes, mesurables et jamais racoleurs.",
    tags: ["SEO", "Acquisition", "Contenu"],
    employmentType: "FULL_TIME",
    teletravail: true,
  },
  {
    id: "stage-marketing",
    title: "Stage · Marketing & contenu",
    equipe: "Croissance",
    contrat: "Stage 6 mois",
    lieu: "Télétravail",
    description:
      "Vous produisez guides, newsletters et formats courts qui aident vraiment les artisans, encadré(e) par l'équipe croissance.",
    tags: ["Rédaction", "Réseaux sociaux", "SEO"],
    employmentType: "INTERN",
    teletravail: true,
  },
];

export const avantagesRejoindre = [
  {
    icon: "ri-time-line",
    title: "Souplesse réelle",
    description:
      "Télétravail et horaires flexibles : on juge le résultat, pas la présence. Le présentiel sert à se retrouver, pas à surveiller.",
    tone: "primary" as const,
  },
  {
    icon: "ri-user-smile-line",
    title: "Impact visible",
    description:
      "Une fonctionnalité livrée le mardi peut changer la semaine d'un artisan le mercredi. Votre travail se mesure en heures rendues.",
    tone: "accent" as const,
  },
  {
    icon: "ri-graduation-cap-line",
    title: "On apprend en continu",
    description:
      "Budget formation, veille IA et temps dédié pour explorer. On préfère une équipe curieuse à une équipe figée.",
    tone: "secondary" as const,
  },
  {
    icon: "ri-team-line",
    title: "Équipe à taille humaine",
    description:
      "Peu de réunions, beaucoup d'entraide. Tout le monde parle à tout le monde, y compris les fondateurs.",
    tone: "primary" as const,
  },
  {
    icon: "ri-heart-3-line",
    title: "Vraiment bien traités",
    description:
      "Mutuelle et prévoyance prises en charge, matériel au choix, primes sur objectifs clairs et sans zone d'ombre.",
    tone: "accent" as const,
  },
  {
    icon: "ri-plant-line",
    title: "Du sens, pas du vernis",
    description:
      "On rend du temps à des gens qui construisent et réparent tous les jours. C'est concret, utile, et ça se voit.",
    tone: "secondary" as const,
  },
];

export const etapesRecrutement = [
  {
    title: "Votre candidature",
    description: "Quelques lignes et deux liens. Cinq minutes suffisent, pas besoin de lettre fleuve.",
  },
  {
    title: "Échange découverte",
    description: "30 minutes en visio pour comprendre votre parcours et répondre à toutes vos questions.",
  },
  {
    title: "Rencontre & cas pratique",
    description: "Une heure avec l'équipe sur un exercice proche du quotidien réel, jamais gratuit.",
  },
  {
    title: "Offre & bienvenue",
    description: "Une réponse claire, une proposition détaillée et un premier jour bien préparé.",
  },
];

export const chiffresCulture = [
  { value: "100%", label: "télétravail possible" },
  { value: "24h", label: "de réponse max" },
  { value: "6", label: "postes ouverts" },
  { value: "2 400+", label: "artisans à servir" },
];