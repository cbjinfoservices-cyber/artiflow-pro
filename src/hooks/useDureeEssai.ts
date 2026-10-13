import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  DUREE_ESSAI_DEFAUT,
  fetchDureeEssai,
  enregistrerDureeEssai,
  viderCacheDureeEssai,
} from "@/lib/parametresEssai";

/**
 * Durée d'essai en vigueur (réglage global modifiable depuis le back-office).
 * Utilisé par l'information de fin d'essai, le compte à rebours du tableau de bord
 * artisan et le tunnel de souscription. La lecture est publique ; l'écriture est
 * réservée aux gestionnaires (règles de sécurité côté Backend).
 */
export function useDureeEssai() {
  const { user } = useAuth();
  const [jours, setJours] = useState(DUREE_ESSAI_DEFAUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJours(await fetchDureeEssai());
    } catch {
      setJours(DUREE_ESSAI_DEFAUT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (nouvelleDuree: number): Promise<{ error: string | null; jours: number }> => {
      setSaving(true);
      setError(null);
      try {
        const propre = await enregistrerDureeEssai(nouvelleDuree, user?.email ?? null);
        setJours(propre);
        viderCacheDureeEssai();
        return { error: null, jours: propre };
      } catch {
        const message = "L'enregistrement de la durée d'essai a échoué.";
        setError(message);
        return { error: message, jours };
      } finally {
        setSaving(false);
      }
    },
    [user, jours],
  );

  return { jours, loading, saving, error, save, reload: load };
}