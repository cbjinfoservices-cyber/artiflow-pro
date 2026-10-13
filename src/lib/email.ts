import { supabase } from "@/lib/supabase";
import { publicBaseUrl } from "@/lib/signature";

interface FunctionResult {
  ok?: boolean;
  error?: string;
}

async function invoke(name: string, body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  const payload = data as FunctionResult | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi de l'email a échoué.");
}

/** Envoie une facture au client par email, avec le PDF en pièce jointe. */
export async function sendFactureEmail(factureId: number, pdfBase64: string, filename: string): Promise<void> {
  await invoke("send-facture-email", { factureId, pdfBase64, filename });
}

/**
 * Envoie une relance (canal email) au client.
 * Le PDF de la facture concernée peut être joint en pièce jointe.
 * `groupe` indique que l'envoi fait partie d'un lot (relance groupée / escalade automatique).
 */
export async function sendRelanceEmail(
  relanceId: number,
  pdfBase64?: string,
  filename?: string,
  groupe = false,
): Promise<void> {
  await invoke("send-relance-email", {
    relanceId,
    pdfBase64: pdfBase64 ?? "",
    filename: filename ?? "",
    groupe,
    // Base publique du site : permet au backend de rappeler le lien partagé du devis dans l'email.
    baseUrl: publicBaseUrl(),
  });
}

/**
 * Envoie une relance SMS ou WhatsApp au client via Twilio.
 * `canal` vaut « SMS » ou « WhatsApp ».
 * `groupe` indique que l'envoi fait partie d'un lot (relance groupée / escalade automatique).
 */
export async function sendRelanceSms(relanceId: number, canal: string, groupe = false): Promise<void> {
  await invoke("send-relance-sms", { relanceId, canal, groupe });
}

/**
 * Envoie un SMS ou WhatsApp de TEST vers un numéro saisi à la volée, sans créer de relance.
 * Sert à valider la configuration Twilio en un clic depuis l'écran Relances.
 */
export async function sendTestSms(telephone: string, canal: string, message = ""): Promise<void> {
  await invoke("send-test-sms", { telephone, canal, message });
}

/** Envoie un devis au client par email, avec le lien de signature en ligne. */
export async function sendDevisEmail(devisId: number, signUrl: string): Promise<void> {
  await invoke("send-devis-email", { devisId, signUrl });
}

/**
 * Envoie par email la synthèse CSV des envois automatiques à l'adresse du profil artisan.
 * Le CSV est transmis en pièce jointe (encodé en base64).
 */
export async function sendSyntheseEnvoisAutoEmail(params: {
  csvBase64: string;
  filename: string;
  nbItems: number;
  aJour: number;
  aVerifier: number;
  inactifs: number;
}): Promise<void> {
  await invoke("send-envois-auto-email", params);
}