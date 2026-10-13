type Cell = boolean | string;

export const comparatif: { title: string; rows: { label: string; essentiel: Cell; pro: Cell; entreprise: Cell }[] }[] = [
  {
    title: "Devis & documents",
    rows: [
      { label: "Devis générés par IA", essentiel: "Illimités", pro: "Illimités", entreprise: "Illimités" },
      { label: "Modèles par corps de métier", essentiel: true, pro: true, entreprise: true },
      { label: "Bibliothèque de prix personnalisée", essentiel: true, pro: true, entreprise: true },
      { label: "Devis en plusieurs lots", essentiel: false, pro: true, entreprise: true },
      { label: "Signature électronique client", essentiel: false, pro: true, entreprise: true },
      { label: "Facturation depuis un devis signé", essentiel: true, pro: true, entreprise: true },
    ],
  },
  {
    title: "Relances & clients",
    rows: [
      { label: "Relances email automatiques", essentiel: true, pro: true, entreprise: true },
      { label: "Relances SMS & WhatsApp", essentiel: false, pro: true, entreprise: true },
      { label: "CRM clients & historique", essentiel: true, pro: true, entreprise: true },
      { label: "Paiement en ligne des clients", essentiel: false, pro: false, entreprise: true },
    ],
  },
  {
    title: "Chantiers & planning",
    rows: [
      { label: "Planning intelligent & trajets", essentiel: false, pro: true, entreprise: true },
      { label: "Suivi de chantier par étapes", essentiel: false, pro: true, entreprise: true },
      { label: "Photos horodatées illimitées", essentiel: false, pro: true, entreprise: true },
      { label: "Tableau de bord & prévisions IA", essentiel: "Basique", pro: "Avancé", entreprise: "Avancé" },
    ],
  },
  {
    title: "Équipe & support",
    rows: [
      { label: "Utilisateurs", essentiel: "1", pro: "1", entreprise: "Dès 5 (+12 €/artisan)" },
      { label: "Rôles & permissions", essentiel: false, pro: false, entreprise: true },
      { label: "Export comptable automatique", essentiel: false, pro: false, entreprise: true },
      { label: "Support", essentiel: "Email", pro: "Prioritaire", entreprise: "Accompagnement dédié" },
    ],
  },
];

export const tarifsFaq = [
  {
    question: "Puis-je tester ArtiFlow-pro avant de payer ?",
    answer:
      "Oui. Vous profitez de 14 jours d'essai complet sur l'offre Pro, avec aucun débit avant la fin de l'essai. Vous voyez exactement ce qu'ArtiFlow-pro génère pour vos chantiers avant le premier prélèvement.",
  },
  {
    question: "L'abonnement est-il vraiment sans engagement ?",
    answer:
      "Totalement. Vous êtes facturé au mois, vous pouvez résilier en un clic depuis votre espace. Et si vous choisissez l'annuel, vous gardez 20 % de réduction.",
  },
  {
    question: "Pourquoi l'annuel est 20 % moins cher ?",
    answer:
      "Parce qu'un paiement annuel nous coûte moins cher à gérer : moins de transactions, moins de relances de facturation et une visibilité plus stable. On vous reverse cette économie au lieu de la garder. Concrètement, −20 % sur 12 mensualités revient à payer 9,6 mois au lieu de 12 : vous économisez un peu plus de 2 mois par an, pour exactement le même service.",
  },
  {
    question: "Y a-t-il une limite au nombre de devis ?",
    answer:
      "Non. Sur toutes les offres, les devis générés par IA sont illimités. Vous n'êtes jamais bloqué en pleine période chargée.",
  },
  {
    question: "Que veux dire « relances SMS & WhatsApp » ?",
    answer:
      "Sur l'offre Pro et au-dessus, ArtiFlow-pro relance vos clients sur le canal où ils répondent le mieux. Email d'abord, puis SMS ou WhatsApp si pas de réponse — toujours avec des messages courtois que vous pouvez relire.",
  },
  {
    question: "Je travaille avec un apprenti, comment ça se passe ?",
    answer:
      "L'offre Entreprise gère plusieurs utilisateurs avec des rôles distincts : votre apprenti peut renseigner un chantier sans accéder à votre chiffre d'affaires.",
  },
  {
    question: "Comment fonctionne l'export comptable ?",
    answer:
      "Sur l'offre Entreprise, chaque facture et devis peut être exporté automatiquement vers votre comptable au format qu'il attend. Fini les allers-retours de pièces jointes en fin de trimestre.",
  },
  {
    question: "Est-ce que le paiement en ligne des clients est inclus ?",
    answer:
      "Le paiement en ligne par carte est disponible sur l'offre Entreprise. Vos clients règlent directement depuis le devis signé, et vous suivez les encaissements dans le tableau de bord.",
  },
  {
    question: "Puis-je changer d'offre en cours de route ?",
    answer:
      "À tout moment, à la hausse comme à la baisse. Le changement est appliqué immédiatement et ajusté au prorata, sans repartir de zéro.",
  },
  {
    question: "Mes données de clients sont-elles protégées ?",
    answer:
      "Oui. Vos données sont hébergées en Europe, chiffrées, et conformes au RGPD. Elles restent les vôtres : vous pouvez les exporter à tout moment.",
  },
  {
    question: "Proposez-vous un accompagnement à la mise en route ?",
    answer:
      "Oui. Un modèle de devis est préparé pour votre métier dès l'inscription. Sur l'offre Entreprise, un conseiller vous accompagne pour connecter vos tarifs et vos habitudes de travail.",
  },
];

export const proTestimonials = [
  {
    name: "Marc Dubois",
    role: "Plombier chauffagiste · Toulouse",
    rating: 5,
    quote:
      "Avant, je relançais mes devis à l'arrache le soir. Depuis que je suis passé au Pro, les SMS et WhatsApp partent tout seuls — j'ai signé trois devis que j'aurais laissés tomber.",
    avatar:
      "https://readdy.ai/api/search-image?query=Portrait%20photography%20of%20a%20friendly%20French%20male%20plumber%20in%20his%20forties%20wearing%20a%20dark%20work%20polo%2C%20warm%20neutral%20beige%20studio%20background%2C%20soft%20natural%20lighting%2C%20confident%20smile%2C%20consistent%20editorial%20headshot%20style%2C%20high%20detail&width=200&height=200&seq=artiflow-pro-avatar-marc&orientation=squarish",
  },
  {
    name: "Léa Martin",
    role: "Électricienne · Bordeaux",
    rating: 5,
    quote:
      "Le planning intelligent me fait gagner au moins une heure de route par jour. Mes chantiers sont regroupés par zone et je rentre plus tôt chez moi, sans stress.",
    avatar:
      "https://readdy.ai/api/search-image?query=Portrait%20photography%20of%20a%20smiling%20French%20woman%20electrician%20in%20her%20thirties%20with%20tied-back%20hair%20wearing%20a%20navy%20work%20vest%2C%20warm%20neutral%20beige%20studio%20background%2C%20soft%20natural%20lighting%2C%20professional%20friendly%20expression%2C%20consistent%20editorial%20headshot%20style%2C%20high%20detail&width=200&height=200&seq=artiflow-pro-avatar-lea&orientation=squarish",
  },
  {
    name: "Rémi Faure",
    role: "Menuisier · Nantes",
    rating: 5,
    quote:
      "La signature électronique a tout changé : mes clients signent le devis avant même que je range l'outillage. Je facture dans la foulée, plus personne ne traîne.",
    avatar:
      "https://readdy.ai/api/search-image?query=Portrait%20photography%20of%20a%20cheerful%20French%20male%20carpenter%20in%20his%20fifties%20with%20short%20grey%20hair%20wearing%20a%20grey%20work%20shirt%2C%20warm%20neutral%20beige%20studio%20background%2C%20soft%20natural%20lighting%2C%20honest%20smile%2C%20consistent%20editorial%20headshot%20style%2C%20high%20detail&width=200&height=200&seq=artiflow-pro-avatar-remi&orientation=squarish",
  },
];

export const proStats = [
  { value: "1 240+", label: "artisans en offre Pro" },
  { value: "4,8/5", label: "de satisfaction moyenne" },
  { value: "+27 %", label: "de devis signés en moyenne" },
  { value: "6 h", label: "gagnées chaque semaine" },
];