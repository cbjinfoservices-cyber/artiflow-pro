import { useCallback, useEffect, useState } from "react";
import {
  fetchAbonnementHistorique,
  OFFRE_PRIX,
  type AbonnementHistoriqueItem,
} from "@/lib/abonnementsApi";

export interface PointActiviteOffres {
  /** Libellé court du mois (ex. « janv. »). */
  label: string;
  /** Nombre de passages d'une offre à une autre ce mois-ci. */
  changements: number;
  /** Montant mensuel de l'offre en vigueur à la fin du mois (null si aucune offre encore). */
  montant: number | null;
}

function montantItem(item: AbonnementHistoriqueItem): number {
  if (item.nouveau_montant && item.nouveau_montant > 0) return item.nouveau_montant;
  return item.nouvelle_valeur ? OFFRE_PRIX[item.nouvelle_valeur] ?? 0 : 0;
}

/**
 * Reconstruit l'activité d'offres d'un abonnement sur les `mois` derniers mois :
 * le nombre de changements d'offre par mois (barres) et le montant mensuel en vigueur
 * à la fin de chaque mois (courbe). Lecture directe depuis le Backend.
 */
export function useActiviteOffresAbonnement(abonnementId: number | null | undefined, mois = 12) {
  const [points, setPoints] = useState<PointActiviteOffres[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!abonnementId) {
      setPoints([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const historique = await fetchAbonnementHistorique(abonnementId);

      const now = new Date();
      const buckets: Array<{ label: string; debut: number; fin: number; changements: number; montant: number | null }> = [];
      for (let i = mois - 1; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          label: d.toLocaleDateString("fr-FR", { month: "short" }),
          debut: d.getTime(),
          fin: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
          changements: 0,
          montant: null,
        });
      }

      // Événements d'offre triés chronologiquement : on rejoue l'offre en vigueur mois par mois.
      const events = historique
        .filter((h) => h.type === "offre" && h.nouvelle_valeur)
        .map((h) => ({
          t: new Date(h.created_at).getTime(),
          montant: montantItem(h),
          changement: Boolean(h.ancienne_valeur && h.nouvelle_valeur),
        }))
        .filter((e) => Number.isFinite(e.t))
        .sort((a, b) => a.t - b.t);

      buckets.forEach((b) => {
        b.changements = events.filter((e) => e.changement && e.t >= b.debut && e.t <= b.fin).length;
        let montantCourant: number | null = null;
        events.forEach((e) => {
          if (e.t <= b.fin) montantCourant = e.montant;
        });
        b.montant = montantCourant && montantCourant > 0 ? montantCourant : null;
      });

      setPoints(buckets.map((b) => ({ label: b.label, changements: b.changements, montant: b.montant })));
    } catch {
      setError("Impossible de charger l'activité d'offres pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [abonnementId, mois]);

  useEffect(() => {
    load();
  }, [load]);

  return { points, loading, error, reload: load };
}