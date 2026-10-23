import { supabase } from "@/lib/supabase";
import { originePublique } from "@/lib/site";

export interface PublicDevisData {
  devis: {
    numero: string;
    objet: string | null;
    statut: string;
    total_ht: number;
    total_ttc: number;
    created_at: string | null;
    signed_at: string | null;
    signataire_nom: string | null;
    signature_image: string | null;
  };
  client: { nom: string; adresse: string | null; telephone: string | null; email: string | null } | null;
  lignes: { designation: string; unite: string; quantite: number; prix_unitaire: number }[];
  emetteur: {
    entreprise: string | null;
    metier: string | null;
    telephone: string | null;
    email: string | null;
    logo_url: string | null;
    siret: string | null;
    tva: string | null;
    assurance: string | null;
    doc_couleur: string | null;
    doc_afficher_logo: boolean | null;
    doc_pied_page: string | null;
  } | null;
}

/** Base publique du site (gère le sous-chemin de déploiement). */
export function publicBaseUrl(): string {
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  return `${originePublique()}${base}`;
}

/** Lien à envoyer au client pour qu'il signe le devis en ligne. */
export function buildSignUrl(token: string): string {
  return `${publicBaseUrl()}/signature-devis/${token}`;
}

function randomToken(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
  return uuid.replace(/[^a-zA-Z0-9]/g, "");
}

/** Récupère (ou crée) le jeton de signature public d'un devis. */
export async function ensureDevisSignToken(devisId: number): Promise<string> {
  const { data, error } = await supabase.from("devis").select("sign_token").eq("id", devisId).maybeSingle();
  if (error) throw error;
  const existing = (data as { sign_token?: string | null } | null)?.sign_token;
  if (existing) return existing;
  const token = randomToken();
  const { error: updErr } = await supabase.from("devis").update({ sign_token: token }).eq("id", devisId);
  if (updErr) throw updErr;
  return token;
}

/** Signature sur place : l'artisan enregistre le tracé du client depuis son appareil. */
export async function signDevisInPerson(devisId: number, signature: string, signataire: string): Promise<void> {
  const { error } = await supabase
    .from("devis")
    .update({
      signature_image: signature,
      signataire_nom: signataire || null,
      signed_at: new Date().toISOString(),
      statut: "Signé",
    })
    .eq("id", devisId);
  if (error) throw error;
}

export interface DevisSignatureInfo {
  signature_image: string | null;
  signataire_nom: string | null;
  signed_at: string | null;
}

export async function fetchDevisSignature(devisId: number): Promise<DevisSignatureInfo> {
  const { data, error } = await supabase
    .from("devis")
    .select("signature_image, signataire_nom, signed_at")
    .eq("id", devisId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    signature_image: (row.signature_image as string) ?? null,
    signataire_nom: (row.signataire_nom as string) ?? null,
    signed_at: (row.signed_at as string) ?? null,
  };
}

/** Lecture publique d'un devis à partir du jeton (sans compte). */
export async function fetchPublicDevis(token: string): Promise<PublicDevisData> {
  const { data, error } = await supabase.functions.invoke("devis-public", {
    body: { action: "read", token },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string; data?: PublicDevisData } | null;
  if (!payload?.ok || !payload.data) throw new Error(payload?.error || "Document introuvable.");
  return payload.data;
}

/** Signature publique du devis par le client (sans compte). */
export async function signPublicDevis(token: string, signature: string, signataire: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("devis-public", {
    body: { action: "sign", token, signature, signataire },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) throw new Error(payload?.error || "La signature a échoué.");
}