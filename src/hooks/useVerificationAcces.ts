import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Une anomalie détectée par le contrôle de non-régression des règles d'accès.
 * Renvoyée par la fonction Backend `verifier_acces_ouverts()` (réservée aux gestionnaires :
 * la fonction vérifie elle-même que l'appelant est gestionnaire).
 */
export interface ViolationAcces {
  /** Table concernée (null pour un message d'erreur global, ex. non autorisé). */
  table_name: string | null;
  /** Nature du problème : « rls_desactivee », « policy_ouverte » ou « non_autorise ». */
  probleme: string;
  /** Explication lisible du problème. */
  detail: string;
}

/**
 * Petit garde-fou de sécurité : interroge la fonction Backend `verifier_acces_ouverts()`,
 * qui repère toute table du schéma public repassée en « accès ouvert » — soit parce que la
 * RLS a été désactivée, soit parce qu'une policy `USING true` / `WITH CHECK true` a été ajoutée
 * hors liste blanche. Le contrôle est lancé à la demande (bouton) pour ne pas solliciter la
 * base à chaque affichage.
 */
export function useVerificationAcces() {
  const [violations, setViolations] = useState<ViolationAcces[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [derniereVerif, setDerniereVerif] = useState<string | null>(null);

  const verifier = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("verifier_acces_ouverts");
      const lignes = (data ?? []) as ViolationAcces[];
      if (err) {
        setViolations(null);
        setError("Impossible de lancer le contrôle pour l'instant. Réessayez dans un instant.");
        return;
      }
      if (lignes.some((l) => l.probleme === "non_autorise")) {
        setViolations(null);
        setError("Ce contrôle est réservé aux gestionnaires.");
        return;
      }
      setViolations(lignes);
      setDerniereVerif(new Date().toISOString());
    } catch {
      setViolations(null);
      setError("Impossible de lancer le contrôle pour l'instant. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { violations, loading, error, derniereVerif, verifier };
}