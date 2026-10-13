/**
 * Données de navigation de l'espace artisan (barre latérale + barre mobile).
 *
 * Chaque entrée porte son groupe thématique (`groupe`) : la barre latérale s'en sert pour
 * construire des sous-sections repliables, la barre mobile pour ordonner les icônes.
 * Le découpage reste volontairement court (libellés concis) afin de condenser le menu.
 */

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
}

/** Libellé du grand ensemble regroupant les entrées métier (début de la barre latérale). */
export const GROUPE_ARTISAN = "Espace artisan";

/** Libellé du groupe des accès aux ressources (bibliothèque + vues épinglées). */
export const GROUPE_RESSOURCES = "Ressources";

/**
 * Entrées de l'espace artisan, dans l'ordre d'affichage.
 * Le regroupement (Commercial / Clients / Terrain / Relances / Envois) est plus court qu'avant
 * pour condenser la barre latérale ; Chantiers et Planning restent côte à côte dans « Terrain »
 * car ce sont deux facettes du même suivi de chantier.
 */
export const navItems: ItemNav[] = [
  { to: "/app", label: "Tableau de bord", icon: "ri-dashboard-line", end: true, groupe: "Pilotage", hint: "Votre activité en un coup d'œil : chiffre d'affaires, devis en attente et alertes du jour." },
  { to: "/app/devis", label: "Devis", icon: "ri-file-text-line", end: false, groupe: "Commercial", hint: "Créez et suivez vos devis. Le bouton « Nouveau devis IA » les rédige pour vous." },
  { to: "/app/factures", label: "Factures", icon: "ri-receipt-line", end: false, groupe: "Commercial", hint: "Établissez vos factures et repérez d'un coup d'œil celles qui ne sont pas encore payées." },
  { to: "/app/bibliotheque-lignes", label: "Bibliothèque de lignes", short: "Lignes", icon: "ri-list-check-2", end: false, groupe: "Commercial", hint: "Vos prestations et fournitures réutilisables, avec leurs prix : vous piochez dedans pour aller plus vite." },
  { to: "/app/clients", label: "Clients", icon: "ri-contacts-book-2-line", end: false, groupe: "Clients", hint: "La fiche de vos clients : coordonnées, historique et relances." },
  { to: "/app/professionnels", label: "Professionnels", icon: "ri-briefcase-line", end: false, groupe: "Clients", hint: "Vos partenaires et fournisseurs professionnels." },
  { to: "/app/chantiers", label: "Chantiers", icon: "ri-building-2-line", end: false, groupe: "Terrain", hint: "Suivez vos chantiers et leur avancement." },
  { to: "/app/planning", label: "Planning", icon: "ri-calendar-2-line", end: false, groupe: "Terrain", hint: "Vos créneaux et rendez-vous, jour par jour." },
  { to: "/app/relances", label: "Relances", icon: "ri-notification-3-line", end: false, groupe: "Relances", hint: "Les rappels à envoyer pour récupérer vos impayés." },
  { to: "/app/relances-programmees", label: "Relances programmées", short: "Programmées", icon: "ri-calendar-schedule-line", end: false, groupe: "Relances", hint: "Les relances déjà calées pour partir plus tard, automatiquement." },
  { to: "/app/envois", label: "Envois", icon: "ri-send-plane-line", end: false, groupe: "Envois", hint: "L'historique de tout ce qui a été envoyé : devis, factures, relances." },
  { to: "/app/envois-automatiques", label: "Envois automatiques", short: "Auto", icon: "ri-robot-2-line", end: false, groupe: "Envois", hint: "Les envois qui partent tout seuls, à la date choisie. Vous n'avez rien à faire." },
];