import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import {
  fetchPaiementsEchecs,
  fetchRelancesImpaye,
  indexerRelancesImpaye,
  type PaiementEchecItem,
  type RelanceImpayeIndex,
} from "@/lib/paiementsEchecsApi";

/** Index vide : aucune relance déjà envoyée. */
const INDEX_VIDE: RelanceImpayeIndex = { parArtisan: {}, parEmail: {} };

/**
 * Charge les dernières tentatives de paiement Stripe échouées pour le back-office,
 * ainsi que l'index des relances de paiement déjà envoyées (badge « déjà relancé »).
 * La lecture est réservée aux gestionnaires (règle d'accès de la table) : pour tout
 * autre profil, on renvoie une liste vide sans requête.
 */
export function usePaiementsEchecs(limite = 20) {
  const { user, isGestionnaire } = useAuth();
  const [items, setItems] = useState<PaiementEchecItem[]>([]);
  const [relances, setRelances] = useState<RelanceImpayeIndex>(INDEX_VIDE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !isGestionnaire) {
      setItems([]);
      setRelances(INDEX_VIDE);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [itemsData, relancesData] = await Promise.all([
        fetchPaiementsEchecs(limite),
        fetchRelancesImpaye().catch((err) => {
          journaliserDepuisErreur({
            ecran: "Back-office · Échecs de paiement",
            source: "recontacts_artisans",
            error: err,
            gravite: "avertissement",
          });
          return [];
        }),
      ]);
      setItems(itemsData);
      setRelances(indexerRelancesImpaye(relancesData));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Back-office · Échecs de paiement",
        source: "paiements_echecs",
        error: e,
      });
      setError("Impossible de charger l'historique des paiements échoués pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [user, isGestionnaire, limite]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, relances, loading, error, reload: load };
}