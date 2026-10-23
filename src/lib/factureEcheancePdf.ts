import type { jsPDF } from "jspdf";
import type { FactureAEcheance } from "@/hooks/useEcheancesDuJour";
import type { Profile } from "@/hooks/useAuth";
import { buildDocumentPdf, type PdfLigne } from "@/lib/pdf";
import { styleDocumentsDepuisProfil } from "@/lib/documentStyle";
import { statutJuridiqueLabel } from "@/lib/entreprise";
import { formatShortDate } from "@/lib/dates";

/**
 * Construit le PDF d'une facture à partir des données déjà chargées par les
 * échéances du jour (numéro, client, montants, lignes figées).
 *
 * Sert au bouton « Relancer » : le document joint à l'email est exactement celui
 * que l'artisan voit dans l'aperçu, avec son logo et ses mentions légales.
 */
export async function construirePdfFactureEcheance(
  facture: FactureAEcheance,
  profile: Profile | null | undefined,
  emailFallback = "",
): Promise<jsPDF> {
  // Une facture générée possède toujours sa copie de lignes ; si elle manque (cas ancien),
  // on affiche une ligne de synthèse pour que le document reste lisible.
  const lignes: PdfLigne[] =
    facture.lignes && facture.lignes.length > 0
      ? facture.lignes.map((l) => ({
          designation: l.designation,
          unite: l.unite,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          taux_tva: l.taux_tva,
        }))
      : [
          {
            designation: `Prestation facturée (${facture.numero})`,
            unite: "forfait",
            quantite: 1,
            prix_unitaire: facture.totalHt,
            taux_tva: 20,
          },
        ];

  return buildDocumentPdf({
    type: "facture",
    numero: facture.numero,
    dateLabel: facture.dateEmission
      ? formatShortDate(facture.dateEmission)
      : formatShortDate(new Date().toISOString()),
    statut: facture.statut,
    objet: `Facture ${facture.numero}`,
    emetteur: {
      entreprise: profile?.entreprise ?? "",
      metier: profile?.metier ?? "",
      telephone: profile?.telephone ?? "",
      email: profile?.email ?? emailFallback,
      logo: profile?.logo_url ?? null,
      formeJuridique: statutJuridiqueLabel(profile?.statut_juridique) || null,
      siret: profile?.siret ?? null,
      tva: profile?.tva ?? null,
      assurance: profile?.assurance ?? null,
      penalitesRetard: profile?.penalites_retard ?? null,
    },
    client: facture.clientNom
      ? {
          nom: facture.clientNom,
          adresse: facture.clientAdresse,
          telephone: facture.clientTelephone,
          email: facture.clientEmail,
        }
      : null,
    lignes,
    totalHT: facture.totalHt,
    totalTTC: facture.totalTtc,
    echeanceLabel: facture.dateEcheance ? formatShortDate(facture.dateEcheance) : undefined,
    style: styleDocumentsDepuisProfil(profile),
  });
}