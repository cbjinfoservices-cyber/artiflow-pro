/**
 * Réglages des raccourcis clavier de l'espace : chaque raccourci peut être activé ou désactivé
 * individuellement depuis la page « Réglages des raccourcis ». On mémorise uniquement les
 * raccourcis DÉSACTIVÉS (le reste étant actif par défaut) : ainsi, un nouveau raccourci ajouté
 * plus tard est actif sans intervention, et le stockage reste minimal.
 *
 * Aucune donnée métier ici : c'est un simple réglage d'interface, propre au poste et au navigateur.
 * La lecture / écriture passe exclusivement par `@/lib/stockageLocal` (accès sûrs, sans exception).
 */

import { cleArtiflow, ecrireJson, lireJson, v } from "@/lib/stockageLocal";

/** Clé de stockage du jeu de raccourcis désactivés (tableau d'identifiants). */
export const RACCOURCIS_ESPACE_CLE = cleArtiflow("raccourcis-espace", "desactives");

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const RACCOURCIS_ESPACE_EVENT = "artiflow-raccourcis-espace";

/**
 * Identifiants stables des raccourcis de l'espace. Source unique partagée par la page « Raccourcis
 * clavier » (affichage), la page « Réglages des raccourcis » (interrupteurs) et les composants qui
 * réagissent réellement au clavier (graphe des alertes).
 */
export const ID_RACCOURCI = {
  // Partout dans l'espace
  generalEchap: "general-echap",
  generalEntree: "general-entree",
  generalCtrlClic: "general-ctrl-clic",
  // Graphe « Alertes envoyées par mois »
  grapheFleches: "graphe-fleches",
  grapheFlechesMaj: "graphe-fleches-maj",
  grapheOrigine: "graphe-origine",
  grapheFin: "graphe-fin",
  grapheT: "graphe-t",
  graphePageHaut: "graphe-page-haut",
  graphePageBas: "graphe-page-bas",
  grapheZ: "graphe-z",
  grapheX: "graphe-x",
  grapheZXMaj: "graphe-zx-maj",
  grapheCtrlClic: "graphe-ctrl-clic",
  grapheSuppr: "graphe-suppr",
  grapheEchap: "graphe-echap",
} as const;

/** Identifiant d'un raccourci de l'espace. */
export type IdRaccourci = (typeof ID_RACCOURCI)[keyof typeof ID_RACCOURCI];

/** Lit la liste des identifiants de raccourcis désactivés (jamais d'exception). */
export function lireIdsRaccourcisDesactives(): string[] {
  return lireJson<string[]>(RACCOURCIS_ESPACE_CLE, v.tableauDeChaines());
}

/** Un raccourci est-il actif ? Actif tant qu'il n'a pas été explicitement désactivé. */
export function estRaccourciActif(id: string): boolean {
  return !lireIdsRaccourcisDesactives().includes(id);
}

/** Écrit le jeu de raccourcis désactivés et prévient les composants intéressés. */
function ecrireIdsDesactives(ids: string[]): void {
  const uniques = Array.from(new Set(ids));
  if (!ecrireJson(RACCOURCIS_ESPACE_CLE, uniques)) return;
  try {
    window.dispatchEvent(new Event(RACCOURCIS_ESPACE_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

/** Active ou désactive un raccourci donné. */
export function ecrireRaccourciActif(id: string, actif: boolean): void {
  const set = new Set(lireIdsRaccourcisDesactives());
  if (actif) set.delete(id);
  else set.add(id);
  ecrireIdsDesactives(Array.from(set));
}

/** Inverse l'état d'un raccourci et renvoie son nouvel état (true = actif). */
export function basculerRaccourci(id: string): boolean {
  const actif = !estRaccourciActif(id);
  ecrireRaccourciActif(id, actif);
  return actif;
}

/** Nombre de raccourcis actuellement désactivés (aperçu / récapitulatif). */
export function compterRaccourcisDesactives(): number {
  return lireIdsRaccourcisDesactives().length;
}

/** Active ou désactive d'un bloc tous les raccourcis d'une liste donnée. */
export function definirRaccourcisActifs(ids: readonly string[], actif: boolean): void {
  const set = new Set(lireIdsRaccourcisDesactives());
  ids.forEach((id) => {
    if (actif) set.delete(id);
    else set.add(id);
  });
  ecrireIdsDesactives(Array.from(set));
}

/** Réactive tous les raccourcis ; renvoie le nombre de raccourcis qui étaient désactivés. */
export function reinitialiserRaccourcisEspace(): number {
  const n = lireIdsRaccourcisDesactives().length;
  ecrireIdsDesactives([]);
  return n;
}