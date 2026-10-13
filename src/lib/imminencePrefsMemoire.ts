/**
 * Préférences d'interface des « signalements imminents ». Il ne s'agit que de réglages d'affichage
 * (aucune donnée métier) stockés localement :
 * - la fenêtre d'alerte (15 / 30 / 60 min) qui décide à partir de quand un traitement est signalé ;
 * - les automatisations volontairement exclues du signalement (bandeau, badge et notification).
 *
 * Toutes les lectures / écritures passent par `src/lib/stockageLocal.ts` (jamais localStorage en direct).
 */

import { ecrireBrut, ecrireJson, lireJson, lireTexte } from "@/lib/stockageLocal";

/** Fenêtre d'alerte : un traitement est « imminent » s'il part dans moins de ce délai. */
export type FenetreImminenteMin = 15 | 30 | 60;

/** Fenêtres proposées dans l'ordre d'affichage. */
export const FENETRES_IMMINENTES_MIN: FenetreImminenteMin[] = [15, 30, 60];

/** Fenêtre par défaut : une heure. */
export const FENETRE_IMMINENTE_DEFAUT: FenetreImminenteMin = 60;

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const IMMINENCE_PREF_EVENT = "artiflow-imminents-pref";

/** Une automatisation que l'utilisateur ne veut plus voir signalée (nom conservé pour pouvoir la réactiver). */
export interface ExclusionImminente {
  id: string;
  nom: string;
}

const CLE_FENETRE = "artiflow.imminents.fenetre";
const CLE_EXCLUS = "artiflow.imminents.exclus";

/** Vrai si la valeur fournie est une fenêtre reconnue. */
function estFenetre(valeur: number | null): valeur is FenetreImminenteMin {
  return valeur === 15 || valeur === 30 || valeur === 60;
}

/** Fenêtre d'alerte courante, ou la valeur par défaut (60 min) si rien n'est mémorisé. */
export function lireFenetreImminenteMin(): FenetreImminenteMin {
  const brut = lireTexte(CLE_FENETRE, "");
  const n = brut ? Number(brut) : Number.NaN;
  return estFenetre(n) ? n : FENETRE_IMMINENTE_DEFAUT;
}

/** Mémorise la fenêtre d'alerte et prévient les composants intéressés. */
export function ecrireFenetreImminenteMin(min: FenetreImminenteMin): void {
  if (!ecrireBrut(CLE_FENETRE, String(min))) return;
  try {
    window.dispatchEvent(new Event(IMMINENCE_PREF_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

/** Liste des automatisations exclues du signalement (robuste à un stockage corrompu). */
export function lireExclusionsImminentes(): ExclusionImminente[] {
  return lireJson<ExclusionImminente[]>(CLE_EXCLUS, (brut) => {
    if (!Array.isArray(brut)) return [];
    return brut
      .filter(
        (x): x is { id: string; nom?: unknown } =>
          Boolean(x) && typeof (x as { id?: unknown }).id === "string",
      )
      .map((x) => ({ id: x.id, nom: typeof x.nom === "string" ? x.nom : x.id }));
  });
}

/** Écrit la liste des exclusions et prévient les composants intéressés. */
function ecrireExclusions(liste: ExclusionImminente[]): void {
  if (!ecrireJson(CLE_EXCLUS, liste)) return;
  try {
    window.dispatchEvent(new Event(IMMINENCE_PREF_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

/** Ajoute une automatisation à la liste des exclusions (sans doublon). */
export function ajouterExclusionImminente(id: string, nom: string): void {
  const liste = lireExclusionsImminentes().filter((e) => e.id !== id);
  liste.push({ id, nom });
  ecrireExclusions(liste);
}

/** Retire une automatisation des exclusions (elle recommence à être signalée). */
export function retirerExclusionImminente(id: string): void {
  ecrireExclusions(lireExclusionsImminentes().filter((e) => e.id !== id));
}

/** Réinitialise les exclusions : toutes les automatisations sont à nouveau signalées. */
export function reinitialiserExclusionsImminentes(): void {
  ecrireExclusions([]);
}