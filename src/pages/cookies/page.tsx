import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { openCookieConsent } from "@/components/feature/CookieConsent";
import { IMAGE_PARTAGE_COOKIES } from "@/lib/imagesPartage";

const sections = [
  { id: "definition", label: "Qu'est-ce qu'un cookie ?" },
  { id: "necessaires", label: "Cookies strictement nécessaires" },
  { id: "mesure", label: "Cookies de mesure d'audience" },
  { id: "tableau", label: "Liste des traceurs" },
  { id: "gestion", label: "Gérer vos préférences" },
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
      metaTitle="Politique de cookies · ArtiFlow-pro"
      metaDescription="Politique de cookies d'ArtiFlow-pro : cookies strictement nécessaires, cookies de mesure d'audience, finalités, durées de conservation et gestion de vos préférences."
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
        <p>Voici le détail de chaque traceur utilisé sur artiflow-pro.fr :</p>
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
            href="mailto:contact@artiflow-pro.fr"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            contact@artiflow-pro.fr
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}