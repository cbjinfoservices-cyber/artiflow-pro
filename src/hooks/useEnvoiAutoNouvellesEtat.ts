import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/**
 * État minimal de l'envoi groupé automatique des nouvelles (activé ou non).
 * Requête volontairement légère pour être montée dans la coquille de l'espace :
 * la cloche peut ainsi rappeler discrètement que l'automatisation est coupée.
 */
export function useEnvoiAutoNouvellesEtat(refreshKey?: string): {
  actif: boolean | null;
  loading: boolean;
} {
  const { user } = useAuth();
  const [actif, setActif] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      if (!user) {
        setActif(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("nouvelles_auto_actif")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (annule) return;
        setActif((data as Record<string, unknown> | null)?.nouvelles_auto_actif === true);
      } catch {
        // Un incident ici ne doit pas bloquer la page : la cloche reste simplement muette.
        if (!annule) setActif(null);
      } finally {
        if (!annule) setLoading(false);
      }
    };

    void charger();
    return () => {
      annule = true;
    };
  }, [user, refreshKey]);

  return { actif, loading };
}