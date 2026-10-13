/**
 * Mémoire locale de lecture des guides : position de la dernière section lue
 * et marqueur « lu ». Chaque changement diffuse un événement afin que les
 * cartes, listes et sommaires se mettent à jour en direct sans rechargement.
 */

export type StatutLecture = "lu" | "en-cours" | "a-lire";

const POSITION_PREFIX = "artiflow:lecture:";
const LU_PREFIX = "artiflow:lu:";
const LU_AT_PREFIX = "artiflow:lu-at:";
const ACTIVITE_KEY = "artiflow:lecture:activite";
const ACTIVITE_MAX = 400;
const EVENT_NAME = "artiflow:lecture-change";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function emit(): void {
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* ignore */
  }
}

/** Section mémorisée de la dernière lecture, ou `null` si aucune. */
export function getPosition(guideSlug: string): string | null {
  if (!guideSlug) return null;
  return read(`${POSITION_PREFIX}${guideSlug}`);
}

/** Mémorise la section en cours de lecture pour ce guide. */
export function setPosition(guideSlug: string, sectionId: string): void {
  if (!guideSlug || !sectionId) return;
  write(`${POSITION_PREFIX}${guideSlug}`, sectionId);
  enregistrerActivite();
  emit();
}

/** Oublie la position mémorisée (le guide n'est plus « en cours »). */
export function clearPosition(guideSlug: string): void {
  if (!guideSlug) return;
  remove(`${POSITION_PREFIX}${guideSlug}`);
  emit();
}

/** Vrai si le guide a été marqué comme lu. */
export function isLu(guideSlug: string): boolean {
  if (!guideSlug) return false;
  return read(`${LU_PREFIX}${guideSlug}`) === "1";
}

/** Statut de lecture du guide. */
export function getStatut(guideSlug: string): StatutLecture {
  if (isLu(guideSlug)) return "lu";
  if (getPosition(guideSlug)) return "en-cours";
  return "a-lire";
}

/**
 * Poids de lecture d'un guide (2 = lu, 1 = en cours, 0 = à lire).
 * Sert de base aux tris « les plus lus » : plus vous avez avancé dans un
 * guide, plus il remonte dans la liste.
 */
export function getPoidsLecture(guideSlug: string): number {
  const statut = getStatut(guideSlug);
  if (statut === "lu") return 2;
  if (statut === "en-cours") return 1;
  return 0;
}

/** Clé de journée (AAAA-MM-JJ) pour une date donnée. */
export function jourKey(date: Date = new Date()): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/** Enregistre la journée courante comme jour d'activité de lecture (dédupliquée, plafonnée). */
function enregistrerActivite(): void {
  const cle = jourKey();
  let jours: string[] = [];
  try {
    const brut = read(ACTIVITE_KEY);
    const parse = brut ? (JSON.parse(brut) as unknown) : [];
    jours = Array.isArray(parse) ? (parse as string[]) : [];
  } catch {
    jours = [];
  }
  if (!jours.includes(cle)) {
    jours.push(cle);
    if (jours.length > ACTIVITE_MAX) jours = jours.slice(jours.length - ACTIVITE_MAX);
    write(ACTIVITE_KEY, JSON.stringify(jours));
  }
}

/** Liste des journées avec activité de lecture (clés « AAAA-MM-JJ »). */
export function getActivite(): string[] {
  try {
    const brut = read(ACTIVITE_KEY);
    const parse = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(parse) ? (parse as string[]) : [];
  } catch {
    return [];
  }
}

/** Date ISO du marquage « lu » d'un guide, ou `null` si non renseignée. */
export function getLuAt(guideSlug: string): string | null {
  if (!guideSlug) return null;
  return read(`${LU_AT_PREFIX}${guideSlug}`);
}

/** Marque le guide comme lu et le retire des lectures à reprendre. */
export function marquerCommeLu(guideSlug: string): void {
  if (!guideSlug) return;
  write(`${LU_PREFIX}${guideSlug}`, "1");
  write(`${LU_AT_PREFIX}${guideSlug}`, new Date().toISOString());
  remove(`${POSITION_PREFIX}${guideSlug}`);
  enregistrerActivite();
  emit();
}

/** Annule le marqueur « lu » du guide. */
export function marquerCommeNonLu(guideSlug: string): void {
  if (!guideSlug) return;
  remove(`${LU_PREFIX}${guideSlug}`);
  remove(`${LU_AT_PREFIX}${guideSlug}`);
  emit();
}

/** S'abonne aux changements de lecture (même onglet et autres onglets). */
export function subscribeLecture(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}