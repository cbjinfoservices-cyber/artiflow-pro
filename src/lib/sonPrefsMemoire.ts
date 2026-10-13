/**
 * Préférence d'interface « son de confirmation ». Il ne s'agit que d'un réglage d'affichage
 * (aucune donnée métier) stocké localement : les utilisateurs qui préfèrent le silence peuvent
 * couper le petit son joué lors d'un partage, et le choix est mémorisé entre deux visites.
 */

import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";
import { ecrireBrut, lireTexte } from "@/lib/stockageLocal";

/** Clé de stockage de la préférence « son de confirmation ». */
export const SON_CLE = "artiflow.son.confirmation";

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const SON_PREF_EVENT = "artiflow-son-pref";

/** Le son est-il activé ? Activé par défaut tant que l'utilisateur ne l'a pas coupé. */
export function lireSonActif(): boolean {
  const brut = lireTexte(SON_CLE, "");
  if (brut === "") return true;
  return brut === "1";
}

/** Mémorise la préférence de son et prévient les composants intéressés. */
export function ecrireSonActif(actif: boolean): void {
  if (!ecrireBrut(SON_CLE, actif ? "1" : "0")) return;
  try {
    window.dispatchEvent(new Event(SON_PREF_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
  marquerPreferenceModifiee("son");
}