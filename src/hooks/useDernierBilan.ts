import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchBilansEnvoyes, type BilanArchive, type DernierBilan } from "@/lib/artisanApi";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

interface DernierBilanResult {
  /** Dernier bilan d'archivage envoyé (date + exercice + taille), ou null. */
  bilan: DernierBilan | null;
  /** Liste des bilans d'archivage déjà envoyés (un par exercice), le plus récent en premier. */
  bilans: BilanArchive[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Charge les bilans d'archivage déjà envoyés au comptable (date + exercice + taille),
 * pour les afficher dans la carte d'envoi automatique. RLS garantit qu'un artisan ne
 * voit que ses propres envois.
 */
export function useDernierBilan(): DernierBilanResult {
  const { user } = useAuth();
  const [bilans, setBilans] = useState<BilanArchive[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setBilans([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBilans(await fetchBilansEnvoyes(user.id));
    } catch (e) {
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Bilan d'archivage",
        source: "envois_email",
        error: e,
      });
      setError("Impossible de charger les bilans d'archivage.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Le « dernier » bilan est simplement le premier de la liste (déjà triée du plus récent au plus ancien).
  const premier = bilans[0] ?? null;
  const bilan: DernierBilan | null = premier
    ? { envoye_le: premier.envoye_le, annee: premier.annee, nbLignes: premier.nbLignes, auto: premier.auto }
    : null;

  return { bilan, bilans, loading, error, reload: load };
}