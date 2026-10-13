import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import {
  fetchAlertesConfigStripe,
  marquerAlerteTraitee,
  marquerAlertesTraitees,
  rouvrirAlerteConfigStripe,
  type AlerteConfigStripeItem,
} from "@/lib/alertesConfigStripeApi";

/**
 * Charge l'historique des alertes de configuration Stripe (date, cause, destinataires)
 * pour le back-office, et expose les actions de suivi (marquer traitée / rouvrir).
 * La lecture et l'écriture sont réservées aux gestionnaires (règles d'accès de la
 * table) : pour tout autre profil, on renvoie une liste vide sans requête.
 */
export function useAlertesConfigStripe(limite = 50) {
  const { user, isGestionnaire } = useAuth();
  const [items, setItems] = useState<AlerteConfigStripeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !isGestionnaire) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchAlertesConfigStripe(limite));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Back-office · Alertes config Stripe",
        source: "alerte_config_stripe",
        error: e,
      });
      setError("Impossible de charger l'historique des alertes de configuration pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [user, isGestionnaire, limite]);

  useEffect(() => {
    load();
  }, [load]);

  /** Marque une alerte comme traitée (statut + auteur + date), avec mise à jour optimiste. */
  const marquerTraitee = useCallback(async (id: number, auteur: string) => {
    await marquerAlerteTraitee(id, auteur);
    const at = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, statut: "traitee", traite_par: auteur.trim(), traite_at: at } : it,
      ),
    );
  }, []);

  /** Marque plusieurs alertes comme traitées d'un coup (action groupée de la vue filtrée). */
  const marquerToutTraitee = useCallback(async (ids: number[], auteur: string) => {
    if (ids.length === 0) return;
    await marquerAlertesTraitees(ids, auteur);
    const at = new Date().toISOString();
    const cibles = new Set(ids);
    setItems((prev) =>
      prev.map((it) =>
        cibles.has(it.id)
          ? { ...it, statut: "traitee", traite_par: auteur.trim(), traite_at: at }
          : it,
      ),
    );
  }, []);

  /** Rouvre une alerte marquée par erreur (retour au statut « à traiter »). */
  const rouvrir = useCallback(async (id: number) => {
    await rouvrirAlerteConfigStripe(id);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, statut: "nouvelle", traite_par: "", traite_at: "" } : it,
      ),
    );
  }, []);

  return { items, loading, error, reload: load, marquerTraitee, marquerToutTraitee, rouvrir };
}