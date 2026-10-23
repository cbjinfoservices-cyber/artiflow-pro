import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { FactureAEcheance } from "@/hooks/useEcheancesDuJour";
import { buildDocumentPdf, type PdfLigne } from "@/lib/pdf";
import { formatShortDate } from "@/lib/dates";
import { styleDocumentsDepuisProfil } from "@/lib/documentStyle";
import { statutJuridiqueLabel } from "@/lib/entreprise";
import ApercuPdfModal from "@/components/feature/ApercuPdfModal";

/**
 * Aperçu rapide d'une facture en PDF, ouvert depuis la pastille d'échéances du menu.
 *
 * Le but est de pouvoir jeter un œil à la facture SANS quitter la page courante :
 * on ne recharge ici que les données déjà disponibles sur la pastille (numéro, client,
 * montant, échéance, lignes figées) et l'apparence des documents vient du profil.
 */
export default function ApercuFactureRapide({
  facture,
  onClose,
}: {
  /** Facture à afficher, telle que fournie par les échéances du jour. */
  facture: FactureAEcheance;
  onClose: () => void;
}) {
  const { profile, user } = useAuth();

  const docBuilder = useMemo(
    () => async () => {
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
        dateLabel: facture.dateEmission ? formatShortDate(facture.dateEmission) : formatShortDate(new Date().toISOString()),
        statut: facture.statut,
        objet: `Facture ${facture.numero}`,
        emetteur: {
          entreprise: profile?.entreprise ?? "",
          metier: profile?.metier ?? "",
          telephone: profile?.telephone ?? "",
          email: profile?.email ?? user?.email ?? "",
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
    },
    [facture, profile, user],
  );

  return (
    <ApercuPdfModal
      title={`Aperçu · ${facture.numero}`}
      subtitle="Aperçu rapide : vous restez sur la page en cours, rien n'est enregistré."
      filename={`${facture.numero}.pdf`}
      docBuilder={docBuilder}
      note="Le document reprend votre logo, vos mentions légales et vos coordonnées de paiement."
      onClose={onClose}
    />
  );
}