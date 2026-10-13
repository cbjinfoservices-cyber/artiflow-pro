/**
 * Préférence d'affichage de la barre latérale : les groupes (sous-thèmes) du menu que
 * l'utilisateur a repliés. On mémorise uniquement les identifiants des groupes *repliés* :
 * ainsi tout nouveau groupe ajouté plus tard s'affiche déplié par défaut, sans intervention.
 *
 * Aucune donnée métier ici : c'est un simple réglage d'interface, propre au poste et au navigateur.
 * La lecture / écriture passe exclusivement par `@/lib/stockageLocal` (accès sûrs, sans exception).
 */

import { cleArtiflow, v } from "@/lib/stockageLocal";

/** Clé de stockage de la liste des groupes repliés (convention « artiflow:segment:segment »). */
export const MENU_GROUPES_REPLIES_CLE = cleArtiflow("menu", "groupesReplies");

/**
 * Validateur stable de la liste des groupes repliés. Défini au niveau du module (et non dans le
 * rendu) pour garder une identité constante : `usePersistedState` en dépend.
 */
export const VALIDER_GROUPES_REPLIES = v.tableauDeChaines();