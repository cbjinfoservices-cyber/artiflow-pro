/**
 * Données de navigation de l'espace artisan (barre latérale + barre mobile).
 *
 * Chaque entrée porte son groupe thématique (`groupe`) : la barre latérale s'en sert pour
 * construire des sous-sections repliables, la barre mobile pour ordonner les icônes.
 * Le découpage suit l'ordre de travail de l'artisan : Suivi clients → Devis et facturation →
 * Comptabilité → Automatiser.
 */

/** Sous-entrée d'une entrée de menu (utilisée par le bloc « Clients »). */
export interface SousEntreeNav {
  /** Chemin de destination, filtre de type inclus dans l'URL. */
  to: string;
  /** Libellé court affiché dans la sous-liste. */
  label: string;
  /** Classe d'icône Remix. */
  icon: string;
  /** Phrase d'aide affichée en infobulle. */
  hint: string;
  /** Compteur à afficher à droite de la sous-entrée. */
  compteur: "particuliers" | "entreprises";
}

/** Une entrée de menu de l'espace artisan. */
export interface ItemNav {
  /** Chemin de destination. */
  to: string;
  /** Libellé complet. */
  label: string;
  /** Libellé court (barre mobile), sinon repli sur le premier mot du libellé. */
  short?: string;
  /** Classe d'icône Remix. */
  icon: string;
  /** Correspondance exacte du chemin (page racine uniquement). */
  end: boolean;
  /** Phrase d'aide affichée en infobulle. */
  hint: string;
  /** Sous-thème de rattachement (sert aussi de titre de groupe repliable). */
  groupe: string;
  /** Sous-entrées dépliables (une seule entrée en a aujourd'hui : le carnet de clients). */
  sousEntrees?: SousEntreeNav[];
}

/** Libellé du grand ensemble regroupant les entrées métier (début de la barre latérale). */
export const GROUPE_ARTISAN = "Espace artisan";

/** Libellé du groupe des accès aux ressources (fiche « Sécurité du compte »). */
export const GROUPE_RESSOURCES = "Ressources";

/** Groupe d'ouverture : la page d'accueil, seule entrée du bloc. */
export const GROUPE_AUJOURDHUI = "Aujourd'hui";
/** Groupe « Suivi clients » : le carnet, les chantiers, le planning et l'équipe. */
export const GROUPE_SUIVI_CLIENTS = "Suivi clients";
/** Groupe « Devis et facturation » : ce qui fait entrer une commande, puis ce qui l'encaisse. */
export const GROUPE_DEVIS_FACTURATION = "Devis et facturation";
/** Groupe « Comptabilité » : les documents et la régularité pour le comptable. */
export const GROUPE_COMPTABILITE = "Comptabilité";
/** Groupe « Automatiser » : historique des envois et programmes qui partent seuls. */
export const GROUPE_AUTOMATISER = "Automatiser";

/**
 * Sous-entrées du bloc « Clients » : les deux natures de fiches du même carnet.
 * Un même écran, deux portes d'entrée — l'une pré-filtrée sur les particuliers, l'autre sur les
 * entreprises. Le clic sur « Clients » (ligne du haut) reste le carnet complet.
 */
export const sousEntreesClients: SousEntreeNav[] = [
  {
    to: "/app/clients?type=Particuliers",
    label: "Particuliers",
    icon: "ri-user-line",
    hint: "Le carnet filtré sur les particuliers : coordonnées, notes internes et historique.",
    compteur: "particuliers",
  },
  {
    to: "/app/clients?type=Professionnels",
    label: "Entreprises",
    icon: "ri-building-2-line",
    hint: "Le carnet filtré sur les entreprises : SIRET, secteur, interlocuteur et CA généré.",
    compteur: "entreprises",
  },
];

/**
 * Entrées de l'espace artisan, dans l'ordre d'affichage.
 *
 * Le découpage suit désormais le déroulé d'une affaire : on suit le client et le terrain,
 * puis on chiffre et on facture, on passe la comptabilité, et enfin on automatise les envois.
 * Chaque groupe compte 1 à 6 entrées, ce qui garde les accordéons courts et lisibles.
 */
export const navItems: ItemNav[] = [
  { to: "/app", label: "Tableau de bord", icon: "ri-dashboard-line", end: true, groupe: GROUPE_AUJOURDHUI, hint: "Votre activité en un coup d'œil : chiffre d'affaires, devis en attente et alertes du jour." },

  {
    to: "/app/clients",
    label: "Clients",
    icon: "ri-contacts-book-2-line",
    end: false,
    groupe: GROUPE_SUIVI_CLIENTS,
    hint: "Votre carnet unique : particuliers et entreprises (SIRET, secteur, interlocuteur) dans la même liste.",
    sousEntrees: sousEntreesClients,
  },
  { to: "/app/chantiers", label: "Chantiers", icon: "ri-building-2-line", end: false, groupe: GROUPE_SUIVI_CLIENTS, hint: "Suivez vos chantiers et leur avancement." },
  { to: "/app/planning", label: "Planning", icon: "ri-calendar-2-line", end: false, groupe: GROUPE_SUIVI_CLIENTS, hint: "Vos créneaux et rendez-vous, jour par jour." },
  { to: "/app/intervenants", label: "Intervenants", short: "Équipe", icon: "ri-team-line", end: false, groupe: GROUPE_SUIVI_CLIENTS, hint: "Votre équipe : fiches, invitations à créer un compte, heures du mois, congés et planning de chacun." },
  { to: "/app/pointages", label: "Pointages", icon: "ri-timer-line", end: false, groupe: GROUPE_SUIVI_CLIENTS, hint: "Les heures pointées par votre équipe, filtrables par personne et par mois, avec export CSV pour la paie." },

  { to: "/app/devis", label: "Devis", icon: "ri-file-text-line", end: false, groupe: GROUPE_DEVIS_FACTURATION, hint: "Créez et suivez vos devis. Le bouton « Nouveau devis IA » les rédige pour vous." },
  { to: "/app/bibliotheque-lignes", label: "Bibliothèque de lignes", short: "Lignes", icon: "ri-list-check-2", end: false, groupe: GROUPE_DEVIS_FACTURATION, hint: "Vos prestations et fournitures réutilisables, avec leurs prix : vous piochez dedans pour aller plus vite." },
  { to: "/app/factures", label: "Factures", icon: "ri-receipt-line", end: false, groupe: GROUPE_DEVIS_FACTURATION, hint: "Établissez vos factures et repérez d'un coup d'œil celles qui ne sont pas encore payées." },
  { to: "/app/facturation-electronique", label: "Facturation électronique", short: "E-facture", icon: "ri-file-code-line", end: false, groupe: GROUPE_DEVIS_FACTURATION, hint: "Préparez le fichier structuré de vos factures et suivez chaque transmission, du dépôt à l'accusé de réception." },
  { to: "/app/relances", label: "Relances", icon: "ri-notification-3-line", end: false, groupe: GROUPE_DEVIS_FACTURATION, hint: "Les rappels à envoyer pour récupérer vos impayés." },
  { to: "/app/relances-programmees", label: "Relances programmées", short: "Programmées", icon: "ri-calendar-schedule-line", end: false, groupe: GROUPE_DEVIS_FACTURATION, hint: "Les relances déjà calées pour partir plus tard, automatiquement." },

  { to: "/app/comptabilite", label: "Comptabilité", icon: "ri-file-chart-line", end: false, groupe: GROUPE_COMPTABILITE, hint: "Préparez les documents pour votre comptable (journal, TVA, régularité) et repérez les mois manquants." },

  { to: "/app/envois", label: "Envois", icon: "ri-send-plane-line", end: false, groupe: GROUPE_AUTOMATISER, hint: "L'historique de tout ce qui a été envoyé : devis, factures, relances." },
  { to: "/app/envois-automatiques", label: "Envois automatiques", short: "Auto", icon: "ri-robot-2-line", end: false, groupe: GROUPE_AUTOMATISER, hint: "Les envois qui partent tout seuls, à la date choisie. Vous n'avez rien à faire." },
];

/**
 * Entrée secondaire : ce n'est pas une simple route, mais un module de la barre latérale rendu
 * à l'intérieur d'un groupe métier (bibliothèque personnelle, vues épinglées…).
 */
export interface ItemNavSecondaire {
  /** Identifiant de rendu (détermine le module affiché). */
  id: "bibliotheque" | "vues-favorites";
  /** Libellé visible. */
  label: string;
  /** Groupe métier de rattachement. */
  groupe: string;
  /** Classe d'icône Remix (utilisée par la recherche et les infobulles). */
  icon: string;
  /** Phrase d'aide affichée en infobulle. */
  hint: string;
  /** Mots-clés supplémentaires pour la recherche du menu. */
  motsCles: string;
}

/**
 * Entrées secondaires rattachées aux étapes du métier plutôt qu'à un bloc « Ressources » fourre-tout :
 * la bibliothèque personnelle rejoint « Suivi clients » (ce que l'on consulte pour travailler), et les vues
 * épinglées rejoignent « Automatiser » (les raccourcis qui font gagner du temps).
 */
export const navSecondaires: ItemNavSecondaire[] = [
  {
    id: "bibliotheque",
    label: "Ma bibliothèque",
    groupe: GROUPE_SUIVI_CLIENTS,
    icon: "ri-bookmark-3-line",
    hint: "Les articles et guides du site que vous avez mis de côté, à retrouver en un clin d'œil.",
    motsCles: "articles guides enregistres sauvegardes documentation ressources",
  },
  {
    id: "vues-favorites",
    label: "Vues favorites",
    groupe: GROUPE_AUTOMATISER,
    icon: "ri-pushpin-2-line",
    hint: "Vos vues épinglées (devis, factures, clients) à rouvrir en un clic.",
    motsCles: "vues epinglees favorites raccourcis filtres enregistres",
  },
];

/**
 * Ordre d'affichage initial des groupes, avant tout glisser-déposer. Sert aussi de référence :
 * un groupe mémorisé qui n'existe plus est ignoré, et un nouveau groupe arrive en fin de liste.
 */
export const ORDRE_GROUPES_DEFAUT: readonly string[] = [
  GROUPE_AUJOURDHUI,
  GROUPE_SUIVI_CLIENTS,
  GROUPE_DEVIS_FACTURATION,
  GROUPE_COMPTABILITE,
  GROUPE_AUTOMATISER,
  GROUPE_RESSOURCES,
];

/** Classes communes à tous les liens de la barre latérale (état actif / survol). */
export function classeLienNav(isActive: boolean): string {
  return `relative flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
    isActive
      ? "bg-primary-100 text-primary-800"
      : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
  }`;
}