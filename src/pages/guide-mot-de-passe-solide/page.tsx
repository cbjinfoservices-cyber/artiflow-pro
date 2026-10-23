import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import FilAriane from "@/components/feature/FilAriane";
import { IMAGE_PARTAGE_GUIDE_MOT_DE_PASSE } from "@/lib/imagesPartage";
import { useStructuredData } from "@/hooks/useStructuredData";
import { useDemoModal } from "@/hooks/useDemoModal";
import { getSiteOrigin } from "@/lib/site";
import ALireEnsuiteGuide from "@/pages/guide-mot-de-passe-solide/components/ALireEnsuiteGuide";

/** Un ingrédient d'un mot de passe solide. */
interface Ingredient {
  icon: string;
  titre: string;
  texte: string;
}

const CHEMIN = "/guide/mot-de-passe-solide";

const TITRE = "Créer un mot de passe solide | ArtiFlow-pro";

const DESCRIPTION =
  "Le guide simple pour choisir un mot de passe vraiment solide : longueur, variété, unicité et méthode de la phrase de passe, avec la checklist à garder en tête.";

const IMAGE_PARTAGE =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20creating%20a%20strong%20password%2C%20a%20large%20padlock%20and%20floating%20key%20shapes%20with%20subtle%20data%20patterns%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=guide-mdp-solide-og&orientation=landscape";

/** Dernière révision réelle du contenu du guide. */
const DATE_REVISION = "2026-10-13";

const INGREDIENTS: Ingredient[] = [
  {
    icon: "ri-ruler-2-line",
    titre: "Assez long",
    texte:
      "Visez au moins 12 caractères. La longueur protège plus que la complexité : chaque caractère en plus rend le mot de passe bien plus difficile à deviner.",
  },
  {
    icon: "ri-shuffle-line",
    titre: "Mélangé",
    texte:
      "Combinez majuscules, minuscules, chiffres et au moins un caractère spécial (comme ! ? * -). C'est le seuil minimum demandé par ArtiFlow-pro.",
  },
  {
    icon: "ri-eye-off-line",
    titre: "Imprévisible",
    texte:
      "Évitez votre prénom, votre date de naissance, votre plaque d'immatriculation ou « azerty1234 ». Ces informations se devinent en quelques secondes.",
  },
  {
    icon: "ri-fingerprint-line",
    titre: "Unique",
    texte:
      "Un mot de passe différent pour chaque site. Si l'un d'eux fuite, les autres comptes restent protégés. C'est la règle la plus importante.",
  },
];

const METHODE = [
  "Choisissez une phrase que vous retenez facilement, tirée d'un souvenir personnel (une chanson, un lieu, une anecdote).",
  "Gardez les premières lettres de chaque mot, puis remplacez-en quelques-unes par des chiffres ou des symboles.",
  "Ajoutez un élément propre au site : par exemple « AF » pour ArtiFlow-pro, afin que chaque mot de passe soit unique.",
  "Répétez-le mentalement deux ou trois fois : en quelques jours, il devient automatique.",
];

const ERREURS = [
  "Réutiliser le même mot de passe partout.",
  "Le garder écrit sur un papier collé à l'écran ou dans une note non protégée.",
  "Le partager par email, SMS ou téléphone, même à quelqu'un de confiance.",
  "Choisir une suite logique : 123456, azerty, motdepasse, votre nom de famille.",
  "Ignorer les alertes : si un service vous prévient d'une connexion inhabituelle, changez votre mot de passe.",
];

export default function GuideMotDePasseSolidePage() {
  const { openDemo } = useDemoModal();
  const origin = getSiteOrigin();

  usePageMeta(TITRE, DESCRIPTION, { image: IMAGE_PARTAGE_GUIDE_MOT_DE_PASSE });

  // Article : page éditoriale autonome, signée par l'organisation (pas de
  // signature individuelle affichée sur la page, donc pas d'entité Person).
  useStructuredData("artiflow-guide-mdp-article", {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Créer un mot de passe solide",
    description: DESCRIPTION,
    inLanguage: "fr-FR",
    image: IMAGE_PARTAGE_GUIDE_MOT_DE_PASSE,
    dateModified: DATE_REVISION,
    author: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: "ArtiFlow-pro",
      url: origin,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: "ArtiFlow-pro",
      url: origin,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}${CHEMIN}` },
  });

  // HowTo : reprend exactement la méthode affichée dans la page (quatre étapes).
  useStructuredData("artiflow-guide-mdp-howto", {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Créer un mot de passe solide",
    description:
      "La méthode de la phrase de passe, en quatre étapes, pour obtenir un mot de passe à la fois long, robuste et facile à retenir.",
    inLanguage: "fr-FR",
    totalTime: "PT5M",
    step: METHODE.map((etape, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: `Étape ${index + 1}`,
      text: etape,
    })),
  });

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="relative w-full pt-16 md:pt-18 overflow-hidden bg-foreground-950">
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet="https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20portrait%20scene%20about%20creating%20a%20strong%20password%2C%20a%20large%20padlock%20and%20floating%20key%20shapes%20with%20subtle%20data%20patterns%20and%20gentle%20glow%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=800&height=1000&seq=guide-mdp-solide-hero-mobile&orientation=portrait"
            />
          <img
            src="https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20scene%20about%20creating%20a%20strong%20password%2C%20a%20large%20padlock%20and%20floating%20key%20shapes%20with%20subtle%20data%20patterns%20and%20gentle%20glow%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=guide-mdp-solide-hero&orientation=landscape"
            alt="Guide pour créer un mot de passe solide - ArtiFlow-pro"
            title="Créer un mot de passe solide · ArtiFlow-pro"
            width={1600}
            height={900}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/85 via-foreground-950/75 to-foreground-950/92"></div>

          <div className="relative w-full px-4 md:px-8 lg:px-12 pt-12 md:pt-16 pb-12 md:pb-16">
            <FilAriane
              items={[
                { name: "Accueil", path: "/" },
                { name: "Créer un mot de passe solide", path: CHEMIN },
              ]}
              variante="sombre"
              schemaId="artiflow-guide-mdp-breadcrumb"
            />

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500 text-background-50 text-xs font-semibold">
                <i className="ri-shield-keyhole-line"></i>
                Sécurité du compte
              </span>
              <h1 className="mt-4 font-heading font-bold text-3xl md:text-5xl text-background-50 tracking-tight leading-tight">
                Créer un mot de passe solide
              </h1>
              <p className="mt-4 text-base md:text-lg text-background-200/85 leading-relaxed">
                Un bon mot de passe, c'est la première serrure de votre espace. Voici, sans jargon, comment en
                choisir un qui vous protège vraiment — et que vous retiendrez facilement.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14 items-start">
              <div className="lg:col-span-2 flex flex-col gap-10">
                <div>
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                    Pourquoi ça compte vraiment
                  </h2>
                  <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                    Votre espace ArtiFlow-pro contient vos devis, vos clients et vos factures. Un mot de passe
                    faible, c'est une porte ouverte sur tout ça. La bonne nouvelle : quelques règles simples
                    suffisent à écarter l'immense majorité des risques.
                  </p>
                  <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                    Un mot de passe solide ne veut pas dire « compliqué à retenir ». En suivant la méthode
                    ci-dessous, vous obtenez une clé à la fois robuste et mémorisable.
                  </p>
                </div>

                <div>
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                    Les 4 ingrédients d'un mot de passe solide
                  </h2>
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {INGREDIENTS.map((ing) => (
                      <div
                        key={ing.titre}
                        className="p-5 rounded-lg bg-background-100 border border-background-200"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
                            <i className={ing.icon}></i>
                          </span>
                          <h3 className="font-heading font-semibold text-sm text-foreground-950">
                            {ing.titre}
                          </h3>
                        </div>
                        <p className="mt-2.5 text-sm text-foreground-600 leading-relaxed">{ing.texte}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                    La méthode de la phrase de passe
                  </h2>
                  <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                    C'est la technique la plus simple pour obtenir un mot de passe à la fois long et facile à
                    mémoriser. Quatre étapes suffisent :
                  </p>
                  <ol className="mt-5 flex flex-col gap-3">
                    {METHODE.map((etape, index) => (
                      <li
                        key={etape}
                        className="flex items-start gap-3 p-4 rounded-lg bg-background-100 border border-background-200"
                      >
                        <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-primary-500 text-background-50 text-[11px] font-bold">
                          {index + 1}
                        </span>
                        <span className="text-sm text-foreground-600 leading-relaxed">{etape}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                    Les erreurs à éviter
                  </h2>
                  <ul className="mt-5 flex flex-col gap-2.5">
                    {ERREURS.map((erreur) => (
                      <li key={erreur} className="flex items-start gap-2.5">
                        <i className="ri-close-circle-line text-red-500 mt-0.5"></i>
                        <span className="text-sm text-foreground-600 leading-relaxed">{erreur}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 rounded-lg bg-secondary-50 border border-secondary-200">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-lg">
                      <i className="ri-list-check-2"></i>
                    </span>
                    <h2 className="font-heading font-semibold text-base text-foreground-950">
                      La checklist avant de valider
                    </h2>
                  </div>
                  <ul className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      "Au moins 12 caractères (8 minimum sur le site).",
                      "Majuscules, minuscules, chiffres et un symbole.",
                      "Aucune information personnelle évidente.",
                      "Différent de tous vos autres mots de passe.",
                      "Non partagé et non écrit en clair.",
                      "Enregistré dans un gestionnaire de mots de passe si possible.",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <i className="ri-checkbox-circle-line text-accent-600 mt-0.5"></i>
                        <span className="text-sm text-foreground-600 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <aside className="lg:col-span-1 flex flex-col gap-4">
                <div className="p-5 rounded-lg bg-background-100 border border-background-200">
                  <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-lg">
                    <i className="ri-key-2-line"></i>
                  </span>
                  <h2 className="mt-3 font-heading font-semibold text-base text-foreground-950">
                    Prêt à le mettre en pratique ?
                  </h2>
                  <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
                    Retournez à la page de connexion pour définir votre nouveau mot de passe, ou repartez de
                    votre espace si vous êtes déjà connecté.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      to="/app/auth"
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                    >
                      <i className="ri-login-box-line"></i>
                      Aller à la connexion
                    </Link>
                    <Link
                      to="/app/profil"
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
                    >
                      <i className="ri-shield-check-line"></i>
                      Ma sécurité du compte
                    </Link>
                  </div>
                </div>

                <div className="p-5 rounded-lg bg-accent-950 text-background-50">
                  <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-background-50/10 text-accent-200 text-lg">
                    <i className="ri-lock-password-line"></i>
                  </span>
                  <h3 className="mt-3 font-heading font-semibold text-base text-background-50">
                    Vous hésitez sur votre mot de passe ?
                  </h3>
                  <p className="mt-2 text-sm text-background-200/80 leading-relaxed">
                    L'indicateur de robustesse d'ArtiFlow-pro vous guide en direct pendant la saisie : vous
                    voyez tout de suite si c'est assez solide.
                  </p>
                  <button
                    type="button"
                    onClick={() => openDemo("guide-mdp-solide")}
                    className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-calendar-check-line"></i>
                    Demander une démo
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <ALireEnsuiteGuide />
      </main>

      <Footer />
    </div>
  );
}