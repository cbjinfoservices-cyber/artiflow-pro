import { useCallback, useEffect, useState } from "react";
import { fetchChangementsOffreParMois, type ChangementOffreMois } from "@/lib/abonnementsApi";

/**
 * Résumé mensuel du nombre de changements d'offre (tous abonnements confondus),
 * pour le back-office Abonnements. Lecture directe depuis le Backend.
 */
export function useChangementsOffreParMois(mois = 6) {
  const [data, setData] = useState<ChangementOffreMois[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchChangementsOffreParMois(mois));
    } catch {
      setError("Impossible de charger les changements d'offre pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [mois]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}