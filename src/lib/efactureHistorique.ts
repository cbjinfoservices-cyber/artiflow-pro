import { supabase } from "@/lib/supabase";
import { normalizeEfStatut, type EfStatut } from "@/lib/factureElectronique";

/**
 * Journal des changements d'étape d'une facture électronique.
 *
 * L'historique est stocké dans `envois_email`, la table de journal déjà en place : une
 * ligne de type « efacture_etape » par changement, avec l'ancienne étape, la nouvelle,
 * l'ancien motif de rejet et le nouveau. Aucune modification de structure n'est nécessaire,
 * et l'historique reste rattaché à la facture et à l'artisan (RLS sur `user_id`).
 */
export const TYPE_JOURNAL_EFACTURE = "efacture_etape";

/** Une entrée d'historique telle qu'affichée sur une facture. */
export interface EfHistoriqueEntree {
  id: number;
  /** Date et heure du changement (ISO). */
  date: string;
  ancienneEtape: EfStatut;
  nouvelleEtape: EfStatut;
  /** Motif de rejet qui était enregistré avant le changement, ou null. */
  ancienMotif: string | null;
  /** Motif éventuellement posé par le changement (cas d'un nouveau rejet). */
  nouveauMotif: string | null;
  /** Vrai si la facture quitte l'étape « rejetée » : c'est une retransmission. */
  retransmission: boolean;
}

/** Enregistre un changement d'étape dans le journal (best-effort, ne bloque jamais l'action). */
export async function journaliserChangementEtape(params: {
  userId: string | null;
  factureId: number;
  ancienneEtape: EfStatut;
  nouvelleEtape: EfStatut;
  ancienMotif: string | null;
  nouveauMotif: string | null;
}): Promise<void> {
  if (!params.userId) return;
  const contenu = JSON.stringify({
    a: params.ancienneEtape,
    n: params.nouvelleEtape,
    am: params.ancienMotif ?? null,
    nm: params.nouveauMotif ?? null,
  });
  try {
    await supabase.from("envois_email").insert({
      user_id: params.userId,
      facture_id: params.factureId,
      type: TYPE_JOURNAL_EFACTURE,
      canal: "interne",
      groupe: false,
      mode: "reel",
      sujet: contenu,
    });
  } catch {
    /* Le journal ne doit jamais faire échouer un changement d'étape. */
  }
}

function texte(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/** Décode le contenu d'une ligne de journal, tolérant aux anciennes écritures. */
function decoderSujet(sujet: unknown): {
  ancienneEtape: EfStatut;
  nouvelleEtape: EfStatut;
  ancienMotif: string | null;
  nouveauMotif: string | null;
} | null {
  const brut = texte(sujet);
  if (!brut) return null;
  try {
    const objet = JSON.parse(brut) as Record<string, unknown>;
    if (!objet || typeof objet !== "object") return null;
    return {
      ancienneEtape: normalizeEfStatut(objet.a),
      nouvelleEtape: normalizeEfStatut(objet.n),
      ancienMotif: texte(objet.am),
      nouveauMotif: texte(objet.nm),
    };
  } catch {
    return null;
  }
}

/** Charge l'historique de toutes les factures de l'artisan, regroupé par facture. */
export async function chargerHistoriqueEfactures(): Promise<Map<number, EfHistoriqueEntree[]>> {
  const map = new Map<number, EfHistoriqueEntree[]>();
  const { data, error } = await supabase
    .from("envois_email")
    .select("id, facture_id, sujet, created_at")
    .eq("type", TYPE_JOURNAL_EFACTURE)
    .order("created_at", { ascending: false });
  if (error) throw error;

  ((data ?? []) as unknown as Array<Record<string, unknown>>).forEach((row) => {
    const factureId = Number(row.facture_id);
    if (!Number.isFinite(factureId)) return;
    const decode = decoderSujet(row.sujet);
    if (!decode) return;
    const entree: EfHistoriqueEntree = {
      id: Number(row.id),
      date: texte(row.created_at) ?? new Date().toISOString(),
      ancienneEtape: decode.ancienneEtape,
      nouvelleEtape: decode.nouvelleEtape,
      ancienMotif: decode.ancienMotif,
      nouveauMotif: decode.nouveauMotif,
      retransmission: decode.ancienneEtape === "rejetee",
    };
    const liste = map.get(factureId) ?? [];
    liste.push(entree);
    map.set(factureId, liste);
  });

  return map;
}