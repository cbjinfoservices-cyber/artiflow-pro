import { supabase } from "@/lib/supabase";
import type { PeriodeAbsence } from "@/lib/indisponibilites";

/** Résultat de la prévenance email d'un intervenant quand un congé est posé. */
export interface ResultatPrevenanceConge {
  /** Vrai si l'email est bien parti. */
  envoye: boolean;
  /** Adresse réellement prévenue, ou null. */
  destinataire: string | null;
  /** Raison lisible de l'échec (« aucune adresse sur la fiche »…), ou null. */
  raison: string | null;
}

/**
 * Prévient par email l'intervenant concerné qu'un congé (ou une absence) vient d'être
 * posé sur son planning. L'envoi part du Backend (Resend) : la clé n'est jamais exposée
 * au navigateur, et le destinataire est retrouvé depuis la fiche de la personne.
 * Ne lève jamais d'exception : le congé reste enregistré même si l'email échoue.
 */
export async function prevenirIntervenantConge(params: {
  intervenantId: number;
  dateDebut: string;
  dateFin: string;
  motif: string;
  note: string | null;
  /** Journée entière, matin ou après-midi. */
  periode?: PeriodeAbsence;
}): Promise<ResultatPrevenanceConge> {
  try {
    const { data, error } = await supabase.functions.invoke("notifier-conge-intervenant", {
      body: { ...params, periode: params.periode ?? "journee" },
    });
    if (error) throw new Error(error.message);
    const payload = data as { ok?: boolean; to?: string; error?: string } | null;
    if (payload?.ok) {
      return { envoye: true, destinataire: payload.to ?? null, raison: null };
    }
    return { envoye: false, destinataire: null, raison: payload?.error ?? "envoi indisponible" };
  } catch (e) {
    return {
      envoye: false,
      destinataire: null,
      raison: e instanceof Error ? e.message : "envoi indisponible",
    };
  }
}