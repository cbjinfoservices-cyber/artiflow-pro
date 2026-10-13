/**
 * Préférence d'affichage de la fenêtre du graphique de régularité des liens d'authentification
 * (Diagnostic). Mémorisation locale de la dernière fenêtre choisie (tous / 30 jours / 6 semaines)
 * pour la retrouver telle quelle à la prochaine visite, comme le filtre de type et le seuil.
 * Aucune donnée métier ici : c'est un simple réglage d'interface. On mémorise en plus le fait que
 * l'utilisateur a déjà choisi sa fenêtre par défaut, pour ne proposer l'invite qu'à la première
 * visite.
 */

import type { FenetreRegularite } from "@/lib/regulariteLiensAuth";

const CLE = "artiflow.liens-auth.fenetre";
const CLE_CHOIX = "artiflow.liens-auth.fenetre-choisie";

/** Fenêtre par défaut proposée à la première visite (modifiable ensuite depuis la légende). */
export const FENETRE_LIENS_AUTH_DEFAUT: FenetreRegularite = "6s";

/** Événement diffusé après chaque modification de la fenêtre, pour tenir l'affichage à jour à chaud. */
export const FENETRE_LIENS_AUTH_EVENT = "artiflow-liens-auth-fenetre";

/** Événement diffusé après le choix de la fenêtre par défaut de première visite. */
export const FENETRE_LIENS_AUTH_CHOIX_EVENT = "artiflow-liens-auth-fenetre-choix";

/** Vérifie qu'une valeur lue est une fenêtre valide (robuste au stockage corrompu). */
function estFenetreLiensAuth(valeur: unknown): valeur is FenetreRegularite {
  return valeur === "tous" || valeur === "30j" || valeur === "6s";
}

/** Fenêtre courante, ou « 6 semaines » par défaut si rien n'est mémorisé. */
export function lireFenetreLiensAuth(): FenetreRegularite {
  try {
    const brut = localStorage.getItem(CLE);
    return estFenetreLiensAuth(brut) ? brut : FENETRE_LIENS_AUTH_DEFAUT;
  } catch {
    return FENETRE_LIENS_AUTH_DEFAUT;
  }
}

/** Mémorise la fenêtre choisie pour la retrouver à la prochaine visite. */
export function ecrireFenetreLiensAuth(fenetre: FenetreRegularite): void {
  try {
    localStorage.setItem(CLE, fenetre);
    window.dispatchEvent(new Event(FENETRE_LIENS_AUTH_EVENT));
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}

/**
 * L'utilisateur a-t-il déjà choisi sa fenêtre par défaut ? Tant que non, l'invite de première
 * visite s'affiche. En cas de stockage indisponible, on considère le choix fait pour ne pas
 * harceler l'utilisateur avec une invite qui ne pourrait pas être mémorisée.
 */
export function aChoisiFenetreDefaut(): boolean {
  try {
    return localStorage.getItem(CLE_CHOIX) === "1";
  } catch {
    return true;
  }
}

/** Marque la fenêtre par défaut comme choisie : masque définitivement l'invite de première visite. */
export function marquerFenetreDefautChoisie(): void {
  try {
    localStorage.setItem(CLE_CHOIX, "1");
    window.dispatchEvent(new Event(FENETRE_LIENS_AUTH_CHOIX_EVENT));
  } catch {
    /* stockage indisponible : l'invite pourra réapparaître, sans conséquence */
  }
}

/**
 * Réinitialise le marqueur de choix : l'invite de première visite réapparaîtra, pour rejouer le
 * choix de la fenêtre par défaut à volonté. La fenêtre courante reste inchangée tant que
 * l'utilisateur n'a pas refait son choix.
 */
export function reinitialiserFenetreDefaut(): void {
  try {
    localStorage.removeItem(CLE_CHOIX);
    window.dispatchEvent(new Event(FENETRE_LIENS_AUTH_CHOIX_EVENT));
  } catch {
    /* stockage indisponible : rien à réinitialiser */
  }
}