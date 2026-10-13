import { useCallback, useEffect, useState } from "react";
import { fetchRecontactsArtisan, type RecontactArtisanItem } from "@/lib/abonnementsApi";

/**
 * Journal des recontacts envoyés à un compte volatil.
 * Le chargement est déclenché uniquement quand `actif` passe à vrai (panneau ouvert),
 * pour ne pas requêter toutes les lignes de la liste.
 */
export function useRecontactsArtisan(abonnementId: number, actif: boolean, refreshKey = 0) {
  const [items, setItems] = useState<RecontactArtisanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!actif) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchRecontactsArtisan(abonnementId));
    } catch {
      setError("Impossible de charger le journal des recontacts.");
    } finally {
      setLoading(false);
    }
  }, [abonnementId, actif]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { items, loading, error, reload: load };
}