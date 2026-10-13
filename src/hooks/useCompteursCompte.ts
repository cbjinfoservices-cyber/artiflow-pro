import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { normalizeDevisStatut, normalizeFactureStatut } from "@/lib/statuts";

/** Compteurs légers affichés dans le menu du compte. */
export interface CompteursCompte {
  /** Devis encore en attente de réponse client (Envoyé / À relancer). */
  devisEnAttente: number;
  /** Factures non réglées (Émise / En retard). */
  facturesImpayees: number;
  /** Montant HT cumulé des devis encore en attente. */
  devisEnAttenteMontant: number;
  /** Montant TTC cumulé des factures non réglées. */
  facturesImpayeesMontant: number;
  loading: boolean;
}

const VIDE: CompteursCompte = {
  devisEnAttente: 0,
  facturesImpayees: 0,
  devisEnAttenteMontant: 0,
  facturesImpayeesMontant: 0,
  loading: true,
};

/**
 * Charge uniquement les statuts des devis et factures de l'artisan connecté
 * pour alimenter les badges de comptage du menu (sans charger les listes complètes).
 */
export function useCompteursCompte(): CompteursCompte {
  const { user } = useAuth();
  const [state, setState] = useState<CompteursCompte>(VIDE);

  useEffect(() => {
    let actif = true;

    if (!user) {
      setState({
        devisEnAttente: 0,
        facturesImpayees: 0,
        devisEnAttenteMontant: 0,
        facturesImpayeesMontant: 0,
        loading: false,
      });
      return () => {
        actif = false;
      };
    }

    (async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const [devisRes, facturesRes] = await Promise.all([
          supabase.from("devis").select("statut, total_ht").eq("user_id", user.id),
          supabase.from("factures").select("statut, total_ttc").eq("user_id", user.id),
        ]);
        if (!actif) return;

        const devisRows = (devisRes.data ?? []) as Array<{ statut: string | null; total_ht: number | null }>;
        const factureRows = (facturesRes.data ?? []) as Array<{ statut: string | null; total_ttc: number | null }>;

        const devisAttente = devisRows.filter((row) => {
          const s = normalizeDevisStatut(row.statut);
          return s === "Envoyé" || s === "À relancer";
        });
        const facturesNonReglees = factureRows.filter((row) => normalizeFactureStatut(row.statut) !== "Payée");

        setState({
          devisEnAttente: devisAttente.length,
          facturesImpayees: facturesNonReglees.length,
          devisEnAttenteMontant: devisAttente.reduce((sum, row) => sum + Number(row.total_ht || 0), 0),
          facturesImpayeesMontant: facturesNonReglees.reduce((sum, row) => sum + Number(row.total_ttc || 0), 0),
          loading: false,
        });
      } catch {
        if (actif) setState((prev) => ({ ...prev, loading: false }));
      }
    })();

    return () => {
      actif = false;
    };
  }, [user]);

  return state;
}