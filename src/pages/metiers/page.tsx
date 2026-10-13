import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { metiers, metiersFaq } from "@/mocks/metiers";
import { useDemoModal } from "@/hooks/useDemoModal";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import SommaireMetiers from "@/pages/metiers/components/SommaireMetiers";
import FaqAccordion from "@/components/feature/FaqAccordion";

const raisons = [
  {
    icon: "ri-mic-line",
    title: "Une IA qui parle votre langue",
    description:
      "Chaque corps d'état a ses postes, ses unités et ses unités de prix. ArtiFlow-pro part de modèles pensés pour votre métier, pas d'un devis générique.",
  },
  {
    icon: "ri-map-pin-2-line",
    title: "Pensé pour le terrain",
    description:
      "Mobile d'abord, utilisable d'une main. Vous dictez, photographiez et envoyez depuis le chantier, sans repasser au bureau.",
  },
  {
    icon: "ri-repeat-line",
    title: "Les mêmes automatismes partout",
    description:
      "Devis IA, relances automatiques, planning par zone et suivi de chantier : les mêmes gains, quel que soit votre corps d'état.",
  },
];

export default function MetiersPage() {
  const { openDemo } = useDemoModal();

  usePageMeta(
    "ArtiFlow-pro · Tous les métiers du bâtiment : devis & relances",
    "Plombier, électricien, maçon, peintre, menuisier, carreleur, couvreur, plaquiste : découvrez comment ArtiFlow-pro génère les devis, relances et plannings de chaque corps d'état.",
    {
      type: "website",
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20artistic%20abstract%20composition%20of%20building%20trade%20tools%20and%20materials%20with%20warm%20amber%20and%20deep%20teal%20lighting%20on%20a%20charcoal%20background%2C%20editorial%20hero%20banner%2C%20high%20detail%2C%20strong%20contrast&width=1200&height=630&seq=artiflow-og-metiers&orientation=landscape",
    }
  );

  useFaqSchema(metiersFaq, "artiflow-metiers-faq-schema");
  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Métiers", path: "/metiers" },
    ],
    "artiflow-metiers-breadcrumb-schema"
  );

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section id="top" className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <nav className="flex items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">Accueil</Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Métiers</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-tools-line"></i>
                Tous les corps d'état
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Un artisan, un métier, un devis sur mesure
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                ArtiFlow-pro se décline pour chaque corps d'état du bâtiment. Choisissez le vôtre et découvrez
                des devis, des relances et un planning adaptés à votre façon de travailler.
              </p>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => openDemo("metiers")}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-calendar-check-line"></i>
                Demander une démo
              </button>
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-login-box-line"></i>
                Ouvrir mon espace
              </Link>
            </div>
          </div>
        </section>

        <SommaireMetiers />

        <section id="metiers" className="w-full bg-background-50 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metiers.map((m) => (
                <article
                  key={m.slug}
                  className="group flex flex-col rounded-lg border border-background-200 bg-background-50 overflow-hidden hover:border-primary-300 transition-colors"
                >
                  <div className="relative w-full h-40 overflow-hidden bg-background-100">
                    <img
                      src={m.cardImage}
                      alt={`ArtiFlow-pro pour les ${m.name.toLowerCase()}s`}
                      title={`${m.name} · ArtiFlow-pro`}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col flex-1 p-5">
                    <h2 className="font-heading font-semibold text-base text-foreground-950">{m.name}</h2>
                    <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">{m.tagline}</p>
                    <Link
                      to={`/metiers/${m.slug}`}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
                    >
                      Voir les devis {m.shortName.toLowerCase()}
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pourquoi" className="w-full bg-background-100 border-y border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-sparkling-2-line"></i>
                Pourquoi ça marche partout
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Le même socle IA, adapté à chaque métier
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {raisons.map((r) => (
                <div key={r.title} className="p-6 rounded-lg bg-background-50 border border-background-200">
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
                    <i className={r.icon}></i>
                  </span>
                  <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950">{r.title}</h3>
                  <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-sm text-foreground-500">
              Votre métier n'apparaît pas ? ArtiFlow-pro s'adapte à tout corps d'état du bâtiment.{" "}
              <button
                type="button"
                onClick={() => openDemo("metiers-autre")}
                className="text-primary-700 font-semibold hover:underline cursor-pointer"
              >
                Parlez-nous de votre activité
              </button>
              .
            </p>
          </div>
        </section>

        <section id="faq" className="w-full bg-background-50 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-question-answer-line"></i>
                  Questions fréquentes
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  ArtiFlow-pro et votre corps d'état
                </h2>
                <p className="mt-4 text-foreground-600 text-base">
                  Ce qu'il faut savoir avant de choisir la version ArtiFlow-pro de votre métier.
                </p>
              </div>

              <FaqAccordion items={metiersFaq} idPrefix="faq-metiers" />
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Prêt à gagner du temps sur vos devis ?
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                20 minutes de démonstration suffisent pour voir ArtiFlow-pro rédiger votre premier devis, avec les tarifs de votre métier.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo("metiers-cta")}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-calendar-check-line"></i>
                  Demander une démo
                </button>
                <Link
                  to="/tarifs"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-price-tag-3-line"></i>
                  Voir les tarifs
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-foreground-500">
            <i className="ri-map-2-line text-secondary-600"></i>
            <span>Vous cherchez une page précise ?</span>
            <Link
              to="/plan-du-site"
              className="inline-flex items-center gap-1 font-semibold text-secondary-700 hover:text-secondary-800 transition-colors cursor-pointer"
            >
              Consulter le plan du site
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}