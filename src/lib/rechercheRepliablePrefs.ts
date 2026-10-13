/**
 * Préférence d'affichage des barres de recherche repliables de l'espace.
 * On mémorise, pour chaque barre (identifiée par son `carteId`), si elle est ouverte ou repliée,
 * afin de la retrouver telle quelle à la prochaine visite. Aucune donnée métier ici : c'est un
 * simple réglage d'interface, propre au poste et au navigateur.
 *
 * La lecture / écriture passe exclusivement par `@/lib/stockageLocal` (accès sûrs, sans exception).
 */

import { enregistrerRemiseAZero, marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";
import { clesAvecPrefixe, ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";

/** Préfixe des clés de stockage (une clé par barre, pour éviter les écritures croisées). */
export const RECHERCHE_REPLIABLE_PREFIXE = "artiflow.recherche-repliable.";

/** Construit la clé de stockage d'une barre à partir de son identifiant. */
function cle(carteId: string): string {
  return `${RECHERCHE_REPLIABLE_PREFIXE}${carteId}`;
}

/** État mémorisé d'une barre (true = ouverte, false = repliée), ou null si jamais réglé. */
export function lireRechercheRepliableOuverte(carteId: string): boolean | null {
  const brut = lireBrut(cle(carteId));
  if (brut === "1") return true;
  if (brut === "0") return false;
  return null;
}

/** Mémorise l'état ouvert/replié d'une barre pour la retrouver telle quelle à la prochaine visite. */
export function ecrireRechercheRepliableOuverte(carteId: string, ouvert: boolean): void {
  if (ecrireBrut(cle(carteId), ouvert ? "1" : "0")) marquerPreferenceModifiee("barres");
}

/** Efface la préférence d'une barre (retour au comportement par défaut, repliée). */
export function effacerRechercheRepliable(carteId: string): void {
  supprimer(cle(carteId));
}

/** Nombre de barres dont l'état (ouvert / replié) est actuellement mémorisé (aperçu des préférences). */
export function compterRecherchesRepliables(): number {
  return clesAvecPrefixe(RECHERCHE_REPLIABLE_PREFIXE).length;
}

/**
 * Efface l'état mémorisé de TOUTES les barres de recherche : elles repartiront repliées au
 * prochain affichage. Renvoie le nombre de barres réinitialisées.
 */
export function reinitialiserRecherchesRepliables(): number {
  const cles = clesAvecPrefixe(RECHERCHE_REPLIABLE_PREFIXE);
  // Photographie de l'état d'avant (ouvert/replié de chaque barre), pour pouvoir le rétablir.
  const avant: [string, boolean][] = cles.map((k) => [
    k.slice(RECHERCHE_REPLIABLE_PREFIXE.length),
    lireBrut(k) === "1",
  ]);
  cles.forEach((k) => supprimer(k));
  if (cles.length > 0) enregistrerRemiseAZero("barres", avant);
  return cles.length;
}