/** Une vue épinglée « favorite », conservée localement pour la rejouer en un clic. */
export interface VueFavorite {
  /** Identifiant stable (le chemin interne) pour dédoublonner. */
  id: string;
  /** Libellé lisible de la vue (« Devis · vue partagée »). */
  label: string;
  /** Chemin interne navigable (ex. « /app/devis?statut=Envoyé »). */
  chemin: string;
  /** Date de l'épinglage (ISO). */
  at: string;
}

const CLE = "artiflow_vues_favorites";
const MAX = 12;

/** Événement diffusé après chaque modification, pour rafraîchir les listes à chaud. */
export const VUES_FAVORITES_EVENT = "artiflow-vues-favorites";

/** Ancienne page « Professionnels », supprimée au profit du carnet filtré. */
const ANCIENNE_VUE_PRO = "/app/professionnels";
/** Adresse actuelle de la vue « Professionnels » (le carnet filtré sur les entreprises). */
const VUE_PRO_ACTUELLE = "/app/clients?type=Professionnels";

/**
 * Ramène une ancienne adresse de vue vers son équivalent actuel.
 * Les vues épinglées avant la fusion pointent vers /app/professionnels : on les convertit
 * (plutôt que de les jeter) pour que l'utilisateur retrouve ses raccourcis intacts.
 */
export function normaliserCheminVue(chemin: string): string {
  if (
    chemin === ANCIENNE_VUE_PRO ||
    chemin.startsWith(`${ANCIENNE_VUE_PRO}?`) ||
    chemin.startsWith(`${ANCIENNE_VUE_PRO}/`)
  ) {
    return VUE_PRO_ACTUELLE;
  }
  return chemin;
}

/** Écrit la liste sans diffuser d'événement (migration silencieuse). */
function persisterSansEvenement(vues: VueFavorite[]): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(vues));
  } catch {
    /* stockage indisponible : la migration sera retentée à la prochaine lecture */
  }
}

/**
 * Relit les vues favorites (de la plus récente à la plus ancienne).
 * Les vues portant encore l'ancienne adresse « Professionnels » sont converties à la volée,
 * dédoublonnées (une seule épingle pour la même vue) puis réécrites silencieusement.
 */
export function lireVuesFavorites(): VueFavorite[] {
  try {
    const raw = localStorage.getItem(CLE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const vues: VueFavorite[] = [];
    let migre = false;
    parsed.forEach((v) => {
      if (!(v && typeof v.chemin === "string" && typeof v.label === "string" && v.chemin.startsWith("/"))) return;
      const vue = v as VueFavorite;
      const chemin = normaliserCheminVue(vue.chemin);
      if (chemin !== vue.chemin) migre = true;
      // Deux épingles peuvent désormais désigner la même vue : on garde la première (la plus récente).
      if (vues.some((x) => x.chemin === chemin)) {
        migre = true;
        return;
      }
      vues.push({ ...vue, id: chemin, chemin });
    });
    const sortie = vues.slice(0, MAX);
    if (migre) persisterSansEvenement(sortie);
    return sortie;
  } catch {
    return [];
  }
}

/** La vue portée par ce chemin est-elle déjà épinglée en favori ? */
export function estVueFavorite(chemin: string): boolean {
  return lireVuesFavorites().some((v) => v.chemin === chemin);
}

/** Épingle une vue en favori (dédoublonné par chemin, le plus récent en tête). */
export function ajouterVueFavorite(label: string, chemin: string): VueFavorite[] {
  const propre = chemin.trim();
  if (!propre) return lireVuesFavorites();
  const existants = lireVuesFavorites().filter((v) => v.chemin !== propre);
  const suivant: VueFavorite[] = [
    { id: propre, label, chemin: propre, at: new Date().toISOString() },
    ...existants,
  ].slice(0, MAX);
  try {
    localStorage.setItem(CLE, JSON.stringify(suivant));
    window.dispatchEvent(new Event(VUES_FAVORITES_EVENT));
  } catch {
    /* stockage indisponible : la vue favorite n'est pas persistante */
  }
  return suivant;
}

/** Renomme une vue favorite (libellé personnalisé). Un libellé vide conserve l'ancien. */
export function renommerVueFavorite(chemin: string, label: string): VueFavorite[] {
  const propre = label.trim();
  if (!propre) return lireVuesFavorites();
  const suivant = lireVuesFavorites().map((v) => (v.chemin === chemin ? { ...v, label: propre } : v));
  try {
    localStorage.setItem(CLE, JSON.stringify(suivant));
    window.dispatchEvent(new Event(VUES_FAVORITES_EVENT));
  } catch {
    /* ignore */
  }
  return suivant;
}

/**
 * Réordonne les vues favorites selon l'ordre de chemins fourni (le premier en tête).
 * Les vues non listées sont conservées à la fin, dans leur ordre courant.
 */
export function reordonnerVuesFavorites(chemins: string[]): VueFavorite[] {
  const actuelles = lireVuesFavorites();
  const restantes = new Map(actuelles.map((v) => [v.chemin, v]));
  const ordonnees: VueFavorite[] = [];
  chemins.forEach((chemin) => {
    const vue = restantes.get(chemin);
    if (vue) {
      ordonnees.push(vue);
      restantes.delete(chemin);
    }
  });
  actuelles.forEach((v) => {
    if (restantes.has(v.chemin)) ordonnees.push(v);
  });
  try {
    localStorage.setItem(CLE, JSON.stringify(ordonnees));
    window.dispatchEvent(new Event(VUES_FAVORITES_EVENT));
  } catch {
    /* ignore */
  }
  return ordonnees;
}

/** Retire une vue des favoris. */
export function retirerVueFavorite(chemin: string): VueFavorite[] {
  const suivant = lireVuesFavorites().filter((v) => v.chemin !== chemin);
  try {
    localStorage.setItem(CLE, JSON.stringify(suivant));
    window.dispatchEvent(new Event(VUES_FAVORITES_EVENT));
  } catch {
    /* ignore */
  }
  return suivant;
}

/** Efface toutes les vues favorites. */
export function effacerVuesFavorites(): void {
  try {
    localStorage.removeItem(CLE);
    window.dispatchEvent(new Event(VUES_FAVORITES_EVENT));
  } catch {
    /* ignore */
  }
}