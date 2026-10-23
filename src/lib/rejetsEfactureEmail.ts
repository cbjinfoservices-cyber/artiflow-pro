import { supabase } from "@/lib/supabase";

export interface EnvoiFicheRejetsParams {
  /** Adresse du comptable (obligatoire). */
  to: string;
  /** Adresse secondaire mise en copie (facultative). */
  cc?: string;
  /** Nom de l'entreprise, repris en tête de l'email. */
  entreprise?: string | null;
  /** Période couverte par la fiche (« Octobre 2026 », « Tous les mois »…). */
  moisLabel: string;
  /** Nombre de factures rejetées listées sur la fiche. */
  nbRejets: number;
  /** Montant TTC bloqué par ces rejets. */
  montantTtc: number;
  /** Message d'accompagnement saisi par l'artisan (facultatif, 500 caractères max). */
  message?: string;
  /** Contenu du PDF encodé en base64 (sans préfixe data URI). */
  pdfBase64: string;
  /** Nom du fichier joint. */
  filename: string;
}

/**
 * Expédie la fiche PDF « factures rejetées à corriger » au comptable, en pièce jointe
 * d'un email récapitulant la période, le nombre de rejets et le montant bloqué.
 */
export async function envoyerFicheRejetsComptable(params: EnvoiFicheRejetsParams): Promise<void> {
  const { data, error } = await supabase.functions.invoke("envoyer-fiche-rejets-comptable", { body: params });
  if (error) {
    throw new Error("Impossible d'envoyer la fiche au comptable pour l'instant. Réessayez dans un instant.");
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    throw new Error(result?.error || "L'envoi au comptable a échoué.");
  }
}