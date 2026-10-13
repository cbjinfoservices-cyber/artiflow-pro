import { supabase } from "@/lib/supabase";

export interface LigneIa {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
}

export interface DevisIaResult {
  objet: string;
  lignes: LigneIa[];
}

/**
 * Demande à l'IA de proposer les lignes d'un devis à partir d'une description
 * libre du chantier. Rien n'est enregistré : la proposition est renvoyée
 * pour être présentée (et corrigée) par l'artisan dans le formulaire.
 */
export async function genererLignesDevis(description: string): Promise<DevisIaResult> {
  const { data, error } = await supabase.functions.invoke("generer-devis-lignes", {
    body: { description },
  });
  if (error) throw new Error(error.message);

  const payload = data as
    | { ok?: boolean; error?: string; objet?: string; lignes?: LigneIa[] }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "La génération du devis par l'IA a échoué.");

  return {
    objet: payload.objet ?? "",
    lignes: Array.isArray(payload.lignes) ? payload.lignes : [],
  };
}