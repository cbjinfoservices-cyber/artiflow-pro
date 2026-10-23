export type NiveauNouveaute = "majeur" | "amelioration" | "correctif";

export type Nouveaute = {
  id: string;
  version: string;
  dateIso: string;
  dateLabel: string;
  title: string;
  summary: string;
  categorie: string;
  icon: string;
  niveau: NiveauNouveaute;
  points: string[];
  /** Lien vers une page d'annonce dédiée (facultatif). */
  lien?: string;
  /** Libellé du lien d'annonce dédiée (facultatif). */
  lienLabel?: string;
};

export const categoriesNouveautes: { key: string; label: string; icon: string }[] = [
  { key: "toutes", label: "Tout", icon: "ri-apps-2-line" },
  { key: "devis", label: "Devis & factures", icon: "ri-file-text-line" },
  { key: "clients", label: "Fiche client & emails", icon: "ri-mail-line" },
  { key: "relances", label: "Relances", icon: "ri-notification-3-line" },
  { key: "planning", label: "Planning & chantiers", icon: "ri-calendar-line" },
  { key: "comptabilite", label: "Comptabilité", icon: "ri-calculator-line" },
  { key: "tarifs", label: "Offres & tarifs", icon: "ri-price-tag-3-line" },
  { key: "site", label: "Site & transparence", icon: "ri-global-line" },
  { key: "espace", label: "Espace artisan", icon: "ri-layout-grid-line" },
];

export const niveauLabels: Record<NiveauNouveaute, string> = {
  majeur: "Mise à jour majeure",
  amelioration: "Amélioration",
  correctif: "Correctif",
};

export const nouveautes: Nouveaute[] = [
  {
    id: "renvois-programmes",
    version: "3.4",
    dateIso: "2026-10-23",
    dateLabel: "23 octobre 2026",
    title: "Renvoyer dans 24 h, sans y repenser",
    summary:
      "Un email refusé peut désormais être reprogrammé depuis la cloche. Un décompte en direct indique quand la relance partira, et tout s'annule d'un clic — y compris si vous corrigez la fiche entre-temps.",
    categorie: "clients",
    icon: "ri-time-line",
    niveau: "majeur",
    lien: "/nouveautes/suivi-emails-clients",
    lienLabel: "Voir l'annonce et le mode d'emploi",
    points: [
      "Programmation d'un renvoi à 24 h depuis la liste des échecs",
      "Décompte en direct avant chaque départ prévu",
      "Annulation ligne par ligne ou groupée en un clic",
      "Annulation automatique si l'adresse est corrigée avant l'échéance",
    ],
  },
  {
    id: "verification-adresse",
    version: "3.3",
    dateIso: "2026-10-21",
    dateLabel: "21 octobre 2026",
    title: "Plus de renvoi vers une adresse invalide",
    summary:
      "Le formulaire client contrôle l'adresse avant tout envoi : format puis domaine. Tant que l'adresse reste douteuse, aucun email ne part — et la correction relance automatiquement la relance.",
    categorie: "clients",
    icon: "ri-shield-check-line",
    niveau: "amelioration",
    points: [
      "Bouton « Vérifier l'adresse » : format et domaine",
      "Suggestion d'adresse corrigée pour les fautes de frappe courantes",
      "Renvoi bloqué tant que l'adresse est invalide",
      "Renvoi automatique dès que l'adresse est corrigée",
    ],
  },
  {
    id: "suivi-emails-clients",
    version: "3.2",
    dateIso: "2026-10-19",
    dateLabel: "19 octobre 2026",
    title: "Le refus d'email s'explique enfin",
    summary:
      "Sur la fiche client, vous voyez le dernier email refusé avec sa date, l'adresse tentée et la raison exacte, à côté de la liste datée des emails réellement partis.",
    categorie: "clients",
    icon: "ri-mail-check-line",
    niveau: "majeur",
    lien: "/nouveautes/suivi-emails-clients",
    lienLabel: "Lire l'annonce complète",
    points: [
      "Dernier refus affiché avec date, adresse et raison",
      "Liste datée des emails partis : objet et destinataire",
      "Compteur d'envois réussis par client",
      "Bouton « Vérifier et renvoyer » en une seule action",
    ],
  },
  {
    id: "personnalisation-documents",
    version: "3.1",
    dateIso: "2026-10-16",
    dateLabel: "16 octobre 2026",
    title: "Des documents à votre image, partout",
    summary:
      "Couleur d'accent, logo, coordonnées de paiement et message de pied de page : vos devis, factures, emails clients et pages de signature portent désormais la même identité, du premier PDF jusqu'à la signature du client.",
    categorie: "devis",
    icon: "ri-palette-line",
    niveau: "majeur",
    lien: "/nouveautes/personnalisation-documents",
    lienLabel: "Lire l'annonce complète",
    points: [
      "Couleur d'accent et logo sur vos devis et factures",
      "Même identité dans les emails clients et les relances",
      "Page de signature en ligne à vos couleurs",
    ],
  },
  {
    id: "v3-0",
    version: "3.0",
    dateIso: "2026-10-06",
    dateLabel: "6 octobre 2026",
    title: "Journal des nouveautés public et flux RSS",
    summary:
      "Le journal des mises à jour devient public : suivez chaque livraison et abonnez-vous au flux RSS pour être prévenu dès qu'une nouveauté sort.",
    categorie: "site",
    icon: "ri-rss-line",
    niveau: "amelioration",
    points: [
      "Page publique Nouveautés, filtrable par catégorie",
      "Les deux dernières nouveautés mises en avant sur l'accueil",
      "Flux RSS pour s'abonner depuis son lecteur d'actualités",
    ],
  },
  {
    id: "v2-9",
    version: "2.9",
    dateIso: "2026-09-12",
    dateLabel: "12 septembre 2026",
    title: "L'économie annuelle mise en avant sur toutes les offres",
    summary:
      "En vue mensuelle, chaque carte d'offre affiche désormais un rappel cliquable de l'économie réalisée à l'année, calculée automatiquement sur le prix réel.",
    categorie: "tarifs",
    icon: "ri-gift-line",
    niveau: "amelioration",
    points: [
      "Rappel d'économie annuelle sur les offres Essentiel, Pro et Entreprise",
      "Un clic bascule directement le sélecteur en mode annuel",
      "Montant calculé sur le prix réel, jamais arrondi au hasard",
    ],
  },
  {
    id: "v2-8",
    version: "2.8",
    dateIso: "2026-08-28",
    dateLabel: "28 août 2026",
    title: "Simulateur Entreprise et questions tracées",
    summary:
      "Le simulateur estime en direct l'économie annuelle selon le nombre d'utilisateurs, et le formulaire de contact indique désormais de quelle page vient la question.",
    categorie: "tarifs",
    icon: "ri-team-line",
    niveau: "amelioration",
    points: [
      "Encart « Économie annuelle » réactif au nombre d'artisans",
      "Origine de la question transmise dans la soumission du formulaire",
      "Récap mensuel/annuel enrichi d'un point de contact dédié",
    ],
  },
  {
    id: "v2-7",
    version: "2.7",
    dateIso: "2026-08-05",
    dateLabel: "5 août 2026",
    title: "Récap hebdomadaire des abonnements",
    summary:
      "Le back-office suit le MRR, la volatilité des changements d'offre et envoie un récapitulatif hebdomadaire avec recontact automatique des artisans volatils.",
    categorie: "espace",
    icon: "ri-line-chart-line",
    niveau: "majeur",
    points: [
      "Suivi du revenu récurrent mensuel sur historique",
      "Détection des artisans volatils et recontact automatique",
      "Aperçu et détail du récap hebdomadaire avant envoi",
    ],
  },
  {
    id: "v2-6",
    version: "2.6",
    dateIso: "2026-07-18",
    dateLabel: "18 juillet 2026",
    title: "Relances SMS & WhatsApp programmables",
    summary:
      "Vous programmez vos relances clients à l'avance, sur le canal qui répond le mieux, avec aperçu du message avant envoi et replanification en masse.",
    categorie: "relances",
    icon: "ri-notification-3-line",
    niveau: "majeur",
    points: [
      "Programmation d'une relance à une date précise",
      "Aperçu du message client avant envoi",
      "Reprogrammation groupée et journal des envois",
    ],
  },
  {
    id: "v2-5",
    version: "2.5",
    dateIso: "2026-06-30",
    dateLabel: "30 juin 2026",
    title: "Comptabilité : export, balance âgée et TVA multi-taux",
    summary:
      "Le module comptabilité gagne un export au format attendu par votre comptable, une balance âgée des impayés et un récapitulatif de TVA par taux.",
    categorie: "comptabilite",
    icon: "ri-calculator-line",
    niveau: "majeur",
    points: [
      "Journal, balance âgée et récap de TVA",
      "Envoi automatique au comptable",
      "Bilan d'archivage annuel et suivi de régularité",
    ],
  },
  {
    id: "v2-4",
    version: "2.4",
    dateIso: "2026-06-14",
    dateLabel: "14 juin 2026",
    title: "Planning intelligent par zone",
    summary:
      "Les chantiers se regroupent automatiquement par secteur pour limiter les trajets, avec prise en compte des urgences et de vos disponibilités.",
    categorie: "planning",
    icon: "ri-road-map-line",
    niveau: "majeur",
    points: [
      "Regroupement des chantiers par zone géographique",
      "Gestion des urgences et des créneaux libres",
      "Vue semaine utilisable à une main sur le chantier",
    ],
  },
  {
    id: "v2-3",
    version: "2.3",
    dateIso: "2026-05-27",
    dateLabel: "27 mai 2026",
    title: "Signature électronique des devis",
    summary:
      "Vos clients signent le devis directement en ligne, depuis un lien sécurisé. Le devis passe automatiquement en « signé » dans votre espace.",
    categorie: "devis",
    icon: "ri-quill-pen-line",
    niveau: "majeur",
    points: [
      "Lien client sécurisé pour la signature",
      "Passage automatique au statut « signé »",
      "Traçabilité de la signature côté artisan",
    ],
  },
  {
    id: "v2-2",
    version: "2.2",
    dateIso: "2026-05-09",
    dateLabel: "9 mai 2026",
    title: "Devis en plusieurs lots et modèles réutilisables",
    summary:
      "Découpez un devis en lots (par corps d'état ou par phase), enregistrez vos modèles préférés et réutilisez-les en un clic.",
    categorie: "devis",
    icon: "ri-file-list-3-line",
    niveau: "amelioration",
    points: [
      "Devis structuré en plusieurs lots",
      "Modèles enregistrés et suivis d'usage",
      "Enregistrement d'un devis existant comme modèle",
    ],
  },
  {
    id: "v2-1",
    version: "2.1",
    dateIso: "2026-04-21",
    dateLabel: "21 avril 2026",
    title: "Fiches clients enrichies et notes prioritaires",
    summary:
      "Les clients particuliers et professionnels disposent de fiches plus complètes, avec notes prioritaires et historique des relances.",
    categorie: "espace",
    icon: "ri-contacts-book-2-line",
    niveau: "amelioration",
    points: [
      "Séparation particuliers et professionnels",
      "Notes prioritaires remontées dans le suivi",
      "Historique des relances par client",
    ],
  },
  {
    id: "v2-0",
    version: "2.0",
    dateIso: "2026-04-02",
    dateLabel: "2 avril 2026",
    title: "Nouveau tableau de bord avec prévisions IA",
    summary:
      "Le tableau de bord se refait une beauté : indicateurs clés, prévisions de chiffre d'affaires et alertes concrètes pour la semaine.",
    categorie: "espace",
    icon: "ri-dashboard-3-line",
    niveau: "majeur",
    points: [
      "Indicateurs clés en un coup d'œil",
      "Prévisions de chiffre d'affaires",
      "Alertes actionnables pour la semaine",
    ],
  },
];