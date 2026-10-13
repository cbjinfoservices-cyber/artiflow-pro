import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_ACCESSIBILITE } from "@/lib/imagesPartage";

const sections = [
  { id: "engagement", label: "Notre engagement" },
  { id: "niveau", label: "Niveau de conformité" },
  { id: "mesures", label: "Ce que nous mettons en place" },
  { id: "amelioration", label: "Points en cours d'amélioration" },
  { id: "signaler", label: "Signaler un problème" },
  { id: "recours", label: "Voies de recours" },
];

const mesures = [
  {
    icon: "ri-code-s-slash-line",
    title: "Structure sémantique claire",
    text: "Titres hiérarchisés, repères de navigation (en-tête, principal, pied de page) et liens explicites pour faciliter la lecture par les lecteurs d'écran.",
  },
  {
    icon: "ri-contrast-2-line",
    title: "Contrastes suffisants",
    text: "Des ratios de contraste conformes aux recommandations WCAG AA pour le texte et les éléments d'interface essentiels.",
  },
  {
    icon: "ri-keyboard-line",
    title: "Navigation au clavier",
    text: "Tous les éléments interactifs — liens, boutons, formulaires — sont accessibles et utilisables sans souris.",
  },
  {
    icon: "ri-image-line",
    title: "Alternatives textuelles",
    text: "Les images porteuses d'information disposent d'une alternative textuelle ; le contenu reste compréhensible lorsqu'elles sont indisponibles.",
  },
  {
    icon: "ri-text-wrap",
    title: "Textes redimensionnables",
    text: "La mise en page reste lisible et fonctionnelle lorsque la taille du texte est augmentée, sans perte d'information.",
  },
  {
    icon: "ri-file-list-3-line",
    title: "Formulaires accessibles",
    text: "Chaque champ dispose d'une étiquette associée, les messages d'erreur sont explicites et le parcours est cohérent au clavier.",
  },
];

export default function AccessibilitePage() {
  return (
    <LegalLayout
      path="/accessibilite"
      eyebrow="Inclusion numérique"
      eyebrowIcon="ri-wheelchair-line"
      title="Déclaration d'accessibilité"
      intro="ArtiFlow-pro s'engage à rendre son site accessible au plus grand nombre, y compris aux personnes en situation de handicap. Cette déclaration décrit nos engagements, notre niveau de conformité et les moyens de nous signaler une difficulté."
      updatedAt="1 octobre 2026"
      metaTitle="Accessibilité · ArtiFlow-pro"
      metaDescription="Déclaration d'accessibilité d'ArtiFlow-pro : engagement, niveau de conformité, mesures mises en place et contact pour signaler un problème d'accessibilité."
      metaImage={IMAGE_PARTAGE_ACCESSIBILITE}
      breadcrumbLabel="Accessibilité"
      breadcrumbSchemaId="artiflow-accessibilite-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="engagement" title="Notre engagement">
        <p>
          Nous considérons l'accessibilité numérique comme une exigence de qualité, pas comme une option.
          Notre ambition est qu'un artisan, quel que soit son équipement ou ses besoins spécifiques, puisse
          consulter le site, comprendre nos offres et demander une démonstration sans obstacle.
        </p>
        <p>
          Nous visons le niveau <strong>AA des recommandations WCAG 2.1</strong>, qui constitue le référentiel
          international de référence pour l'accessibilité web, en cohérence avec la démarche du RGAA.
        </p>
      </LegalSection>

      <LegalSection id="niveau" title="Niveau de conformité">
        <div className="p-4 rounded-lg bg-background-100 border border-background-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-100 text-secondary-800 text-sm font-semibold">
              <i className="ri-error-warning-line"></i>
              Partiellement conforme
            </span>
            <span className="text-sm text-foreground-600">Référentiel visé : WCAG 2.1 niveau AA</span>
          </div>
          <p className="mt-3 text-sm text-foreground-600 leading-relaxed">
            Le site est <strong>partiellement conforme</strong> au référentiel choisi. La majorité des pages
            respectent les critères, mais certains points restent à corriger. Un audit d'accessibilité complet
            est planifié pour confirmer et documenter précisément le taux de conformité.
          </p>
        </div>
      </LegalSection>

      <LegalSection id="mesures" title="Ce que nous mettons en place">
        <p>Les efforts déjà engagés couvrent notamment les points suivants :</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mesures.map((m) => (
            <div key={m.title} className="p-4 rounded-lg bg-background-100 border border-background-200">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                  <i className={m.icon}></i>
                </span>
                <h3 className="font-heading font-semibold text-sm text-foreground-950">{m.title}</h3>
              </div>
              <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{m.text}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection id="amelioration" title="Points en cours d'amélioration">
        <p>
          Nous identifions actuellement les axes d'amélioration suivants, que nous traitons par ordre de
          priorité :
        </p>
        <ul className="flex flex-col gap-2.5">
          {[
            "Vérification exhaustive des contrastes sur l'ensemble des composants d'interface.",
            "Renforcement des messages d'erreur et du parcours complet des formulaires au lecteur d'écran.",
            "Audit externe d'accessibilité pour valider le niveau de conformité et publier un taux chiffré.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <i className="ri-arrow-right-circle-line text-secondary-600 mt-0.5"></i>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="signaler" title="Signaler un problème d'accessibilité">
        <p>
          Si vous rencontrez un obstacle sur le site — un contenu inaccessible, un élément non utilisable au
          clavier, un contraste insuffisant — dites-le-nous. Nous vous répondons et faisons de notre mieux pour
          corriger rapidement.
        </p>
        <ul className="flex flex-col gap-2.5">
          <li className="flex items-start gap-2.5">
            <i className="ri-mail-line text-secondary-600 mt-0.5"></i>
            <span>
              Par email :{" "}
              <a
                href="mailto:contact@artiflow-pro.fr"
                className="font-semibold text-primary-700 hover:underline cursor-pointer"
              >
                contact@artiflow-pro.fr
              </a>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <i className="ri-phone-line text-secondary-600 mt-0.5"></i>
            <span>Par téléphone : 07 88 94 61 91 (jours ouvrés)</span>
          </li>
        </ul>
        <p>
          Merci de préciser, si possible, la page concernée, votre navigateur et l'aide technique que vous
          utilisez (lecteur d'écran, loupe, navigation clavier). Nous nous engageons à accuser réception de
          votre signalement.
        </p>
      </LegalSection>

      <LegalSection id="recours" title="Voies de recours">
        <p>
          Si vous estimez, après nous avoir contactés, que vos besoins d'accessibilité ne sont pas pris en
          compte, vous pouvez saisir le <strong>Défenseur des droits</strong>, autorité compétente pour les
          questions d'accessibilité numérique.
        </p>
        <p>
          Défenseur des droits — Libre réponse 71120, 75342 Paris Cedex 07, ou en ligne sur{" "}
          <a
            href="https://www.defenseurdesdroits.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-700 hover:underline cursor-pointer"
          >
            defenseurdesdroits.fr
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}