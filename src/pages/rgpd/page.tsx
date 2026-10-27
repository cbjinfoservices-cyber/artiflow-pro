import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_RGPD } from "@/lib/imagesPartage";
import { PRESTATAIRES } from "@/lib/documentsLegaux";

/**
 * Politique de confidentialité d'ArtiFlow-pro (site vitrine ET application).
 *
 * Deux rôles distincts au sens du RGPD :
 *  - responsable de traitement pour les données des visiteurs, prospects et artisans abonnés ;
 *  - sous-traitant (art. 28) pour les données que l'artisan enregistre sur ses propres clients et
 *    sur son équipe : l'artisan en est le responsable.
 * Les prestataires listés ici doivent rester alignés sur le code (supabase/functions/_shared/*).
 */

const EMAIL_CONTACT = "contact@artiflow-pro.com";

const sections = [
  { id: "responsable", label: "Qui est responsable" },
  { id: "donnees", label: "Données traitées" },
  { id: "finalites", label: "Pourquoi et sur quelle base" },
  { id: "sous-traitant", label: "Les données de vos clients et de votre équipe" },
  { id: "intervenants", label: "Intervenants et pointage des heures" },
  { id: "prestataires", label: "Nos prestataires" },
  { id: "transferts", label: "Transferts hors Union européenne" },
  { id: "durees", label: "Durées de conservation" },
  { id: "droits", label: "Vos droits" },
  { id: "cookies", label: "Cookies et ressources externes" },
  { id: "securite", label: "Sécurité" },
  { id: "contact", label: "Contact et réclamation" },
];

const donnees = [
  {
    qui: "Visiteurs du site",
    quoi: "Pages consultées, date et heure, type d'appareil et de navigateur, adresse IP (journaux techniques du serveur). Mesure d'audience uniquement si vous l'acceptez.",
  },
  {
    qui: "Prospects et contacts",
    quoi: "Demande de démonstration ou message de contact : nom, entreprise, email, téléphone, métier, taille d'équipe, sujet et message. Alerte podcast : email et plateforme d'écoute.",
  },
  {
    qui: "Candidats",
    quoi: "Nom, email, téléphone, poste visé, lien vers un profil en ligne et message.",
  },
  {
    qui: "Artisans abonnés",
    quoi: "Email et mot de passe (chiffré), nom de l'entreprise, métier, coordonnées, SIRET, numéro de TVA, logo, réglages, abonnement et historique de facturation. Les données de carte bancaire sont saisies chez Stripe : nous ne les voyons ni ne les conservons.",
  },
  {
    qui: "Clients des artisans",
    quoi: "Ce que l'artisan enregistre : nom, coordonnées, adresse du chantier, devis, factures, signature d'un devis ou d'un procès-verbal, photos de chantier, échanges envoyés (emails, SMS).",
  },
  {
    qui: "Intervenants (équipe de l'artisan)",
    quoi: "Nom, email, téléphone, métier, planning, congés, heures d'arrivée et de départ pointées, pauses, procès-verbaux remplis sur place.",
  },
];

const finalites = [
  { finalite: "Fournir le service ArtiFlow-pro aux artisans abonnés (compte, application, envois)", base: "Exécution du contrat" },
  { finalite: "Facturer l'abonnement et tenir la comptabilité", base: "Exécution du contrat et obligation légale" },
  { finalite: "Répondre à une demande de démonstration ou à un message", base: "Mesures précontractuelles à votre demande" },
  { finalite: "Étudier une candidature", base: "Mesures précontractuelles à votre demande" },
  { finalite: "Prévenir de la sortie des épisodes du podcast", base: "Consentement (inscription à l'alerte)" },
  { finalite: "Assurer la sécurité du service et prévenir les abus (journaux techniques)", base: "Intérêt légitime" },
  { finalite: "Informer les professionnels de nos offres (désinscription en un clic)", base: "Intérêt légitime" },
  { finalite: "Mesurer l'audience du site", base: "Consentement (cookies)" },
  { finalite: "Traiter les données des clients et de l'équipe pour le compte de l'artisan", base: "Selon les instructions de l'artisan, responsable de ces données" },
];

const durees = [
  { categorie: "Compte artisan et données saisies dans l'application", duree: "Pendant toute la durée de l'abonnement, puis effacement 30 jours après la demande de suppression du compte" },
  { categorie: "Factures d'abonnement", duree: "10 ans (obligations comptables)" },
  { categorie: "Trace d'une demande de suppression de compte", duree: "5 ans (preuve en cas de litige)" },
  { categorie: "Demande de démonstration, message de contact, alerte podcast", duree: "3 ans" },
  { categorie: "Candidature non retenue", duree: "2 ans" },
  { categorie: "Inscription jamais confirmée (adresse email non validée)", duree: "30 jours" },
  { categorie: "Journaux techniques des envois (emails, SMS, diagnostics)", duree: "12 mois" },
  { categorie: "Journaux techniques du serveur web", duree: "Quelques semaines (rotation automatique)" },
  { categorie: "Cookies de mesure d'audience", duree: "13 mois maximum" },
];

const droits = [
  { icon: "ri-eye-line", label: "Droit d'accès", text: "Obtenir une copie des données que nous détenons sur vous." },
  { icon: "ri-edit-2-line", label: "Droit de rectification", text: "Corriger des informations inexactes ou incomplètes." },
  { icon: "ri-delete-bin-6-line", label: "Droit à l'effacement", text: "Demander la suppression de vos données et de votre compte." },
  { icon: "ri-forbid-2-line", label: "Droit d'opposition", text: "Vous opposer à un traitement, notamment à la prospection." },
  { icon: "ri-filter-3-line", label: "Droit de limitation", text: "Geler temporairement l'usage de vos données." },
  { icon: "ri-download-2-line", label: "Droit à la portabilité", text: "Recevoir vos données dans un format réutilisable." },
];

const lien = "font-semibold text-primary-700 hover:underline cursor-pointer";

function Tableau({ entetes, lignes }: { entetes: string[]; lignes: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-background-200">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr className="bg-background-100">
            {entetes.map((e) => (
              <th key={e} className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((cellules, i) => (
            <tr key={i} className="border-t border-background-200 align-top">
              {cellules.map((c, j) => (
                <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? "text-foreground-800 font-medium" : "text-foreground-600"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Liste({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <i className="ri-checkbox-circle-line text-secondary-600 mt-0.5"></i>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const Email = () => (
  <a href={`mailto:${EMAIL_CONTACT}`} className={lien}>
    {EMAIL_CONTACT}
  </a>
);

export default function RgpdPage() {
  return (
    <LegalLayout
      path="/rgpd"
      eyebrow="Protection des données"
      eyebrowIcon="ri-shield-user-line"
      title="RGPD & données personnelles"
      intro="Chez ArtiFlow-pro, vos données et celles de vos clients n'appartiennent qu'à vous. Voici, en clair, quelles données nous traitons sur le site et dans l'application, pourquoi, avec qui, combien de temps, et comment exercer vos droits."
      updatedAt="25 octobre 2026"
      metaTitle="RGPD et données personnelles : vos droits · ArtiFlow-pro"
      metaDescription="Politique de confidentialité d'ArtiFlow-pro : données traitées sur le site et dans l'application, prestataires, durées de conservation, cookies et exercice de vos droits RGPD."
      metaImage={IMAGE_PARTAGE_RGPD}
      breadcrumbLabel="RGPD & données"
      breadcrumbSchemaId="artiflow-rgpd-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="responsable" title="Qui est responsable">
        <p>
          Le site artiflow-pro.com et l'application ArtiFlow-pro sont édités par <strong>CBJ-INFOSERVICES</strong>,
          société à responsabilité limitée, dont le siège est situé 14 voie des Meuniers, 94550 Chevilly-Larue,
          France (SIREN 990 157 562, SIRET 990 157 562 00036, TVA intracommunautaire FR85 990 157 562).
        </p>
        <p>
          CBJ-INFOSERVICES est <strong>responsable du traitement</strong> des données des visiteurs du site, des
          personnes qui demandent une démonstration et des artisans abonnés. Pour les données que l'artisan enregistre
          sur ses propres clients et sur son équipe, c'est l'artisan qui est responsable, et nous agissons comme son{" "}
          <strong>sous-traitant</strong> (voir plus bas).
        </p>
        <p>
          Pour toute question sur vos données : <Email />.
        </p>
      </LegalSection>

      <LegalSection id="donnees" title="Données traitées">
        <p>Nous ne traitons que les données nécessaires au service :</p>
        <Tableau entetes={["Personnes concernées", "Données"]} lignes={donnees.map((d) => [d.qui, d.quoi])} />
        <p>
          Nous ne demandons aucune donnée sensible (santé, origine, opinions politiques ou religieuses) et ne
          pratiquons aucun profilage produisant des effets juridiques. L'application n'utilise pas la position de
          votre téléphone.
        </p>
      </LegalSection>

      <LegalSection id="finalites" title="Pourquoi et sur quelle base">
        <p>Chaque traitement repose sur une base légale prévue par l'article 6 du RGPD :</p>
        <Tableau entetes={["Finalité", "Base légale"]} lignes={finalites.map((f) => [f.finalite, f.base])} />
        <p>
          <strong>Nous ne vendons, ne louons ni n'échangeons jamais vos données</strong>, et nous ne les utilisons
          pas à des fins publicitaires.
        </p>
      </LegalSection>

      <LegalSection id="sous-traitant" title="Les données de vos clients et de votre équipe">
        <p>
          Lorsque vous enregistrez dans ArtiFlow-pro les coordonnées de vos clients, vos chantiers ou les heures de
          votre équipe, vous êtes le responsable de ces données. CBJ-INFOSERVICES les traite uniquement pour vous
          fournir le service, et s'engage à :
        </p>
        <Liste
          items={[
            "ne les utiliser que pour exécuter vos instructions (devis, factures, relances, planning, suivi de chantier) ;",
            "ne jamais les consulter, sauf demande de votre part pour une assistance, et ne jamais les céder ;",
            "les protéger : chaque compte ne voit que ses propres données, et nos gestionnaires n'ont pas accès aux fichiers clients des artisans ;",
            "ne confier leur traitement qu'aux prestataires listés ci-dessous, tenus aux mêmes obligations ;",
            "vous aider à répondre aux demandes de vos clients ou de vos salariés qui exercent leurs droits ;",
            "vous prévenir sans délai en cas de violation de données les concernant ;",
            "les effacer à la fin de votre abonnement, après le délai de 30 jours prévu à la suppression du compte.",
          ]}
        />
        <p>
          Ces engagements sont détaillés dans notre{" "}
          <Link to="/accord-sous-traitance" className={lien}>
            accord de sous-traitance des données
          </Link>
          , annexe des conditions générales acceptée à l'inscription.
        </p>
        <p>
          Un client ou un salarié qui souhaite exercer ses droits sur ces données doit s'adresser en priorité à
          l'artisan concerné. S'il nous écrit, nous transmettons sa demande à l'artisan.
        </p>
      </LegalSection>

      <LegalSection id="intervenants" title="Intervenants et pointage des heures">
        <p>
          Les intervenants invités par un artisan disposent de leur propre espace : ils y voient leur planning, les
          informations utiles du chantier (adresse, client à contacter, consignes) et y pointent leurs heures. Ils ne
          voient jamais les montants, devis ou factures de l'entreprise.
        </p>
        <p>
          Les heures pointées (arrivée, départ, pause) sont visibles par l'artisan employeur, qui les utilise pour
          organiser les chantiers et préparer la paie. L'application ne suit pas la position des intervenants. Il
          appartient à l'employeur d'informer ses salariés de ce dispositif, comme le prévoit le Code du travail.
        </p>
      </LegalSection>

      <LegalSection id="prestataires" title="Nos prestataires">
        <p>
          Nous faisons appel à des prestataires techniques, liés par contrat et tenus de protéger les données qu'ils
          traitent pour notre compte :
        </p>
        <Tableau
          entetes={["Prestataire", "Rôle", "Localisation des données"]}
          lignes={PRESTATAIRES.map((p) => [p.nom, p.role, p.lieu])}
        />
        <p>
          Seuls les membres habilités de notre équipe accèdent aux données, et uniquement lorsque c'est nécessaire
          (assistance, facturation, sécurité).
        </p>
      </LegalSection>

      <LegalSection id="transferts" title="Transferts hors Union européenne">
        <p>
          Vos données sont hébergées dans l'Union européenne. Deux situations peuvent entraîner un transfert vers les
          États-Unis, encadré par les clauses contractuelles types de la Commission européenne et, le cas échéant, le
          cadre de protection des données UE–États-Unis (Data Privacy Framework) :
        </p>
        <Liste
          items={[
            "la rédaction d'un devis par intelligence artificielle : seuls la description des travaux saisie par l'artisan et son métier sont envoyés à OpenAI, sans le nom du client ni l'identifiant du compte. OpenAI n'utilise pas ces données pour entraîner ses modèles. Évitez d'y inscrire des informations personnelles ;",
            "l'assistance technique de Supabase et de Stripe, dont les sociétés mères sont américaines.",
          ]}
        />
      </LegalSection>

      <LegalSection id="durees" title="Durées de conservation">
        <p>Nous conservons les données uniquement le temps nécessaire, puis nous les supprimons ou les anonymisons :</p>
        <Tableau entetes={["Données", "Durée"]} lignes={durees.map((d) => [d.categorie, d.duree])} />
        <p>
          Ces durées sont appliquées automatiquement : un traitement quotidien supprime les données arrivées à échéance.
          Les données de vos clients et de votre équipe sont conservées tant que votre compte existe. Pensez à exporter
          vos documents avant de supprimer votre compte : vos propres obligations de conservation (factures clients,
          paie) restent à votre charge.
        </p>
      </LegalSection>

      <LegalSection id="droits" title="Vos droits">
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants sur vos
          données :
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
          Pour supprimer votre compte et toutes les données associées, suivez la procédure décrite sur la page{" "}
          <Link to="/suppression-compte" className={lien}>
            Supprimer votre compte
          </Link>
          . Pour les autres droits, écrivez à <Email />. Nous répondons dans un délai d'un mois et pouvons vous demander
          un justificatif d'identité en cas de doute raisonnable.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies et ressources externes">
        <p>
          Le site utilise des <strong>cookies strictement nécessaires</strong> (sécurité, connexion, mémorisation de
          vos choix), qui ne requièrent pas votre consentement, et des <strong>cookies de mesure d'audience</strong>,
          déposés seulement si vous les acceptez. Refuser ces derniers n'empêche pas d'utiliser le site. Le détail de
          chaque traceur figure dans notre{" "}
          <Link to="/cookies" className={lien}>
            politique de cookies
          </Link>
          .
        </p>
        <p>
          Pour s'afficher, le site charge aussi des polices de caractères (Google Fonts), des icônes (cdnjs, Cloudflare)
          et certaines images depuis des services externes : votre navigateur leur transmet votre adresse IP, comme
          pour toute ressource web. Aucun de ces services ne dépose de cookie publicitaire.
        </p>
      </LegalSection>

      <LegalSection id="securite" title="Sécurité">
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles adaptées : chiffrement de toutes les
          communications (HTTPS), chiffrement des données stockées, mots de passe jamais conservés en clair, règles
          d'accès qui cloisonnent les données de chaque entreprise, et accès d'administration limités et protégés.
        </p>
        <p>
          En cas de violation de données susceptible d'engendrer un risque pour vos droits, nous prévenons la CNIL et
          les personnes concernées dans les délais prévus par la réglementation.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact et réclamation">
        <p>
          Pour toute question relative à vos données personnelles : <Email />, ou par courrier à CBJ-INFOSERVICES,
          14 voie des Meuniers, 94550 Chevilly-Larue. Nous traitons votre demande dans un délai d'un mois.
        </p>
        <p>
          Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez adresser une
          réclamation à la Commission nationale de l'informatique et des libertés (CNIL), 3 place de Fontenoy, TSA
          80715, 75334 Paris Cedex 07, ou en ligne sur{" "}
          <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer" className={lien}>
            cnil.fr
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
