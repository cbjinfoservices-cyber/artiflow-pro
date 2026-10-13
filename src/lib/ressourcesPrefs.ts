import { readingMinutes, type LectureSource } from "@/mocks/ressources";
import { ecrireBrut, lireTexte } from "@/lib/stockageLocal";

/* ------------------------- Filtre « temps de lecture » ------------------------- */

export type FiltreTemps = "tous" | "courts" | "moyens" | "longs";

/** Options du filtre par temps de lecture (chips). */
export const FILTRES_TEMPS: { id: FiltreTemps; label: string; hint: string; icon: string }[] = [
  { id: "tous", label: "Tous", hint: "Tous les temps de lecture", icon: "ri-time-line" },
  { id: "courts", label: "Courts", hint: "1 min", icon: "ri-flashlight-line" },
  { id: "moyens", label: "Moyens", hint: "2 min", icon: "ri-timer-line" },
  { id: "longs", label: "Longs", hint: "3 min et plus", icon: "ri-hourglass-line" },
];

const FILTRES_TEMPS_IDS = FILTRES_TEMPS.map((f) => f.id);

/** Vrai si la durée (en minutes) correspond au filtre de temps courant. */
export function matchTemps(minutes: number, filtre: FiltreTemps): boolean {
  if (filtre === "courts") return minutes <= 1;
  if (filtre === "moyens") return minutes === 2;
  if (filtre === "longs") return minutes >= 3;
  return true;
}

/** Vrai si l'article passe le filtre de temps de lecture. */
export function passeTemps(article: LectureSource, filtre: FiltreTemps): boolean {
  return matchTemps(readingMinutes(article), filtre);
}

/** Clé de mémorisation du filtre par temps de lecture (partagée par les deux vues). */
const TEMPS_KEY = "artiflow:ressources:temps";

/** Relit le filtre de temps mémorisé. */
export function lireTemps(): FiltreTemps {
  const valeur = lireTexte(TEMPS_KEY, "");
  if (valeur && FILTRES_TEMPS_IDS.includes(valeur as FiltreTemps)) return valeur as FiltreTemps;
  return "tous";
}

/** Mémorise le filtre de temps courant. */
export function ecrireTemps(filtre: FiltreTemps): void {
  ecrireBrut(TEMPS_KEY, filtre);
}

/* --------------------------- Mémoire de la vue active --------------------------- */

export type VueRessources = "metier" | "sujet";

/** Clé de mémorisation de la vue active du hub (Par métier / Par sujet). */
const VUE_KEY = "artiflow:ressources:vue";

/** Relit la dernière vue utilisée (« metier » par défaut). */
export function lireVueActive(): VueRessources {
  return lireTexte(VUE_KEY, "") === "sujet" ? "sujet" : "metier";
}

/** Mémorise la vue active. */
export function ecrireVueActive(vue: VueRessources): void {
  ecrireBrut(VUE_KEY, vue);
}