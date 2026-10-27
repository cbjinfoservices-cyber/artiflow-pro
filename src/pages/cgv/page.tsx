import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_CGV } from "@/lib/imagesPartage";

const sections = [
  { id: "objet", label: "Objet et champ d'application" },
  { id: "definitions", label: "Définitions" },
  { id: "service", label: "Description du service" },
  { id: "compte", label: "Compte utilisateur" },
  { id: "tarifs", label: "Offres, tarifs et abonnement" },
  { id: "paiement", label: "Paiement" },
  { id: "renouvellement", label: "Renouvellement et résiliation" },
  { id: "retractation", label: "Droit de rétractation" },
  { id: "obligations", label: "Obligations de l'utilisateur" },
  { id: "disponibilite", label: "Disponibilité et support" },
  { id: "propriete", label: "Propriété intellectuelle" },
  { id: "responsabilite", label: "Responsabilité" },
  { id: "donnees", label: "Données personnelles" },
  { id: "modification", label: "Modification des CGV" },
  { id: "litiges", label: "Droit applicable et litiges" },
];

const offres = [
  {
    nom: "Essentiel",
    prix: "29 € HT / mois",
    publics: "Artisan seul",
    inclus: "Devis, clients, relances et planning pour un seul utilisateur.",
  },
  {
    nom: "Pro",
    prix: "59 € HT / mois",
    publics: "Artisan avec petit atelier",
    inclus: "Tout Essentiel, plus la facturation, la comptabilité et les modèles avancés.",
  },
  {
    nom: "Entreprise",
    prix: "99 € HT / mois",
    publics: "Équipe de plusieurs artisans",
    inclus: "Tout Pro, plus plusieurs comptes, le suivi de chantiers et l'accompagnement dédié.",
  },
];

export default function CgvPage() {
  return (
    <LegalLayout
      path="/cgv"
      eyebrow="Conditions contractuelles"
      eyebrowIcon="ri-file-shield-2-line"
      title="Conditions générales de vente et d'utilisation"
      intro="Les présentes conditions encadrent l'utilisation du logiciel ArtiFlow-pro et la souscription à ses abonnements. Elles s'appliquent à toute personne créant un compte ou utilisant le service, qu'elle soit professionnelle ou particulière."
      updatedAt="1 octobre 2026"
      metaTitle="CGV & CGU : conditions générales de vente · ArtiFlow-pro"
      metaDescription="Conditions générales de vente et d'utilisation d'ArtiFlow-pro : abonnements, tarifs, paiement, renouvellement, résiliation, rétractation et responsabilité."
      metaImage={IMAGE_PARTAGE_CGV}
      breadcrumbLabel="CGV & CGU"
      breadcrumbSchemaId="artiflow-cgv-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="objet" title="Objet et champ d'application">
        <p>
          Les présentes conditions générales de vente et d'utilisation (les « CGV ») régissent la relation entre{" "}
          <strong>CBJ-INFOSERVICES</strong>, SARL dont le siège est situé 14 voie des Meuniers, 94550 Chevilly-Larue
          (SIREN 990 157 562), éditeur du logiciel ArtiFlow-pro (le « Service »), et toute personne
          physique ou morale qui crée un compte ou utilise le Service (l'« Utilisateur »).
        </p>
        <p>
          Elles se composent des conditions générales d'utilisation (CGU) — qui définissent les règles d'accès
          et d'usage du Service — et des conditions générales de vente (CGV) relatives à la souscription des
          abonnements payants. En souscrivant à un abonnement, l'Utilisateur reconnaît avoir lu et accepté
          sans réserve l'intégralité des présentes CGV.
        </p>
        <p>
          Les CGV prévalent sur tout autre document, notamment sur les conditions d'achat de l'Utilisateur,
          sauf accord écrit contraire d'ArtiFlow-pro. Elles sont rédigées en français et accessibles à tout moment
          depuis le site.
        </p>
      </LegalSection>

      <LegalSection id="definitions" title="Définitions">
        <ul className="flex flex-col gap-2.5">
          {[
            "« Service » : le logiciel ArtiFlow-pro, accessible en ligne, destiné aux artisans du bâtiment pour la gestion des devis, relances, planning, chantiers, facturation et comptabilité.",
            "« Utilisateur » : la personne physique ou morale titulaire d'un compte ArtiFlow-pro.",
            "« Abonnement » : la souscription donnant accès au Service pour la durée et l'offre choisies.",
            "« Contenu Utilisateur » : les données saisies par l'Utilisateur dans le Service (clients, devis, factures, notes, etc.).",
            "« Offre » : l'un des niveaux tarifaires du Service (Essentiel, Pro, Entreprise).",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <i className="ri-arrow-right-circle-line text-secondary-600 mt-0.5"></i>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="service" title="Description du service">
        <p>
          ArtiFlow-pro est un logiciel en ligne (SaaS) qui aide les artisans du bâtiment à gérer leur activité au
          quotidien : création de devis assistée, suivi des relances, planning d'interventions, suivi des
          chantiers, facturation et préparation comptable.
        </p>
        <p>
          Le Service est fourni « en l'état », dans le cadre d'une obligation de moyens. ArtiFlow-pro s'efforce
          d'en assurer la disponibilité, la sécurité et l'évolution, sans garantir un résultat particulier
          quant à l'activité commerciale de l'Utilisateur. Les fonctionnalités peuvent évoluer, être enrichies
          ou ajustées pour améliorer le Service, sans que cela constitue une modification substantielle du
          contrat.
        </p>
      </LegalSection>

      <LegalSection id="compte" title="Compte utilisateur">
        <p>
          L'accès au Service nécessite la création d'un compte. L'Utilisateur s'engage à fournir des
          informations exactes, complètes et à jour, et à les maintenir à jour.
        </p>
        <p>
          Les identifiants de connexion sont strictement personnels et confidentiels. L'Utilisateur est seul
          responsable de leur conservation et de toute activité effectuée depuis son compte. En cas d'usage non
          autorisé ou de doute sur la confidentialité de ses identifiants, l'Utilisateur doit en informer
          ArtiFlow-pro sans délai et modifier son mot de passe.
        </p>
        <p>
          Le Service est réservé aux personnes capables de contracter. Un Utilisateur professionnel déclare
          agir dans le cadre de son activité et disposer des pouvoirs nécessaires pour engager son entreprise.
        </p>
      </LegalSection>

      <LegalSection id="tarifs" title="Offres, tarifs et abonnement">
        <p>
          Le Service est proposé sous forme d'abonnements mensuels. Les offres en vigueur, exprimées en euros
          hors taxes, sont les suivantes :
        </p>
        <div className="overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="bg-background-100">
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Offre</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Tarif</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Pour qui</th>
              </tr>
            </thead>
            <tbody>
              {offres.map((o) => (
                <tr key={o.nom} className="border-t border-background-200">
                  <td className="px-4 py-3 text-sm font-medium text-foreground-900">{o.nom}</td>
                  <td className="px-4 py-3 text-sm text-foreground-800 whitespace-nowrap">{o.prix}</td>
                  <td className="px-4 py-3 text-sm text-foreground-600">{o.publics}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Le prix total dû par l'Utilisateur, toutes taxes comprises, lui est présenté avant la validation de
          sa commande. ArtiFlow-pro se réserve le droit de modifier ses tarifs ; toute évolution est notifiée à
          l'Utilisateur au moins <strong>30 jours avant</strong> son entrée en vigueur. L'Utilisateur qui
          refuse la nouvelle tarification peut résilier son abonnement avant cette date, sans frais.
        </p>
        <p>
          Une période d'essai gratuite peut être proposée. À l'issue de celle-ci, l'abonnement se poursuit aux
          conditions tarifaires en vigueur, sauf résiliation par l'Utilisateur avant le terme de l'essai.
        </p>
      </LegalSection>

      <LegalSection id="paiement" title="Paiement">
        <p>
          Le paiement s'effectue par carte bancaire ou via les moyens de paiement proposés lors de la
          souscription, par l'intermédiaire d'un prestataire de paiement sécurisé. ArtiFlow-pro ne conserve à aucun
          moment les données bancaires complètes de l'Utilisateur.
        </p>
        <p>
          L'abonnement est payable d'avance, à la souscription puis à chaque échéance de la période choisie.
          En cas d'échec de paiement, ArtiFlow-pro peut suspendre l'accès au Service après information de
          l'Utilisateur, sans que cette suspension ne donne lieu à remboursement. Les sommes dues restent
          exigibles.
        </p>
      </LegalSection>

      <LegalSection id="renouvellement" title="Renouvellement et résiliation">
        <p>
          L'abonnement est conclu pour une durée correspondant à la période choisie (mensuelle ou annuelle) et
          se <strong>renouvelle automatiquement</strong> pour des périodes identiques, sauf résiliation.
        </p>
        <p>
          L'Utilisateur peut résilier son abonnement à tout moment depuis son espace personnel. La résiliation
          prend effet à la fin de la période en cours, qui reste due. L'accès au Service est maintenu jusqu'à
          cette échéance, puis le compte passe en accès restreint.
        </p>
        <p>
          L'Utilisateur reste responsable de l'export de ses données avant la fin de son abonnement. ArtiFlow-pro
          peut supprimer les données au terme d'un délai de conservation raisonnable après la résiliation,
          conformément à sa politique de confidentialité.
        </p>
      </LegalSection>

      <LegalSection id="retractation" title="Droit de rétractation">
        <p>
          Lorsque l'Utilisateur est un <strong>consommateur</strong> au sens du Code de la consommation, il
          dispose d'un droit de rétractation de <strong>quatorze (14) jours</strong> à compter de la
          souscription, sans avoir à motiver sa décision.
        </p>
        <p>
          Toutefois, conformément à l'article L221-28 du Code de la consommation, lorsque l'Utilisateur demande
          expressément l'accès immédiat au Service et renonce à son droit de rétractation avant la fin du délai,
          la rétractation n'est plus possible une fois le Service pleinement exécuté.
        </p>
        <p>
          Pour exercer ce droit, l'Utilisateur peut écrire à{" "}
          <a
            href="mailto:contact@artiflow-pro.com"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.com
          </a>
          . Les sommes versées sont alors remboursées dans un délai de quatorze jours suivant la réception de la
          demande. Les professionnels ne bénéficient pas de ce droit de rétractation.
        </p>
      </LegalSection>

      <LegalSection id="obligations" title="Obligations de l'utilisateur">
        <p>L'Utilisateur s'engage à utiliser le Service de manière loyale et conforme à sa destination. Il s'interdit notamment de :</p>
        <ul className="flex flex-col gap-2.5">
          {[
            "Utiliser le Service à des fins illicites, frauduleuses ou portant atteinte aux droits de tiers.",
            "Contourner ou tenter de contourner les mesures de sécurité, d'authentification ou les limites techniques du Service.",
            "Extraire, copier ou réutiliser de façon massive les contenus ou bases de données du Service sans autorisation.",
            "Partager ses identifiants ou donner accès au Service à un utilisateur non autorisé, hors formules prévoyant plusieurs comptes.",
            "Introduire un virus ou tout code susceptible de nuire au Service ou à son infrastructure.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <i className="ri-close-circle-line text-accent-700 mt-0.5"></i>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          L'Utilisateur demeure responsable du Contenu Utilisateur qu'il saisit et garantit disposer des droits
          nécessaires à son traitement. Tout manquement grave peut entraîner la suspension ou la résiliation du
          compte, sans préjudice de tout dommage et intérêt.
        </p>
      </LegalSection>

      <LegalSection id="disponibilite" title="Disponibilité et support">
        <p>
          ArtiFlow-pro met en œuvre les moyens raisonnables pour assurer la disponibilité du Service 24 h/24 et
          7 j/7, hors interruptions pour maintenance, mise à jour ou cas de force majeure. Des interruptions
          temporaires peuvent survenir sans ouvrir droit à indemnité.
        </p>
        <p>
          Le support est accessible par email à{" "}
          <a
            href="mailto:contact@artiflow-pro.com"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.com
          </a>{" "}
          durant les jours ouvrés. Les modalités et niveaux de support peuvent varier selon l'offre souscrite.
        </p>
      </LegalSection>

      <LegalSection id="propriete" title="Propriété intellectuelle">
        <p>
          Le Service, sa structure, ses interfaces, son code source, ses textes et ses marques demeurent la
          propriété exclusive d'CBJ-INFOSERVICES. La souscription ne confère à l'Utilisateur qu'un droit d'usage
          personnel, non exclusif et non transférable, pour la durée de son abonnement.
        </p>
        <p>
          Le Contenu Utilisateur reste la propriété de l'Utilisateur. Ce dernier concède à ArtiFlow-pro une licence
          limitée, nécessaire à l'hébergement, au traitement et à la restitution de ce contenu dans le cadre du
          Service.
        </p>
      </LegalSection>

      <LegalSection id="responsabilite" title="Responsabilité">
        <p>
          ArtiFlow-pro est tenue à une obligation de moyens. Sa responsabilité ne saurait être engagée pour les
          dommages indirects, la perte de chiffre d'affaires, de clientèle ou de données résultant d'un usage
          inapproprié du Service, d'une défaillance de connexion ou d'un cas de force majeure.
        </p>
        <p>
          En tout état de cause, pour les Utilisateurs professionnels, la responsabilité d'ArtiFlow-pro est limitée
          au montant total des sommes effectivement versées par l'Utilisateur au cours des douze mois précédant
          le fait générateur. Pour les consommateurs, cette limitation ne s'applique pas en cas de dommage
          corporel ou de faute lourde.
        </p>
      </LegalSection>

      <LegalSection id="donnees" title="Données personnelles">
        <p>
          Le traitement des données personnelles est décrit en détail dans notre{" "}
          <Link to="/rgpd" className="font-semibold text-primary-700 hover:underline cursor-pointer">
            politique de protection des données (RGPD)
          </Link>
          . L'Utilisateur, en tant que responsable de traitement des données de ses propres clients et de son équipe,
          s'engage à respecter la réglementation applicable.
        </p>
        <p>
          Le traitement de ces données par ArtiFlow-pro, en qualité de sous-traitant, est régi par l'
          <Link to="/accord-sous-traitance" className="font-semibold text-primary-700 hover:underline cursor-pointer">
            accord de sous-traitance des données
          </Link>{" "}
          (article 28 du RGPD), qui fait partie intégrante des présentes CGV et est accepté en même temps qu'elles lors
          de l'inscription.
        </p>
      </LegalSection>

      <LegalSection id="modification" title="Modification des CGV">
        <p>
          ArtiFlow-pro se réserve le droit de modifier les présentes CGV à tout moment. Les CGV applicables sont
          celles en vigueur à la date de la souscription ou du renouvellement de l'abonnement. En cas de
          modification substantielle, l'Utilisateur en est informé par tout moyen approprié et dispose d'un
          délai raisonnable pour résilier s'il refuse les nouvelles conditions.
        </p>
      </LegalSection>

      <LegalSection id="litiges" title="Droit applicable et litiges">
        <p>
          Les présentes CGV sont soumises au droit français. En cas de différend, les parties s'efforceront de
          trouver une solution amiable. À défaut, et sous réserve des règles impératives protégeant les
          consommateurs, les tribunaux français seront compétents.
        </p>
        <p>
          Conformément à la réglementation, le consommateur peut recourir gratuitement à un médiateur de la
          consommation. Pour toute question relative aux présentes conditions, écrivez-nous à{" "}
          <a
            href="mailto:contact@artiflow-pro.com"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}