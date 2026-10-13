/**
 * Trace de la dernière restauration de préférences depuis le compte.
 *
 * Quand on se connecte sur un appareil où les préférences locales diffèrent de celles du compte
 * (cas typique d'un nouvel appareil), le moteur de synchronisation réapplique les préférences du
 * compte. On mémorise alors la liste des familles réellement restaurées, afin de pouvoir en
 * proposer un petit résumé à l'utilisateur — un repère rassurant, surtout la première fois.
 *
 * Aucune donnée métier ici : uniquement des préférences d'interface, propres au compte.
 * L'accès au stockage passe par `src/lib/stockageLocal.ts` (jamais localStorage en direct).
 */

import { ecrireJson, supprimer, lireJson } from "@/lib/stockageLocal";
import type { TypePreference } from "@/lib/preferencesAffichageNotif";

/** Résumé d'une restauration : quand, et quelles familles ont été reprises depuis le compte. */
export interface RestaurationPreferences {
  /** Date (ISO) de la restauration. */
  quand: string;
  /** Familles de préférences qui ont réellement changé en appliquant l'état du compte. */
  familles: TypePreference[];
}

const CLE = "artiflow.preferences.restauration";

/** Événement diffusé après une restauration, pour que l'interface propose le résumé. */
export const PREFERENCES_RESTAUREES_EVENT = "artiflow:preferences-restaurees";

/** Mémorise la restauration qui vient d'avoir lieu et prévient l'interface (résumé à proposer). */
export function enregistrerRestauration(
  familles: TypePreference[],
  quand: string = new Date().toISOString(),
): void {
  if (familles.length === 0) return;
  const rec: RestaurationPreferences = { quand, familles };
  ecrireJson(CLE, rec);
  try {
    window.dispatchEvent(new Event(PREFERENCES_RESTAUREES_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

/** Relit la dernière restauration mémorisée (null si aucune ou si elle a déjà été écartée). */
export function lireDerniereRestauration(): RestaurationPreferences | null {
  return lireJson<RestaurationPreferences | null>(CLE, (brut) => {
    if (!brut || typeof brut !== "object") return null;
    const parsed = brut as Partial<RestaurationPreferences>;
    if (parsed && Array.isArray(parsed.familles) && parsed.familles.length > 0 && typeof parsed.quand === "string") {
      return { quand: parsed.quand, familles: parsed.familles as TypePreference[] };
    }
    return null;
  });
}

/** Oublie la dernière restauration (appelé quand l'utilisateur a écarté le résumé). */
export function oublierRestauration(): void {
  supprimer(CLE);
}