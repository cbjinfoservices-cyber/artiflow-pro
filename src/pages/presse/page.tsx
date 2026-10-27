import { Link } from "react-router-dom";
import BoutonCopier from "@/components/feature/BoutonCopier";
import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_PRESSE } from "@/lib/imagesPartage";
import { metiers } from "@/mocks/metiers";

const sections = [
  { id: "presentation", label: "ArtiFlow-pro en bref" },
  { id: "textes", label: "Textes de présentation" },
  { id: "faits", label: "Faits clés" },
  { id: "logos", label: "Logos à télécharger" },
  { id: "communique", label: "Communiqué de presse" },
  { id: "contact", label: "Contact presse" },
];

/** Textes prêts à reprendre tels quels (annuaires, articles, fiches partenaires). */
const textes = [
  {
    titre: "Accroche (1 phrase)",
    texte:
      "ArtiFlow-pro est le logiciel IA des artisans du bâtiment : devis dictés en quelques minutes, relances automatiques, planning d'équipe et facture électronique prête.",
  },
  {
    titre: "Présentation courte (environ 50 mots)",
    texte:
      "ArtiFlow-pro est un assistant IA conçu pour les artisans du bâtiment. Depuis le chantier, l'artisan dicte son devis, que l'application rédige avec ses propres tarifs. Les relances clients partent automatiquement par email, SMS ou WhatsApp, le planning de l'équipe se pilote sur mobile et les factures sont générées au format électronique Factur-X.",
  },
  {
    titre: "Présentation longue (environ 150 mots)",
    texte:
      "ArtiFlow-pro est un logiciel de gestion pensé pour les artisans du bâtiment : plombiers, électriciens, maçons, peintres, menuisiers, carreleurs, couvreurs, plaquistes, frigoristes et installateurs photovoltaïques. Son assistant IA transforme une description dictée sur le chantier en devis détaillé, chiffré avec la bibliothèque de prix de l'artisan. Une fois le devis envoyé, ArtiFlow-pro relance le client automatiquement par email, SMS ou WhatsApp jusqu'à la signature. L'application réunit aussi le planning de l'équipe, le suivi de chantier avec photos horodatées, la facturation et l'export des factures au format Factur-X, prêt pour la réforme de la facture électronique. Disponible sur le web, Android et iPhone, ArtiFlow-pro est édité par CBJ-INFOSERVICES, société basée à Chevilly-Larue (Val-de-Marne). L'essai est gratuit pendant 14 jours, sans engagement.",
  },
];

const faits = [
  { label: "Nom", value: "ArtiFlow-pro" },
  { label: "Éditeur", value: "CBJ-INFOSERVICES (SARL), Chevilly-Larue (94)" },
  { label: "Site", value: "https://artiflow-pro.com" },
  { label: "Catégorie", value: "Logiciel de gestion pour artisans du bâtiment (SaaS)" },
  { label: "Plateformes", value: "Web, Android, iPhone" },
  { label: "Métiers couverts", value: `${metiers.length} corps d'état du bâtiment` },
  { label: "Essai", value: "14 jours gratuits, sans engagement" },
  { label: "Langue", value: "Français" },
];

const logos = [
  { fichier: "logo-artiflow-pro", label: "Logo — fond clair", fond: "bg-background-50" },
  { fichier: "logo-artiflow-pro-blanc", label: "Logo — fond sombre", fond: "bg-foreground-950" },
  { fichier: "icone-artiflow-pro", label: "Icône seule", fond: "bg-background-50" },
];

export default function PressePage() {
  return (
    <LegalLayout
      path="/presse"
      eyebrow="Espace presse"
      eyebrowIcon="ri-newspaper-line"
      title="Kit média ArtiFlow-pro"
      intro="Journalistes, blogueurs, annuaires et partenaires : retrouvez ici les textes de présentation, les faits clés, les logos et nos communiqués. Tout est libre de reprise pour parler d'ArtiFlow-pro."
      updatedAt="27 octobre 2026"
      metaTitle="Espace presse et kit média · ArtiFlow-pro"
      metaDescription="Kit média d'ArtiFlow-pro : textes de présentation, faits clés, logos à télécharger, communiqués de presse et contact presse."
      metaImage={IMAGE_PARTAGE_PRESSE}
      breadcrumbLabel="Presse"
      breadcrumbSchemaId="artiflow-presse-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="presentation" title="ArtiFlow-pro en bref">
        <p>
          ArtiFlow-pro aide les artisans du bâtiment à passer moins de temps au bureau. L'assistant IA rédige les
          devis à partir d'une simple dictée sur le chantier, relance les clients jusqu'à la signature et prépare
          les factures au format électronique. Le planning de l'équipe et le suivi de chantier se pilotent depuis
          le téléphone.
        </p>
        <p>
          Pour découvrir le produit en détail, consultez les <Link to="/metiers" className="text-primary-700 underline">fiches métiers</Link>,
          les <Link to="/tarifs" className="text-primary-700 underline">tarifs</Link> et le{" "}
          <Link to="/nouveautes" className="text-primary-700 underline">journal des nouveautés</Link>.
        </p>
      </LegalSection>

      <LegalSection id="textes" title="Textes de présentation">
        <p>Ces textes peuvent être repris tels quels, avec un lien vers https://artiflow-pro.com.</p>
        <div className="flex flex-col gap-4">
          {textes.map((t) => (
            <div key={t.titre} className="p-4 rounded-lg bg-background-100 border border-background-200">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading font-semibold text-sm text-foreground-950">{t.titre}</h3>
                <BoutonCopier texte={t.texte} />
              </div>
              <p className="mt-2 text-sm text-foreground-700 leading-relaxed">{t.texte}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection id="faits" title="Faits clés">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {faits.map((f) => (
            <div key={f.label} className="p-3 rounded-lg bg-background-100 border border-background-200">
              <dt className="text-xs font-semibold uppercase tracking-wide text-foreground-500">{f.label}</dt>
              <dd className="mt-1 text-sm text-foreground-900">{f.value}</dd>
            </div>
          ))}
        </dl>
      </LegalSection>

      <LegalSection id="logos" title="Logos à télécharger">
        <p>
          Merci de ne pas déformer ni recolorer les logos, et de laisser un espace libre autour. Le format SVG
          convient au web et à l'impression, le PNG aux usages courants.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {logos.map((l) => (
            <div key={l.fichier} className="rounded-lg border border-background-200 overflow-hidden">
              <div className={`${l.fond} h-28 flex items-center justify-center p-4`}>
                <img
                  src={`/presse/${l.fichier}.svg`}
                  alt={`ArtiFlow-pro — ${l.label.toLowerCase()}`}
                  className="max-h-16 w-auto"
                  loading="lazy"
                />
              </div>
              <div className="p-3 bg-background-100">
                <p className="text-sm font-semibold text-foreground-950">{l.label}</p>
                <div className="mt-2 flex gap-3 text-sm">
                  <a href={`/presse/${l.fichier}.svg`} download className="text-primary-700 underline">
                    SVG
                  </a>
                  <a href={`/presse/${l.fichier}.png`} download className="text-primary-700 underline">
                    PNG
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection id="communique" title="Communiqué de presse">
        <article className="p-5 rounded-lg bg-background-100 border border-background-200 flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">
            Chevilly-Larue, le 27 octobre 2026
          </p>
          <h3 className="font-heading font-bold text-lg text-foreground-950">
            Facture électronique : ArtiFlow-pro prépare les artisans du bâtiment à l'échéance de septembre 2027
          </h3>
          <p className="font-semibold text-foreground-800">
            Depuis le 1er septembre 2026, toutes les entreprises françaises doivent pouvoir recevoir des factures
            électroniques. Le 1er septembre 2027, les TPE et PME devront à leur tour les émettre. Pour les artisans
            du bâtiment, souvent seuls face à l'administratif, ArtiFlow-pro intègre dès maintenant la génération
            des factures au format Factur-X.
          </p>
          <p>
            La réforme de la facturation électronique change la manière dont les artisans facturent leurs clients
            professionnels : un simple PDF ne suffira plus. Les factures devront être émises dans un format
            structuré et transmises par une plateforme agréée. Beaucoup d'artisans facturent encore depuis un
            tableur ou un traitement de texte, et découvrent l'échéance tardivement.
          </p>
          <p>
            ArtiFlow-pro, le logiciel IA des artisans du bâtiment, génère chaque facture au format Factur-X
            (norme européenne EN 16931) : un PDF lisible par le client, qui embarque aussi les données
            structurées attendues par sa comptabilité. Les mentions obligatoires sont vérifiées avant l'envoi, et
            les factures du mois peuvent être regroupées dans une archive prête à déposer sur la plateforme agréée
            choisie par l'artisan, dont l'application suit ensuite le statut.
          </p>
          <p>
            « Un artisan ne devrait pas avoir à devenir expert en formats de fichiers pour être payé. Notre rôle
            est que la facture soit conforme sans qu'il ait à y penser, comme le devis qu'il a dicté sur le
            chantier », explique l'équipe d'ArtiFlow-pro.
          </p>
          <p>
            Au-delà de la facturation, ArtiFlow-pro rédige les devis à partir d'une dictée vocale, relance les
            clients automatiquement par email, SMS ou WhatsApp et réunit le planning de l'équipe et le suivi de
            chantier. L'application est disponible sur le web, Android et iPhone, avec un essai gratuit de
            14 jours.
          </p>
          <p className="text-sm text-foreground-600">
            <strong>À propos d'ArtiFlow-pro</strong> — ArtiFlow-pro est édité par CBJ-INFOSERVICES, société basée à
            Chevilly-Larue (Val-de-Marne). Le logiciel accompagne les artisans du bâtiment de {metiers.length} corps
            d'état, du devis à la facture. Plus d'informations : https://artiflow-pro.com
          </p>
        </article>
      </LegalSection>

      <LegalSection id="contact" title="Contact presse">
        <p>
          Pour une interview, une démonstration ou un accès de test : écrivez à{" "}
          <a href="mailto:contact@artiflow-pro.com" className="text-primary-700 underline">
            contact@artiflow-pro.com
          </a>{" "}
          ou appelez le 07 88 94 61 91. Vous êtes un partenaire potentiel ? Consultez la page{" "}
          <Link to="/partenaires" className="text-primary-700 underline">Partenaires</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
