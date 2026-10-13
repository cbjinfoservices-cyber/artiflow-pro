import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useStructuredData } from "@/hooks/useStructuredData";
import {
  categoriesNouveautes,
  niveauLabels,
  nouveautes,
  type NiveauNouveaute,
} from "@/mocks/nouveautes";

const categorieTone: Record<string, string> = {
  devis: "bg-primary-100 text-primary-700",
  relances: "bg-accent-100 text-accent-800",
  planning: "bg-secondary-100 text-secondary-800",
  comptabilite: "bg-primary-100 text-primary-700",
  tarifs: "bg-accent-100 text-accent-800",
  site: "bg-secondary-100 text-secondary-800",
  espace: "bg-secondary-100 text-secondary-800",
};

const niveauTone: Record<NiveauNouveaute, string> = {
  majeur: "bg-accent-500 text-background-50",
  amelioration: "bg-primary-100 text-primary-700",
  correctif: "bg-secondary-100 text-secondary-800",
};

function categorieLabel(key: string): string {
  const found = categoriesNouveautes.find((c) => c.key === key);
  return found ? found.label : key;
}

export default function NouveautesPage() {
  const [active, setActive] = useState("toutes");

  const filtered = active === "toutes" ? nouveautes : nouveautes.filter((n) => n.categorie === active);

  usePageMeta(
    "Nouveautés ArtiFlow-pro · Journal des mises à jour produit",
    "Suivez les nouveautés d'ArtiFlow-pro : devis, relances, planning, comptabilité et offres. Le journal des mises à jour, transparent et mis à jour régulièrement.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20abstract%20banner%20about%20product%20updates%20and%20changelog%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20rocket%20and%20spark%20shapes%2C%20stacked%20card%20silhouettes%2C%20blueprint%20lines%20on%20deep%20charcoal%20background%2C%20cinematic%20minimal%20editorial%20lighting%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-nouveautes&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Nouveautés", path: "/nouveautes" },
    ],
    "artiflow-nouveautes-breadcrumb-schema"
  );

  useStructuredData("artiflow-nouveautes-itemlist", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Journal des mises à jour ArtiFlow-pro",
    itemListElement: nouveautes.map((n, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${n.version} — ${n.title}`,
      description: n.summary,
    })),
  });

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
              <span className="text-foreground-800">Nouveautés</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-sparkling-2-line"></i>
                Journal des mises à jour
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Ce qu'on améliore, semaine après semaine
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                ArtiFlow-pro évolue en continu avec les retours du terrain. Voici, en toute transparence, les
                nouveautés livrées : nouvelles fonctions, améliorations et corrections.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-rocket-2-line"></i>
                {nouveautes.length} mises à jour publiées
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-refresh-line"></i>
                Mise à jour régulière
              </span>
              <a
                href="/nouveautes/rss.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-background-300 bg-background-50 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-400 hover:text-primary-700 transition-colors"
              >
                <i className="ri-rss-line"></i>
                S'abonner au flux RSS
              </a>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
            <div className="flex flex-wrap items-center gap-2 mb-10">
              {categoriesNouveautes.map((cat) => {
                const isActive = active === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActive(cat.key)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                      isActive
                        ? "bg-primary-500 text-background-50 border-primary-500"
                        : "bg-background-50 text-foreground-700 border-background-200 hover:bg-background-100"
                    }`}
                  >
                    <i className={cat.icon}></i>
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 rounded-lg bg-background-100 border border-background-200">
                <span className="w-14 h-14 flex items-center justify-center rounded-full bg-background-200 text-foreground-500 text-2xl">
                  <i className="ri-search-line"></i>
                </span>
                <p className="mt-4 text-sm text-foreground-600">
                  Aucune mise à jour dans cette catégorie pour le moment.
                </p>
              </div>
            ) : (
              <ol className="relative flex flex-col gap-6 md:gap-8">
                {filtered.map((n) => (
                  <li key={n.id} className="grid grid-cols-1 lg:grid-cols-[170px_1fr] gap-3 lg:gap-6">
                    <div className="flex lg:flex-col items-center lg:items-start gap-3 lg:pt-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground-950 text-background-50 text-xs font-bold whitespace-nowrap">
                        <i className="ri-git-commit-line"></i>
                        v{n.version}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500 whitespace-nowrap">
                        <i className="ri-calendar-line"></i>
                        <time dateTime={n.dateIso}>{n.dateLabel}</time>
                      </span>
                    </div>

                    <article className="rounded-lg border border-background-200 bg-background-50 p-5 md:p-6 transition-colors hover:border-primary-300">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${niveauTone[n.niveau]}`}>
                          <i className="ri-award-line"></i>
                          {niveauLabels[n.niveau]}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${categorieTone[n.categorie] ?? "bg-background-100 text-foreground-700"}`}>
                          <i className={n.icon}></i>
                          {categorieLabel(n.categorie)}
                        </span>
                      </div>

                      <h2 className="mt-3 font-heading font-bold text-lg md:text-xl text-foreground-950 tracking-tight">
                        {n.title}
                      </h2>
                      <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{n.summary}</p>

                      <ul className="mt-4 flex flex-col gap-2">
                        {n.points.map((point) => (
                          <li key={point} className="flex items-start gap-2">
                            <i className="ri-check-line mt-0.5 text-accent-600"></i>
                            <span className="text-sm text-foreground-700">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Une idée, un manque, un bug à signaler ?
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                C'est le terrain qui guide nos priorités. Écrivez-nous : beaucoup des nouveautés ci-dessus
                viennent directement de vos retours.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-mail-send-line"></i>
                  Nous écrire
                </Link>
                <Link
                  to="/tarifs"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-price-tag-3-line"></i>
                  Voir les offres
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