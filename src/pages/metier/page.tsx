import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { metiers } from "@/mocks/metiers";
import { articles } from "@/mocks/ressources";
import ArticleCard from "@/components/feature/ArticleCard";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useMetierSchema } from "@/hooks/useMetierSchema";
import { useDemoModal } from "@/hooks/useDemoModal";
import { useBibliothequeVersion } from "@/hooks/useBibliotheque";
import { isFavori } from "@/lib/bibliotheque";
import FaqAccordion from "@/components/feature/FaqAccordion";

export default function MetierPage() {
  const { slug } = useParams();
  const { openDemo } = useDemoModal();
  const [favorisSeuls, setFavorisSeuls] = useState(false);
  const version = useBibliothequeVersion();
  const metier = metiers.find((m) => m.slug === slug);
  const guides = metier ? articles.filter((a) => a.category === metier.slug) : [];
  const nbFavoris = useMemo(
    () => guides.filter((a) => isFavori(a.slug)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guides, version]
  );
  const guidesAffiches = favorisSeuls ? guides.filter((a) => isFavori(a.slug)) : guides;

  usePageMeta(
    metier ? metier.title : "ArtiFlow-pro · Devis pour artisans",
    metier?.metaDescription,
    {
      type: "website",
      // Visuel de partage dédié à chaque métier (1200×630), avec repli sur l'image héros.
      image: metier?.ogImage ?? metier?.heroImage,
    }
  );

  useMetierSchema(metier ?? null);

  if (!metier) {
    return <Navigate to="/metiers/plombier-chauffagiste" replace />;
  }

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section id="top" className="relative w-full pt-16 md:pt-18">
          <div className="absolute inset-0 h-full w-full">
            <img
              src={metier.heroImage}
              alt={`ArtiFlow-pro pour les ${metier.name.toLowerCase()}s`}
              title={`${metier.name} · ArtiFlow-pro`}
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/70 via-foreground-950/55 to-foreground-950/80"></div>
          </div>

          <div className="relative w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-24 pb-16 md:pb-20">
            <nav className="flex items-center gap-2 text-xs text-background-100/70 mb-6">
              <Link to="/" className="hover:text-background-50 cursor-pointer">Accueil</Link>
              <i className="ri-arrow-right-s-line"></i>
              <Link to="/metiers" className="hover:text-background-50 cursor-pointer">Métiers</Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-background-50">{metier.name}</span>
            </nav>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50/15 text-background-50 text-xs font-semibold backdrop-blur">
              <i className="ri-tools-line"></i>
              Démo conçue pour les {metier.name.toLowerCase()}s
            </span>
            <h1 className="mt-5 max-w-3xl font-heading font-bold text-3xl md:text-5xl leading-tight tracking-tight text-background-50">
              {metier.tagline}
            </h1>
            <p className="mt-5 max-w-2xl text-sm md:text-base text-background-100/85 leading-relaxed">
              {metier.intro}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-login-box-line"></i>
                Accéder à mon espace
              </Link>
              <button
                type="button"
                onClick={() => openDemo(`metier-${slug}`)}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors backdrop-blur"
              >
                <i className="ri-calendar-check-line"></i>
                Demander une démo
              </button>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              {metier.stats.map((s) => (
                <div key={s.label} className="p-4 rounded-lg bg-background-50/10 border border-background-50/20 backdrop-blur">
                  <p className="font-heading font-bold text-2xl md:text-3xl text-background-50">{s.value}</p>
                  <p className="mt-1 text-xs text-background-100/80 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-6">
            <div className="flex flex-wrap gap-2">
              {metiers.map((m) => (
                <Link
                  key={m.slug}
                  to={`/metiers/${m.slug}`}
                  className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    m.slug === metier.slug
                      ? "bg-primary-500 text-background-50"
                      : "bg-background-100 border border-background-200 text-foreground-700 hover:border-primary-300"
                  }`}
                >
                  <i className="ri-hammer-line"></i>
                  {m.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-emotion-unhappy-line"></i>
                Le quotidien
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Ce qui vous fait perdre du temps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metier.problems.map((p) => (
                <div key={p.title} className="p-6 rounded-lg bg-background-50 border border-background-200">
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-xl">
                    <i className={p.icon}></i>
                  </span>
                  <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950">{p.title}</h3>
                  <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-sparkling-2-line"></i>
                La solution
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Comment ArtiFlow-pro vous fait gagner des heures
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {metier.helps.map((f) => (
                <div key={f.title} className="flex items-start gap-4 p-5 rounded-lg bg-background-100 border border-background-200">
                  <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
                    <i className={f.icon}></i>
                  </span>
                  <div>
                    <h3 className="font-heading font-semibold text-base text-foreground-950">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-foreground-600 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 md:p-8 rounded-lg bg-foreground-950 text-background-50 flex flex-col md:flex-row md:items-center gap-6">
              <span className="w-14 h-14 shrink-0 flex items-center justify-center rounded-full bg-background-50/10 text-accent-400 text-3xl">
                <i className="ri-double-quotes-l"></i>
              </span>
              <blockquote className="flex-1">
                <p className="text-base md:text-lg leading-relaxed text-background-100/90">« {metier.testimonial.quote} »</p>
                <footer className="mt-3 text-sm">
                  <span className="font-semibold text-background-50">{metier.testimonial.name}</span>
                  <span className="text-background-200/70"> · {metier.testimonial.role}</span>
                </footer>
              </blockquote>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-question-answer-line"></i>
                  Questions des {metier.name.toLowerCase()}s
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  On répond avant que vous demandiez
                </h2>
              </div>

              <FaqAccordion items={metier.faq} idPrefix={`faq-${metier.slug}`} />

              <div className="mt-8 text-center">
                <Link to="/tarifs" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:underline cursor-pointer">
                  Voir les tarifs détaillés
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-9">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                  <i className="ri-book-open-line"></i>
                  Guides pour les {metier.shortName.toLowerCase()}s
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  Nos conseils terrain pour les {metier.shortName.toLowerCase()}s
                </h2>
                <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                  Deux guides courts, écrits pour votre corps d'état : chiffrage, relances et organisation
                  de chantier, à lire entre deux interventions.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setFavorisSeuls((v) => !v)}
                  disabled={nbFavoris === 0}
                  aria-pressed={favorisSeuls}
                  title={
                    nbFavoris === 0
                      ? "Aucun guide de ce métier n'est encore en favori"
                      : "N'afficher que mes guides favoris de ce métier"
                  }
                  className={`inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors border disabled:opacity-50 disabled:cursor-not-allowed ${
                    favorisSeuls
                      ? "bg-accent-500 text-background-50 border-accent-500"
                      : "bg-background-50 text-foreground-700 border-background-200 hover:border-accent-300 hover:text-accent-700"
                  }`}
                >
                  <i className={favorisSeuls ? "ri-bookmark-3-fill" : "ri-bookmark-3-line"}></i>
                  Favoris
                  <span className={favorisSeuls ? "text-background-50/80" : "text-foreground-400"}>
                    {nbFavoris}
                  </span>
                </button>
                <Link
                  to="/ressources"
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors shrink-0"
                >
                  Tous les guides
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>
            </div>

            {guidesAffiches.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed border-background-300 bg-background-50">
                <span className="w-14 h-14 flex items-center justify-center rounded-full bg-background-100 text-foreground-500 text-2xl">
                  <i className="ri-bookmark-3-line"></i>
                </span>
                <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
                  Aucun guide favori pour les {metier.shortName.toLowerCase()}s
                </h3>
                <p className="mt-2 text-sm text-foreground-600 max-w-md">
                  Touchez le signet sur une carte de guide pour le garder ici. Vos favoris sont
                  partagés avec la bibliothèque des Ressources.
                </p>
                <button
                  type="button"
                  onClick={() => setFavorisSeuls(false)}
                  className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-list-check-2"></i>
                  Voir tous les guides
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {guidesAffiches.map((article) => (
                  <ArticleCard key={article.slug} article={article} showMarquerLu />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Prêt à gagner du temps sur vos devis de {metier.shortName.toLowerCase()} ?
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                20 minutes de démonstration suffisent pour voir ArtiFlow-pro rédiger votre premier devis, avec vos tarifs.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo(`metier-${slug}`)}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-calendar-check-line"></i>
                  Demander une démo
                </button>
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-login-box-line"></i>
                  Ouvrir mon espace
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