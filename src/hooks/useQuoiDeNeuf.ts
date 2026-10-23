import { useCallback, useMemo, useSyncExternalStore } from "react";
import { STOCKAGE_LOCAL_EVENT, type StockageLocalChange } from "@/lib/stockageLocal";
import {
  CLE_QUOI_DE_NEUF_VU,
  derniereNouveaute,
  lireVersionVue,
  marquerQuoiDeNeufVu,
  nonLuesDepuis,
} from "@/lib/quoiDeNeufVu";

/**
 * Abonne le composant aux changements de la clé « quoi de neuf vu » : dans le même onglet
 * (événement diffusé par le module de stockage) comme entre onglets (événement natif).
 * Indispensable pour que le bandeau, le compteur et la cloche s'accordent instantanément.
 */
function abonner(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const surLocal = (e: Event) => {
    const detail = (e as CustomEvent<StockageLocalChange>).detail;
    if (!detail || detail.cle === CLE_QUOI_DE_NEUF_VU) cb();
  };
  const surStorage = (e: StorageEvent) => {
    if (e.key === CLE_QUOI_DE_NEUF_VU || e.key === null) cb();
  };
  window.addEventListener(STOCKAGE_LOCAL_EVENT, surLocal);
  window.addEventListener("storage", surStorage);
  return () => {
    window.removeEventListener(STOCKAGE_LOCAL_EVENT, surLocal);
    window.removeEventListener("storage", surStorage);
  };
}

/**
 * État partagé du journal des nouveautés côté artisan : la dernière livraison, ce qui reste
 * à lire, et l'action de tout marquer comme lu.
 *
 * La valeur lue est une chaîne stable, ce qui rend `useSyncExternalStore` sûr : deux lectures
 * successives sans changement renvoient la même valeur (pas de rendu en boucle).
 */
export function useQuoiDeNeuf() {
  const versionVue = useSyncExternalStore(abonner, lireVersionVue, () => "");
  const nonLues = useMemo(() => nonLuesDepuis(versionVue), [versionVue]);

  const marquerToutVu = useCallback(() => {
    marquerQuoiDeNeufVu(derniereNouveaute.version);
  }, []);

  return {
    versionVue,
    derniere: derniereNouveaute,
    nonLues,
    nombreNonLues: nonLues.length,
    /** Vrai tant que la dernière livraison n'a pas été vue. */
    derniereNonLue: versionVue !== derniereNouveaute.version,
    marquerToutVu,
  };
}