import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Répartition du carnet de clients entre particuliers et entreprises. */
export interface CompteursClients {
  particuliers: number;
  entreprises: number;
}

const VIDE: CompteursClients = { particuliers: 0, entreprises: 0 };

/**
 * Compteurs légers du carnet de clients (particuliers / entreprises), utilisés par les pastilles
 * du menu latéral et du tiroir mobile : on voit le volume de chaque type sans ouvrir la page.
 *
 * Une seule requête ramène la colonne `type` de toutes les fiches, puis on répartit côté client.
 * Le chargement n'a lieu que lorsque `actif` est vrai (compte artisan), pour ne pas solliciter
 * le Backend depuis les autres profils. `refreshKey` (typiquement le chemin courant) provoque
 * une remise à jour à chaque navigation, donc après une création ou une modification de fiche.
 */
export function useClientsCounts(actif: boolean, refreshKey?: string): CompteursClients {
  const [counts, setCounts] = useState<CompteursClients>(VIDE);

  useEffect(() => {
    if (!actif) {
      setCounts(VIDE);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("clients").select("type");
        if (cancelled) return;
        if (error) {
          setCounts(VIDE);
          return;
        }
        const lignes = data ?? [];
        setCounts({
          entreprises: lignes.filter((c) => c.type === "professionnel").length,
          particuliers: lignes.filter((c) => c.type !== "professionnel").length,
        });
      } catch {
        if (!cancelled) setCounts(VIDE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actif, refreshKey]);

  return counts;
}