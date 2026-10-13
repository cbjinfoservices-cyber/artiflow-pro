import { normaliserPeriodeMoisDelai, PERIODE_MOIS_DELAI_DEFAUT } from "@/lib/recapEchecsAnnuel";
import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

/**
 * Mémoire locale de la PÉRIODE affichée sur la courbe du délai moyen avant relance
 * (12 / 24 / 36 mois). Il ne s'agit que d'une préférence d'affichage (aucune donnée métier) :
 * la fenêtre choisie est conservée d'une ouverture à l'autre, et partagée entre le Diagnostic
 * et la carte des envois automatiques pour que l'export reste aligné sur ce qui est affiché.
 *
 * La lecture / écriture passe exclusivement par `@/lib/stockageLocal` (accès sûrs, sans exception).
 */

const CLE = "artiflow.delai.periodeMois";

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const DELAI_PERIODE_EVENT = "artiflow-delai-periode";

/** Période (en mois) mémorisée, ou la valeur par défaut (36) si rien n'est conservé. */
export function lirePeriodeMoisDelai(): number {
  const brut = lireBrut(CLE);
  if (brut === null) return PERIODE_MOIS_DELAI_DEFAUT;
  return normaliserPeriodeMoisDelai(Number(brut));
}

/** Mémorise la période (12 / 24 / 36 mois) et prévient les composants intéressés. */
export function ecrirePeriodeMoisDelai(mois: number): void {
  if (!ecrireBrut(CLE, String(normaliserPeriodeMoisDelai(mois)))) return;
  try {
    window.dispatchEvent(new Event(DELAI_PERIODE_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

const CLE_MOYENNE = "artiflow.delai.moyenneMobileVisible";

/** Événement diffusé après chaque changement d'affichage de la moyenne mobile. */
export const DELAI_MOYENNE_EVENT = "artiflow-delai-moyenne-mobile";

/**
 * Indique si la ligne de moyenne mobile (pointillés) doit être AFFICHÉE sur la courbe du délai
 * moyen. L'artisan peut la masquer d'un clic sur la légende ; ce choix est mémorisé localement
 * (pure préférence d'affichage) pour être retrouvé tel quel à la réouverture. Affichée par défaut.
 */
export function lireMoyenneMobileVisible(): boolean {
  const brut = lireBrut(CLE_MOYENNE);
  if (brut === null) return true;
  return brut === "1";
}

/** Mémorise l'affichage (ou le masquage) de la ligne de moyenne mobile et prévient les composants. */
export function ecrireMoyenneMobileVisible(visible: boolean): void {
  if (!ecrireBrut(CLE_MOYENNE, visible ? "1" : "0")) return;
  try {
    window.dispatchEvent(new Event(DELAI_MOYENNE_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}