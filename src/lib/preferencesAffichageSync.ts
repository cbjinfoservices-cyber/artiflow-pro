/**
 * Moteur de synchronisation des préférences d'affichage vers le Backend.
 *
 * Objectif : retrouver ses préférences (son, barres de recherche, aide des raccourcis, ordres
 * personnalisés) sur n'importe quel appareil. À la connexion, on charge les préférences du compte ;
 * à chaque modification, on les renvoie (regroupées et légèrement différées pour éviter les
 * écritures à répétition).
 *
 * Ce module est un petit « singleton » : un seul point d'écoute global, monté par le hook
 * `usePreferencesAffichageSync`, partagé par toute l'application.
 */

import {
  appliquerPreferencesAffichage,
  collecterPreferencesAffichage,
  famillesDifferentes,
} from "@/lib/preferencesAffichage";
import { enregistrerRestauration } from "@/lib/preferencesRestauration";
import {
  PREFERENCES_MODIFIEES_EVENT,
  ecrireMajPreferences,
  lireMajPreferences,
} from "@/lib/preferencesAffichageNotif";
import {
  chargerPreferencesAffichage,
  enregistrerPreferencesAffichage,
} from "@/lib/preferencesAffichageApi";

/** État courant de la synchronisation, exposé aux composants. */
export interface EtatSyncPreferences {
  /** Un compte est connecté : la synchronisation est active. */
  connecte: boolean;
  /** Une opération de synchronisation est en cours. */
  enCours: boolean;
  /** Date (ISO) de la dernière synchronisation réussie. */
  derniereSynchro: string | null;
  /** Message d'erreur éventuel (null si tout va bien). */
  erreur: string | null;
}

let userId: string | null = null;
let etat: EtatSyncPreferences = {
  connecte: false,
  enCours: false,
  derniereSynchro: null,
  erreur: null,
};
const abonnes = new Set<(e: EtatSyncPreferences) => void>();
let timerPush: number | null = null;
let ecouteInstallee = false;

function notifier(): void {
  abonnes.forEach((cb) => cb(etat));
}

function majEtat(patch: Partial<EtatSyncPreferences>): void {
  etat = { ...etat, ...patch };
  notifier();
}

/** Diffère l'envoi des préférences (les modifications arrivent souvent en rafale). */
function planifierPush(): void {
  if (!userId) return;
  if (timerPush) window.clearTimeout(timerPush);
  timerPush = window.setTimeout(() => {
    timerPush = null;
    void pousserPreferences();
  }, 1500);
}

function installerEcoute(): void {
  if (ecouteInstallee || typeof window === "undefined") return;
  ecouteInstallee = true;
  window.addEventListener(PREFERENCES_MODIFIEES_EVENT, () => planifierPush());
}

/** Envoie immédiatement les préférences locales vers le Backend. */
export async function pousserPreferences(): Promise<void> {
  if (!userId) return;
  const id = userId;
  majEtat({ enCours: true });
  try {
    await enregistrerPreferencesAffichage(id, collecterPreferencesAffichage(), lireMajPreferences());
    majEtat({ enCours: false, derniereSynchro: new Date().toISOString(), erreur: null });
  } catch {
    majEtat({ enCours: false, erreur: "Enregistrement des préférences impossible pour le moment." });
  }
}

/**
 * Charge les préférences du Backend et les applique localement. Si le compte n'en a jamais
 * enregistré (premier appareil), on envoie les préférences locales pour amorcer la sauvegarde.
 */
export async function tirerPreferences(): Promise<void> {
  if (!userId) return;
  const id = userId;
  majEtat({ enCours: true, erreur: null });
  try {
    const ligne = await chargerPreferencesAffichage(id);
    if (ligne?.donnees) {
      // On note l'état local d'avant l'application, pour savoir ce qui a été réellement restauré
      // depuis le compte (utile sur un nouvel appareil, où presque tout diffère des valeurs locales).
      const avant = collecterPreferencesAffichage();
      appliquerPreferencesAffichage(ligne.donnees);
      if (ligne.maj) ecrireMajPreferences(ligne.maj);
      const familles = famillesDifferentes(avant, collecterPreferencesAffichage());
      if (familles.length > 0) enregistrerRestauration(familles);
    } else {
      await enregistrerPreferencesAffichage(id, collecterPreferencesAffichage(), lireMajPreferences());
    }
    majEtat({ enCours: false, derniereSynchro: new Date().toISOString(), erreur: null });
  } catch {
    majEtat({ enCours: false, erreur: "Chargement des préférences impossible pour le moment." });
  }
}

/**
 * Démarre (ou arrête) la synchronisation pour le compte donné. Sans compte, la synchronisation est
 * simplement inactive ; les préférences restent locales, comme avant.
 */
export function demarrerSyncPreferences(id: string | null): void {
  installerEcoute();
  if (id === userId) return;
  userId = id;
  if (timerPush) {
    window.clearTimeout(timerPush);
    timerPush = null;
  }
  if (!id) {
    majEtat({ connecte: false, enCours: false, erreur: null, derniereSynchro: null });
    return;
  }
  majEtat({ connecte: true, enCours: true, erreur: null });
  void tirerPreferences();
}

/** S'abonne aux changements d'état de la synchronisation. Renvoie la fonction de désabonnement. */
export function souscrireSyncPreferences(cb: (e: EtatSyncPreferences) => void): () => void {
  abonnes.add(cb);
  cb(etat);
  return () => {
    abonnes.delete(cb);
  };
}