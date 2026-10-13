import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface MonAbonnement {
  id: number;
  artisan_id: string | null;
  entreprise: string;
  email: string | null;
  metier: string | null;
  ville: string | null;
  offre: string;
  statut: string;
  montant_mensuel: number;
  canal_paiement: string | null;
  date_debut: string | null;
  date_echeance: string | null;
  /** Préférence d'affichage des montants : true = TTC, false = HT. */
  montants_ttc: boolean;
}

const COLONNES =
  "id, artisan_id, entreprise, email, metier, ville, offre, statut, montant_mensuel, canal_paiement, date_debut, date_echeance, montants_ttc";

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function mapRow(row: Record<string, unknown>): MonAbonnement {
  const montant = Number(row.montant_mensuel);
  return {
    id: Number(row.id),
    artisan_id: toStr(row.artisan_id),
    entreprise: toStr(row.entreprise) ?? "—",
    email: toStr(row.email),
    metier: toStr(row.metier),
    ville: toStr(row.ville),
    offre: toStr(row.offre) ?? "Essentiel",
    statut: toStr(row.statut) ?? "Actif",
    montant_mensuel: Number.isFinite(montant) ? montant : 0,
    canal_paiement: toStr(row.canal_paiement),
    date_debut: toStr(row.date_debut),
    date_echeance: toStr(row.date_echeance),
    montants_ttc: row.montants_ttc === null || row.montants_ttc === undefined ? true : Boolean(row.montants_ttc),
  };
}

/**
 * Récupère l'abonnement de l'artisan connecté.
 * On cherche d'abord par `artisan_id`, puis en repli par l'email du profil
 * (utile pour les abonnements historiques dont `artisan_id` est vide).
 */
export function useMonAbonnement() {
  const { user, profile } = useAuth();
  const [abonnement, setAbonnement] = useState<MonAbonnement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const email = user?.email ?? profile?.email ?? null;

  const load = useCallback(async () => {
    if (!user) {
      setAbonnement(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: errArtisan } = await supabase
        .from("abonnements")
        .select(COLONNES)
        .eq("artisan_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (errArtisan) throw errArtisan;
      if (data) {
        setAbonnement(mapRow(data as Record<string, unknown>));
        return;
      }

      if (email) {
        const { data: dataEmail, error: errEmail } = await supabase
          .from("abonnements")
          .select(COLONNES)
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (errEmail) throw errEmail;
        if (dataEmail) {
          setAbonnement(mapRow(dataEmail as Record<string, unknown>));
          return;
        }
      }

      setAbonnement(null);
    } catch {
      setError("Impossible de charger votre abonnement pour l'instant. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }, [user, email]);

  useEffect(() => {
    load();
  }, [load]);

  return { abonnement, loading, error, reload: load };
}