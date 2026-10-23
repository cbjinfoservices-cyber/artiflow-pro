import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import BlocTexteSeo from "@/components/feature/BlocTexteSeo";
import PastilleOuverture from "@/components/base/PastilleOuverture";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useStructuredData } from "@/hooks/useStructuredData";
import { useLocalBusinessSchema } from "@/hooks/useLocalBusinessSchema";
import { getSiteOrigin } from "@/lib/site";
import { coordonneesEntreprise, localBusinessDisponible, formatHoraire } from "@/lib/coordonnees";
import ContactForm from "@/pages/contact/components/ContactForm";

const canaux = [
  {
    icon: "ri-phone-line",
    label: "Par téléphone",
    value: "07 88 94 61 91",
    href: "tel:+33788946191",
    hint: "Du lundi au vendredi, 9 h – 18 h",
    tone: "primary" as const,
  },
  {
    icon: "ri-whatsapp-line",
    label: "Sur WhatsApp",
    value: "Discuter maintenant",
    href: "https://wa.me/33788946191",
    hint: "Réponse rapide, en semaine",
    tone: "accent" as const,
  },
  {
    icon: "ri-mail-line",
    label: "Par email",
    value: "contact@artiflow-pro.fr",
    href: "mailto:contact@artiflow-pro.fr",
    hint: "Réponse sous 24 h ouvrées",
    tone: "secondary" as const,
  },
];

const engagements = [
  { icon: "ri-time-line", text: "Une réponse humaine sous 24 heures ouvrées" },
  { icon: "ri-smartphone-line", text: "Un accompagnement adapté à votre métier" },
  { icon: "ri-shield-check-line", text: "Vos données restent les vôtres (conformité RGPD)" },
];

export default function ContactPage() {
  usePageMeta(
    "Contact ArtiFlow-pro · Parler à un conseiller artisan",
    "Contactez ArtiFlow-pro par téléphone, WhatsApp ou email. Une équipe qui connaît le bâtiment vous répond sous 24 heures ouvrées pour vous aider à démarrer.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20a%20warm%20friendly%20customer%20support%20moment%20for%20an%20artisan%20SaaS%2C%20telephone%20headset%20and%20craftsman%20tools%20resting%20on%20a%20wooden%20desk%20with%20warm%20orange%20and%20deep%20teal%20green%20tones%2C%20blueprint%20lines%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-contact&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Contact", path: "/contact" },
    ],
    "artiflow-contact-breadcrumb-schema"
  );

  const toneClasses: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    accent: "bg-accent-100 text-accent-700",
    secondary: "bg-secondary-100 text-secondary-700",
  };

  const contactPageSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "url": `${getSiteOrigin()}/contact`,
    "name": "Contact ArtiFlow-pro · Parler à un conseiller artisan",
    "description": "Contactez ArtiFlow-pro par téléphone, WhatsApp ou email. Une équipe qui connaît le bâtiment vous répond sous 24 heures ouvrées pour vous aider à démarrer.",
    "image": "https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20a%20warm%20friendly%20customer%20support%20moment%20for%20an%20artisan%20SaaS%2C%20telephone%20headset%20and%20craftsman%20tools%20resting%20on%20a%20wooden%20desk%20with%20warm%20orange%20and%20deep%20teal%20green%20tones%2C%20blueprint%20lines%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-contact&orientation=landscape",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${getSiteOrigin()}/contact`
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": `${getSiteOrigin()}/` },
        { "@type": "ListItem", "position": 2, "name": "Contact", "item": `${getSiteOrigin()}/contact` }
      ]
    },
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "telephone": "+33788946191",
        "contactType": "customer support",
        "areaServed": "FR",
        "availableLanguage": [
          "français",
          "anglais"
        ]
      }
    ]
  };

  useStructuredData("artiflow-contact-page-schema", contactPageSchema);

  // Balisage LocalBusiness : injecté uniquement quand l'adresse réelle est
  // renseignée dans src/lib/coordonnees.ts (jamais de fausses coordonnées).
  useLocalBusinessSchema();

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">
                Accueil
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Contact</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-customer-service-2-line"></i>
                On est là pour vous
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Parlons de votre activité d'artisan
              </h1>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-background-200 bg-background-50 px-3.5 py-2">
                <PastilleOuverture variante="clair" avecDetail className="text-xs" />
              </div>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Une question sur les offres, envie de voir ArtiFlow-pro en action ou besoin d'un coup de main
                pour démarrer ? Choisissez le canal qui vous arrange — on vous répond vite.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-10 items-start">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3">
                  {canaux.map((c) => (
                    <a
                      key={c.label}
                      href={c.href}
                      target={c.href.startsWith("http") ? "_blank" : undefined}
                      rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="group flex items-start gap-4 p-5 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
                    >
                      <span
                        className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-lg ${toneClasses[c.tone]}`}
                      >
                        <i className={c.icon}></i>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
                          {c.label}
                        </span>
                        <span className="mt-0.5 block font-heading font-semibold text-base text-foreground-950 break-words group-hover:text-primary-700 transition-colors">
                          {c.value}
                        </span>
                        <span className="mt-1 block text-xs text-foreground-500">{c.hint}</span>
                      </span>
                      <i className="ri-arrow-right-line text-foreground-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all mt-3"></i>
                    </a>
                  ))}
                </div>

                {localBusinessDisponible() && (
                  <div className="p-5 rounded-lg bg-background-50 border border-background-200">
                    <h2 className="font-heading font-semibold text-base text-foreground-950 flex items-center gap-2">
                      <i className="ri-map-pin-2-line text-primary-600"></i>
                      Nos coordonnées
                    </h2>
                    <ul className="mt-4 flex flex-col gap-3 text-sm text-foreground-600">
                      <li className="flex items-start gap-2.5">
                        <i className="ri-building-2-line text-secondary-600 mt-0.5"></i>
                        <span className="leading-relaxed">
                          {coordonneesEntreprise.adresseRue}
                          <br />
                          {coordonneesEntreprise.codePostal} {coordonneesEntreprise.ville}
                          {coordonneesEntreprise.region ? `, ${coordonneesEntreprise.region}` : ""}
                        </span>
                      </li>
                      {coordonneesEntreprise.horaires.length > 0 && (
                        <li className="flex items-start gap-2.5">
                          <i className="ri-time-line text-secondary-600 mt-0.5"></i>
                          <span className="flex flex-col gap-1 leading-relaxed">
                            {coordonneesEntreprise.horaires.map((horaire, index) => (
                              <span key={index}>{formatHoraire(horaire)}</span>
                            ))}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="p-5 rounded-lg bg-accent-950 text-background-50">
                  <h2 className="font-heading font-semibold text-base text-background-50 flex items-center gap-2">
                    <i className="ri-map-pin-2-line text-accent-400"></i>
                    Nos engagements
                  </h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {engagements.map((e) => (
                      <li key={e.text} className="flex items-start gap-2.5">
                        <i className={`${e.icon} text-accent-400 mt-0.5`}></i>
                        <span className="text-sm text-background-100/90 leading-relaxed">{e.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-6 md:p-8 rounded-lg bg-background-100 border border-background-200">
                <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
                  Envoyez-nous un message
                </h2>
                <p className="mt-1.5 text-sm text-foreground-600 mb-6">
                  Remplissez le formulaire, on revient vers vous rapidement.
                </p>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>

        <BlocTexteSeo
          id="avant-de-nous-ecrire"
          eyebrow="Avant de nous écrire"
          eyebrowIcon="ri-question-answer-line"
          ton="secondary"
          fond="bg-background-50"
          titre="Comment nous joindre, et ce que vous pouvez nous demander"
          intro="Nous répondons à tous les messages, mais nous pouvons vous aider plus vite si vous savez déjà ce que vous cherchez. Voici les demandes les plus fréquentes et la façon d'obtenir une réponse rapide."
          blocs={[
            {
              sousTitre: "Ce pour quoi on peut vous aider",
              paragraphes: [
                "Notre équipe connaît le bâtiment et l'outil. Quel que soit votre besoin, vous tomberez sur une personne qui comprend votre métier et votre organisation.",
              ],
              liste: [
                "Découvrir ArtiFlow-pro et savoir s'il correspond à votre corps d'état.",
                "Être accompagné pour créer votre premier devis, pas à pas.",
                "Comprendre les offres, les tarifs et ce qu'ils incluent réellement.",
                "Résoudre un souci technique sur votre compte ou une fonctionnalité.",
                "Organiser le passage à plusieurs utilisateurs dans votre entreprise.",
              ],
            },
            {
              sousTitre: "Nos délais de réponse",
              paragraphes: [
                "Par téléphone et sur WhatsApp, nous répondons pendant les heures ouvrées, du lundi au vendredi. Vous avez très souvent une personne en ligne sans attendre. Par email, comptez une réponse humaine sous vingt-quatre heures ouvrées, week-ends et jours fériés exclus.",
                "Pour les demandes urgentes liées à un devis en cours ou à un client à rappeler, le téléphone reste le plus direct : un échange de vive voix règle souvent la question en quelques minutes.",
              ],
            },
            {
              sousTitre: "Pour aller plus vite",
              paragraphes: [
                "Un message bien préparé nous permet de vous aider du premier coup, sans allers-retours. Si vous nous écrivez, pensez à préciser les éléments suivants :",
              ],
              liste: [
                "Votre métier et la taille de votre entreprise.",
                "L'offre qui vous intéresse, si vous l'avez déjà identifiée.",
                "La page ou la fonctionnalité concernée, en cas de souci technique.",
                "Vos disponibilités, si vous souhaitez un rendez-vous ou une démonstration.",
              ],
            },
          ]}
        />

        <BlocTexteSeo
          id="accompagnement"
          eyebrow="Notre façon d'accompagner"
          eyebrowIcon="ri-hand-heart-line"
          ton="primary"
          fond="bg-background-100"
          titre="Un accompagnement pensé pour des artisans, pas pour des informaticiens"
          intro="Prendre contact est souvent le premier pas. Ce qui compte ensuite, c'est la façon dont on vous accompagne : sans jargon, sans rendez-vous inutile, et en tenant compte du fait que votre journée ne se passe pas derrière un écran."
          blocs={[
            {
              sousTitre: "Le premier échange sert à comprendre votre métier",
              paragraphes: [
                "Nous ne commençons jamais par une présentation commerciale. La première question porte sur votre activité : quel corps d'état, combien de personnes, quel volume de devis par mois, comment vous organisez aujourd'hui vos chantiers et vos relances. Deux artisans peuvent faire le même métier et travailler de manière très différente — un plombier seul qui enchaîne les dépannages n'a pas les mêmes besoins qu'une entreprise de cinq personnes sur des rénovations complètes.",
                "À partir de là, nous vous disons honnêtement si ArtiFlow-pro est le bon outil pour vous. Il arrive que la réponse soit non, ou pas tout de suite : dans ce cas, nous préférons vous le dire plutôt que de vous faire souscrire un abonnement que vous n'utiliseriez pas.",
              ],
            },
            {
              sousTitre: "Une prise en main qui se fait avec vos propres documents",
              paragraphes: [
                "Nous n'accompagnons pas sur une démonstration théorique. Pendant la prise en main, nous partons d'un de vos devis récents, de vos prix et de vos habitudes : c'est le meilleur moyen de vérifier que l'outil tient la route sur votre réalité, et de repérer tout de suite ce qui doit être adapté.",
                "Une démonstration dure généralement vingt minutes. Elle suffit pour créer un premier devis, l'envoyer, programmer une relance et voir comment le planning et la facturation se remplissent ensuite. Vous ressortez avec quelque chose de concret, pas avec une promesse.",
              ],
              liste: [
                "Un échange de 20 minutes, sans engagement et sans installation préalable.",
                "Une prise en main basée sur vos propres devis et vos propres prix.",
                "Un interlocuteur unique qui connaît le bâtiment et suit votre dossier.",
              ],
            },
            {
              sousTitre: "Partout en France, y compris là où le réseau est capricieux",
              paragraphes: [
                "ArtiFlow-pro est utilisé dans toute la France métropolitaine, en zone rurale comme en centre-ville. Nous savons qu'un chantier ne se déroule pas toujours dans un bureau climatisé avec une fibre optique : l'interface reste lisible en plein soleil, utilisable avec des gants et pensée pour des connexions irrégulières.",
                "Vous pouvez nous joindre par téléphone, WhatsApp ou email, du lundi au vendredi. Le téléphone reste le canal le plus direct pour une question urgente liée à un devis en cours ; l'email convient mieux pour une question détaillée ou l'envoi d'un document.",
              ],
            },
            {
              sousTitre: "Ce qui se passe après la première démonstration",
              paragraphes: [
                "Une démonstration n'est pas une vente. À la fin des vingt minutes, vous savez ce que l'outil fait, ce qu'il ne fait pas, et ce qu'il changerait concrètement dans votre semaine. Si la réponse est « pas maintenant », nous vous le disons franchement : il vaut mieux un artisan qui revient dans six mois qu'un abonnement résilié au bout de trois semaines.",
                "Si vous décidez d'essayer, votre compte est créé avec les informations de votre entreprise, votre logo et vos coordonnées. Vous pouvez importer vos clients existants ou partir d'une page blanche, rédiger votre premier devis avec nous, puis programmer une première relance. L'objectif de cette séance est simple : que vous repartiez avec un devis réellement envoyé, pas avec un compte vide et une liste de fonctionnalités à découvrir seul.",
                "Les semaines suivantes, vous restez libre de nous appeler pour n'importe quelle question, y compris une question qui vous paraît bête. Nous préférons un appel de deux minutes à un artisan bloqué trois jours sur un écran qu'il n'ose pas signaler. C'est aussi comme cela que nous repérons les endroits de l'interface qui méritent d'être simplifiés : un débutant perdu à cet endroit le sera probablement aussi dans six mois.",
              ],
            },
          ]}
        />

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
            <div className="p-8 md:p-10 rounded-lg bg-foreground-950 text-background-50 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">
                  Vous préférez voir l'outil en action ?
                </h2>
                <p className="mt-3 text-sm md:text-base text-background-200/85">
                  Réservez une démonstration de 20 minutes : on configure votre premier devis avec vous, sans
                  engagement.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="tel:+33788946191"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-phone-line"></i>
                  Appeler maintenant
                </a>
                <a
                  href="https://wa.me/33788946191"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-whatsapp-line"></i>
                  Écrire sur WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}