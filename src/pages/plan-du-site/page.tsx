import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import PageSectionNav, { type PageSection } from "@/components/feature/PageSectionNav";
import { metiers } from "@/mocks/metiers";
import { articles } from "@/mocks/ressources";
import { sujets } from "@/mocks/sujets";
import { equipe } from "@/mocks/equipe";
import EquipeAuteursSection from "@/pages/plan-du-site/components/EquipeAuteursSection";
import InterventionsPlanDuSite from "@/pages/plan-du-site/components/InterventionsPlanDuSite";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import { useSectionNav } from "@/hooks/useSectionNav";

const pagesPrincipales = [
  {
    to: "/",
    icon: "ri-home-4-line",
    label: "Accueil",
    description:
      "La présentation d'ArtiFlow-pro : problème, fonctionnalités, aperçu de l'app, tarifs et démonstration.",
  },
  {
    to: "/tarifs",
    icon: "ri-price-tag-3-line",
    label: "Tarifs",
    description:
      "Les offres Essentiel, Pro et Entreprise, le comparatif détaillé et la FAQ sur les prix.",
  },
  {
    to: "/metiers",
    icon: "ri-hammer-line",
    label: "Les métiers du bâtiment",
    description:
      "Le hub qui regroupe les 9 corps d'état couverts par ArtiFlow-pro et leurs conseils dédiés.",
  },
  {
    to: "/metiers/recapitulatif",
    icon: "ri-list-check-2",
    label: "Récapitulatif des métiers",
    description:
      "La synthèse des 9 fiches métiers : type de devis, unités fréquentes et guides associés, pour naviguer d'un corps d'état à l'autre.",
  },
  {
    to: "/zones-intervention",
    icon: "ri-map-2-line",
    label: "Zones d'intervention",
    description:
      "Les grandes villes couvertes (Paris, Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Nice, Strasbourg, Montpellier, Rennes, Grenoble) et leur page dédiée.",
  },
  {
    to: "/ressources",
    icon: "ri-book-open-line",
    label: "Ressources par métier",
    description:
      "Les 20 guides pratiques, à filtrer par mot-clé ou par corps d'état.",
  },
  {
    to: "/ressources/sujets",
    icon: "ri-compass-3-line",
    label: "Ressources par sujet",
    description:
      "Les mêmes guides classés par thème : chiffrage, relances clients et planning.",
  },
  {
    to: "/contact",
    icon: "ri-customer-service-2-line",
    label: "Contact",
    description:
      "Joignez ArtiFlow-pro par téléphone, WhatsApp ou email, ou envoyez un message via le formulaire.",
  },
  {
    to: "/a-propos",
    icon: "ri-team-line",
    label: "À propos",
    description:
      "L'équipe derrière ArtiFlow-pro : notre histoire, nos valeurs et les visages qui accompagnent les artisans.",
  },
  {
    to: "/podcast",
    icon: "ri-mic-line",
    label: "Podcast & médias",
    description:
      "Les épisodes de podcast où l'équipe intervient, avec lecteur audio intégré et liens vers les plateformes.",
  },
  {
    to: "/nouveautes",
    icon: "ri-sparkling-2-line",
    label: "Nouveautés",
    description:
      "Le journal des mises à jour produit : nouvelles fonctions, améliorations et correctifs livrés par l'équipe.",
  },
  {
    to: "/nouveautes/recapitulatif",
    icon: "ri-gallery-line",
    label: "Récapitulatif des annonces",
    description:
      "Toutes les livraisons du journal en images, avec leur visuel de partage, filtrables par catégorie et par année.",
  },
  {
    to: "/nous-rejoindre",
    icon: "ri-user-add-line",
    label: "Nous rejoindre",
    description:
      "Les postes ouverts, notre process de recrutement et le formulaire pour déposer votre candidature.",
  },
  {
    to: "/partenaires",
    icon: "ri-shake-hands-line",
    label: "Partenaires",
    description:
      "Fédérations, comptables, fournisseurs, écoles et médias : devenir partenaire, et le badge à afficher pour les artisans clients.",
  },
  {
    to: "/presse",
    icon: "ri-newspaper-line",
    label: "Espace presse",
    description:
      "Le kit média : textes de présentation, faits clés, logos à télécharger, communiqués et contact presse.",
  },
  {
    to: "/guide/mot-de-passe-solide",
    icon: "ri-shield-keyhole-line",
    label: "Créer un mot de passe solide",
    description:
      "Le guide de sécurité du compte : les 4 ingrédients d'un bon mot de passe, la méthode de la phrase de passe et la checklist à garder en tête.",
  },
];

const accueilSections = [
  {
    id: "fonctionnalites",
    icon: "ri-apps-2-line",
    label: "Fonctionnalités",
    description:
      "Tout ce que fait ArtiFlow-pro : devis IA, relances, planning, chantiers et facturation, dans une seule app.",
  },
  {
    id: "tarifs",
    icon: "ri-price-tag-3-line",
    label: "Tarifs (page d'accueil)",
    description:
      "L'aperçu des offres Essentiel, Pro et Entreprise, avec le sélecteur Mensuel / Annuel.",
  },
  {
    id: "faq",
    icon: "ri-question-answer-line",
    label: "Questions fréquentes",
    description:
      "Les réponses rapides aux questions les plus posées avant de tester ArtiFlow-pro.",
  },
];

const planSections: PageSection[] = [
  { id: "pages-principales", label: "Pages principales", icon: "ri-file-list-3-line" },
  { id: "metiers-du-batiment", label: "Les métiers", icon: "ri-hammer-line" },
  { id: "guides-sujet", label: "Guides par sujet", icon: "ri-book-open-line" },
  { id: "interventions-publiques", label: "Interventions", icon: "ri-presentation-line" },
  { id: "equipe-auteurs", label: "Équipe & auteurs", icon: "ri-team-line" },
  { id: "sections-accueil", label: "Sections de l'accueil", icon: "ri-home-4-line" },
  { id: "informations-legales", label: "Infos légales", icon: "ri-scales-3-line" },
];

export default function PlanDuSitePage() {
  const goSection = useSectionNav();

  usePageMeta(
    "Plan du site ArtiFlow-pro · Pages, métiers et guides",
    "Retrouvez toutes les pages d'ArtiFlow-pro au même endroit : les métiers du bâtiment, les 20 guides, les tarifs et les ressources par sujet.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20abstract%20banner%20representing%20a%20website%20sitemap%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20connected%20node%20and%20grid%20shapes%2C%20blueprint%20lines%20on%20deep%20charcoal%20background%2C%20cinematic%20minimal%20editorial%20lighting%2C%20premium%20clean%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-plan&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Plan du site", path: "/plan-du-site" },
    ],
    "artiflow-plan-du-site-breadcrumb-schema"
  );

  useStructuredData(
    "artiflow-plan-du-site-equipe-itemlist",
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Équipe & auteurs ArtiFlow-pro",
      itemListElement: equipe.map((membre, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: membre.name,
        url: `${getSiteOrigin()}/auteurs/${membre.id}`,
      })),
    }
  );

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
              <span className="text-foreground-800">Plan du site</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-map-2-line"></i>
                Plan du site
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Toutes les pages d'ArtiFlow-pro, au même endroit
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Un plan d'ensemble pour vous repérer en un coup d'œil : les pages clés, les métiers du
                bâtiment et l'ensemble des guides classés par thème.
              </p>
            </div>
          </div>
        </section>

        <PageSectionNav sections={planSections} ariaLabel="Sommaire du plan du site" />

        <section id="pages-principales" className="w-full bg-background-50 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight mb-8">
              Pages principales
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {pagesPrincipales.map((page) => (
                <Link
                  key={page.to}
                  to={page.to}
                  className="group flex flex-col p-6 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
                >
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-lg">
                    <i className={page.icon}></i>
                  </span>
                  <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
                    {page.label}
                  </h3>
                  <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">
                    {page.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 group-hover:gap-3 transition-all">
                    Ouvrir
                    <i className="ri-arrow-right-line"></i>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="metiers-du-batiment" className="w-full bg-background-100 border-y border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Les métiers du bâtiment
                </h2>
                <p className="mt-2 text-sm text-foreground-600">
                  Chaque corps d'état dispose de sa page dédiée.
                </p>
              </div>
              <Link
                to="/metiers"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
              >
                Voir le hub métiers
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metiers.map((metier) => (
                <Link
                  key={metier.slug}
                  to={`/metiers/${metier.slug}`}
                  className="group flex flex-col p-5 rounded-lg bg-background-50 border border-background-200 hover:border-accent-300 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-base">
                      <i className="ri-tools-line"></i>
                    </span>
                    <h3 className="font-heading font-semibold text-sm text-foreground-950">
                      {metier.name}
                    </h3>
                  </div>
                  <p className="mt-3 text-xs text-foreground-600 leading-relaxed flex-1">
                    {metier.tagline}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="guides-sujet" className="w-full bg-background-50 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Les guides par sujet
                </h2>
                <p className="mt-2 text-sm text-foreground-600">
                  {articles.filter((a) => sujets.some((s) => s.articleSlugs.includes(a.slug))).length} guides pratiques, regroupés par thème.
                </p>
              </div>
              <Link
                to="/ressources/sujets"
                className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700 hover:gap-3 transition-all cursor-pointer"
              >
                Voir le hub par sujet
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {sujets.map((sujet) => {
                const items = articles.filter((article) => sujet.articleSlugs.includes(article.slug));
                return (
                  <div
                    key={sujet.slug}
                    className="flex flex-col p-6 rounded-lg bg-background-100 border border-background-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-lg">
                        <i className={sujet.icon}></i>
                      </span>
                      <div>
                        <h3 className="font-heading font-semibold text-base text-foreground-950">
                          {sujet.name}
                        </h3>
                        <span className="text-xs text-foreground-500">
                          {items.length} guide{items.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <ul className="mt-5 flex flex-col gap-2.5">
                      {items.map((article) => (
                        <li key={article.slug}>
                          <Link
                            to={`/ressources/${article.slug}`}
                            className="group flex items-start gap-2 text-sm text-foreground-700 hover:text-foreground-950 cursor-pointer"
                          >
                            <i className="ri-article-line mt-0.5 text-secondary-600"></i>
                            <span className="leading-snug">{article.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <InterventionsPlanDuSite />

        <EquipeAuteursSection />

        <section id="sections-accueil" className="w-full bg-background-50 border-t border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Sections de la page d'accueil
                </h2>
                <p className="mt-2 text-sm text-foreground-600">
                  Fonctionnalités, tarifs et FAQ : accédez directement au bon bloc d'un clic.
                </p>
              </div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
              >
                Ouvrir l'accueil
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {accueilSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => goSection(section.id)}
                  className="group flex flex-col items-start text-left p-5 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
                >
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-lg">
                    <i className={section.icon}></i>
                  </span>
                  <span className="mt-4 font-heading font-semibold text-base text-foreground-950">
                    {section.label}
                  </span>
                  <span className="mt-1.5 text-sm text-foreground-600 leading-relaxed flex-1">
                    {section.description}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 group-hover:gap-3 transition-all">
                    Y aller
                    <i className="ri-arrow-right-line"></i>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="informations-legales" className="w-full bg-background-100 border-t border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-heading font-semibold text-base text-foreground-950">
                  Informations légales
                </h2>
                <p className="mt-1 text-sm text-foreground-600">
                  Les documents juridiques et la politique de confidentialité d'ArtiFlow-pro.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/mentions-legales"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-sm font-medium text-foreground-800 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-text-line text-secondary-600"></i>
                  Mentions légales
                </Link>
                <Link
                  to="/cgv"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-sm font-medium text-foreground-800 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-shield-2-line text-secondary-600"></i>
                  CGV &amp; CGU
                </Link>
                <Link
                  to="/rgpd"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-sm font-medium text-foreground-800 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-shield-user-line text-secondary-600"></i>
                  RGPD &amp; données
                </Link>
                <Link
                  to="/cookies"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-sm font-medium text-foreground-800 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-equalizer-line text-secondary-600"></i>
                  Politique de cookies
                </Link>
                <Link
                  to="/accessibilite"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-sm font-medium text-foreground-800 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-wheelchair-line text-secondary-600"></i>
                  Accessibilité
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}