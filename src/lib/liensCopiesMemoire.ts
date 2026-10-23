import { normaliserCheminVue } from "@/lib/vuesFavoritesMemoire";
import { originePublique } from "@/lib/site";

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

/** Reconstruit une adresse complète (origine + préfixe de publication) depuis un chemin interne. */
function urlDepuisChemin(chemin: string): string {
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  return `${originePublique()}${base}${chemin}`;
}

/** Écrit la liste sans diffuser d'événement (migration silencieuse des anciennes adresses). */
function persisterSansEvenement(liens: LienCopie[]): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(liens));
  } catch {
    /* stockage indisponible : la migration sera retentée à la prochaine lecture */
  }
}

/**
 * Relit l'historique des liens copiés (du plus récent au plus ancien).
 * Les liens qui pointent encore vers l'ancienne page « Professionnels » sont ramenés vers la
 * vue actuelle du carnet (/app/clients?type=Professionnels) puis réécrits silencieusement,
 * avec dédoublonnage s'il existait déjà un lien vers la nouvelle adresse.
 */
export function lireLiensCopies(): LienCopie[] {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const liens: LienCopie[] = [];
    let migre = false;
    parsed.forEach((l) => {
      if (!(l && typeof l.url === "string" && typeof l.label === "string")) return;
      const lien = l as LienCopie;
      const cheminActuel = cheminInterneDepuisUrl(lien.url);
      const chemin = normaliserCheminVue(cheminActuel);
      const url = chemin === cheminActuel ? lien.url : urlDepuisChemin(chemin);
      if (url !== lien.url) migre = true;
      // Deux liens peuvent désormais désigner la même vue : on garde le premier (le plus récent).
      if (liens.some((x) => x.url === url)) {
        migre = true;
        return;
      }
      liens.push({ ...lien, id: url, url });
    });
    const sortie = liens.slice(0, MAX);
    if (migre) persisterSansEvenement(sortie);
    return sortie;
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
  if (path.startsWith(originePublique())) path = path.slice(originePublique().length);
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  if (base && path.startsWith(base)) path = path.slice(base.length);
  return path.startsWith("/") ? path : `/${path}`;
}