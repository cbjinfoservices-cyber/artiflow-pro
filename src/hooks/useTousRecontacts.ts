import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchTousRecontacts,
  indexerDerniersRecontacts,
  type RecontactArtisanItem,
} from "@/lib/abonnementsApi";

/**
 * Journal complet des recontacts (tous abonnements), chargé en une seule lecture.
 * Fournit la liste brute (export CSV) et le dernier recontact par abonnement
 * (badge « recontacté le … » et filtre « déjà recontacté / à recontacter »).
 */
export function useTousRecontacts() {
  const [items, setItems] = useState<RecontactArtisanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchTousRecontacts());
    } catch {
      setError("Impossible de charger le journal des recontacts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const parAbonnement = useMemo(() => indexerDerniersRecontacts(items), [items]);

  return { items, parAbonnement, loading, error, reload: load };
}