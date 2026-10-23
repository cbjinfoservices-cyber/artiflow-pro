import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import ArticleCard from "@/components/feature/ArticleCard";
import { metiers } from "@/mocks/metiers";
import { articles, articleFullText, formatLecture } from "@/mocks/ressources";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useRobotsMeta } from "@/hooks/useRobotsMeta";
import { useDemoModal } from "@/hooks/useDemoModal";

const metiersMisEnAvant = metiers.slice(0, 3);
const guidesPopulaires = articles.slice(0, 2);

/** Minuscules + accents retirés, pour une recherche tolérante (ex. « chaudiere » ≈ « chaudière »). */
function normaliser(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function NotFound() {
  const location = useLocation();
  const { openDemo } = useDemoModal();
  const [query, setQuery] = useState("");
  const [metierActif, setMetierActif] = useState("");

  usePageMeta(
    "Page introuvable · ArtiFlow-pro",
    "La page demandée n'existe pas ou a été déplacée. Retrouvez toutes les pages ArtiFlow-pro depuis le plan du site."
  );
  useRobotsMeta("noindex, nofollow");

  // Recherche directe dans les guides Ressources : on cherche dans le titre, l'extrait,
  // le métier associé et le contenu complet du guide, pour retrouver un article depuis la 404.
  const resultatsTous = useMemo(() => {
    const q = normaliser(query.trim());
    if (!q) return [];
    return articles.filter((article) => {
      const metier = metiers.find((m) => m.slug === article.category);
      const corpus = normaliser(
        [article.title, article.excerpt, metier?.name ?? "", metier?.shortName ?? "", articleFullText(article)].join(" ")
      );
      return corpus.includes(q);
    });
  }, [query]);

  // Compteur de guides par métier parmi les résultats, pour affiner la recherche d'un clic.
  const comptesMetier = useMemo(() => {
    const map = new Map<string, number>();
    resultatsTous.forEach((a) => map.set(a.category, (map.get(a.category) ?? 0) + 1));
    return [...map.entries()]
      .map(([slug, count]) => ({ slug, count, metier: metiers.find((m) => m.slug === slug) }))
      .sort((a, b) => b.count - a.count || (a.metier?.name ?? "").localeCompare(b.metier?.name ?? "", "fr"));
  }, [resultatsTous]);

  const resultatsFiltres = useMemo(
    () => (metierActif ? resultatsTous.filter((a) => a.category === metierActif) : resultatsTous),
    [resultatsTous, metierActif]
  );

  const resultats = resultatsFiltres.slice(0, 6);

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-28 md:pt-32 pb-14 md:pb-20">
            <div className="max-w-2xl mx-auto text-center">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-700 text-3xl">
                <i className="ri-compass-3-line"></i>
              </span>
              <p className="mt-6 font-heading font-extrabold text-6xl md:text-7xl text-foreground-950 tracking-tight">
                404
              </p>
              <h1 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
                Cette page est introuvable
              </h1>
              <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
                La page <span className="font-medium text-foreground-800">{location.pathname}</span> n'existe
                pas ou a été déplacée. Pas de panique : voici de quoi retrouver votre chemin.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-home-4-line"></i>
                  Retour à l'accueil
                </Link>
                <button
                  type="button"
                  onClick={() => openDemo("page-404")}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                >
                  <i className="ri-calendar-check-line"></i>
                  Demander une démo
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-background-200">
                <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                  Accès rapides
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Link
                    to="/metiers"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-foreground-950 transition-colors"
                  >
                    <i className="ri-tools-line text-primary-600"></i>
                    Les métiers
                  </Link>
                  <Link
                    to="/ressources"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-foreground-950 transition-colors"
                  >
                    <i className="ri-book-open-line text-accent-600"></i>
                    Ressources
                  </Link>
                  <Link
                    to="/tarifs"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-secondary-300 hover:text-foreground-950 transition-colors"
                  >
                    <i className="ri-price-tag-3-line text-secondary-600"></i>
                    Tarifs
                  </Link>
                  <Link
                    to="/plan-du-site"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-foreground-950 transition-colors"
                  >
                    <i className="ri-map-2-line"></i>
                    Plan du site
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-hammer-line"></i>
                  Les plus demandés
                </span>
                <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Les métiers les plus recherchés
                </h2>
              </div>
              <Link
                to="/metiers"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
              >
                Voir tous les métiers
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {metiersMisEnAvant.map((metier) => (
                <Link
                  key={metier.slug}
                  to={`/metiers/${metier.slug}`}
                  className="group flex flex-col rounded-lg border border-background-200 bg-background-50 overflow-hidden hover:border-primary-300 transition-colors cursor-pointer"
                >
                  <div className="relative w-full h-40 overflow-hidden bg-background-100">
                    <img
                      src={metier.cardImage}
                      alt={`ArtiFlow-pro pour les ${metier.name.toLowerCase()}s`}
                      title={`${metier.name} · ArtiFlow-pro`}
                      width={400}
                      height={300}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col flex-1 p-5">
                    <h3 className="font-heading font-semibold text-base text-foreground-950">{metier.name}</h3>
                    <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">{metier.tagline}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 group-hover:gap-3 transition-all">
                      Voir les devis {metier.shortName.toLowerCase()}
                      <i className="ri-arrow-right-line"></i>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100 border-y border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                  <i className="ri-book-open-line"></i>
                  À lire aussi
                </span>
                <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                  Les guides les plus consultés
                </h2>
              </div>
              <Link
                to="/ressources"
                className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700 hover:gap-3 transition-all cursor-pointer"
              >
                Tous les guides
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>

            <div className="max-w-xl mb-7">
              <label htmlFor="notfound-guide-search" className="sr-only">
                Rechercher un guide Ressources
              </label>
              <div className="flex items-center gap-2 px-4 h-12 rounded-md bg-background-50 border border-background-200 focus-within:border-accent-400 transition-colors">
                <i className="ri-search-line text-foreground-400"></i>
                <input
                  id="notfound-guide-search"
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setMetierActif("");
                  }}
                  placeholder="Rechercher un guide : chaudière, carrelage, façade…"
                  className="flex-1 bg-transparent text-sm text-foreground-800 outline-none placeholder:text-foreground-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setMetierActif("");
                    }}
                    aria-label="Effacer la recherche"
                    title="Effacer la recherche"
                    className="w-6 h-6 flex items-center justify-center rounded-full text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer transition-colors"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                )}
              </div>
              {query.trim() && (
                <p className="mt-2 text-xs text-foreground-500" aria-live="polite">
                  {resultatsFiltres.length > 0
                    ? `${resultatsFiltres.length} guide${resultatsFiltres.length > 1 ? "s" : ""} trouvé${resultatsFiltres.length > 1 ? "s" : ""}`
                    : "Aucun guide ne correspond à cette recherche"}
                </p>
              )}
              {query.trim() && comptesMetier.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-foreground-500">Affiner par métier :</span>
                  <button
                    type="button"
                    onClick={() => setMetierActif("")}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                      metierActif === ""
                        ? "bg-secondary-500 text-background-50 border-secondary-500"
                        : "bg-background-50 text-foreground-700 border-background-200 hover:border-secondary-300 hover:text-foreground-950"
                    }`}
                  >
                    Tous
                    <span className={metierActif === "" ? "text-background-50/80" : "text-foreground-400"}>
                      {resultatsTous.length}
                    </span>
                  </button>
                  {comptesMetier.map(({ slug, count, metier }) => {
                    const actif = metierActif === slug;
                    return (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => setMetierActif(actif ? "" : slug)}
                        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                          actif
                            ? "bg-secondary-500 text-background-50 border-secondary-500"
                            : "bg-background-50 text-foreground-700 border-background-200 hover:border-secondary-300 hover:text-foreground-950"
                        }`}
                      >
                        <i className="ri-tools-line"></i>
                        {metier?.name ?? "Artisan"}
                        <span className={actif ? "text-background-50/80" : "text-foreground-400"}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {query.trim() ? (
              resultats.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {resultats.map((article) => {
                    const metier = metiers.find((m) => m.slug === article.category);
                    return (
                      <li key={article.slug}>
                        <Link
                          to={`/ressources/${article.slug}`}
                          className="group flex items-start gap-4 p-4 rounded-lg border border-background-200 bg-background-50 hover:border-accent-300 transition-colors cursor-pointer"
                        >
                          <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
                            <i className="ri-book-open-line"></i>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-900 text-[11px] font-semibold">
                                {metier ? metier.name : "Artisan"}
                              </span>
                              <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                                <i className="ri-time-line"></i>
                                {formatLecture(article)}
                              </span>
                            </span>
                            <span className="mt-1.5 block font-heading font-semibold text-sm text-foreground-950 group-hover:text-accent-800 transition-colors">
                              {article.title}
                            </span>
                            <span className="mt-1 block text-xs text-foreground-600 leading-relaxed line-clamp-2">
                              {article.excerpt}
                            </span>
                          </span>
                          <i className="ri-arrow-right-line text-foreground-300 group-hover:text-accent-600 group-hover:translate-x-0.5 transition-all mt-1"></i>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-3 p-8 rounded-lg border border-background-200 bg-background-50 text-center">
                  <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-100 text-foreground-300">
                    <i className="ri-search-eye-line text-xl"></i>
                  </span>
                  <p className="text-sm text-foreground-700">
                    Aucun guide ne correspond à « {query.trim()} ».
                  </p>
                  <p className="text-xs text-foreground-500">
                    Essayez un autre mot-clé, ou parcourez l'ensemble des guides Ressources.
                  </p>
                  <Link
                    to="/ressources"
                    className="mt-1 inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-book-open-line"></i>
                    Voir tous les guides
                  </Link>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {guidesPopulaires.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}