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

/**
 * Clé de stockage de l'état du bloc « Mon compte » (profil, comptabilité, préférences).
 * Il vit dans son propre composant, d'où une clé séparée de celle des groupes métier.
 */
export const MENU_COMPTE_REPLIE_CLE = cleArtiflow("menu", "compteReplie");

/** Validateur stable du bloc « Mon compte » (déplié par défaut). */
export const VALIDER_MENU_COMPTE_REPLIE = v.booleen(false);

/* -------------------------------------------------------------------------- */
/*                Sous-liste Particuliers / Entreprises (Clients)             */
/* -------------------------------------------------------------------------- */

/**
 * Clé de stockage de l'état de la sous-liste du bloc « Clients ». Par défaut elle est dépliée
 * (`false` = non repliée) : les deux portes d'entrée sont visibles dès l'ouverture du menu.
 */
export const MENU_CLIENTS_REPLIE_CLE = cleArtiflow("menu", "clientsReplie");

/** Validateur stable de la sous-liste « Clients » (dépliée par défaut). */
export const VALIDER_CLIENTS_REPLIE = v.booleen(false);

/* -------------------------------------------------------------------------- */
/*                        Ordre des groupes (glisser-déposer)                 */
/* -------------------------------------------------------------------------- */

/**
 * Clé de stockage de l'ordre des groupes de la barre latérale. On mémorise la liste des titres
 * dans l'ordre choisi par l'utilisateur ; toute comparaison se fait sur le libellé du groupe.
 */
export const MENU_ORDRE_GROUPES_CLE = cleArtiflow("menu", "ordreGroupes");

/** Validateur stable de l'ordre mémorisé (liste de titres de groupes). */
export const VALIDER_ORDRE_GROUPES = v.tableauDeChaines();

/**
 * Reconstruit un ordre complet et fiable à partir de l'ordre mémorisé :
 *  — les titres connus mais absents de la mémoire arrivent à la suite, dans l'ordre par défaut ;
 *  — les titres mémorisés qui n'existent plus (groupe renommé ou supprimé) sont ignorés ;
 *  — les doublons sont éliminés.
 * Une préférence corrompue retombe donc naturellement sur l'ordre par défaut.
 */
export function normaliserOrdreGroupes(
  defaut: readonly string[],
  memorise: readonly string[],
): string[] {
  const connus = new Set(defaut);
  const ordre: string[] = [];
  memorise.forEach((titre) => {
    if (connus.has(titre) && !ordre.includes(titre)) ordre.push(titre);
  });
  defaut.forEach((titre) => {
    if (!ordre.includes(titre)) ordre.push(titre);
  });
  return ordre;
}