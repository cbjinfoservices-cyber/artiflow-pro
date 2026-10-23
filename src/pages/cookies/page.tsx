import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { openCookieConsent } from "@/components/feature/CookieConsent";
import { IMAGE_PARTAGE_COOKIES } from "@/lib/imagesPartage";

const sections = [
  { id: "definition", label: "Qu'est-ce qu'un cookie ?" },
  { id: "limites", label: "Pourquoi si peu de traceurs" },
  { id: "necessaires", label: "Cookies strictement nécessaires" },
  { id: "mesure", label: "Cookies de mesure d'audience" },
  { id: "tableau", label: "Liste des traceurs" },
  { id: "tiers", label: "Services tiers et contenus externes" },
  { id: "ce-que-nous-ne-faisons-pas", label: "Ce que nous ne faisons pas" },
  { id: "gestion", label: "Gérer vos préférences" },
  { id: "droits", label: "Vos droits sur vos données" },
  { id: "duree", label: "Durées de conservation" },
  { id: "evolution", label: "Évolution de cette politique" },
];

const traceurs = [
  {
    nom: "artiflow-cookie-consent",
    categorie: "Strictement nécessaire",
    finalite: "Mémorise votre choix de consentement pour ne pas vous reposer la question à chaque visite.",
    duree: "6 mois",
  },
  {
    nom: "artiflow-session",
    categorie: "Strictement nécessaire",
    finalite: "Maintient votre session active et garantit la sécurité de la navigation.",
    duree: "Session",
  },
  {
    nom: "artiflow-csrf",
    categorie: "Strictement nécessaire",
    finalite: "Protège les formulaires contre les requêtes frauduleuses (falsification de requête).",
    duree: "Session",
  },
  {
    nom: "_af_analytics",
    categorie: "Mesure d'audience",
    finalite: "Mesure de façon anonymisée les pages consultées, la durée et le parcours, pour améliorer le site.",
    duree: "13 mois",
  },
  {
    nom: "_af_canal",
    categorie: "Mesure d'audience",
    finalite: "Identifie le canal d'arrivée (recherche, campagne, lien direct) pour comprendre ce qui vous amène.",
    duree: "13 mois",
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      path="/cookies"
      eyebrow="Traceurs et consentement"
      eyebrowIcon="ri-equalizer-line"
      title="Politique de cookies"
      intro="Cette page détaille, traceur par traceur, ce que le site ArtiFlow-pro utilise, dans quel but et pendant combien de temps. Vous gardez le contrôle : vos préférences sont modifiables à tout moment."
      updatedAt="1 octobre 2026"
      metaTitle="Politique de cookies et traceurs du site · ArtiFlow-pro"
      metaDescription="Politique de cookies d'ArtiFlow-pro : cookies strictement nécessaires, mesure d'audience, finalités, durées de conservation et gestion des préférences."
      metaImage={IMAGE_PARTAGE_COOKIES}
      breadcrumbLabel="Politique de cookies"
      breadcrumbSchemaId="artiflow-cookies-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="definition" title="Qu'est-ce qu'un cookie ?">
        <p>
          Un cookie est un petit fichier texte déposé sur votre appareil lorsque vous consultez un site. Il
          permet de mémoriser des informations utiles à votre navigation (vos préférences, votre session) ou
          de mesurer l'usage du site. Certains traceurs sont indispensables à son fonctionnement, d'autres
          nécessitent votre accord préalable.
        </p>
        <p>
          Le site ArtiFlow-pro utilise deux familles de traceurs : les cookies <strong>strictement nécessaires</strong>{" "}
          et les cookies de <strong>mesure d'audience</strong>. Nous n'utilisons aucun cookie publicitaire ni
          de ciblage marketing tiers.
        </p>
      </LegalSection>

      <LegalSection id="limites" title="Pourquoi nous utilisons si peu de traceurs">
        <p>
          Beaucoup de sites déposent des dizaines de cookies : régies publicitaires, réseaux sociaux, outils de
          personnalisation, tests A/B, cartes de chaleur. Chacun ajoute du poids à la page, allonge le temps de
          chargement et déplace la question de la vie privée vers celle de la surveillance publicitaire. Nous
          avons fait le choix inverse.
        </p>
        <p>
          Un artisan consulte notre site entre deux chantiers, depuis son téléphone, parfois avec un réseau
          médiocre. Chaque script supplémentaire se paie en secondes d'attente et en données mobiles
          consommées. Nous préférons donc un site léger, qui répond vite à la seule question qui compte :
          « est-ce que cet outil peut m'aider dans mon métier ? »
        </p>
        <p>
          Ce choix a une conséquence directe : nous ne revendons aucune donnée de navigation, nous ne construisons
          pas de profils publicitaires, et nous ne suivons pas votre parcours d'un site à l'autre. La mesure
          d'audience que nous utilisons reste agrégée, sans identification individuelle, et uniquement si vous
          l'avez acceptée.
        </p>
      </LegalSection>

      <LegalSection id="necessaires" title="Cookies strictement nécessaires">
        <p>
          Ces traceurs sont indispensables au fonctionnement et à la sécurité du site. Ils permettent de
          maintenir votre session, de protéger les formulaires contre les abus et de mémoriser votre choix de
          consentement. Conformément à la réglementation, ils ne requièrent pas votre accord car le site ne
          pourrait pas fonctionner correctement sans eux.
        </p>
      </LegalSection>

      <LegalSection id="mesure" title="Cookies de mesure d'audience">
        <p>
          Ces traceurs nous aident à comprendre comment le site est utilisé : pages les plus consultées, temps
          passé, canaux d'arrivée. Les données sont <strong>agrégées et anonymisées</strong> — elles ne
          permettent pas de vous identifier personnellement.
        </p>
        <p>
          Ces cookies ne sont déposés <strong>qu'après votre accord explicite</strong>. Si vous les refusez,
          le site reste pleinement accessible et fonctionnel.
        </p>
      </LegalSection>

      <LegalSection id="tableau" title="Liste des traceurs">
        <p>Voici le détail de chaque traceur utilisé sur artiflow-pro.com :</p>
        <div className="overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-background-100">
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Nom</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Catégorie</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Finalité</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">Durée</th>
              </tr>
            </thead>
            <tbody>
              {traceurs.map((t) => (
                <tr key={t.nom} className="border-t border-background-200">
                  <td className="px-4 py-3 text-sm font-medium text-foreground-900 whitespace-nowrap">
                    <code className="text-xs">{t.nom}</code>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground-700 whitespace-nowrap">{t.categorie}</td>
                  <td className="px-4 py-3 text-sm text-foreground-600">{t.finalite}</td>
                  <td className="px-4 py-3 text-sm text-foreground-600 whitespace-nowrap">{t.duree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="tiers" title="Services tiers et contenus externes">
        <p>
          Certaines fonctionnalités reposent sur des services externes, mais nous veillons à ce qu'ils ne
          déposent pas de traceur publicitaire à votre insu. Le chargement des polices et des icônes est
          réalisé de manière à ne pas bloquer l'affichage de la page ; aucune régie publicitaire n'est intégrée
          au site.
        </p>
        <p>
          Lorsque vous choisissez de nous contacter par WhatsApp, d'ouvrir un profil LinkedIn ou de consulter une
          page externe depuis nos liens, vous quittez notre site et les politiques de confidentialité de ces
          services s'appliquent. Nous n'avons aucun contrôle sur les traceurs qu'ils déposent à ce moment-là.
          C'est pourquoi ces liens sont toujours signalés comme externes et ouverts dans un nouvel onglet.
        </p>
        <p>
          Enfin, si vous souscrivez à un abonnement, le paiement est traité par un prestataire spécialisé, qui
          applique ses propres obligations de sécurité et de conformité. Aucune donnée bancaire ne transite par
          nos serveurs.
        </p>
      </LegalSection>

      <LegalSection id="ce-que-nous-ne-faisons-pas" title="Ce que nous ne faisons pas avec vos données">
        <p>
          Il est plus simple de décrire ce que nous ne faisons pas que ce que nous faisons, parce que la liste
          est courte et qu'elle est assumée. Nous ne revendons pas de données de navigation, nous ne les
          échangeons pas avec des partenaires et nous ne construisons pas de profils publicitaires. Aucun
          identifiant publicitaire n'est créé sur ce site, et aucun script de reciblage n'y est chargé.
        </p>
        <p>
          Nous ne cherchons pas non plus à identifier une personne derrière une visite. Le tableau ci-dessus
          liste cinq traceurs, ce qui est très peu au regard des standards du web : il n'y a ni carte de
          chaleur, ni test A/B comportemental, ni outil de personnalisation dynamique, ni widget de réseau
          social qui vous suivrait sur d'autres sites. Ces technologies ne sont pas mauvaises en soi, mais
          elles imposent un coût de chargement et une surveillance qui ne se justifient pas pour une
          documentation produit et une page tarifaire.
        </p>
        <p>
          Enfin, les informations que vous nous transmettez volontairement — un message envoyé par le
          formulaire de contact, une demande de démonstration, une candidature — ne servent qu'à vous répondre
          et à assurer le suivi de votre demande. Elles ne viennent alimenter aucune prospection automatisée
          sans votre accord, et vous pouvez demander leur suppression à tout moment, comme expliqué plus bas.
        </p>
      </LegalSection>

      <LegalSection id="gestion" title="Gérer vos préférences">
        <p>
          Vous pouvez à tout moment accepter ou refuser les cookies de mesure d'audience. Votre choix est
          mémorisé et n'affecte pas l'accès au site.
        </p>
        <button
          type="button"
          onClick={openCookieConsent}
          className="self-start inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-equalizer-line"></i>
          Gérer mes cookies
        </button>
        <p>
          Vous pouvez également supprimer ou bloquer les cookies depuis les réglages de votre navigateur
          (Chrome, Firefox, Safari, Edge). Notez que le blocage des cookies strictement nécessaires peut
          dégrader certaines fonctionnalités du site.
        </p>
      </LegalSection>

      <LegalSection id="droits" title="Vos droits sur vos données">
        <p>
          Le refus des cookies de mesure d'audience est un droit, pas une option cachée : il s'exerce en un clic
          depuis le bouton ci-dessus, et votre choix est conservé. Refuser ne restreint aucun contenu et ne
          dégrade aucune fonctionnalité du site.
        </p>
        <p>
          Plus largement, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et
          d'opposition sur les données vous concernant, conformément au RGPD. Ces droits s'appliquent aussi aux
          informations transmises via nos formulaires de contact ou lors d'une demande de démonstration.
        </p>
        <p>
          Pour exercer ces droits, écrivez-nous à contact@artiflow-pro.com en précisant votre demande. Nous
          répondons dans un délai maximum d'un mois, et nous vous indiquons, le cas échéant, quelles données nous
          conservons et pour quelle durée. Le détail complet des traitements figure dans notre politique de
          confidentialité.
        </p>
        <ul className="flex flex-col gap-2.5">
          {[
            "Droit d'accès : savoir quelles données sont conservées et en obtenir une copie.",
            "Droit de rectification : corriger une information inexacte ou incomplète.",
            "Droit à l'effacement : demander la suppression de vos données lorsque la loi le permet.",
            "Droit d'opposition : refuser un traitement fondé sur notre intérêt légitime.",
            "Droit à la portabilité : récupérer vos données dans un format lisible par une machine.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <i className="ri-arrow-right-circle-line text-secondary-600 mt-0.5"></i>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="duree" title="Durées de conservation">
        <p>
          Chaque traceur a une durée de vie limitée, indiquée dans le tableau ci-dessus. Les cookies de
          session disparaissent à la fermeture de votre navigateur ; les autres sont conservés pour une durée
          maximale de <strong>13 mois</strong>, conformément aux recommandations de la CNIL. Passé ce délai,
          votre consentement est à nouveau recueilli.
        </p>
      </LegalSection>

      <LegalSection id="evolution" title="Évolution de cette politique">
        <p>
          Cette politique peut être mise à jour pour refléter l'ajout de nouveaux traceurs ou une évolution
          réglementaire. En cas de modification substantielle, la bannière de consentement vous sera présentée
          à nouveau.
        </p>
        <p>
          Pour toute question sur les cookies ou vos données personnelles, écrivez-nous à{" "}
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