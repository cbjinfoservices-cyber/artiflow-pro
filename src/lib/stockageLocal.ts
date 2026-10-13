/**
 * Accès centralisé, sûr et robuste au stockage local (localStorage).
 *
 * Objectif : ne plus jamais toucher `localStorage` en direct dans le reste du code. Toutes les
 * lectures / écritures de préférences passent par ce module, qui :
 *  — ne remonte JAMAIS d'exception (navigation privée, quota dépassé, `window` absent) : une
 *    lecture échouée renvoie la valeur par défaut, une écriture échouée renvoie `false` ;
 *  — propose des validateurs réutilisables (`v.*`) : une valeur corrompue retombe proprement sur
 *    la valeur par défaut au lieu de propager des données invalides dans l'interface ;
 *  — diffuse un événement unique (`STOCKAGE_LOCAL_EVENT`) à chaque changement, dans le même onglet,
 *    et écoute l'événement natif « storage » entre onglets (via le hook `usePersistedState`).
 *
 * ⚠️ Convention des clés :
 *  — les NOUVELLES clés suivent le format « artiflow:segment:segment » en camelCase, à construire
 *    avec `cleArtiflow(...)` ;
 *  — les préfixes HISTORIQUES (`artiflow.` / `artiflow-` / `artiflow:`) déjà utilisés par les
 *    modules existants ne doivent JAMAIS être renommés : les données déjà stockées chez les
 *    utilisateurs et la synchronisation Backend en dépendent.
 */

/** Événement diffusé dans le même onglet après toute écriture/suppression passée par ce module. */
export const STOCKAGE_LOCAL_EVENT = "artiflow:stockage-local";

/** Détail transmis avec `STOCKAGE_LOCAL_EVENT`. */
export interface StockageLocalChange {
  /** Clé modifiée. */
  cle: string;
  /** Nouvelle valeur brute (`null` en cas de suppression). */
  valeur: string | null;
}

/** Un validateur : transforme une valeur lue (potentiellement corrompue) en valeur sûre. */
export type Validateur<T> = (brut: unknown) => T;

/* -------------------------------------------------------------------------- */
/*                              Accès bas niveau                              */
/* -------------------------------------------------------------------------- */

/** Récupère l'objet `localStorage`, ou `null` s'il est indisponible. */
function recupererStockage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Prévient les composants du même onglet qu'une clé a changé. */
function notifier(cle: string, valeur: string | null): void {
  try {
    window.dispatchEvent(
      new CustomEvent<StockageLocalChange>(STOCKAGE_LOCAL_EVENT, { detail: { cle, valeur } }),
    );
  } catch {
    /* environnement sans window : on ignore */
  }
}

/**
 * Construit une clé ArtiFlow sous la convention « artiflow:segment:segment » en camelCase.
 * Exemple : `cleArtiflow("biblio", "tri")` → `"artiflow:biblio:tri"`.
 * À utiliser uniquement pour les NOUVELLES clés ; ne jamais réutiliser pour renommer une clé historique.
 */
export function cleArtiflow(...segments: (string | number)[]): string {
  const propres = segments.map((s) => String(s).trim()).filter(Boolean);
  return ["artiflow", ...propres].join(":");
}

/** Lit une valeur brute. Renvoie `null` si la clé est absente ou le stockage indisponible. */
export function lireBrut(cle: string): string | null {
  const stockage = recupererStockage();
  if (!stockage) return null;
  try {
    return stockage.getItem(cle);
  } catch {
    return null;
  }
}

/** Écrit une valeur brute. Renvoie `true` si l'écriture a réussi. */
export function ecrireBrut(cle: string, valeur: string): boolean {
  const stockage = recupererStockage();
  if (!stockage) return false;
  try {
    stockage.setItem(cle, valeur);
    notifier(cle, valeur);
    return true;
  } catch {
    return false;
  }
}

/** Supprime une clé (sans erreur si absente ou si le stockage est indisponible). */
export function supprimer(cle: string): void {
  const stockage = recupererStockage();
  if (!stockage) return;
  try {
    stockage.removeItem(cle);
    notifier(cle, null);
  } catch {
    /* stockage indisponible : rien à supprimer */
  }
}

/** Supprime une liste de clés d'un coup. */
export function supprimerCles(cles: readonly string[]): void {
  cles.forEach((cle) => supprimer(cle));
}

/** Renvoie toutes les clés existantes commençant par le préfixe donné. */
export function clesAvecPrefixe(prefixe: string): string[] {
  const stockage = recupererStockage();
  if (!stockage) return [];
  const resultat: string[] = [];
  try {
    for (let i = 0; i < stockage.length; i += 1) {
      const cle = stockage.key(i);
      if (cle && cle.startsWith(prefixe)) resultat.push(cle);
    }
  } catch {
    /* stockage indisponible : on renvoie ce qu'on a pu lire */
  }
  return resultat;
}

/* -------------------------------------------------------------------------- */
/*                              Accès typés JSON                              */
/* -------------------------------------------------------------------------- */

/**
 * Lit une clé, l'interprète comme du JSON et la passe au validateur.
 * Si la clé est absente ou le JSON illisible, le validateur reçoit `undefined`
 * (et retombe donc sur sa valeur par défaut).
 */
export function lireJson<T>(cle: string, valider: Validateur<T>): T {
  const brut = lireBrut(cle);
  if (brut === null) return valider(undefined);
  let parse: unknown;
  try {
    parse = JSON.parse(brut);
  } catch {
    parse = undefined;
  }
  return valider(parse);
}

/** Sérialise une valeur en JSON et l'écrit. Renvoie `true` si l'écriture a réussi. */
export function ecrireJson(cle: string, valeur: unknown): boolean {
  let serialise: string;
  try {
    serialise = JSON.stringify(valeur);
  } catch {
    return false;
  }
  return ecrireBrut(cle, serialise);
}

/** Lit une valeur texte brute (jamais interprétée comme du JSON). */
export function lireTexte(cle: string, defaut = ""): string {
  const brut = lireBrut(cle);
  return brut === null ? defaut : brut;
}

/* -------------------------------------------------------------------------- */
/*                                Validateurs                                 */
/* -------------------------------------------------------------------------- */

/** Options du validateur `v.nombre`. */
export interface OptionsNombre {
  /** Borne inférieure acceptée. */
  min?: number;
  /** Borne supérieure acceptée. */
  max?: number;
  /** Exiger un nombre entier (les décimales sont tronquées). */
  entier?: boolean;
  /** Ramener dans [min, max] au lieu de retomber sur la valeur par défaut. */
  ramener?: boolean;
  /** Accepter une chaîne numérique (« 7 » → 7). Activé par défaut. */
  depuisTexte?: boolean;
}

/** Options du validateur `v.chaine`. */
export interface OptionsChaine {
  /** Longueur maximale acceptée (au-delà, on retombe sur la valeur par défaut). */
  max?: number;
  /** Autoriser la chaîne vide. Par défaut, une chaîne vide retombe sur la valeur par défaut. */
  videOk?: boolean;
}

/** Booleen lu depuis un booléen ou une chaîne (« true » / « 1 » / « false » / « 0 »). */
function validerBooleen(defaut: boolean): Validateur<boolean> {
  return (brut) => {
    if (typeof brut === "boolean") return brut;
    if (brut === "true" || brut === "1" || brut === 1) return true;
    if (brut === "false" || brut === "0" || brut === 0) return false;
    return defaut;
  };
}

/** Nombre lu depuis un nombre ou une chaîne numérique, borné et optionnellement entier. */
function validerNombre(defaut: number, options: OptionsNombre = {}): Validateur<number> {
  const depuisTexte = options.depuisTexte ?? true;
  return (brut) => {
    let n: number;
    if (typeof brut === "number") n = brut;
    else if (typeof brut === "string" && depuisTexte && brut.trim() !== "") n = Number(brut);
    else return defaut;
    if (!Number.isFinite(n)) return defaut;
    if (options.entier) n = Math.trunc(n);
    if (options.min !== undefined && n < options.min) {
      if (options.ramener) n = options.min;
      else return defaut;
    }
    if (options.max !== undefined && n > options.max) {
      if (options.ramener) n = options.max;
      else return defaut;
    }
    return n;
  };
}

/** Chaîne lue depuis une chaîne (ou un nombre/booléen converti), avec garde-fous. */
function validerChaine(defaut: string, options: OptionsChaine = {}): Validateur<string> {
  return (brut) => {
    let s: string;
    if (typeof brut === "string") s = brut;
    else if (typeof brut === "number" || typeof brut === "boolean") s = String(brut);
    else return defaut;
    if (!options.videOk && s.trim() === "" && defaut.trim() !== "") return defaut;
    if (options.max !== undefined && s.length > options.max) return defaut;
    return s;
  };
}

/** Valeur appartenant à une liste fermée, sinon valeur par défaut. */
function validerEnumeration<T extends string | number>(valeurs: readonly T[], defaut: T): Validateur<T> {
  return (brut) => ((valeurs as readonly unknown[]).includes(brut) ? (brut as T) : defaut);
}

/** Tableau ne conservant que les chaînes valides (vide si la donnée est corrompue). */
function validerTableauDeChaines(): Validateur<string[]> {
  return (brut) => (Array.isArray(brut) ? brut.filter((x): x is string => typeof x === "string") : []);
}

/**
 * Objet partiel : chaque clé de la forme est validée indépendamment, les clés absentes ou
 * corrompues retombant sur la valeur par défaut correspondante.
 */
function validerObjetPartiel<O extends Record<string, unknown>>(
  forme: { [K in keyof O]: Validateur<O[K]> },
  defaut: O,
): Validateur<O> {
  return (brut) => {
    const sortie = { ...defaut };
    if (!brut || typeof brut !== "object" || Array.isArray(brut)) return sortie;
    const source = brut as Record<string, unknown>;
    (Object.keys(forme) as (keyof O)[]).forEach((cle) => {
      sortie[cle] = forme[cle](source[cle as string]);
    });
    return sortie;
  };
}

/**
 * Jeu de validateurs réutilisables. Chaque validateur encapsule sa valeur par défaut : une
 * donnée absente ou corrompue retombe donc proprement sur cette valeur.
 */
export const v = {
  /** Valeur telle quelle, ou la valeur par défaut si absente. */
  identite<T>(defaut: T): Validateur<T> {
    return (brut) => (brut === undefined || brut === null ? defaut : (brut as T));
  },
  /** Booléen tolérant (booléen, « true »/« false », « 1 »/« 0 »). */
  booleen(defaut: boolean): Validateur<boolean> {
    return validerBooleen(defaut);
  },
  /** Nombre borné, optionnellement entier, acceptant une chaîne numérique. */
  nombre(defaut: number, options: OptionsNombre = {}): Validateur<number> {
    return validerNombre(defaut, options);
  },
  /** Chaîne, avec longueur maximale et gestion de la chaîne vide. */
  chaine(defaut: string, options: OptionsChaine = {}): Validateur<string> {
    return validerChaine(defaut, options);
  },
  /** Valeur d'une liste fermée (enum). */
  enumeration<T extends string | number>(valeurs: readonly T[], defaut: T): Validateur<T> {
    return validerEnumeration(valeurs, defaut);
  },
  /** Tableau ne gardant que les chaînes. */
  tableauDeChaines(): Validateur<string[]> {
    return validerTableauDeChaines();
  },
  /** Objet partiel validé clé par clé. */
  objetPartiel<O extends Record<string, unknown>>(
    forme: { [K in keyof O]: Validateur<O[K]> },
    defaut: O,
  ): Validateur<O> {
    return validerObjetPartiel(forme, defaut);
  },
};