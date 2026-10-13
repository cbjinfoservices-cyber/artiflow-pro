import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

/**
 * Statistiques de supervision de la régularité comptable de tous les artisans,
 * renvoyées par la fonction Backend `regu_comptable_stats()` (réservée aux
 * gestionnaires : la fonction vérifie elle-même que l'appelant est gestionnaire).
 *
 * Un artisan est « suivi » s'il a activé l'envoi automatique de son journal comptable.
 * Il est « à jour » s'il n'a aucun mois manquant entre son premier envoi automatique
 * et le mois écoulé, « en retard » sinon.
 */
export interface RegulariteComptableStats {
  /** Artisans ayant activé l'envoi automatique de leur journal comptable. */
  artisansSuivis: number;
  /** Parmi eux, ceux à jour (aucun mois manquant). */
  artisansReguliers: number;
  /** Parmi eux, ceux ayant au moins un mois manquant. */
  artisansRetard: number;
  /** Auto activé mais aucun envoi automatique enregistré pour l'instant. */
  artisansSansEnvoi: number;
  /** Cumul des mois manquants sur l'ensemble des artisans suivis. */
  moisManquantsTotal: number;
  /** Envois automatiques portant sur le mois écoulé (tous artisans). */
  envoisAutoMoisEcoule: number;
  /** Date du dernier envoi automatique (tous artisans confondus). */
  dernierEnvoiAt: string | null;
  /** Mois (« AAAA-MM ») du dernier envoi automatique. */
  dernierEnvoiMois: string | null;
  /** Série mensuelle (6 derniers mois) pour le graphe d'évolution. */
  serie6mois?: RegulariteMois[] | null;
}

/** Un point mensuel de la série de régularité comptable (6 derniers mois). */
export interface RegulariteMois {
  /** Mois au format « AAAA-MM ». */
  mois: string;
  /** Nombre total d'envois automatiques ce mois-là. */
  envois: number;
  /** Nombre d'artisans distincts ayant envoyé automatiquement ce mois-là. */
  artisans: number;
  /** Nombre d'artisans déjà suivis (ayant commencé à envoyer) au plus tard ce mois-là. */
  attendus: number;
}

/**
 * Charge les statistiques de régularité comptable de l'ensemble du parc d'artisans.
 * Sans effet pour un compte artisan (aucune donnée sensible ne remonte). Le résultat
 * est rafraîchi quand `refreshKey` change.
 */
export function useRegulariteComptable(refreshKey?: string) {
  const { user, isGestionnaire } = useAuth();
  const [stats, setStats] = useState<RegulariteComptableStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isGestionnaire) {
      setStats(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error: err } = await supabase.rpc("regu_comptable_stats");
        if (cancelled) return;
        const payload = (data ?? null) as (RegulariteComptableStats & { error?: string }) | null;
        if (err || !payload || payload.error) {
          journaliserDepuisErreur({
            ecran: "Back-office · Régularité comptable",
            source: "regu_comptable_stats",
            error: err ?? payload?.error ?? "Réponse vide",
          });
          setStats(null);
          setError("Impossible de charger la régularité comptable pour l'instant.");
        } else {
          setStats(payload);
        }
      } catch (e) {
        if (!cancelled) {
          journaliserDepuisErreur({
            ecran: "Back-office · Régularité comptable",
            source: "regu_comptable_stats",
            error: e,
          });
          setStats(null);
          setError("Impossible de charger la régularité comptable pour l'instant.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isGestionnaire, refreshKey]);

  return { stats, loading, error };
}