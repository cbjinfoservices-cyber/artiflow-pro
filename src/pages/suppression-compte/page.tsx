import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_RGPD } from "@/lib/imagesPartage";

/**
 * Page publique « Supprimer votre compte » : exigée par Google Play pour les applications avec
 * comptes. Elle doit rester accessible sans l'application ni connexion, et expliquer comment
 * demander la suppression du compte et des données associées.
 */

const EMAIL_CONTACT = "contact@artiflow-pro.com";

/** Lien email pré-rempli pour les personnes qui n'ont plus accès à leur espace. */
const LIEN_DEMANDE = `mailto:${EMAIL_CONTACT}?subject=${encodeURIComponent(
  "Demande de suppression de compte ArtiFlow-pro",
)}&body=${encodeURIComponent(
  "Bonjour,\n\nJe demande la suppression de mon compte ArtiFlow-pro et des données associées.\n\nAdresse email du compte : \nNom de l'entreprise (si artisan) : \n\nMerci.",
)}`;

const sections = [
  { id: "depuis-application", label: "Depuis l'application ou le site" },
  { id: "sans-acces", label: "Sans accès à votre compte" },
  { id: "donnees-supprimees", label: "Données supprimées" },
  { id: "donnees-conservees", label: "Données conservées" },
];

const supprimees = [
  "Votre compte de connexion et votre profil (entreprise, coordonnées, logo, réglages)",
  "Vos fiches clients, particuliers comme entreprises",
  "Vos devis, factures, modèles et bibliothèque de lignes",
  "Vos chantiers, étapes, photos, planning, pointages et procès-verbaux de réception",
  "Les fiches de votre équipe (intervenants) et leurs congés",
  "Vos relances, l'historique de vos envois et vos préférences d'affichage",
];

export default function SuppressionComptePage() {
  return (
    <LegalLayout
      path="/suppression-compte"
      eyebrow="Vos données"
      eyebrowIcon="ri-delete-bin-6-line"
      title="Supprimer votre compte"
      intro="Vous pouvez à tout moment demander la suppression de votre compte ArtiFlow-pro et de toutes les données associées. Voici comment faire, avec ou sans accès à votre espace."
      updatedAt="24 octobre 2026"
      metaTitle="Supprimer votre compte ArtiFlow-pro · ArtiFlow-pro"
      metaDescription="Comment demander la suppression de votre compte ArtiFlow-pro et des données associées, depuis l'application, le site ou par email."
      metaImage={IMAGE_PARTAGE_RGPD}
      breadcrumbLabel="Supprimer votre compte"
      breadcrumbSchemaId="artiflow-suppression-compte-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="depuis-application" title="Depuis l'application ou le site">
        <p>Si vous pouvez vous connecter, la suppression se fait en quelques gestes :</p>
        <ol className="flex flex-col gap-2.5 list-decimal pl-5">
          <li>
            Connectez-vous à l'application mobile ArtiFlow-pro ou au site{" "}
            <a href="https://artiflow-pro.com" className="font-semibold text-primary-700 hover:underline cursor-pointer">
              artiflow-pro.com
            </a>
            .
          </li>
          <li>
            Ouvrez <strong>Mon profil</strong>, puis l'onglet <strong>Sécurité</strong>.
          </li>
          <li>
            Dans la zone <strong>« Supprimer mon compte »</strong>, saisissez votre mot de passe et le mot{" "}
            <strong>SUPPRIMER</strong> pour confirmer.
          </li>
        </ol>
        <p>
          La suppression est programmée <strong>30 jours</strong> plus tard. Pendant ce délai, votre espace reste
          utilisable et vous pouvez changer d'avis : il suffit de vous reconnecter ou de cliquer sur « Annuler la
          suppression ». Votre abonnement n'est plus renouvelé et s'arrête à la fin de la période déjà réglée. Un email
          vous confirme la date de suppression.
        </p>
        <p>
          <Link
            to="/app/profil?onglet=securite"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold no-underline hover:bg-primary-600 transition-colors cursor-pointer"
          >
            <i className="ri-shield-keyhole-line"></i>
            Ouvrir mon espace, onglet Sécurité
          </Link>
        </p>
      </LegalSection>

      <LegalSection id="sans-acces" title="Sans accès à votre compte">
        <p>
          Application désinstallée, mot de passe perdu, ou compte d'intervenant (membre d'une équipe) : écrivez-nous
          depuis l'adresse email de votre compte, en précisant que vous demandez la suppression de votre compte.
        </p>
        <p>
          <a
            href={LIEN_DEMANDE}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold no-underline hover:bg-primary-600 transition-colors cursor-pointer"
          >
            <i className="ri-mail-send-line"></i>
            Demander la suppression par email
          </a>
        </p>
        <p>
          Adresse : <strong>{EMAIL_CONTACT}</strong>. Nous vérifions que la demande vient bien du titulaire du compte,
          puis nous la traitons dans un délai d'un mois au plus, comme le prévoit le RGPD. Vous recevez une confirmation
          une fois la suppression effectuée.
        </p>
        <p>
          Pour un compte d'intervenant, la suppression porte sur votre compte de connexion. Les interventions et heures
          que vous avez réalisées pour une entreprise font partie de ses propres dossiers : pour les faire retirer,
          adressez-vous aussi à votre employeur.
        </p>
      </LegalSection>

      <LegalSection id="donnees-supprimees" title="Données supprimées">
        <p>À l'issue du délai de 30 jours, nous effaçons définitivement :</p>
        <ul className="flex flex-col gap-2.5">
          {supprimees.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <i className="ri-checkbox-circle-line text-secondary-600 mt-0.5"></i>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          Pensez à exporter vos documents avant la suppression (factures, export comptable) : une fois le délai passé,
          ils ne peuvent plus être récupérés. Vos factures clients restent soumises à vos propres obligations de
          conservation.
        </p>
      </LegalSection>

      <LegalSection id="donnees-conservees" title="Données conservées">
        <p>
          Nous ne gardons que ce que la loi nous impose : les factures de votre abonnement ArtiFlow-pro, conservées
          10 ans au titre de nos obligations comptables, et la trace de votre demande de suppression (date, adresse
          email, entreprise), qui sert de preuve en cas de litige.
        </p>
        <p>
          Pour en savoir plus sur vos données et vos droits, consultez notre page{" "}
          <Link to="/rgpd" className="font-semibold text-primary-700 hover:underline cursor-pointer">
            RGPD & données personnelles
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
