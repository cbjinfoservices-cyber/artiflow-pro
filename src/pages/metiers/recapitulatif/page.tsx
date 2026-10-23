import { useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import FilAriane from "@/components/feature/FilAriane";
import { useItemListSchema } from "@/hooks/useItemListSchema";
import { useDemoModal } from "@/hooks/useDemoModal";
import { metiers, metiersSeo } from "@/mocks/metiers";
import { articles } from "@/mocks/ressources";
import { metierIcons } from "@/components/feature/NavMenus";
import { originePublique } from "@/lib/site";

/** Unités de chiffrage les plus courantes par corps d'état (colonne du tableau récapitulatif). */
const unitesParMetier: Record<string, string> = {
  "plombier-chauffagiste": "Forfait, unité, m²",
  electricien: "Point, ml, forfait",
  macon: "m², m³, forfait",
  "peintre-finitions": "m², forfait",
  menuisier: "Unité, ml, forfait",
  carreleur: "m², ml, forfait",
  couvreur: "m², ml, forfait",
  platrier: "m², ml, forfait",
  "installateur-climatisation": "Unité, forfait, ml",
};

const RSS_HREF = "/metiers/rss.xml";

export default function MetiersRecapitulatifPage() {
  const { openDemo } = useDemoModal();

  usePageMeta(
    "Récapitulatif des métiers du bâtiment | ArtiFlow-pro",
    "Toutes les fiches métiers d'ArtiFlow-pro : plombier, électricien, maçon, peintre, menuisier, carreleur, couvreur, plaquiste et frigoriste climaticien, avec leurs guides.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20a%20grid%20of%20building%20trade%20icons%20and%20tool%20silhouettes%20connected%20by%20thin%20lines%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-metiers-recap&orientation=landscape",
    }
  );

  useItemListSchema(
    {
      name: "Fiches métiers ArtiFlow-pro",
      description: "Les fiches métiers du bâtiment couvertes par ArtiFlow-pro.",
      items: metiers.map((m) => ({ name: `${m.name} — ${metiersSeo[m.slug as keyof typeof metiersSeo]}`, path: `/metiers/${m.slug}` })),
    },
    "artiflow-metiers-recap-itemlist-schema"
  );

  // Lien d'auto-découverte du flux RSS (lecteurs d'actualités + navigateurs).
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.type = "application/rss+xml";
    link.title = "ArtiFlow-pro — Fiches métiers";
    link.href = `${originePublique()}${RSS_HREF}`;
    link.id = "artiflow-metiers-rss-alternate";
    document.head.appendChild(link);
    return () => {
      const existing = document.getElementById("artiflow-metiers-rss-alternate");
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    };
  }, []);

  const totalGuides = articles.filter((a) => metiers.some((m) => m.slug === a.category)).length;

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <FilAriane
              items={[
                { name: "Accueil", path: "/" },
                { name: "Métiers", path: "/metiers" },
                { name: "Récapitulatif", path: "/metiers/recapitulatif" },
              ]}
              variante="clair"
              schemaId="artiflow-metiers-recap-breadcrumb-schema"
            />

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-list-check-2"></i>
                Synthèse des fiches métiers
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Toutes les fiches métiers ArtiFlow-pro, en une page
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Retrouvez les {metiers.length} corps d'état couverts, le type de devis associé et leurs guides
                pratiques. Le point d'entrée idéal pour naviguer entre nos métiers.
              </p>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link
                to="/metiers"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-hammer-line"></i>
                Le hub métiers
              </Link>
              <a
                href={RSS_HREF}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-rss-line text-accent-600"></i>
                S'abonner au flux RSS
              </a>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                <i className="ri-links-line"></i>
                Maillage métiers
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Un métier, une fiche, un devis
              </h2>
              <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                Chaque fiche détaille les pertes de temps du métier, la solution ArtiFlow-pro et une FAQ.
                Cliquez pour ouvrir la fiche qui vous concerne.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {metiers.map((m) => {
                const nbGuides = articles.filter((a) => a.category === m.slug).length;
                return (
                  <Link
                    key={m.slug}
                    to={`/metiers/${m.slug}`}
                    className="group flex flex-col p-5 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
                  >
                    <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
                      <i className={`${metierIcons[m.slug] ?? "ri-tools-line"}`}></i>
                    </span>
                    <h3 className="mt-4 font-heading font-semibold text-sm text-foreground-950">{m.name}</h3>
                    <p className="mt-2 text-xs text-foreground-500 flex-1">
                      {metiersSeo[m.slug as keyof typeof metiersSeo]} · {nbGuides} guide{nbGuides > 1 ? "s" : ""}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 group-hover:gap-2.5 transition-all">
                      Ouvrir la fiche
                      <i className="ri-arrow-right-line"></i>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100 border-y border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-8">
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                Tableau synoptique des métiers
              </h2>
              <p className="mt-3 text-sm text-foreground-600">
                Les types de devis et les unités de chiffrage les plus courants selon le corps d'état.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-background-200 bg-background-50">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-background-100 text-left text-xs uppercase tracking-wide text-foreground-500">
                    <th className="px-5 py-3 font-semibold">Métier</th>
                    <th className="px-5 py-3 font-semibold">Type de devis</th>
                    <th className="px-5 py-3 font-semibold">Unités fréquentes</th>
                    <th className="px-5 py-3 font-semibold">Guides</th>
                    <th className="px-5 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {metiers.map((m) => {
                    const nbGuides = articles.filter((a) => a.category === m.slug).length;
                    return (
                      <tr key={m.slug} className="border-t border-background-200">
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-2 font-medium text-foreground-950">
                            <i className={`${metierIcons[m.slug] ?? "ri-tools-line"} text-primary-600`}></i>
                            {m.name}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-foreground-600">
                          {metiersSeo[m.slug as keyof typeof metiersSeo]}
                        </td>
                        <td className="px-5 py-3.5 text-foreground-600">{unitesParMetier[m.slug] ?? "Forfait"}</td>
                        <td className="px-5 py-3.5 text-foreground-600 tabular-nums">{nbGuides}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to={`/metiers/${m.slug}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:gap-2.5 transition-all cursor-pointer whitespace-nowrap"
                          >
                            Voir
                            <i className="ri-arrow-right-line"></i>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-foreground-500">
              {totalGuides} guides pratiques sont associés à ces métiers, à retrouver dans le centre de ressources.
            </p>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl p-6 md:p-8 rounded-lg bg-background-100 border border-background-200 flex flex-col md:flex-row md:items-center gap-6">
              <span className="w-14 h-14 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-2xl">
                <i className="ri-rss-line"></i>
              </span>
              <div className="flex-1">
                <h2 className="font-heading font-semibold text-lg text-foreground-950">
                  Suivre les fiches métiers par flux RSS
                </h2>
                <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
                  Abonnez-vous au flux RSS des fiches métiers pour suivre leur mise à jour depuis votre
                  lecteur d'actualités. Copiez l'adresse du flux ou utilisez le bouton.
                </p>
                <code className="mt-3 inline-block px-3 py-2 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-700 break-all">
                  https://artiflow-pro.fr{RSS_HREF}
                </code>
              </div>
              <a
                href={RSS_HREF}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors shrink-0"
              >
                <i className="ri-rss-line"></i>
                Ouvrir le flux
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/metiers"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
              >
                <i className="ri-hammer-line"></i>
                Hub des métiers
              </Link>
              <Link
                to="/zones-intervention"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
              >
                <i className="ri-map-2-line"></i>
                Zones d'intervention
              </Link>
              <Link
                to="/ressources"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300"
              >
                <i className="ri-book-open-line"></i>
                Centre de ressources
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Votre métier a sa version d'ArtiFlow-pro
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                20 minutes de démonstration suffisent pour voir ArtiFlow-pro rédiger votre premier devis, avec vos tarifs.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo("metiers-recap-cta")}
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
      </main>

      <Footer />
    </div>
  );
}