/**
 * Mémoire locale de la bibliothèque personnelle : favoris (signets) et notes
 * attachées à chaque guide. Chaque changement diffuse un événement afin que
 * les cartes, listes et bandeaux se mettent à jour en direct.
 */

const FAV_PREFIX = "artiflow:favori:";
const NOTE_PREFIX = "artiflow:note:";
const NOTE_LIBRE_PREFIX = "artiflow:notelibre:";
const TITRE_LIBRE_PREFIX = "artiflow:notelibretitre:";
const EVENT_NAME = "artiflow:biblio-change";

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

/* --------------------------------- Favoris --------------------------------- */

/** Vrai si le guide est dans les favoris. */
export function isFavori(slug?: string): boolean {
  if (!slug) return false;
  return read(`${FAV_PREFIX}${slug}`) !== null;
}

/**
 * Date (timestamp ms) à laquelle le guide a été ajouté aux favoris.
 * Renvoie 0 pour les favoris enregistrés avant l'ajout de l'horodatage.
 */
export function dateFavori(slug?: string): number {
  if (!slug) return 0;
  const valeur = read(`${FAV_PREFIX}${slug}`);
  if (!valeur) return 0;
  const n = Number(valeur);
  return Number.isFinite(n) && n > 1e12 ? n : 0;
}

/** Ajoute ou retire le guide des favoris (horodaté à l'ajout). */
export function togglerFavori(slug: string): void {
  if (!slug) return;
  if (isFavori(slug)) remove(`${FAV_PREFIX}${slug}`);
  else write(`${FAV_PREFIX}${slug}`, String(Date.now()));
  emit();
}

/** Nombre total de guides mis en favori. */
export function compterFavoris(): number {
  try {
    let total = 0;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const cle = window.localStorage.key(i);
      if (cle && cle.startsWith(FAV_PREFIX) && window.localStorage.getItem(cle) !== null) total += 1;
    }
    return total;
  } catch {
    return 0;
  }
}

/* ---------------------------------- Notes ---------------------------------- */

const NOTE_MAX = 2000;
const TITRE_MAX = 80;

/** Note personnelle enregistrée pour ce guide (chaîne vide si aucune). */
export function getNote(slug?: string): string {
  if (!slug) return "";
  return read(`${NOTE_PREFIX}${slug}`) ?? "";
}

/** Vrai si une note non vide est associée au guide. */
export function aUneNote(slug?: string): boolean {
  return getNote(slug).trim().length > 0;
}

/** Enregistre (ou efface) la note personnelle du guide. */
export function ecrireNote(slug: string, text: string): void {
  if (!slug) return;
  const valeur = text.slice(0, NOTE_MAX);
  if (valeur.trim() === "") remove(`${NOTE_PREFIX}${slug}`);
  else write(`${NOTE_PREFIX}${slug}`, valeur);
  emit();
}

/* -------------------------- Listes & réinitialisation ---------------------- */

/** Liste des slugs de guides mis en favori. */
export function listerFavoris(): string[] {
  const slugs: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const cle = window.localStorage.key(i);
      if (cle && cle.startsWith(FAV_PREFIX) && window.localStorage.getItem(cle) !== null) {
        slugs.push(cle.slice(FAV_PREFIX.length));
      }
    }
  } catch {
    /* ignore */
  }
  return slugs;
}

/** Liste des notes personnelles enregistrées (guides avec une note non vide). */
export function listerNotes(): { slug: string; texte: string }[] {
  const items: { slug: string; texte: string }[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const cle = window.localStorage.key(i);
      if (cle && cle.startsWith(NOTE_PREFIX)) {
        const texte = window.localStorage.getItem(cle) ?? "";
        if (texte.trim() !== "") items.push({ slug: cle.slice(NOTE_PREFIX.length), texte });
      }
    }
  } catch {
    /* ignore */
  }
  return items;
}

/** Nombre de guides pour lesquels une note personnelle est enregistrée (hors notes libres). */
export function compterNotes(): number {
  return listerNotes().length;
}

/* ------------------------------ Notes libres ------------------------------- */

/** Génère un identifiant unique pour une nouvelle note libre (non rattachée à un guide). */
export function nouvelIdNoteLibre(): string {
  return `libre-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Note libre enregistrée (chaîne vide si aucune). */
export function getNoteLibre(id?: string): string {
  if (!id) return "";
  return read(`${NOTE_LIBRE_PREFIX}${id}`) ?? "";
}

/** Titre personnalisé d'une note libre (chaîne vide si aucun). */
export function getTitreNoteLibre(id?: string): string {
  if (!id) return "";
  return read(`${TITRE_LIBRE_PREFIX}${id}`) ?? "";
}

/** Retire du stockage une note libre devenue totalement vide (ni titre, ni texte). */
function supprimerNoteLibreSiVide(id: string): void {
  if (getNoteLibre(id).trim() === "" && getTitreNoteLibre(id).trim() === "") {
    remove(`${NOTE_LIBRE_PREFIX}${id}`);
    remove(`${TITRE_LIBRE_PREFIX}${id}`);
  }
}

/** Enregistre (ou efface) une note libre. */
export function ecrireNoteLibre(id: string, text: string): void {
  if (!id) return;
  const valeur = text.slice(0, NOTE_MAX);
  if (valeur.trim() === "") remove(`${NOTE_LIBRE_PREFIX}${id}`);
  else write(`${NOTE_LIBRE_PREFIX}${id}`, valeur);
  supprimerNoteLibreSiVide(id);
  emit();
}

/** Enregistre (ou efface) le titre d'une note libre. */
export function ecrireTitreNoteLibre(id: string, titre: string): void {
  if (!id) return;
  const valeur = titre.slice(0, TITRE_MAX);
  if (valeur.trim() === "") remove(`${TITRE_LIBRE_PREFIX}${id}`);
  else write(`${TITRE_LIBRE_PREFIX}${id}`, valeur);
  supprimerNoteLibreSiVide(id);
  emit();
}

/** Supprime définitivement une note libre (titre et texte). */
export function supprimerNoteLibre(id: string): void {
  if (!id) return;
  remove(`${NOTE_LIBRE_PREFIX}${id}`);
  remove(`${TITRE_LIBRE_PREFIX}${id}`);
  emit();
}

/** Liste des notes libres enregistrées (titre ou texte non vide). */
export function listerNotesLibres(): { id: string; titre: string; texte: string }[] {
  const items: { id: string; titre: string; texte: string }[] = [];
  const ids = new Set<string>();
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const cle = window.localStorage.key(i);
      if (!cle) continue;
      if (cle.startsWith(NOTE_LIBRE_PREFIX)) ids.add(cle.slice(NOTE_LIBRE_PREFIX.length));
      else if (cle.startsWith(TITRE_LIBRE_PREFIX)) ids.add(cle.slice(TITRE_LIBRE_PREFIX.length));
    }
  } catch {
    /* ignore */
  }
  ids.forEach((id) => {
    const titre = getTitreNoteLibre(id);
    const texte = getNoteLibre(id);
    if (titre.trim() !== "" || texte.trim() !== "") items.push({ id, titre, texte });
  });
  return items;
}

/** Nombre de notes libres enregistrées. */
export function compterNotesLibres(): number {
  return listerNotesLibres().length;
}

/* -------------------------- Compteur global -------------------------------- */

/** Nombre total d'éléments de la bibliothèque personnelle (favoris + notes). */
export function compterBibliotheque(): number {
  return compterFavoris() + compterNotes() + compterNotesLibres();
}

/**
 * Efface d'un coup tous les favoris et toutes les notes personnelles.
 * Cette opération est irréversible côté navigateur.
 */
export function toutEffacerBibliotheque(): void {
  try {
    const aSupprimer: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const cle = window.localStorage.key(i);
      if (
        cle &&
        (cle.startsWith(FAV_PREFIX) ||
          cle.startsWith(NOTE_PREFIX) ||
          cle.startsWith(NOTE_LIBRE_PREFIX) ||
          cle.startsWith(TITRE_LIBRE_PREFIX))
      )
        aSupprimer.push(cle);
    }
    aSupprimer.forEach((cle) => window.localStorage.removeItem(cle));
  } catch {
    /* ignore */
  }
  emit();
}

/* ------------------------------- Abonnement -------------------------------- */

/** S'abonne aux changements de favoris et de notes (même onglet et autres onglets). */
export function subscribeBibliotheque(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}