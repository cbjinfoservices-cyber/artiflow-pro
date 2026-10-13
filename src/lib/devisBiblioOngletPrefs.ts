/**
 * Préférence d'affichage de la fenêtre « Bibliothèque de lignes » d'un devis : on mémorise l'onglet
 * actif (« Mes lignes » / « Catalogue métier ») pour rouvrir la fenêtre tel quel à la prochaine
 * utilisation. C'est un simple réglage local, sans aucune donnée métier, sauvegardé sur le compte
 * (Backend) pour être retrouvé sur tout appareil.
 */

import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";

/** Onglet de la fenêtre de bibliothèque de lignes du devis. */
export type OngletBiblioDevis = "perso" | "catalogue";

const CLE = "artiflow:devis:biblio:onglet";

/** Relit l'onglet mémorisé (« Mes lignes » par défaut). */
export function lireOngletBiblioDevis(): OngletBiblioDevis {
  try {
    const valeur = window.localStorage.getItem(CLE);
    if (valeur === "perso" || valeur === "catalogue") return valeur;
  } catch {
    /* stockage indisponible : on ignore */
  }
  return "perso";
}

/** Mémorise l'onglet actif de la fenêtre de bibliothèque de lignes du devis. */
export function ecrireOngletBiblioDevis(onglet: OngletBiblioDevis): void {
  try {
    if (lireOngletBiblioDevis() === onglet) return;
    window.localStorage.setItem(CLE, onglet);
    marquerPreferenceModifiee("lignes");
  } catch {
    /* stockage indisponible : la préférence n'est pas persistante */
  }
}

/** Efface la préférence d'onglet (retour au comportement par défaut, « Mes lignes »). */
export function effacerOngletBiblioDevis(): void {
  try {
    window.localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible : rien à effacer */
  }
}