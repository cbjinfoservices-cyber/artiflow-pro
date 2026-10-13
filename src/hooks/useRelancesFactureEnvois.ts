import { useCallback, useEffect, useState } from "react";
import { fetchRelanceFactureEnvoisAll, type RelanceFactureEnvoi } from "@/lib/artisanApi";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

/**
 * Charge l'historique complet des relances de factures envoyées pour l'artisan courant.
 * Partagé par le panneau du tableau de bord et la page Profil afin que les deux écrans
 * affichent strictement la même archive comptable.
 * `reloadToken` permet au parent de forcer un rechargement (ex. après un envoi de relance).
 */
export function useRelancesFactureEnvois(userId: string | null | undefined, reloadToken = 0) {
  const [envois, setEnvois] = useState<RelanceFactureEnvoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setEnvois([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setEnvois(await fetchRelanceFactureEnvoisAll(userId));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Relances factures",
        source: "relance_facture_envois",
        error: e,
      });
      setError("Impossible de charger l'historique des relances de factures.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  return { envois, loading, error, reload: load };
}