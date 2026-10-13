/**
 * Hook `usePersistedState` : une valeur persistée dans le stockage local qui reste synchronisée
 * avec l'interface. Il s'appuie sur `useSyncExternalStore` et sur les événements diffusés par
 * `src/lib/stockageLocal.ts` :
 *  — même onglet : à chaque écriture/suppression passée par le module central ;
 *  — entre onglets : grâce à l'événement natif « storage ».
 *
 * Le validateur (issu de `v.*`) est appliqué à la lecture : une donnée corrompue retombe sur la
 * valeur par défaut, et la valeur renvoyée reste stable tant que la donnée brute n'a pas changé
 * (indispensable pour `useSyncExternalStore`).
 */

import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  STOCKAGE_LOCAL_EVENT,
  ecrireJson,
  lireBrut,
  lireJson,
  type StockageLocalChange,
  type Validateur,
} from "@/lib/stockageLocal";

/** Abonne un rappel aux changements de la clé donnée (même onglet + entre onglets). */
function abonner(cle: string, cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const surLocal = (e: Event) => {
    const detail = (e as CustomEvent<StockageLocalChange>).detail;
    if (!detail || detail.cle === cle) cb();
  };
  const surStorage = (e: StorageEvent) => {
    if (e.key === cle || e.key === null) cb();
  };
  window.addEventListener(STOCKAGE_LOCAL_EVENT, surLocal);
  window.addEventListener("storage", surStorage);
  return () => {
    window.removeEventListener(STOCKAGE_LOCAL_EVENT, surLocal);
    window.removeEventListener("storage", surStorage);
  };
}

/**
 * Lit et persiste une valeur typée sous une clé du stockage local.
 * Renvoie un couple `[valeur, écrire]`.
 *
 * ⚠️ Le validateur doit être stable (défini au niveau du module) pour éviter des re-souscriptions
 * inutiles : passez `v.nombre(7, { min: 0 })` une seule fois, hors du rendu.
 */
export function usePersistedState<T>(
  cle: string,
  valider: Validateur<T>,
): [T, (valeur: T) => void] {
  const cache = useRef<{ brut: string | null; valeur: T } | null>(null);
  if (cache.current === null) {
    cache.current = { brut: lireBrut(cle), valeur: lireJson(cle, valider) };
  }

  const getSnapshot = useCallback((): T => {
    const courant = cache.current as { brut: string | null; valeur: T };
    const brut = lireBrut(cle);
    if (brut !== courant.brut) {
      cache.current = { brut, valeur: lireJson(cle, valider) };
    }
    return (cache.current as { valeur: T }).valeur;
  }, [cle, valider]);

  const souscrire = useCallback((cb: () => void) => abonner(cle, cb), [cle]);

  const valeur = useSyncExternalStore(souscrire, getSnapshot, () => valider(undefined));

  const ecrire = useCallback(
    (valeurSuivante: T) => {
      ecrireJson(cle, valeurSuivante);
    },
    [cle],
  );

  return [valeur, ecrire];
}