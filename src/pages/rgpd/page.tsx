import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_RGPD } from "@/lib/imagesPartage";

const sections = [
  { id: "responsable", label: "Responsable du traitement" },
  { id: "donnees", label: "Données que nous collectons" },
  { id: "finalites", label: "Pourquoi nous les utilisons" },
  { id: "destinataires", label: "Qui peut y accéder" },
  { id: "durees", label: "Durées de conservation" },
  { id: "droits", label: "Vos droits" },
  { id: "cookies", label: "Cookies et traceurs" },
  { id: "securite", label: "Sécurité" },
  { id: "contact", label: "Contact et réclamation" },
];

const finalites = [
  {
    finalite: "Répondre à une demande de démonstration",
    base: "Consentement et intérêt légitime",
  },
  {
    finalite: "Gérer la relation commerciale et le support",
    base: "Exécution du contrat",
  },
  {
    finalite: "Améliorer le site et mesurer l'audience",
    base: "Consentement (cookies)",
  },
  {
    finalite: "Prospection et information sur nos offres",
    base: "Intérêt légitime / consentement",
  },
];

const durees = [
  { categorie: "Demande de démo (prospect non converti)", duree: "3 ans à compter du dernier contact" },
  { categorie: "Données clients", duree: "Durée de la relation, puis 10 ans (obligations comptables)" },
  { categorie: "Cookies de mesure d'audience", duree: "13 mois maximum" },
  { categorie: "Journaux de connexion", duree: "12 mois" },
];

const droits = [
  { icon: "ri-eye-line", label: "Droit d'accès", text: "Obtenir une copie des données que nous détenons sur vous." },
  { icon: "ri-edit-2-line", label: "Droit de rectification", text: "Corriger des informations inexactes ou incomplètes." },
  { icon: "ri-delete-bin-6-line", label: "Droit à l'effacement", text: "Demander la suppression de vos données, sous conditions légales." },
  { icon: "ri-forbid-2-line", label: "Droit d'opposition", text: "Vous opposer à un traitement, notamment à la prospection." },
  { icon: "ri-filter-3-line", label: "Droit de limitation", text: "Geler temporairement l'usage de vos données." },
  { icon: "ri-download-2-line", label: "Droit à la portabilité", text: "Recevoir vos données dans un format réutilisable." },
];

export default function RgpdPage() {
  return (
    <LegalLayout
      path="/rgpd"
      eyebrow="Protection des données"
      eyebrowIcon="ri-shield-user-line"
      title="RGPD & données personnelles"
      intro="Chez ArtiFlow-pro, vos données et celles de vos clients n'appartiennent qu'à vous. Voici, en clair, quelles données nous traitons, pourquoi, combien de temps, et comment exercer vos droits."
      updatedAt="1 octobre 2026"
      metaTitle="RGPD et données personnelles : vos droits · ArtiFlow-pro"
      metaDescription="Politique de confidentialité d'ArtiFlow-pro : données traitées, finalités, durées de conservation, cookies et exercice de vos droits RGPD."
      metaImage={IMAGE_PARTAGE_RGPD}
      breadcrumbLabel="RGPD & données"
      breadcrumbSchemaId="artiflow-rgpd-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="responsable" title="Responsable du traitement">
        <p>
          Le responsable du traitement des données collectées via le site est <strong>ArtiFlow-pro SAS</strong>,
          dont le siège social est situé au 12 rue des Artisans, 75011 Paris, France, immatriculée au RCS de
          Paris sous le numéro B 912 345 678.
        </p>
        <p>
          Pour toute question relative à la protection de vos données, vous pouvez joindre notre référent
          protection des données à l'adresse{" "}
          <a
            href="mailto:contact@artiflow-pro.fr"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.fr
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="donnees" title="Données que nous collectons">
        <p>Nous ne collectons que les données strictement nécessaires aux finalités décrites ci-dessous :</p>
        <ul className="flex flex-col gap-2.5">
          {[
            "Les informations que vous nous transmettez via le formulaire de démonstration : nom, email, téléphone, métier, taille d'équipe et message.",
            "Les données liées à votre navigation sur le site : pages consultées, date et heure, type d'appareil, mesure d'audience anonymisée.",
            "Les échanges que vous avez avec notre équipe (email, téléphone), lorsque vous demandez une démonstration ou un accompagnement.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <i className="ri-checkbox-circle-line text-secondary-600 mt-0.5"></i>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          Nous ne collectons jamais de données sensibles (santé, origine, opinions politiques ou religieuses)
          et nous ne pratiquons aucun profilage automatisé produisant des effets juridiques à votre égard.
        </p>
      </LegalSection>

      <LegalSection id="finalites" title="Pourquoi nous les utilisons">
        <p>
          Chaque traitement repose sur une base légale précise, conformément à l'article 6 du RGPD :
        </p>
        <div className="overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="bg-background-100">
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Finalité</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Base légale</th>
              </tr>
            </thead>
            <tbody>
              {finalites.map((row) => (
                <tr key={row.finalite} className="border-t border-background-200">
                  <td className="px-4 py-3 text-sm text-foreground-800">{row.finalite}</td>
                  <td className="px-4 py-3 text-sm text-foreground-600">{row.base}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="destinataires" title="Qui peut y accéder">
        <p>
          Vos données sont accessibles uniquement aux membres habilités de l'équipe ArtiFlow-pro et à nos
          sous-traitants techniques (hébergeur, service d'envoi d'emails), dans la limite de ce qui est
          nécessaire à l'exécution de leur mission.
        </p>
        <p>
          <strong>Nous ne vendons ni ne louons jamais vos données.</strong> Aucun transfert n'est réalisé en
          dehors de l'Union européenne sans garanties appropriées.
        </p>
      </LegalSection>

      <LegalSection id="durees" title="Durées de conservation">
        <p>
          Nous conservons vos données uniquement le temps nécessaire aux finalités poursuivies, puis nous les
          supprimons ou les anonymisons :
        </p>
        <div className="overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="bg-background-100">
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Catégorie</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Durée</th>
              </tr>
            </thead>
            <tbody>
              {durees.map((row) => (
                <tr key={row.categorie} className="border-t border-background-200">
                  <td className="px-4 py-3 text-sm text-foreground-800">{row.categorie}</td>
                  <td className="px-4 py-3 text-sm text-foreground-600">{row.duree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="droits" title="Vos droits">
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants sur
          vos données :
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {droits.map((d) => (
            <div key={d.label} className="p-4 rounded-lg bg-background-100 border border-background-200">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                  <i className={d.icon}></i>
                </span>
                <h3 className="font-heading font-semibold text-sm text-foreground-950">{d.label}</h3>
              </div>
              <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{d.text}</p>
            </div>
          ))}
        </div>
        <p>
          Vous pouvez exercer ces droits à tout moment en écrivant à{" "}
          <a
            href="mailto:contact@artiflow-pro.fr"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.fr
          </a>
          . Nous répondons dans un délai maximum d'un mois, et pouvons vous demander un justificatif d'identité
          en cas de doute raisonnable.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies et traceurs">
        <p>
          Le site utilise deux types de cookies. Les <strong>cookies strictement nécessaires</strong>
          (sécurité, fonctionnement, mémorisation de vos choix) ne requièrent pas votre consentement. Les{" "}
          <strong>cookies de mesure d'audience</strong> ne sont déposés qu'avec votre accord, afin de comprendre
          quelles pages sont les plus utiles et d'améliorer le site.
        </p>
        <p>
          Vous pouvez à tout moment modifier vos préférences ou supprimer les cookies depuis les réglages de
          votre navigateur. Le refus des cookies de mesure d'audience n'empêche pas la navigation sur le site.
          Pour le détail de chaque traceur, sa finalité et sa durée, consultez notre{" "}
          <Link to="/cookies" className="font-semibold text-primary-700 hover:underline cursor-pointer">
            politique de cookies
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="securite" title="Sécurité">
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos
          données : chiffrement des communications, contrôle strict des accès, cloisonnement des données,
          sauvegardes régulières et journalisation des accès.
        </p>
        <p>
          En cas de violation de données susceptible d'engendrer un risque élevé pour vos droits, nous nous
          engageons à vous en informer ainsi que la CNIL dans les délais prévus par la réglementation.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact et réclamation">
        <p>
          Pour toute question relative à vos données personnelles, contactez notre référent à{" "}
          <a
            href="mailto:contact@artiflow-pro.fr"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.fr
          </a>
          . Nous traitons votre demande dans un délai d'un mois.
        </p>
        <p>
          Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez
          adresser une réclamation à la Commission nationale de l'informatique et des libertés (CNIL), 3 place
          de Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou en ligne sur{" "}
          <a
            href="https://www.cnil.fr/fr/plaintes"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            cnil.fr
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}