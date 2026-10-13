import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import type { Validateur } from "@/lib/stockageLocal";

/**
 * Un filtre de la page Média piloté par l'URL *et* mémorisé localement.
 *
 * Deux sources, dans cet ordre de priorité :
 *  1. l'URL (`?lieu=Lyon`, `?format=Webinaire`, `?tri=ancien`…) : un lien partagé
 *     ouvre directement la bonne sélection, et une combinaison de filtres se
 *     transmet donc exactement d'un visiteur à l'autre ;
 *  2. la préférence mémorisée : on retrouve telle quelle la dernière vue consultée.
 *
 * Une valeur présente dans l'URL mais inconnue/invalide est ignorée (retour à la
 * préférence), pour ne jamais aboutir à une liste vide à cause d'un lien erroné.
 * La valeur par défaut est retirée de l'URL, afin de garder des liens propres.
 */
export function useFiltreUrl<T extends string>(options: {
  /** Clé de stockage local (mémoire de la préférence). */
  cle: string;
  /** Nom du paramètre d'URL (ex. « lieu », « format »). */
  parametre: string;
  /** Validateur appliqué à la valeur mémorisée (stable, défini au niveau du module). */
  valider: Validateur<T>;
  /** Valeur par défaut : elle est retirée de l'URL pour rester lisible. */
  defaut: T;
  /** Reconnaît une valeur acceptée depuis l'URL (garde-fou anti-lien erroné). */
  estValide: (valeur: string) => boolean;
}): [T, (valeur: T) => void] {
  const { cle, parametre, valider, defaut, estValide } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const [memorise, setMemorise] = usePersistedState(cle, valider);

  const brut = searchParams.get(parametre);
  const valeurUrl = brut !== null && estValide(brut) ? (brut as T) : null;
  const actif = valeurUrl ?? memorise;

  // Un lien partagé prime sur la préférence : on l'adopte aussi en mémoire, pour
  // retrouver la vue sélectionnée à la prochaine visite sans le paramètre d'URL.
  useEffect(() => {
    if (valeurUrl && valeurUrl !== memorise) {
      setMemorise(valeurUrl);
    }
  }, [valeurUrl, memorise, setMemorise]);

  const definir = useCallback(
    (valeur: T) => {
      setMemorise(valeur);
      setSearchParams(
        (precedents) => {
          const suivants = new URLSearchParams(precedents);
          if (valeur === defaut) suivants.delete(parametre);
          else suivants.set(parametre, valeur);
          return suivants;
        },
        { replace: true },
      );
    },
    [defaut, parametre, setMemorise, setSearchParams],
  );

  return [actif, definir];
}