import type { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabase";
import { buildDocumentPdf } from "@/lib/pdf";
import { fetchDevisLignes } from "@/lib/artisanApi";
import { fetchDevisSignature } from "@/lib/signature";
import { formatShortDate } from "@/lib/dates";

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export interface FacturePdfResult {
  doc: jsPDF;
  numero: string;
}

/**
 * Construit le PDF d'une facture à partir de son identifiant, en rechargeant
 * tout le nécessaire (émetteur, client, lignes du devis, signature).
 * Utilisable depuis n'importe quelle page, y compris pour joindre le PDF à un email.
 */
export async function buildFacturePdfById(factureId: number): Promise<FacturePdfResult | null> {
  const { data: factureRow, error } = await supabase
    .from("factures")
    .select("id, user_id, devis_id, client_id, numero, statut, total_ht, total_ttc, date_emission, date_echeance")
    .eq("id", factureId)
    .maybeSingle();
  if (error) throw error;
  if (!factureRow) return null;
  const facture = factureRow as Record<string, unknown>;

  const devisId = facture.devis_id === null || facture.devis_id === undefined ? null : Number(facture.devis_id);
  const clientId = facture.client_id === null || facture.client_id === undefined ? null : Number(facture.client_id);

  const [clientRes, profileRes, devisRes] = await Promise.all([
    clientId
      ? supabase.from("clients").select("nom, adresse, telephone, email").eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("entreprise, metier, telephone, email, logo_url, siret, tva, assurance")
      .eq("id", facture.user_id)
      .maybeSingle(),
    devisId
      ? supabase.from("devis").select("numero, objet").eq("id", devisId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const client = clientRes.data as
    | { nom?: string; adresse?: string | null; telephone?: string | null; email?: string | null }
    | null;
  const profile = profileRes.data as
    | {
        entreprise?: string | null;
        metier?: string | null;
        telephone?: string | null;
        email?: string | null;
        logo_url?: string | null;
        siret?: string | null;
        tva?: string | null;
        assurance?: string | null;
      }
    | null;
  const devis = devisRes.data as { numero?: string; objet?: string } | null;

  const lignes = devisId ? await fetchDevisLignes(devisId) : [];
  const signatureInfo = devisId ? await fetchDevisSignature(devisId) : null;

  const doc = await buildDocumentPdf({
    type: "facture",
    numero: toStr(facture.numero) ?? "",
    dateLabel: formatShortDate(toStr(facture.date_emission)),
    statut: toStr(facture.statut) ?? "",
    objet: devis?.objet ?? "",
    emetteur: {
      entreprise: profile?.entreprise ?? "",
      metier: profile?.metier ?? "",
      telephone: profile?.telephone ?? "",
      email: profile?.email ?? "",
      logo: profile?.logo_url ?? null,
      siret: profile?.siret ?? null,
      tva: profile?.tva ?? null,
      assurance: profile?.assurance ?? null,
    },
    client: client
      ? { nom: client.nom ?? "", adresse: client.adresse, telephone: client.telephone, email: client.email }
      : null,
    lignes,
    totalHT: toNum(facture.total_ht),
    totalTTC: toNum(facture.total_ttc),
    echeanceLabel: facture.date_echeance ? formatShortDate(toStr(facture.date_echeance)) : undefined,
    reference: devis?.numero ?? undefined,
    signature: signatureInfo?.signed_at
      ? {
          nom: signatureInfo.signataire_nom ?? client?.nom ?? "Client",
          dateLabel: formatShortDate(signatureInfo.signed_at),
          image: signatureInfo.signature_image,
        }
      : null,
  });

  return { doc, numero: toStr(facture.numero) ?? "facture" };
}