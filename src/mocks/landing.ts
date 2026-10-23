// Les 7 espaces de l'espace artisan : la page d'accueil reprend le découpage du menu
// (Pilotage, Commercial, Clients, Terrain, Relances, Envois, Ressources) pour rester cohérente.
export const espaces = [
  {
    icon: "ri-dashboard-line",
    title: "Pilotage",
    description: "Votre activité en un coup d'œil : chiffre d'affaires, devis en attente et alertes du jour.",
    tone: "primary",
  },
  {
    icon: "ri-file-text-line",
    title: "Commercial",
    description: "Devis, factures et bibliothèque de lignes : vous créez, envoyez et suivez tout au même endroit.",
    tone: "accent",
  },
  {
    icon: "ri-contacts-book-2-line",
    title: "Clients",
    description: "Fiches clients et professionnels, avec historique et relances. Pensé pour le terrain.",
    tone: "secondary",
  },
  {
    icon: "ri-building-2-line",
    title: "Terrain",
    description: "Chantiers et planning réunis : qui fait quoi, où et quand. Fini les trajets en pagaille.",
    tone: "primary",
  },
  {
    icon: "ri-notification-3-line",
    title: "Relances",
    description: "Les relances à envoyer et celles déjà programmées, pour ne plus laisser dormir d'impayés.",
    tone: "accent",
  },
  {
    icon: "ri-send-plane-line",
    title: "Envois",
    description: "L'historique complet de vos envois, et les envois automatiques qui partent tout seuls.",
    tone: "secondary",
  },
  {
    icon: "ri-bookmark-line",
    title: "Ressources",
    description: "Votre bibliothèque de lignes et vos vues favorites, toujours à portée de main.",
    tone: "primary",
  },
];

export const steps = [
  {
    number: "01",
    icon: "ri-mic-line",
    title: "Vous dictez",
    description:
      "Sur le chantier, dictez les travaux ou prenez une photo. L'IA comprend votre métier et structure tout.",
  },
  {
    number: "02",
    icon: "ri-file-text-line",
    title: "Le devis est prêt",
    description:
      "Lignes, quantités, prix : le devis est rédigé avec vos tarifs. Vous ajustez, vous envoyez en un tap.",
  },
  {
    number: "03",
    icon: "ri-repeat-line",
    title: "Les relances roulent",
    description:
      "Sans réponse, les relances partent automatiquement sur le bon canal jusqu'à la signature.",
  },
  {
    number: "04",
    icon: "ri-checkbox-circle-line",
    title: "Facture encaissée",
    description:
      "Étapes cochées, photos rangées, facture générée et payée. Il ne vous reste qu'à être payé.",
  },
];

export const testimonials = [
  {
    name: "Karim Benali",
    role: "Plombier chauffagiste · Lyon",
    quote:
      "Avant je faisais mes devis le dimanche. Maintenant je les dicte entre deux interventions. J'ai gagné 6 h par semaine.",
    rating: 5,
    avatar: "https://readdy.ai/api/search-image?query=Portrait%20photography%20of%20a%20smiling%20North%20African%20man%20in%20his%20forties%20wearing%20a%20work%20shirt%2C%20warm%20neutral%20studio%20background%2C%20natural%20soft%20lighting%2C%20friendly%20confident%20expression%2C%20high%20detail%20professional%20headshot&width=128&height=128&seq=artiflow-avatar-karim&orientation=squarish",
  },
  {
    name: "Sandrine Lefèvre",
    role: "Électricienne · Bordeaux",
    quote:
      "Les relances automatiques m'ont fait signer trois devis que j'allais laisser tomber. C'est de l'argent que je ne perdais plus.",
    rating: 5,
    avatar: "https://readdy.ai/api/search-image?query=Portrait%20photography%20of%20a%20confident%20French%20woman%20in%20her%20thirties%20with%20short%20hair%20wearing%20a%20work%20vest%2C%20warm%20neutral%20studio%20background%2C%20soft%20natural%20lighting%2C%20professional%20friendly%20headshot%2C%20high%20detail&width=128&height=128&seq=artiflow-avatar-sandrine&orientation=squarish",
  },
  {
    name: "Thomas Girard",
    role: "Maçon · Nantes",
    quote:
      "Le planning intelligent m'évite de traverser la ville trois fois par jour. Je perds beaucoup moins de temps dans les trajets.",
    rating: 5,
    avatar: "https://readdy.ai/api/search-image?query=Portrait%20photography%20of%20a%20rugged%20French%20man%20in%20his%20forties%20wearing%20a%20dusty%20work%20jacket%2C%20warm%20neutral%20studio%20background%2C%20soft%20natural%20lighting%2C%20honest%20smile%2C%20high%20detail%20professional%20headshot&width=128&height=128&seq=artiflow-avatar-thomas&orientation=squarish",
  },
];

export const plans = [
  {
    name: "Essentiel",
    price: "29",
    period: "/ mois",
    tagline: "Pour se lancer proprement.",
    highlighted: false,
    features: [
      "Devis illimités générés par IA",
      "Modèles par corps de métier",
      "1 utilisateur",
      "Relances email automatiques",
      "Documents à votre image (couleur, logo, paiement)",
      "Application mobile",
      "Support par email",
    ],
    cta: "Commencer",
  },
  {
    name: "Pro",
    price: "59",
    period: "/ mois",
    tagline: "Le choix des artisans qui veulent tout automatiser.",
    highlighted: true,
    features: [
      "Tout l'Essentiel, plus :",
      "Relances SMS & WhatsApp",
      "Planning intelligent & trajets",
      "Suivi de chantier, photos & notes de consignes",
      "Modèles de devis et de factures réutilisables",
      "Signature électronique à votre image",
      "Support prioritaire",
    ],
    cta: "Essayer 14 jours",
  },
  {
    name: "Entreprise",
    price: "99",
    period: "/ mois",
    tagline: "Pour les équipes et les gros volumes.",
    highlighted: false,
    features: [
      "Tout le Pro, plus :",
      "Multi-utilisateurs & rôles",
      "Paiement en ligne des clients",
      "Export comptable automatique",
      "Identité de marque partout (documents, emails, signature)",
      "IA avancée & prévisions",
      "Accompagnement dédié",
    ],
    cta: "Nous contacter",
  },
];

export const faqs = [
  {
    question: "Je ne suis pas à l'aise avec l'informatique, ça va aller ?",
    answer:
      "Oui. ArtiFlow-pro est pensé pour le terrain : vous parlez, vous prenez une photo, l'app fait le reste. La prise en main se fait en moins de 30 minutes, et un modèle de devis est déjà prêt pour votre métier.",
  },
  {
    question: "Est-ce que mes prix et mes devis restent les miens ?",
    answer:
      "Absolument. L'IA part de votre bibliothèque de prix et de vos anciens devis. Plus vous l'utilisez, plus elle rédige comme vous.",
  },
  {
    question: "Ça marche sur mon téléphone Android ou iPhone ?",
    answer:
      "Oui, sur les deux. L'application est conçue mobile d'abord : utilisable à une main, sur un chantier, même avec des gants.",
  },
  {
    question: "Les relances automatiques, est-ce que ça agace mes clients ?",
    answer:
      "Non. Les messages sont courtois, différenciés et espacés dans le temps. Vous gardez la main : vous pouvez tout relire, ajuster ou couper à tout moment.",
  },
  {
    question: "Puis-je payer autre chose que par carte ?",
    answer:
      "Les abonnements se règlent par carte. Pour les gros volumes ou les équipes, nous proposons une facturation sur devis.",
  },
  {
    question: "Que se passe-t-il si j'arrête ?",
    answer:
      "Sans engagement. Vous partez quand vous voulez et vous récupérez vos données (devis, clients, factures) en un export.",
  },
];

export const heroStats = [
  { value: "-6 h", label: "de paperasse par semaine" },
  { value: "+27 %", label: "de devis signés en moyenne" },
  { value: "2 min", label: "pour envoyer un devis" },
  { value: "0 oubli", label: "sur les relances clients" },
];

export const avantApres = {
  avant: {
    label: "Avant ArtiFlow-pro",
    headline: "La paperasse grignote vos soirées",
    intro:
      "Après 10 h de chantier, il reste encore les devis. Et les relances qu'on repousse au lendemain, un lendemain qui n'arrive jamais.",
    points: [
      { icon: "ri-moon-line", title: "Devis rédigés le soir", description: "1 à 3 h passées à taper des lignes, au détriment de la famille et du repos." },
      { icon: "ri-close-circle-line", title: "Relances oubliées", description: "Un devis sans réponse et personne ne relance : le client finit par choisir un autre." },
      { icon: "ri-map-pin-time-line", title: "Trajets dispersés", description: "Des rendez-vous mal ordonnés et des heures perdues sur la route chaque semaine." },
      { icon: "ri-error-warning-line", title: "Litiges sans preuve", description: "Ni photo, ni trace écrite : la réception du chantier tourne à la parole contre parole." },
    ],
    metrics: [
      { label: "Temps de devis par soir", value: "2 h", ratio: 100 },
      { label: "Devis réellement relancés", value: "20 %", ratio: 20 },
      { label: "Trajets inutiles par jour", value: "3", ratio: 90 },
    ],
  },
  apres: {
    label: "Avec ArtiFlow-pro",
    headline: "Vous posez, l'IA rédige",
    intro:
      "Le devis part avant même de ranger l'outillage. Les relances tournent toutes seules et la semaine s'organise toute seule.",
    points: [
      { icon: "ri-mic-line", title: "Devis dicté sur place", description: "2 minutes entre deux interventions, l'IA rédige avec vos tarifs et vos unités." },
      { icon: "ri-notification-3-line", title: "Relances automatiques", description: "Email, SMS, WhatsApp : le client est relancé jusqu'à sa réponse, sans oubli." },
      { icon: "ri-road-map-line", title: "Planning optimisé", description: "Les chantiers regroupés par zone : vos trajets sont divisés par deux." },
      { icon: "ri-camera-line", title: "Chantier tracé", description: "Photos horodatées et étapes cochées : plus de litige à la réception." },
    ],
    metrics: [
      { label: "Temps de devis par jour", value: "10 min", ratio: 12 },
      { label: "Devis réellement relancés", value: "100 %", ratio: 100 },
      { label: "Trajets inutiles par jour", value: "0 à 1", ratio: 25 },
    ],
  },
};