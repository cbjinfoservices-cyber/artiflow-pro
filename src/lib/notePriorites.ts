/**
 * Référentiel des priorités attribuables à une note interne sur une fiche client.
 * La clé est stockée en base (colonne `note_priorite`), le reste n'est que présentation.
 */
export interface NotePriorite {
  /** Clé technique stockée en base. */
  key: string;
  /** Libellé affiché à l'utilisateur. */
  label: string;
  /** Icône Remix associée. */
  icon: string;
  /** Classes Tailwind pour la pastille (fond + texte + bordure). */
  badge: string;
  /** Classe Tailwind pour une petite puce de couleur. */
  dot: string;
}

export const NOTE_PRIORITES: NotePriorite[] = [
  {
    key: "a_relancer",
    label: "À relancer",
    icon: "ri-notification-3-line",
    badge: "bg-accent-100 text-accent-800 border-accent-200",
    dot: "bg-accent-500",
  },
  {
    key: "sensible",
    label: "Sensible",
    icon: "ri-alert-line",
    badge: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  {
    key: "urgent",
    label: "Urgent",
    icon: "ri-error-warning-line",
    badge: "bg-red-600 text-background-50 border-red-600",
    dot: "bg-red-600",
  },
  {
    key: "info",
    label: "Info",
    icon: "ri-information-line",
    badge: "bg-secondary-100 text-secondary-800 border-secondary-200",
    dot: "bg-secondary-500",
  },
];

/** Renvoie la priorité correspondant à une clé, ou null si absente/inconnue. */
export function notePrioriteInfo(key: string | null | undefined): NotePriorite | null {
  if (!key) return null;
  return NOTE_PRIORITES.find((p) => p.key === key) ?? null;
}

/**
 * Ordre de tri des priorités (les plus importantes d'abord) pour classer
 * les fiches dans le widget « Clients à suivre ».
 */
const ORDRE: Record<string, number> = {
  urgent: 0,
  sensible: 1,
  a_relancer: 2,
  info: 3,
};

export function notePrioriteRank(key: string | null | undefined): number {
  if (!key) return 99;
  return ORDRE[key] ?? 50;
}