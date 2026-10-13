/**
 * Notification de modification des préférences d'affichage, horodatage du « quand » et
 * historique des remises à zéro.
 *
 * Ce petit module est volontairement isolé de tous les autres modules de préférences pour éviter
 * les imports circulaires : chaque lib de préférence (barres de recherche, ordres personnalisés,
 * son, bibliothèque, bibliothèque de lignes) y signale qu'un type a changé,
 * ce qui (1) horodate la modification et (2) prévient l'application, qui peut alors synchroniser
 * vers le Backend.
 *
 * On y conserve aussi un court historique des dernières remises à zéro par famille (et pas
 * seulement la dernière), avec la date de chaque passage et une photographie de l'état d'avant,
 * afin de pouvoir le rétablir d'un clic depuis la page Préférences.
 *
 * Aucune donnée métier ici : uniquement des préférences d'interface, propres au compte.
 */

/** Les grandes familles de préférences d'affichage suivies par la page Préférences. */
export type TypePreference = "son" | "barres" | "ordres" | "biblio" | "lignes" | "filtres";

/** Libellé court d'une famille de préférences, pour un résumé compact (ex. restauration). */
export const LIBELLES_PREFERENCE_COURT: Record<TypePreference, string> = {
  son: "Son de confirmation",
  barres: "Barres de recherche",
  ordres: "Ordre personnalisé",
  biblio: "Réglages bibliothèque",
  lignes: "Réglages lignes",
  filtres: "Filtres des listes",
};

/** Icône Remix associée à chaque famille de préférences. */
export const ICONES_PREFERENCE: Record<TypePreference, string> = {
  son: "ri-volume-up-line",
  barres: "ri-search-line",
  ordres: "ri-drag-move-2-line",
  biblio: "ri-bookmark-3-line",
  lignes: "ri-list-check-2",
  filtres: "ri-filter-3-line",
};

/** Date (ISO) de la dernière modification, par type de préférence. */
export type MajPreferences = Partial<Record<TypePreference, string>>;

/** Une remise à zéro enregistrée : sa date, et l'état d'avant (restaurable) si connu. */
export interface EntreeRemise {
  /** Date (ISO) du passage. */
  quand: string;
  /** Photographie restaurable de l'état d'avant le passage (null si non capturée). */
  avant: unknown;
}

/** Historique (du plus récent au plus ancien) des remises à zéro, par type de préférence. */
export type HistoriqueRemises = Partial<Record<TypePreference, EntreeRemise[]>>;

/** Nombre maximal d'entrées conservées par famille dans l'historique des remises à zéro. */
export const MAX_HISTORIQUE_REMISES = 5;

const MAJ_KEY = "artiflow.preferences.maj";
const HIST_KEY = "artiflow.preferences.resetHistorique";

/** Événement diffusé après chaque modification, pour déclencher la synchronisation Backend. */
export const PREFERENCES_MODIFIEES_EVENT = "artiflow:preferences-modifiees";

/** Relit les dates de dernière modification par type (vide si jamais modifié). */
export function lireMajPreferences(): MajPreferences {
  try {
    const brut = localStorage.getItem(MAJ_KEY);
    if (!brut) return {};
    const parsed: unknown = JSON.parse(brut);
    if (parsed && typeof parsed === "object") return parsed as MajPreferences;
    return {};
  } catch {
    return {};
  }
}

/** Mémorise les dates de dernière modification par type (utilisé à la réception du Backend). */
export function ecrireMajPreferences(maj: MajPreferences): void {
  try {
    localStorage.setItem(MAJ_KEY, JSON.stringify(maj));
  } catch {
    /* stockage indisponible : rien à mémoriser */
  }
}

/** Ramène une entrée brute (ancienne chaîne ISO, ou objet complet) vers une entrée valide. */
function normaliserEntreeRemise(item: unknown): EntreeRemise | null {
  if (typeof item === "string") return { quand: item, avant: null };
  if (item && typeof item === "object") {
    const o = item as { quand?: unknown; avant?: unknown };
    if (typeof o.quand === "string") return { quand: o.quand, avant: o.avant ?? null };
  }
  return null;
}

/** Relit l'historique des remises à zéro (du plus récent au plus ancien, par famille). */
export function lireHistoriqueRemises(): HistoriqueRemises {
  try {
    const brut = localStorage.getItem(HIST_KEY);
    if (!brut) return {};
    const parsed: unknown = JSON.parse(brut);
    if (!parsed || typeof parsed !== "object") return {};
    const res: HistoriqueRemises = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([cle, valeur]) => {
      if (!Array.isArray(valeur)) return;
      const entrees = valeur.map(normaliserEntreeRemise).filter((x): x is EntreeRemise => x !== null);
      if (entrees.length > 0) res[cle as TypePreference] = entrees;
    });
    return res;
  } catch {
    return {};
  }
}

/** Mémorise l'historique des remises à zéro (utilisé à la réception du Backend). */
export function ecrireHistoriqueRemises(h: HistoriqueRemises): void {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(h));
  } catch {
    /* stockage indisponible : rien à mémoriser */
  }
}

/**
 * Dernière remise à zéro enregistrée pour une famille (la plus récente), ou null si aucune.
 * Sert au raccourci « Rétablir la dernière remise à zéro » affiché directement dans chaque section,
 * sans passer par l'historique.
 */
export function lireDerniereRemise(type: TypePreference): EntreeRemise | null {
  const listes = lireHistoriqueRemises();
  const liste = listes[type];
  if (!liste || liste.length === 0) return null;
  return liste[0] ?? null;
}

/**
 * Enregistre une remise à zéro pour une famille : ajoute l'entrée en tête de son historique
 * (borné à MAX_HISTORIQUE_REMISES entrées), mémorise la photographie de l'état d'avant (afin de
 * pouvoir le rétablir), et prévient l'application (synchronisation Backend).
 */
export function enregistrerRemiseAZero(
  type: TypePreference,
  avant: unknown = null,
  quand: string = new Date().toISOString(),
): void {
  const historique = lireHistoriqueRemises();
  const liste = historique[type] ?? [];
  historique[type] = [{ quand, avant }, ...liste].slice(0, MAX_HISTORIQUE_REMISES);
  ecrireHistoriqueRemises(historique);
  marquerPreferenceModifiee(type);
}

let profondeurSilence = 0;

/**
 * Suspend temporairement les notifications de modification (et l'horodatage). Utilisé lorsqu'on
 * applique une photographie de préférences reçue du Backend : on ne veut pas la considérer comme
 * une modification de l'utilisateur (sinon on re-déclencherait une synchronisation en boucle).
 * Renvoie la fonction à appeler pour rétablir les notifications.
 */
export function suspendreNotificationsPreferences(): () => void {
  profondeurSilence += 1;
  let libere = false;
  return () => {
    if (libere) return;
    libere = true;
    profondeurSilence = Math.max(0, profondeurSilence - 1);
  };
}

/**
 * Horodate la dernière modification d'un type de préférence et prévient l'application (qui peut
 * alors synchroniser vers le Backend). Appelé par chaque lib lorsqu'une préférence change.
 */
export function marquerPreferenceModifiee(type: TypePreference): void {
  if (profondeurSilence > 0) return;
  const maj = lireMajPreferences();
  maj[type] = new Date().toISOString();
  ecrireMajPreferences(maj);
  try {
    window.dispatchEvent(new Event(PREFERENCES_MODIFIEES_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

/** Libellé de temps relatif lisible (« à l'instant », « il y a 5 min », « hier »…). */
export function tempsRelatifPreference(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "jamais";
  const minutes = Math.floor((Date.now() - t) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return "hier";
  if (jours < 7) return `il y a ${jours} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}