/**
 * Agrégateur des préférences d'affichage, pour les traiter d'un bloc :
 * — les rassembler (pour les sauvegarder dans le Backend et les retrouver sur un autre appareil),
 * — les réappliquer (à la réception du Backend),
 * — les réinitialiser toutes d'un seul geste (« Tout réinitialiser »),
 * — rétablir l'état d'avant une remise à zéro précise (depuis l'historique).
 *
 * On couvre cinq familles : le son de confirmation, l'état des barres de recherche, l'ordre
 * personnalisé (lignes + favoris), les préférences de la bibliothèque de ressources et celles de la
 * bibliothèque de lignes. Aucune donnée métier ici :
 * uniquement des préférences d'interface, propres au compte.
 */

import {
  RECHERCHE_REPLIABLE_PREFIXE,
  compterRecherchesRepliables,
  reinitialiserRecherchesRepliables,
} from "@/lib/rechercheRepliablePrefs";
import {
  LIGNES_ORDRE_KEY,
  LIGNES_ORDRE_EVENT,
  compterOrdreLignes,
  effacerOrdreLignes,
  lireOrdreLignes,
} from "@/lib/lignesOrdrePrefs";
import {
  ORDRE_FAVORIS_KEY,
  appliquerPreferencesBiblio,
  collecterPreferencesBiblio,
  compterOrdreFavoris,
  compterPreferencesBiblio,
  effacerOrdreFavoris,
  lireOrdreFavoris,
  reinitialiserPreferencesBiblio,
  type PreferencesBiblio,
} from "@/lib/bibliothequePrefs";
import {
  appliquerPreferencesLignes,
  collecterPreferencesLignes,
  reinitialiserPreferencesLignes,
  type PreferencesLignes,
} from "@/lib/preferencesLignes";
import {
  appliquerPreferencesFiltres,
  collecterPreferencesFiltres,
  compterPreferencesFiltres,
  reinitialiserPreferencesFiltres,
  type PreferencesFiltres,
} from "@/lib/preferencesFiltres";
import { SON_CLE, SON_PREF_EVENT, ecrireSonActif, lireSonActif } from "@/lib/sonPrefsMemoire";
import { clesAvecPrefixe, ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";
import {
  enregistrerRemiseAZero,
  marquerPreferenceModifiee,
  suspendreNotificationsPreferences,
  tempsRelatifPreference,
  type TypePreference,
} from "@/lib/preferencesAffichageNotif";

export { tempsRelatifPreference };

/** Compare deux photographies et renvoie les familles dont la valeur a réellement changé. */
export function famillesDifferentes(
  a: PreferencesAffichage,
  b: PreferencesAffichage,
): TypePreference[] {
  const memes = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  const res: TypePreference[] = [];
  if (a.son !== b.son) res.push("son");
  if (!memes(a.barres, b.barres)) res.push("barres");
  if (!memes(a.ordres, b.ordres)) res.push("ordres");
  if (!memes(a.biblio, b.biblio)) res.push("biblio");
  if (!memes(a.lignes, b.lignes)) res.push("lignes");
  if (!memes(a.filtres, b.filtres)) res.push("filtres");
  return res;
}

/** Photographie complète des préférences d'affichage synchronisables. */
export interface PreferencesAffichage {
  /** État ouvert (true) / replié (false) de chaque barre de recherche, par identifiant de carte. */
  barres: Record<string, boolean>;
  /** Ordre personnalisé : identifiants de lignes, puis slugs de favoris. */
  ordres: { lignes: number[]; favoris: string[] };
  /** Son de confirmation activé. */
  son: boolean;
  /** Préférences d'affichage de la bibliothèque de ressources (tri, vitesse d'aperçu, épinglage). */
  biblio: PreferencesBiblio;
  /** Préférences d'affichage de la bibliothèque de lignes (catégories, vue, onglet du devis). */
  lignes: PreferencesLignes;
  /** Filtres mémorisés des listes (clients, devis, factures, relances programmées). */
  filtres: PreferencesFiltres;
}

/** Retire toutes les clés de stockage commençant par un préfixe donné. */
function retirerParPrefixe(prefixe: string): void {
  clesAvecPrefixe(prefixe).forEach((k) => supprimer(k));
}

/** Rassemble toutes les préférences d'affichage actuellement mémorisées localement. */
export function collecterPreferencesAffichage(): PreferencesAffichage {
  const barres: Record<string, boolean> = {};
  clesAvecPrefixe(RECHERCHE_REPLIABLE_PREFIXE).forEach((k) => {
    barres[k.slice(RECHERCHE_REPLIABLE_PREFIXE.length)] = lireBrut(k) === "1";
  });
  return {
    barres,
    ordres: { lignes: lireOrdreLignes(), favoris: lireOrdreFavoris() },
    son: lireSonActif(),
    biblio: collecterPreferencesBiblio(),
    lignes: collecterPreferencesLignes(),
    filtres: collecterPreferencesFiltres(),
  };
}

/**
 * Écrit une photographie de préférences dans le stockage local (sans horodater ni synchroniser :
 * c'est une simple application de l'état reçu du Backend). Prévient les écrans ouverts.
 */
export function appliquerPreferencesAffichage(p: PreferencesAffichage): void {
  // Les notifications sont suspendues le temps de l'application : recevoir un état du Backend
  // n'est pas une modification de l'utilisateur et ne doit pas re-déclencher une synchronisation.
  const retablir = suspendreNotificationsPreferences();
  try {
    retirerParPrefixe(RECHERCHE_REPLIABLE_PREFIXE);
    Object.entries(p.barres ?? {}).forEach(([id, ouvert]) => {
      ecrireBrut(`${RECHERCHE_REPLIABLE_PREFIXE}${id}`, ouvert ? "1" : "0");
    });
    ecrireBrut(LIGNES_ORDRE_KEY, JSON.stringify(p.ordres?.lignes ?? []));
    ecrireBrut(ORDRE_FAVORIS_KEY, JSON.stringify(p.ordres?.favoris ?? []));
    ecrireBrut(SON_CLE, p.son ? "1" : "0");
    if (p.biblio) appliquerPreferencesBiblio(p.biblio);
    if (p.lignes) appliquerPreferencesLignes(p.lignes);
    if (p.filtres) appliquerPreferencesFiltres(p.filtres);
  } catch {
    /* une application de famille a échoué : on garde ce qui a pu être appliqué */
  } finally {
    retablir();
  }
  try {
    window.dispatchEvent(new Event(SON_PREF_EVENT));
    window.dispatchEvent(new Event(LIGNES_ORDRE_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

/**
 * Rétablit l'état d'avant une remise à zéro précise, à partir de la photographie mémorisée dans
 * l'historique. Ne touche que la famille concernée. Renvoie true si la restitution a pu se faire.
 */
export function restaurerEtatPreference(type: TypePreference, avant: unknown): boolean {
  if (avant == null) return false;
  try {
    if (type === "barres") {
      retirerParPrefixe(RECHERCHE_REPLIABLE_PREFIXE);
      const entrees = avant as [string, boolean][];
      if (Array.isArray(entrees)) {
        entrees.forEach(([id, ouvert]) => {
          if (typeof id === "string") {
            ecrireBrut(`${RECHERCHE_REPLIABLE_PREFIXE}${id}`, ouvert ? "1" : "0");
          }
        });
      }
      marquerPreferenceModifiee("barres");
      return true;
    }
    if (type === "ordres") {
      const o = avant as { lignes?: number[]; favoris?: string[] };
      ecrireBrut(LIGNES_ORDRE_KEY, JSON.stringify(Array.isArray(o?.lignes) ? o.lignes : []));
      ecrireBrut(ORDRE_FAVORIS_KEY, JSON.stringify(Array.isArray(o?.favoris) ? o.favoris : []));
      window.dispatchEvent(new Event(LIGNES_ORDRE_EVENT));
      marquerPreferenceModifiee("ordres");
      return true;
    }
    if (type === "son") {
      ecrireSonActif(Boolean(avant));
      return true;
    }
    if (type === "biblio") {
      appliquerPreferencesBiblio(avant as PreferencesBiblio);
      marquerPreferenceModifiee("biblio");
      return true;
    }
    if (type === "lignes") {
      appliquerPreferencesLignes(avant as PreferencesLignes);
      marquerPreferenceModifiee("lignes");
      return true;
    }
    if (type === "filtres") {
      appliquerPreferencesFiltres(avant as PreferencesFiltres);
      marquerPreferenceModifiee("filtres");
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Réinitialise d'un seul geste toutes les préférences d'affichage à leurs valeurs par défaut :
 * son réactivé, barres repliées, ordres remis à l'origine, réglages des bibliothèques (ressources
 * et lignes) réinitialisés. Renvoie un petit décompte de ce qui a été remis à zéro.
 */
export function reinitialiserToutPreferencesAffichage(): {
  barres: number;
  ordres: number;
  sonEtaitCoupe: boolean;
  biblio: number;
  lignes: number;
  filtres: number;
} {
  const sonAvant = lireSonActif();
  const sonEtaitCoupe = !sonAvant;
  const ordresAvant = { lignes: lireOrdreLignes(), favoris: lireOrdreFavoris() };
  const barres = reinitialiserRecherchesRepliables();
  const lignesRemises = effacerOrdreLignes();
  const favorisRemis = effacerOrdreFavoris();
  ecrireSonActif(true);
  const biblio = compterPreferencesBiblio();
  reinitialiserPreferencesBiblio();
  const lignes = reinitialiserPreferencesLignes();
  const filtres = reinitialiserPreferencesFiltres();
  const ordres = (lignesRemises ? 1 : 0) + (favorisRemis ? 1 : 0);
  if (ordres > 0) enregistrerRemiseAZero("ordres", ordresAvant);
  if (sonEtaitCoupe) enregistrerRemiseAZero("son", sonAvant);
  // Filet de sécurité : on horodate les familles même si une n'avait rien à remettre à zéro,
  // pour refléter fidèlement la remise à l'état par défaut.
  (["son", "barres", "ordres", "biblio", "lignes", "filtres"] as const).forEach(marquerPreferenceModifiee);
  return { barres, ordres, sonEtaitCoupe, biblio, lignes, filtres };
}

/** Compte les préférences actives, pour l'aperçu d'en-tête de la page. */
export function compterPreferencesActives(): {
  barres: number;
  ordres: number;
} {
  return {
    barres: compterRecherchesRepliables(),
    ordres: (compterOrdreLignes() > 0 ? 1 : 0) + (compterOrdreFavoris() > 0 ? 1 : 0),
  };
}