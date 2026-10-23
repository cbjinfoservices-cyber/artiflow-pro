import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_ACCESSIBILITE } from "@/lib/imagesPartage";

const sections = [
  { id: "engagement", label: "Notre engagement" },
  { id: "comprendre", label: "L'accessibilité en clair" },
  { id: "terrain", label: "Sur le terrain" },
  { id: "niveau", label: "Niveau de conformité" },
  { id: "referentiels", label: "Référentiels et démarche" },
  { id: "mesures", label: "Ce que nous mettons en place" },
  { id: "aides-techniques", label: "Aides techniques" },
  { id: "conditions-degradees", label: "Conditions dégradées" },
  { id: "amelioration", label: "Points en cours d'amélioration" },
  { id: "suivi", label: "Suivi et amélioration continue" },
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
      metaTitle="Déclaration d'accessibilité numérique WCAG · ArtiFlow-pro"
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

      <LegalSection id="comprendre" title="L'accessibilité numérique, en clair">
        <p>
          L'accessibilité numérique, c'est la capacité d'un site à être utilisé par tout le monde, y compris par
          les personnes qui rencontrent une difficulté particulière. Cela recouvre des situations très diverses :
          une déficience visuelle ou auditive, un trouble moteur qui rend la souris difficile à manier, un trouble
          de l'attention ou de la lecture, mais aussi des contextes temporaires comme un écran cassé, une main
          immobilisée ou une connexion lente.
        </p>
        <p>
          Pour nos utilisateurs, la question est très concrète. Un artisan consulte souvent son téléphone en
          plein soleil, avec des lunettes de protection, une seule main libre, ou après une longue journée. Un
          site mal contrasté, aux libellés ambigus ou inaccessible au clavier devient alors inutilisable, même
          pour une personne sans handicap. Rendre un site accessible améliore donc la lisibilité, la clarté et le
          confort d'usage pour l'ensemble des visiteurs.
        </p>
        <p>
          Autrement dit, l'accessibilité profite à tout le monde : elle nous oblige à écrire des textes plus
          clairs, à structurer l'information logiquement et à ne jamais reposer uniquement sur la couleur ou
          l'image pour faire passer un message.
        </p>
      </LegalSection>

      <LegalSection id="terrain" title="Sur le terrain : des usages plus exigeants qu'ils n'y paraissent">
        <p>
          Un site accessible n'est pas seulement un site utilisable par une personne en situation de handicap.
          C'est un site qui résiste aux conditions d'usage réelles. Chez les artisans, ces conditions sont
          rarement confortables : téléphone tenu d'une main, gants de protection encore enfilés, soleil direct
          sur l'écran, bruit de chantier, réseau qui va et vient entre deux villages.
        </p>
        <p>
          Dans ces situations, les critères d'accessibilité deviennent des critères d'utilité immédiate. Un
          contraste suffisant permet de lire un montant sous le soleil. Des zones cliquables assez grandes
          évitent d'ouvrir le mauvais devis avec des doigts maladroits. Des libellés explicites, sans dépendre
          d'une icône seule, permettent de comprendre un bouton en trois secondes. Une structure de titres
          logique rend la page exploitable au lecteur d'écran d'un téléphone, mais aussi plus simple à parcourir
          pour tout le monde.
        </p>
        <p>
          Nous concevons donc nos pages pour ces moments-là plutôt que pour une démonstration sur grand écran.
          Cela nous conduit à privilégier des textes courts et explicites, des formulaires qui indiquent
          clairement ce qui est attendu, et des messages d'erreur qui expliquent quoi corriger — jamais un simple
          « champ invalide » sans contexte.
        </p>
        <ul className="flex flex-col gap-2.5">
          {[
            "Lisibilité en extérieur : contrastes vérifiés, taille de texte confortable, pas d'information portée par la seule couleur.",
            "Usage à une main : actions principales accessibles sans précision extrême du geste.",
            "Réseau instable : pages légères, contenus essentiels disponibles rapidement.",
            "Environnement bruyant : aucune information critique ne dépend uniquement d'un signal sonore.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <i className="ri-arrow-right-circle-line text-secondary-600 mt-0.5"></i>
              <span>{item}</span>
            </li>
          ))}
        </ul>
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

      <LegalSection id="referentiels" title="Référentiels et démarche">
        <p>
          Notre travail s'appuie sur les <strong>Règles pour l'accessibilité des contenus web (WCAG 2.1)</strong>,
          publiées par le W3C, et sur le <strong>RGAA</strong>, le référentiel français qui en découle pour les
          services numériques. Ces documents fixent des critères vérifiables : pertinence des alternatives
          textuelles, contrastes minimaux, structure des titres, navigation au clavier, compréhension des
          formulaires, entre autres.
        </p>
        <p>
          Notre démarche se veut progressive et honnête. Plutôt que d'annoncer une conformité parfaite qui ne
          serait pas vérifiée, nous préférons décrire précisément ce qui est en place, ce qui reste à améliorer
          et la façon dont nous traitons chaque signalement. Chaque nouvelle fonctionnalité est pensée en tenant
          compte de ces critères dès sa conception, et non corrigée à la marge.
        </p>
        <p>
          Une fois l'audit externe réalisé, nous publierons ici un taux de conformité chiffré, critère par
          critère, ainsi que le détail des points restant à traiter. Cette transparence fait partie de notre
          engagement envers nos utilisateurs.
        </p>
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

      <LegalSection id="aides-techniques" title="Compatibilité avec les aides techniques">
        <p>
          Le site est utilisable avec les aides techniques les plus courantes, sur ordinateur comme sur mobile.
          Nous testons régulièrement la navigation au clavier seul, sans souris ni trackpad : l'ordre de parcours
          doit rester logique, le focus doit être visible, et aucun contenu ne doit piéger l'utilisateur dans une
          zone dont il ne peut plus sortir.
        </p>
        <p>
          Sur mobile, les lecteurs d'écran intégrés — VoiceOver sur iOS, TalkBack sur Android — restent la
          référence. Nos pages sont structurées avec des titres hiérarchisés et des zones repérables, ce qui
          permet de sauter directement au contenu principal au lieu de parcourir toute la navigation. Les images
          décoratives sont ignorées par ces outils, tandis que les images porteuses d'information disposent d'une
          description utile.
        </p>
        <p>
          Les personnes qui agrandissent le texte, utilisent un mode contraste élevé, désactivent les animations
          ou forcent un thème sombre doivent également pouvoir consulter le site sans perdre d'information. La
          mise en page est construite pour cela : elle s'adapte à la taille du texte et ne repose pas sur des
          largeurs fixes qui couperaient le contenu.
        </p>
      </LegalSection>

      <LegalSection id="conditions-degradees" title="Un site qui reste utilisable quand tout n'est pas idéal">
        <p>
          Une bonne partie de nos utilisateurs consultent le site dans des conditions que l'on qualifierait
          volontiers de dégradées : écran de téléphone fissuré ou couvert de poussière, luminosité extérieure
          très forte, une seule main disponible, batterie presque vide et réseau qui passe de la 4G au vide
          total en quelques kilomètres. Un site conçu uniquement pour une démonstration confortable sur grand
          écran échoue précisément dans ces moments-là.
        </p>
        <p>
          C'est pourquoi nous testons régulièrement les pages avec le texte agrandi à 200 %, la fenêtre réduite
          à la largeur d'un petit téléphone et le contraste système renforcé. Nous vérifions aussi que rien
          d'essentiel ne dépend d'une animation, d'un survol de souris ou d'un chargement d'image : si une image
          ne se charge pas — ce qui arrive encore souvent en zone rurale — le texte doit rester compréhensible
          et les boutons utilisables.
        </p>
        <p>
          Ces vérifications ne relèvent pas du perfectionnisme technique. Elles correspondent à des situations
          ordinaires pour un artisan : lire un montant sur un chantier en plein soleil, valider un devis avec
          des gants, retrouver un numéro de téléphone pendant que le client attend au bout du fil. Chaque fois
          que nous corrigeons un défaut d'accessibilité, nous améliorons en réalité le confort d'usage de tout
          le monde, y compris des visiteurs qui ne rencontrent aucune difficulté particulière.
        </p>
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

      <LegalSection id="suivi" title="Suivi et amélioration continue">
        <p>
          L'accessibilité n'est pas un état que l'on atteint une fois pour toutes : chaque nouvelle page, chaque
          nouveau composant peut introduire une régression. C'est pourquoi nous intégrons ces critères dès la
          conception, puis nous les vérifions avant la mise en ligne des évolutions importantes.
        </p>
        <p>
          Nos vérifications internes portent sur les points qui cassent le plus souvent l'usage : contraste des
          textes secondaires, présence d'une étiquette pour chaque champ, pertinence des alternatives textuelles,
          possibilité de terminer un parcours complet au clavier et lisibilité des messages d'erreur. Lorsqu'un
          défaut est identifié, il est traité par ordre de gravité : bloquant d'abord, gênant ensuite, esthétique
          en dernier.
        </p>
        <p>
          Les signalements reçus par email ou par téléphone entrent dans ce même circuit. Chaque retour est
          enregistré, qualifié, puis suivi jusqu'à sa correction. Nous ne considérons pas un signalement comme
          clos tant que la personne qui l'a formulé n'a pas pu vérifier que le problème a disparu.
        </p>
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
                href="mailto:contact@artiflow-pro.com"
                className="font-semibold text-primary-700 hover:underline cursor-pointer"
              >
                contact@artiflow-pro.com
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