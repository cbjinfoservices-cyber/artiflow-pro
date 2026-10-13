/**
 * Rassemble les filtres mémorisés des listes de l'espace (clients, devis, factures, relances
 * programmées), pour les sauvegarder sur le compte (Backend) et les retrouver sur n'importe quel
 * appareil, puis les réappliquer.
 *
 * Aucune donnée métier ici : uniquement des préférences d'affichage (les filtres et tris choisis
 * pour chaque liste), propres au compte. La recherche texte en cours, elle, reste locale.
 */

import {
  effacerFiltresClients,
  lireFiltresClients,
  memoriserFiltresClients,
  type FiltresClientsMemoire,
} from "@/lib/clientsFiltresMemoire";
import {
  effacerFiltresDevis,
  lireFiltresDevis,
  memoriserFiltresDevis,
  type FiltresDevisMemoire,
} from "@/lib/devisFiltresMemoire";
import {
  effacerFiltresFactures,
  lireFiltresFactures,
  memoriserFiltresFactures,
  type FiltresFacturesMemoire,
} from "@/lib/facturesFiltresMemoire";
import {
  effacerFiltresRelancesProgrammees,
  lireFiltresRelancesProgrammees,
  memoriserFiltresRelancesProgrammees,
  type FiltresRelancesProgrammeesMemoire,
} from "@/lib/relancesProgrammeesFiltresMemoire";
import { enregistrerRemiseAZero } from "@/lib/preferencesAffichageNotif";

/** Valeurs par défaut des filtres clients (aucun filtre actif). */
const CLIENTS_VIDE: FiltresClientsMemoire = { type: "Tous", priorite: "Toutes", notes: false };
/** Valeurs par défaut des filtres devis (aucun filtre actif). */
const DEVIS_VIDE: FiltresDevisMemoire = { statut: "Tous", modele: "", mois: "", periode: "Tout", tri: "" };
/** Valeurs par défaut des filtres factures (aucun filtre actif). */
const FACTURES_VIDE: FiltresFacturesMemoire = { statut: "Toutes", type: "Factures", periode: "Tout", tri: "" };
/** Valeurs par défaut des filtres relances programmées (aucun filtre actif). */
const RELANCES_VIDE: FiltresRelancesProgrammeesMemoire = {
  periode: "all",
  vue: "liste",
  periodeTraitees: "all",
  statutTraitees: "all",
};

/** Filtres mémorisés des listes de l'espace, sauvegardables sur le compte. */
export interface PreferencesFiltres {
  /** Filtres de la liste des clients (type, priorité, « A des notes »). */
  clients: FiltresClientsMemoire;
  /** Filtres de la liste des devis (statut, modèle, mois, période, tri). */
  devis: FiltresDevisMemoire;
  /** Filtres de la liste des factures (statut, type, période, tri). */
  factures: FiltresFacturesMemoire;
  /** Filtres des relances programmées (période, vue, filtres « déjà traitées »). */
  relances: FiltresRelancesProgrammeesMemoire;
}

/** Rassemble les filtres mémorisés des listes (valeurs complétées par les défauts). */
export function collecterPreferencesFiltres(): PreferencesFiltres {
  return {
    clients: { ...CLIENTS_VIDE, ...lireFiltresClients() },
    devis: { ...DEVIS_VIDE, ...lireFiltresDevis() },
    factures: { ...FACTURES_VIDE, ...lireFiltresFactures() },
    relances: { ...RELANCES_VIDE, ...lireFiltresRelancesProgrammees() },
  };
}

/**
 * Applique une photographie de filtres reçue du compte. Si elle est appelée depuis l'application
 * d'un état Backend, les notifications sont suspendues par l'appelant (pas de re-synchronisation).
 */
export function appliquerPreferencesFiltres(p: PreferencesFiltres): void {
  if (!p) return;
  if (p.clients) memoriserFiltresClients({ ...CLIENTS_VIDE, ...p.clients });
  if (p.devis) memoriserFiltresDevis({ ...DEVIS_VIDE, ...p.devis });
  if (p.factures) memoriserFiltresFactures({ ...FACTURES_VIDE, ...p.factures });
  if (p.relances) memoriserFiltresRelancesProgrammees({ ...RELANCES_VIDE, ...p.relances });
}

/** Compte les listes dont les filtres s'écartent de l'état par défaut (aperçu des préférences). */
export function compterPreferencesFiltres(): number {
  const f = collecterPreferencesFiltres();
  let n = 0;
  if (JSON.stringify(f.clients) !== JSON.stringify(CLIENTS_VIDE)) n += 1;
  if (JSON.stringify(f.devis) !== JSON.stringify(DEVIS_VIDE)) n += 1;
  if (JSON.stringify(f.factures) !== JSON.stringify(FACTURES_VIDE)) n += 1;
  if (JSON.stringify(f.relances) !== JSON.stringify(RELANCES_VIDE)) n += 1;
  return n;
}

/** Détail du nombre de filtres actifs, par liste, pour le compteur du récapitulatif. */
export interface FiltresActifs {
  /** Nombre de filtres clients s'écartant des valeurs par défaut. */
  clients: number;
  /** Nombre de filtres devis s'écartant des valeurs par défaut. */
  devis: number;
  /** Nombre de filtres factures s'écartant des valeurs par défaut. */
  factures: number;
  /** Nombre de filtres relances programmées s'écartant des valeurs par défaut. */
  relances: number;
  /** Somme des filtres actifs sur les quatre listes. */
  total: number;
}

/** Compte, champ par champ, combien de filtres s'écartent des valeurs par défaut pour une liste. */
function compterEcarts<T extends Record<string, unknown>>(valeur: T, defaut: T): number {
  return Object.keys(defaut).reduce((n, cle) => (valeur[cle] !== defaut[cle] ? n + 1 : n), 0);
}

/**
 * Compte les filtres actifs sur chacune des quatre listes (clients, devis, factures, relances),
 * avec le total. Sert au compteur « Filtres actifs » du récapitulatif, qui en détaille la
 * répartition par liste.
 */
export function compterFiltresActifs(): FiltresActifs {
  const f = collecterPreferencesFiltres();
  const clients = compterEcarts({ ...f.clients }, CLIENTS_VIDE);
  const devis = compterEcarts({ ...f.devis }, DEVIS_VIDE);
  const factures = compterEcarts({ ...f.factures }, FACTURES_VIDE);
  const relances = compterEcarts({ ...f.relances }, RELANCES_VIDE);
  return { clients, devis, factures, relances, total: clients + devis + factures + relances };
}

/**
 * Remet à zéro les filtres mémorisés des quatre listes (retour aux filtres par défaut).
 * Renvoie le nombre de listes réellement remises à zéro (0 si aucune n'était filtrée).
 */
export function reinitialiserPreferencesFiltres(): number {
  const avant = collecterPreferencesFiltres();
  const avait = compterPreferencesFiltres() > 0;
  effacerFiltresClients();
  effacerFiltresDevis();
  effacerFiltresFactures();
  effacerFiltresRelancesProgrammees();
  if (avait) enregistrerRemiseAZero("filtres", avant);
  return avait ? 1 : 0;
}