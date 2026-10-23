import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useVilleSchema } from "@/hooks/useVilleSchema";
import { usePrechargerImage } from "@/hooks/usePrechargerImage";
import { useDemoModal } from "@/hooks/useDemoModal";
import FaqAccordion from "@/components/feature/FaqAccordion";
import EncartBesoinAide from "@/components/feature/EncartBesoinAide";
import FilAriane from "@/components/feature/FilAriane";
import { metiers, metiersSeo } from "@/mocks/metiers";
import { villes, villeStats, pointsVille, faqVille } from "@/mocks/villes";
import { metierIcons } from "@/components/feature/NavMenus";

export default function VillePage() {
  const { slug } = useParams();
  const { openDemo } = useDemoModal();
  const ville = villes.find((v) => v.slug === slug);
  const faq = ville ? faqVille(ville) : [];
  const points = ville ? pointsVille(ville) : [];
  const autresVilles = villes.filter((v) => v.slug !== slug);

  usePageMeta(ville ? ville.metaTitle : "Zones d'intervention · ArtiFlow-pro", ville?.metaDescription, {
    // Visuel de partage dédié à la ville (1200×630), avec repli sur l'image héros.
    image: ville?.shareImage ?? ville?.heroImage,
  });

  useVilleSchema(ville ?? null, faq);

  // Précharge le visuel héros de la page ville pour stabiliser le premier affichage.
  usePrechargerImage(ville?.heroImage);

  if (!ville) {
    return <Navigate to="/zones-intervention" replace />;
  }

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section id="top" className="relative w-full pt-16 md:pt-18 bg-foreground-950">
          <div className="absolute inset-0 h-full w-full">
            <img
              src={ville.heroImage}
              alt={`Devis et relances pour les artisans du bâtiment à ${ville.name}`}
              title={`${ville.name} : logiciel de devis artisan | ArtiFlow-pro`}
              width={1600}
              height={900}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/70 via-foreground-950/55 to-foreground-950/85"></div>
          </div>

          <div className="relative w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-24 pb-16 md:pb-20">
            <FilAriane
              items={[
                { name: "Accueil", path: "/" },
                { name: "Zones d'intervention", path: "/zones-intervention" },
                { name: ville.name, path: `/zones-intervention/${ville.slug}` },
              ]}
              variante="sombre"
              schemaId="artiflow-ville-breadcrumb-schema"
            />

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50/15 text-background-50 text-xs font-semibold backdrop-blur">
              <i className="ri-map-pin-line"></i>
              {ville.departement} · {ville.region}
            </span>
            <h1 className="mt-5 max-w-3xl font-heading font-bold text-3xl md:text-5xl leading-tight tracking-tight text-background-50">
              Logiciel de devis pour les artisans à {ville.name}
            </h1>
            <p className="mt-5 max-w-2xl text-sm md:text-base text-background-100/85 leading-relaxed">
              {ville.tagline}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => openDemo(`ville-${ville.slug}`)}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-calendar-check-line"></i>
                Demander une démo
              </button>
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors backdrop-blur"
              >
                <i className="ri-login-box-line"></i>
                Accéder à mon espace
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              {villeStats.map((s) => (
                <div key={s.label} className="p-4 rounded-lg bg-background-50/10 border border-background-50/20 backdrop-blur">
                  <p className="font-heading font-bold text-2xl md:text-3xl text-background-50">{s.value}</p>
                  <p className="mt-1 text-xs text-background-100/80 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-14">
            <div className="max-w-3xl">
              <p className="text-base md:text-lg text-foreground-700 leading-relaxed">{ville.intro}</p>
            </div>
          </div>
        </section>

        <section id="metiers" className="w-full bg-background-100 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-hammer-line"></i>
                Votre métier
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                ArtiFlow-pro s'adapte à votre corps d'état à {ville.name}
              </h2>
              <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                Chaque métier dispose de ses modèles de devis et de ses unités. Choisissez le vôtre pour
                voir des exemples et des conseils pensés pour votre façon de travailler.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metiers.map((m) => (
                <Link
                  key={m.slug}
                  to={`/metiers/${m.slug}`}
                  className="group flex flex-col p-5 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
                >
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-lg">
                    <i className={`${metierIcons[m.slug] ?? "ri-tools-line"}`}></i>
                  </span>
                  <h3 className="mt-4 font-heading font-semibold text-sm text-foreground-950">{m.name}</h3>
                  <p className="mt-2 text-xs text-foreground-500 flex-1">
                    {metiersSeo[m.slug as keyof typeof metiersSeo]}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 group-hover:gap-2.5 transition-all">
                    Devis à {ville.name}
                    <i className="ri-arrow-right-line"></i>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-sparkling-2-line"></i>
                Pourquoi ArtiFlow-pro
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Conçu pour le terrain, à {ville.name} comme ailleurs
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {points.map((f) => (
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
          </div>
        </section>

        <section id="zones" className="w-full bg-background-100 border-y border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mb-8">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-map-pin-2-line"></i>
                Zones couvertes
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Secteurs desservis à {ville.name}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap">
                <i className="ri-map-pin-2-line"></i>
                {ville.name} et son agglomération
              </span>
              <span className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-secondary-100 text-secondary-900 text-sm font-medium whitespace-nowrap">
                <i className="ri-map-2-line"></i>
                France entière
              </span>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground-950 mb-3">Quartiers phares</h3>
                <ul className="flex flex-wrap gap-2">
                  {ville.quartiers.map((q) => (
                    <li
                      key={q}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-background-200 bg-background-50 text-sm text-foreground-700"
                    >
                      <i className="ri-map-pin-line text-secondary-600"></i>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground-950 mb-3">Agglomération</h3>
                <ul className="flex flex-wrap gap-2">
                  {ville.agglomeration.map((c) => (
                    <li
                      key={c}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-background-200 bg-background-50 text-sm text-foreground-700"
                    >
                      <i className="ri-map-pin-2-line text-accent-600"></i>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-8 text-sm text-foreground-500">
              Votre secteur n'est pas listé ?{" "}
              <button
                type="button"
                onClick={() => openDemo(`ville-${ville.slug}-zone`)}
                className="text-primary-700 font-semibold hover:underline cursor-pointer"
              >
                Parlez-nous de votre zone
              </button>
              .
            </p>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-question-answer-line"></i>
                  Questions des artisans de {ville.name}
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  On répond avant que vous demandiez
                </h2>
              </div>

              <FaqAccordion items={faq} idPrefix={`faq-${ville.slug}`} />
            </div>
          </div>
        </section>

        <section id="autres-villes" className="w-full bg-background-100 border-t border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-16">
            <div className="max-w-2xl mb-6">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                ArtiFlow-pro dans d'autres villes
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/zones-intervention"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer bg-primary-500 text-background-50"
              >
                <i className="ri-map-2-line"></i>
                Toutes les villes
              </Link>
              {autresVilles.map((v) => (
                <Link
                  key={v.slug}
                  to={`/zones-intervention/${v.slug}`}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
                >
                  <i className="ri-map-pin-line"></i>
                  {v.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Prêt à gagner du temps sur vos devis à {ville.name} ?
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                20 minutes de démonstration suffisent pour voir ArtiFlow-pro rédiger votre premier devis, avec vos tarifs.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo(`ville-${ville.slug}`)}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-calendar-check-line"></i>
                  Demander une démo
                </button>
                <Link
                  to="/metiers"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-hammer-line"></i>
                  Voir les métiers
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-16">
            <div className="max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-customer-service-2-line"></i>
                Un artisan près de chez vous
              </span>
              <h2 className="mt-3 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                Artisans de {ville.name}, une question ?
              </h2>
              <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                Que vous soyez à {ville.name} ou dans son agglomération, notre équipe connaît le terrain et
                répond à vos questions sur l'outil, votre compte ou une offre.
              </p>
              <EncartBesoinAide variante="clair" className="mt-6" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}