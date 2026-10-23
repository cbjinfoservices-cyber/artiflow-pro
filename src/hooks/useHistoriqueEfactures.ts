import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { chargerHistoriqueEfactures, type EfHistoriqueEntree } from "@/lib/efactureHistorique";

interface HistoriqueEfacturesResult {
  /** Historique par identifiant de facture, du plus récent au plus ancien. */
  historique: Map<number, EfHistoriqueEntree[]>;
  loading: boolean;
}

/**
 * Charge l'historique des changements d'étape des factures électroniques de l'artisan.
 * `refreshKey` permet de recharger après une action (changement d'étape, rejet, envoi).
 */
export function useHistoriqueEfactures(refreshKey?: string): HistoriqueEfacturesResult {
  const { user } = useAuth();
  const [historique, setHistorique] = useState<Map<number, EfHistoriqueEntree[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setHistorique(new Map());
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const map = await chargerHistoriqueEfactures();
        if (!annule) setHistorique(map);
      } catch {
        // L'historique est un confort de lecture : un incident ne doit pas bloquer le registre.
        if (!annule) setHistorique(new Map());
      } finally {
        if (!annule) setLoading(false);
      }
    };

    charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey]);

  return { historique, loading };
}