import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_MENTIONS } from "@/lib/imagesPartage";

const identite = [
  { label: "Raison sociale", value: "CBJ-INFOSERVICES" },
  { label: "Forme juridique", value: "Société à responsabilité limitée (SARL)" },
  { label: "Siège social", value: "14 voie des Meuniers, 94550 Chevilly-Larue, France" },
  { label: "RCS", value: "Créteil 990 157 562" },
  { label: "SIRET", value: "990 157 562 00036" },
  { label: "TVA intracommunautaire", value: "FR85 990 157 562" },
  { label: "Activité (code NAF)", value: "Programmation informatique (62.01Y)" },
  { label: "Email", value: "contact@artiflow-pro.com" },
  { label: "Téléphone", value: "07 88 94 61 91" },
];

const sections = [
  { id: "editeur", label: "Éditeur du site" },
  { id: "publication", label: "Directeur de la publication" },
  { id: "hebergement", label: "Hébergement" },
  { id: "propriete", label: "Propriété intellectuelle" },
  { id: "liens", label: "Liens hypertextes" },
  { id: "responsabilite", label: "Responsabilité" },
  { id: "droit", label: "Droit applicable" },
];

export default function MentionsLegalesPage() {
  return (
    <LegalLayout
      path="/mentions-legales"
      eyebrow="Informations légales"
      eyebrowIcon="ri-file-text-line"
      title="Mentions légales"
      intro="Conformément à la loi pour la confiance dans l'économie numérique (LCEN), voici les informations relatives à l'éditeur et à l'exploitation du site ArtiFlow-pro."
      updatedAt="25 octobre 2026"
      metaTitle="Mentions légales et éditeur du site · ArtiFlow-pro"
      metaDescription="Mentions légales du site ArtiFlow-pro : éditeur, directeur de la publication, hébergement, propriété intellectuelle et conditions d'utilisation."
      metaImage={IMAGE_PARTAGE_MENTIONS}
      breadcrumbLabel="Mentions légales"
      breadcrumbSchemaId="artiflow-mentions-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="editeur" title="Éditeur du site">
        <p>
          Le site <strong>artiflow-pro.com</strong> est édité par <strong>CBJ-INFOSERVICES</strong>, société spécialisée
          dans l'édition d'un logiciel d'assistance aux artisans du bâtiment. Les informations d'identification
          de l'éditeur sont les suivantes :
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px overflow-hidden rounded-lg border border-background-200 bg-background-200">
          {identite.map((item) => (
            <div key={item.label} className="p-4 bg-background-50">
              <dt className="text-xs font-semibold uppercase tracking-wide text-foreground-500">
                {item.label}
              </dt>
              <dd className="mt-1 text-sm text-foreground-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </LegalSection>

      <LegalSection id="publication" title="Directeur de la publication">
        <p>
          Le directeur de la publication est le représentant légal d'CBJ-INFOSERVICES. Pour toute question relative
          au contenu du site, vous pouvez le contacter par email à{" "}
          <a
            href="mailto:contact@artiflow-pro.com"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.com
          </a>{" "}
          ou par téléphone au 07 88 94 61 91.
        </p>
      </LegalSection>

      <LegalSection id="hebergement" title="Hébergement">
        <p>
          Le site est hébergé par <strong>IONOS SE</strong>, Elgendorfer Straße 57, 56410 Montabaur, Allemagne
          (ionos.fr), sur un serveur situé dans l'Union européenne.
        </p>
        <p>
          Les données de l'application (comptes, base de données, fichiers et photos) sont hébergées par{" "}
          <strong>Supabase, Inc.</strong> (supabase.com), sur l'infrastructure Amazon Web Services située en Irlande,
          dans l'Union européenne.
        </p>
        <p>
          Pour toute question technique liée à l'hébergement ou à la disponibilité du site, écrivez-nous à{" "}
          <a
            href="mailto:contact@artiflow-pro.com"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="propriete" title="Propriété intellectuelle">
        <p>
          L'ensemble du site ArtiFlow-pro — structure, textes, illustrations, images, logos, interfaces, bases de
          données et code source — est protégé par le droit de la propriété intellectuelle et demeure la
          propriété exclusive d'CBJ-INFOSERVICES ou de ses partenaires.
        </p>
        <p>
          Toute reproduction, représentation, adaptation, traduction ou exploitation, totale ou partielle, par
          quelque procédé que ce soit, sans l'autorisation écrite préalable d'CBJ-INFOSERVICES, est interdite et
          constitue une contrefaçon sanctionnée par le Code de la propriété intellectuelle.
        </p>
        <p>
          La marque <strong>ArtiFlow-pro</strong> ainsi que le logo associé sont des signes distinctifs de CBJ-INFOSERVICES. Toute utilisation non autorisée est prohibée.
        </p>
      </LegalSection>

      <LegalSection id="liens" title="Liens hypertextes">
        <p>
          Le site peut contenir des liens vers des sites tiers. CBJ-INFOSERVICES n'exerce aucun contrôle sur ces
          sites et décline toute responsabilité quant à leur contenu, leurs pratiques ou leurs politiques de
          confidentialité.
        </p>
        <p>
          La mise en place d'un lien vers le site ArtiFlow-pro est autorisée à condition qu'elle ne porte pas
          atteinte à l'image d'ArtiFlow-pro, qu'elle ne recoure pas à la technique du « framing » et qu'elle
          mentionne clairement la source. CBJ-INFOSERVICES se réserve le droit de demander la suppression de tout
          lien jugé inapproprié.
        </p>
      </LegalSection>

      <LegalSection id="responsabilite" title="Responsabilité">
        <p>
          CBJ-INFOSERVICES s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur le
          site. Ces informations sont fournies à titre indicatif et peuvent évoluer sans préavis. CBJ-INFOSERVICES
          ne saurait être tenue responsable des erreurs, omissions ou indisponibilités temporaires du site.
        </p>
        <p>
          CBJ-INFOSERVICES ne pourra être tenue responsable des dommages directs ou indirects résultant de
          l'utilisation du site ou de l'impossibilité d'y accéder. Aucune garantie n'est donnée quant à
          l'absence de virus ou de tout autre élément nuisible susceptibles d'affecter votre équipement.
        </p>
      </LegalSection>

      <LegalSection id="droit" title="Droit applicable">
        <p>
          Les présentes mentions légales sont régies par le droit français. En cas de litige et à défaut de
          résolution amiable, les tribunaux français seront seuls compétents, sous réserve des règles
          impératives protégeant les consommateurs.
        </p>
        <p>
          Pour en savoir plus sur le traitement de vos données personnelles, consultez notre{" "}
          <Link to="/rgpd" className="font-semibold text-primary-700 hover:underline cursor-pointer">
            politique de protection des données (RGPD)
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}