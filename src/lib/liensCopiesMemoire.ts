/** Un lien déjà copié, conservé localement pour le retrouver sans recopier. */
export interface LienCopie {
  /** Identifiant stable (l'URL) pour dédoublonner et clé-ifier la liste. */
  id: string;
  /** Libellé lisible de la vue (« Vue filtrée · devis »). */
  label: string;
  /** Adresse complète copiée. */
  url: string;
  /** Date de la copie (ISO). */
  at: string;
}

const CLE = "artiflow_liens_copies";
const MAX = 6;

/** Événement diffusé après chaque modification, pour rafraîchir le tableau de bord à chaud. */
export const LIENS_COPIES_EVENT = "artiflow-liens-copies";

/** Relit l'historique des liens copiés (du plus récent au plus ancien). */
export function lireLiensCopies(): LienCopie[] {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is LienCopie => Boolean(l && typeof l.url === "string" && typeof l.label === "string"))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

/**
 * Ajoute un lien à l'historique (dédoublonné par URL, le plus récent en tête),
 * puis diffuse l'événement pour que l'affichage se mette à jour sans recharger.
 */
export function ajouterLienCopie(label: string, url: string): LienCopie[] {
  const propre = url.trim();
  if (!propre) return lireLiensCopies();
  const existants = lireLiensCopies().filter((l) => l.url !== propre);
  const suivant: LienCopie[] = [{ id: propre, label, url: propre, at: new Date().toISOString() }, ...existants].slice(
    0,
    MAX,
  );
  try {
    localStorage.setItem(CLE, JSON.stringify(suivant));
    window.dispatchEvent(new Event(LIENS_COPIES_EVENT));
  } catch {
    /* stockage indisponible : l'historique n'est pas persistant */
  }
  return suivant;
}

/** Efface tout l'historique des liens copiés. */
export function effacerLiensCopies(): void {
  try {
    localStorage.removeItem(CLE);
    window.dispatchEvent(new Event(LIENS_COPIES_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Réordonne l'historique des liens copiés selon l'ordre d'identifiants fourni (le premier en tête).
 * Les liens non listés sont conservés à la fin, dans leur ordre courant. Diffuse l'événement
 * pour que le tableau de bord se mette à jour à chaud.
 */
export function reordonnerLiensCopies(ids: string[]): LienCopie[] {
  const actuels = lireLiensCopies();
  const restants = new Map(actuels.map((l) => [l.id, l]));
  const ordonnes: LienCopie[] = [];
  ids.forEach((id) => {
    const lien = restants.get(id);
    if (lien) {
      ordonnes.push(lien);
      restants.delete(id);
    }
  });
  actuels.forEach((l) => {
    if (restants.has(l.id)) ordonnes.push(l);
  });
  try {
    localStorage.setItem(CLE, JSON.stringify(ordonnes));
    window.dispatchEvent(new Event(LIENS_COPIES_EVENT));
  } catch {
    /* ignore */
  }
  return ordonnes;
}

/**
 * Convertit l'URL complète d'un lien mémorisé (origine + préfixe de publication inclus)
 * en chemin interne navigable par l'application (ex. « /app/devis?statut=Envoyé »).
 */
export function cheminInterneDepuisUrl(url: string): string {
  let path = url;
  try {
    if (path.startsWith("http")) {
      const u = new URL(path);
      path = `${u.pathname}${u.search}`;
    }
  } catch {
    /* on garde la chaîne telle quelle */
  }
  if (path.startsWith(window.location.origin)) path = path.slice(window.location.origin.length);
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  if (base && path.startsWith(base)) path = path.slice(base.length);
  return path.startsWith("/") ? path : `/${path}`;
}