import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { metiers, metiersZones, metiersZonesIntro } from "@/mocks/metiers";
import { articles } from "@/mocks/ressources";
import ArticleCard from "@/components/feature/ArticleCard";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useMetierSchema } from "@/hooks/useMetierSchema";
import { usePrechargerImage } from "@/hooks/usePrechargerImage";
import { useDemoModal } from "@/hooks/useDemoModal";
import { useBibliothequeVersion } from "@/hooks/useBibliotheque";
import { isFavori } from "@/lib/bibliotheque";
import FaqAccordion from "@/components/feature/FaqAccordion";
import FilAriane from "@/components/feature/FilAriane";
import ApercuEmailHome from "@/pages/home/components/ApercuEmailHome";

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

  // Précharge le visuel héros de la fiche métier pour stabiliser le premier affichage.
  usePrechargerImage(metier?.heroImage);

  if (!metier) {
    return <Navigate to="/metiers/plombier-chauffagiste" replace />;
  }

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section id="top" className="relative w-full pt-16 md:pt-18 bg-foreground-950">
          <div className="absolute inset-0 h-full w-full">
            <img
              src={metier.heroImage}
              alt={`Devis et relances pour ${metier.name.toLowerCase()}s avec ArtiFlow-pro`}
              title={`${metier.name} : logiciel de devis et de relances | ArtiFlow-pro`}
              width={1600}
              height={900}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/70 via-foreground-950/55 to-foreground-950/80"></div>
          </div>

          <div className="relative w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-24 pb-16 md:pb-20">
            <FilAriane
              items={[
                { name: "Accueil", path: "/" },
                { name: "Métiers", path: "/metiers" },
                { name: metier.name, path: `/metiers/${metier.slug}` },
              ]}
              variante="sombre"
              schemaId="artiflow-metier-breadcrumb-schema"
            />

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

        <section className="w-full bg-background-50 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-10 items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                  <i className="ri-palette-line"></i>
                  À votre image, dès le premier devis
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  Des documents de {metier.shortName.toLowerCase()} à vos couleurs
                </h2>
                <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                  Que vous soyez {metier.name.toLowerCase()}, vos devis, factures, emails et pages de signature portent
                  votre couleur d'accent, votre logo et votre message de pied de page. On règle tout une fois : vos
                  documents de {metier.shortName.toLowerCase()} gardent ensuite la même identité, jusqu'à la signature du client.
                </p>
                <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: "ri-palette-line", label: "Couleur d'accent au choix" },
                    { icon: "ri-image-line", label: "Votre logo sur les documents" },
                    { icon: "ri-bank-card-line", label: "Coordonnées de paiement" },
                    { icon: "ri-quill-pen-line", label: "Identité jusqu'à la signature" },
                  ].map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-3 p-3.5 rounded-lg bg-background-100 border border-background-200"
                    >
                      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-base bg-accent-100 text-accent-700">
                        <i className={item.icon}></i>
                      </span>
                      <span className="text-sm font-medium text-foreground-800">{item.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/nouveautes/personnalisation-documents"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-megaphone-line"></i>
                    Voir la personnalisation en détail
                  </Link>
                  <Link
                    to="/tarifs#documents"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
                  >
                    Voir les tarifs
                  </Link>
                </div>
              </div>

              <div>
                <ApercuEmailHome
                  entreprise="Votre entreprise"
                  role={`${metier.name} · votre ville`}
                  initiales="VE"
                />
                <p className="mt-3 flex items-center justify-center gap-2 text-xs text-foreground-500">
                  <i className="ri-mail-send-line text-accent-600"></i>
                  Exemple d'email reçu par votre client — devis de {metier.shortName.toLowerCase()}
                </p>
              </div>
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

        <section id="zones" className="w-full bg-background-50 border-t border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-map-pin-2-line"></i>
                Zone d'intervention
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Un service pour les {metier.shortName.toLowerCase()}s partout en France
              </h2>
              <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                {metiersZonesIntro}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap">
                <i className="ri-map-pin-2-line"></i>
                France entière
              </span>
              <span className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-secondary-100 text-secondary-900 text-sm font-medium whitespace-nowrap">
                <i className="ri-map-2-line"></i>
                {metiersZones.length} régions métropolitaines couvertes
              </span>
            </div>

            <ul className="mt-6 flex flex-wrap gap-2">
              {metiersZones.map((zone) => (
                <li
                  key={zone.code}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-background-200 bg-background-100 text-sm text-foreground-700"
                >
                  <i className="ri-map-pin-line text-secondary-600"></i>
                  {zone.name}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-sm text-foreground-500">
              Vous êtes artisan en {metier.shortName.toLowerCase()} et votre secteur n'est pas listé ?{" "}
              <button
                type="button"
                onClick={() => openDemo(`metier-${slug}-zone`)}
                className="text-primary-700 font-semibold hover:underline cursor-pointer"
              >
                Parlez-nous de votre zone
              </button>
              .
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/zones-intervention"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer bg-background-100 border border-background-200 text-foreground-700 hover:border-primary-300"
              >
                <i className="ri-map-2-line"></i>
                Zones d'intervention par ville
              </Link>
              <Link
                to="/metiers/recapitulatif"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer bg-background-100 border border-background-200 text-foreground-700 hover:border-primary-300"
              >
                <i className="ri-list-check-2"></i>
                Récapitulatif des métiers
              </Link>
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