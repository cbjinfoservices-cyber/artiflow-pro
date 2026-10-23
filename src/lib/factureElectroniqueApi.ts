import { supabase } from "@/lib/supabase";
import { normalizeEfStatut, type EfStatut } from "@/lib/factureElectronique";
import { journaliserChangementEtape } from "@/lib/efactureHistorique";

/**
 * Met à jour l'étape du cycle de vie d'une facture électronique.
 * La date de transmission est posée automatiquement au premier passage en
 * « transmise », et le motif de rejet est effacé dès qu'on quitte ce statut.
 * Chaque changement d'étape est laissé dans le journal de la facture (date, ancien
 * motif, nouvelle étape), pour garder la trace des retransmissions après correction.
 */
export async function updateEfactureStatut(
  factureId: number,
  statut: EfStatut,
  motif: string | null = null,
): Promise<void> {
  // État courant : il alimente l'historique (ancienne étape, ancien motif de rejet).
  const { data: actuelle, error: lectureError } = await supabase
    .from("factures")
    .select("id, user_id, efacture_statut, efacture_motif")
    .eq("id", factureId)
    .maybeSingle();
  if (lectureError) throw lectureError;

  const patch: Record<string, unknown> = {
    efacture_statut: statut,
    efacture_motif: statut === "rejetee" ? (motif?.trim() || null) : null,
  };
  if (statut === "transmise" || statut === "recue") {
    patch.efacture_transmis_le = new Date().toISOString();
  }
  if (statut === "non_preparee" || statut === "preparee") {
    patch.efacture_transmis_le = null;
  }
  const { error } = await supabase.from("factures").update(patch).eq("id", factureId);
  if (error) throw error;

  if (actuelle) {
    const ligne = actuelle as unknown as Record<string, unknown>;
    const ancienneEtape = normalizeEfStatut(ligne.efacture_statut);
    if (ancienneEtape !== statut) {
      await journaliserChangementEtape({
        userId: ligne.user_id ? String(ligne.user_id) : null,
        factureId,
        ancienneEtape,
        nouvelleEtape: statut,
        ancienMotif: ligne.efacture_motif ? String(ligne.efacture_motif) : null,
        nouveauMotif: statut === "rejetee" ? (motif?.trim() || null) : null,
      });
    }
  }
}

export interface ReglagesEfacture {
  /** TVA payée d'après les débits (mention obligatoire). */
  optionDebits: boolean;
  /** Autoliquidation par le preneur (sous-traitance BTP). */
  autoliquidation: boolean;
  /** Franchise en base : « TVA non applicable, art. 293 B du CGI ». */
  dispenseTva: boolean;
  /** Escompte pour paiement anticipé, texte libre. */
  escompte: string;
  /** Mentions libres ajoutées sur les documents. */
  mentionsLibres: string;
  /** Nom de la plateforme de dématérialisation utilisée (ou vide). */
  pdp: string;
}

/** Enregistre les réglages de facturation électronique dans le profil. */
export async function updateReglagesEfacture(userId: string, reglages: ReglagesEfacture): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      efacture_option_debits: reglages.optionDebits,
      efacture_autoliquidation: reglages.autoliquidation,
      efacture_dispense_tva: reglages.dispenseTva,
      efacture_escompte: reglages.escompte.trim() || null,
      efacture_mentions_libres: reglages.mentionsLibres.trim() || null,
      efacture_pdp: reglages.pdp.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}