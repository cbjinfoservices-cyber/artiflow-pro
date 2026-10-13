import { supabase } from "@/lib/supabase";
import { computeTotaux, fetchDevisLignes, normalizeTvaRate, type LigneInput } from "@/lib/artisanApi";

/**
 * Ajoute des lignes à un devis existant (complétion depuis la bibliothèque),
 * puis recalcule et met à jour les totaux HT / TTC du devis.
 */
export async function appendLignesToDevis(devisId: number, nouvellesLignes: LigneInput[]): Promise<void> {
  const propres = nouvellesLignes.filter((l) => l.designation.trim().length > 0);
  if (propres.length === 0) return;

  const rows = propres.map((l) => ({
    devis_id: devisId,
    designation: l.designation.trim(),
    unite: (l.unite || "u").trim() || "u",
    quantite: Number(l.quantite) || 0,
    prix_unitaire: Number(l.prix_unitaire) || 0,
    taux_tva: normalizeTvaRate(l.taux_tva),
  }));
  const { error: insertError } = await supabase.from("lignes_devis").insert(rows);
  if (insertError) throw insertError;

  const existantes = await fetchDevisLignes(devisId);
  const { ht, ttc } = computeTotaux(existantes);
  const { error: updateError } = await supabase
    .from("devis")
    .update({ total_ht: ht, total_ttc: ttc })
    .eq("id", devisId);
  if (updateError) throw updateError;
}