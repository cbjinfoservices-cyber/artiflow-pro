import { useCallback, useEffect, useState } from "react";
import { fetchResumesHistorique, type AbonnementHistoriqueResume } from "@/lib/abonnementsApi";

/**
 * Charge, en une seule lecture, le résumé d'historique de tous les abonnements.
 * Alimente le compteur de changements d'offre et le mini-historique au survol.
 */
export function useHistoriqueResumes(limiteRecentes = 4) {
  const [resumes, setResumes] = useState<Record<number, AbonnementHistoriqueResume>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResumes(await fetchResumesHistorique(limiteRecentes));
    } catch {
      setError("Impossible de charger les changements d'offre pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [limiteRecentes]);

  useEffect(() => {
    load();
  }, [load]);

  return { resumes, loading, error, reload: load };
}