import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import FilAriane from "@/components/feature/FilAriane";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import { useItemListSchema } from "@/hooks/useItemListSchema";
import { useDemoModal } from "@/hooks/useDemoModal";
import FaqAccordion from "@/components/feature/FaqAccordion";
import EncartBesoinAide from "@/components/feature/EncartBesoinAide";
import { villes } from "@/mocks/villes";

const faqZones = [
  {
    question: "Dans quelles villes ArtiFlow-pro est-il disponible ?",
    answer:
      "ArtiFlow-pro est un logiciel en ligne utilisable partout en France, y compris en zone rurale et en outre-mer. Cette page met en avant les grandes villes où les artisans nous sollicitent le plus : Paris, Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Nice, Strasbourg, Montpellier, Rennes et Grenoble.",
  },
  {
    question: "Le service est-il différent selon la ville ?",
    answer:
      "Non, l'outil est le même partout. En revanche, les pages par ville rappellent comment ArtiFlow-pro s'adapte au bâti local, aux distances et aux habitudes de travail propres à chaque agglomération.",
  },
  {
    question: "Puis-je utiliser ArtiFlow-pro si ma ville n'est pas listée ?",
    answer:
      "Oui, absolument. ArtiFlow-pro fonctionne depuis n'importe où en France : vous n'avez rien à installer, tout se passe depuis votre téléphone, sur le chantier comme au bureau.",
  },
];

export default function ZonesInterventionPage() {
  const { openDemo } = useDemoModal();

  usePageMeta(
    "Zones d'intervention · ArtiFlow-pro partout en France",
    "ArtiFlow-pro accompagne les artisans du bâtiment partout en France, avec une page dédiée à chacune de ses douze villes : Paris, Lyon, Marseille et Toulouse.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20a%20stylized%20map%20of%20France%20with%20connected%20city%20nodes%20and%20glowing%20route%20lines%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-zones&orientation=landscape",
    }
  );

  useFaqSchema(faqZones, "artiflow-zones-faq-schema");
  useItemListSchema(
    {
      name: "Villes couvertes par ArtiFlow-pro",
      description: "Les grandes villes couvertes par les pages zone d'intervention d'ArtiFlow-pro.",
      items: villes.map((v) => ({ name: v.name, path: `/zones-intervention/${v.slug}` })),
    },
    "artiflow-zones-itemlist-schema"
  );

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section id="top" className="relative w-full pt-16 md:pt-18 bg-foreground-950">
          <div className="absolute inset-0 h-full w-full">
            <picture>
              <source
                media="(max-width: 767px)"
                srcSet="https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20portrait%20scene%20of%20a%20stylized%20map%20of%20France%20with%20glowing%20city%20nodes%20and%20route%20lines%2C%20warm%20amber%20orange%20and%20deep%20teal%20lighting%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20technical%20composition%2C%20strong%20contrast%20for%20overlaid%20text%2C%20high%20detail&width=800&height=1000&seq=artiflow-zones-hero-mobile&orientation=portrait"
              />
            <img
              src="https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20scene%20of%20a%20stylized%20map%20of%20France%20with%20glowing%20city%20nodes%20and%20route%20lines%2C%20warm%20amber%20orange%20and%20deep%20teal%20lighting%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20technical%20composition%2C%20strong%20contrast%20for%20overlaid%20text%2C%20high%20detail&width=1600&height=900&seq=artiflow-zones-hero&orientation=landscape"
              alt="ArtiFlow-pro, logiciel de devis pour les artisans du bâtiment, partout en France"
              title="Zones d'intervention · ArtiFlow-pro"
              width={1600}
              height={900}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover object-top"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/75 via-foreground-950/60 to-foreground-950/85"></div>
          </div>

          <div className="relative w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-24 pb-16 md:pb-20">
            <FilAriane
              items={[
                { name: "Accueil", path: "/" },
                { name: "Zones d'intervention", path: "/zones-intervention" },
              ]}
              variante="sombre"
              schemaId="artiflow-zones-breadcrumb-schema"
            />

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50/15 text-background-50 text-xs font-semibold backdrop-blur">
              <i className="ri-map-2-line"></i>
              Partout en France
            </span>
            <h1 className="mt-5 max-w-3xl font-heading font-bold text-3xl md:text-5xl leading-tight tracking-tight text-background-50">
              Un logiciel de devis pour les artisans, où que vous soyez
            </h1>
            <p className="mt-5 max-w-2xl text-sm md:text-base text-background-100/85 leading-relaxed">
              ArtiFlow-pro accompagne les artisans du bâtiment partout en France. Choisissez votre ville
              pour découvrir comment l'outil s'adapte à votre métier, à votre bâti et à vos trajets
              du quotidien.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => openDemo("zones")}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-calendar-check-line"></i>
                Demander une démo
              </button>
              <Link
                to="/metiers"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors backdrop-blur"
              >
                <i className="ri-hammer-line"></i>
                Voir les métiers
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-map-pin-2-line"></i>
                Les grandes villes
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Choisissez votre ville
              </h2>
              <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                Douze pages dédiées détaillent le service pour les artisans de chaque grande ville française.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {villes.map((ville) => (
                <article
                  key={ville.slug}
                  className="group flex flex-col rounded-lg border border-background-200 bg-background-50 overflow-hidden hover:border-primary-300 transition-colors"
                >
                  <div className="relative w-full h-40 overflow-hidden bg-background-100">
                    <img
                      src={ville.cardImage}
                      alt={`Devis pour les artisans du bâtiment à ${ville.name} avec ArtiFlow-pro`}
                      title={`${ville.name} : logiciel de devis artisan | ArtiFlow-pro`}
                      width={400}
                      height={300}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col flex-1 p-5">
                    <div className="flex items-center gap-2">
                      <i className="ri-map-pin-line text-secondary-600"></i>
                      <h3 className="font-heading font-semibold text-base text-foreground-950">{ville.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-foreground-500">{ville.departement} · {ville.region}</p>
                    <p className="mt-3 text-sm text-foreground-600 leading-relaxed flex-1">{ville.tagline}</p>
                    <Link
                      to={`/zones-intervention/${ville.slug}`}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
                    >
                      Artisans à {ville.name}
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100 border-y border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-links-line"></i>
                  Aller plus loin
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  Un métier, une ville, un devis
                </h2>
                <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                  Chaque page ville renvoie vers les huit fiches métiers : combinez votre corps d'état et
                  votre secteur pour voir comment ArtiFlow-pro rédige vos devis au plus près de votre
                  réalité de terrain.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/metiers"
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-hammer-line"></i>
                    Les 8 métiers
                  </Link>
                  <Link
                    to="/metiers/recapitulatif"
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-list-check-2"></i>
                    Récapitulatif des fiches
                  </Link>
                </div>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: "ri-mic-line", text: "Devis dictés depuis le chantier" },
                  { icon: "ri-notification-3-line", text: "Relances email, SMS et WhatsApp" },
                  { icon: "ri-road-map-line", text: "Planning regroupé par secteur" },
                  { icon: "ri-shield-check-line", text: "Un accompagnement humain" },
                ].map((item) => (
                  <li
                    key={item.text}
                    className="flex items-start gap-3 p-5 rounded-lg bg-background-50 border border-background-200"
                  >
                    <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
                      <i className={item.icon}></i>
                    </span>
                    <span className="text-sm text-foreground-700 leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-question-answer-line"></i>
                  Questions fréquentes
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  La couverture d'ArtiFlow-pro en France
                </h2>
              </div>
              <FaqAccordion items={faqZones} idPrefix="faq-zones" />
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
                20 minutes de démonstration suffisent pour voir ArtiFlow-pro rédiger votre premier devis, avec vos tarifs.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo("zones-cta")}
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
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-16">
            <div className="max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-customer-service-2-line"></i>
                Près de chez vous
              </span>
              <h2 className="mt-3 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                Vous cherchez un coup de main près de chez vous ?
              </h2>
              <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                Dites-nous votre ville et votre métier : on vous montre comment ArtiFlow-pro s'adapte à votre
                secteur, et on reste joignables pour toutes vos questions.
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