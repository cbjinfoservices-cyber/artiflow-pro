import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { articles, readingMinutes, type Article } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import { getParcours } from "@/mocks/parcours";
import { getStatut, marquerCommeLu, marquerCommeNonLu } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useItemListSchema } from "@/hooks/useItemListSchema";

/**
 * Page d'un parcours guidé : liste ordonnée de ses étapes, avec l'état de
 * lecture de chacune et un bouton pour commencer ou reprendre au bon endroit.
 */
export default function ParcoursPage() {
  const { slug } = useParams();
  const version = useLectureVersion();
  const parcours = getParcours(slug);

  usePageMeta(
    parcours ? `${parcours.name} — Parcours guidé | ArtiFlow-pro` : "Parcours guidé | ArtiFlow-pro",
    parcours?.description,
    parcours ? { image: parcours.shareImage } : undefined
  );

  // Étapes du parcours calculées avant le retour anticipé pour garder un ordre de hooks stable.
  const etapesSchema = parcours
    ? parcours.articleSlugs
        .map((s) => articles.find((a) => a.slug === s))
        .filter((a): a is Article => Boolean(a))
    : [];

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Ressources", path: "/ressources" },
      { name: parcours?.name ?? "Parcours", path: `/ressources/parcours/${slug ?? ""}` },
    ],
    `artiflow-parcours-breadcrumb-${slug ?? "inconnu"}`
  );

  useItemListSchema(
    parcours
      ? {
          name: parcours.name,
          description: parcours.description,
          items: etapesSchema.map((article) => ({
            name: article.title,
            path: `/ressources/${article.slug}`,
          })),
        }
      : null,
    `artiflow-parcours-itemlist-${slug ?? "inconnu"}`
  );

  if (!parcours) return <Navigate to="/ressources" replace />;

  const etapes = parcours.articleSlugs
    .map((s) => articles.find((a) => a.slug === s))
    .filter((a): a is Article => Boolean(a));
  const total = etapes.length;
  const lus = etapes.filter((a) => getStatut(a.slug) === "lu").length;
  const pct = total > 0 ? Math.round((lus / total) * 100) : 0;
  const termine = lus === total && total > 0;
  const prochaine = etapes.find((a) => getStatut(a.slug) !== "lu") ?? etapes[0];
  const minutesTotal = etapes.reduce((acc, a) => acc + readingMinutes(a), 0);

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-12 md:pt-16 pb-12 md:pb-16">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">Accueil</Link>
              <i className="ri-arrow-right-s-line"></i>
              <Link to="/ressources" className="hover:text-foreground-900 cursor-pointer">Ressources</Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Parcours</span>
            </nav>

            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-12 h-12 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-2xl">
                  <i className={parcours.icon}></i>
                </span>
                <span className="px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold">
                  Niveau {parcours.niveau.toLowerCase()}
                </span>
              </div>
              <h1 className="mt-4 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                {parcours.name}
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                {parcours.description}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-5 text-xs text-foreground-500">
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-list-ordered"></i>
                  {total} étape{total > 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-time-line"></i>
                  {minutesTotal} min au total
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-check-double-line"></i>
                  {lus}/{total} terminée{total > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="mt-7 max-w-xl">
              <div className="flex items-center justify-between text-xs text-foreground-500 mb-1.5">
                <span>Progression du parcours</span>
                <span className="font-semibold text-foreground-800 tabular-nums">{pct}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-background-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${termine ? "bg-secondary-500" : "bg-primary-500"}`}
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
              {prochaine && (
                <Link
                  to={`/ressources/${prochaine.slug}`}
                  className="mt-5 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className={termine ? "ri-refresh-line" : lus > 0 ? "ri-play-line" : "ri-rocket-line"}></i>
                  {termine ? "Revoir le parcours" : lus > 0 ? "Continuer le parcours" : "Commencer le parcours"}
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
            <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight mb-8">
              Les étapes du parcours
            </h2>

            <ol className="flex flex-col gap-4 max-w-4xl">
              {etapes.map((article, index) => {
                const statut = getStatut(article.slug);
                const lu = statut === "lu";
                const enCours = statut === "en-cours";
                const metier = metiers.find((m) => m.slug === article.category);
                return (
                  <li
                    key={article.slug}
                    className="flex flex-col sm:flex-row gap-4 p-5 rounded-lg bg-background-50 border border-background-200"
                  >
                    <div className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 shrink-0">
                      <span
                        className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold whitespace-nowrap ${
                          lu
                            ? "bg-secondary-500 text-background-50"
                            : "bg-background-100 text-foreground-700 border border-background-200"
                        }`}
                      >
                        {lu ? <i className="ri-check-line text-lg"></i> : index + 1}
                      </span>
                      {enCours && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap">
                          <i className="ri-bookmark-line"></i>
                          En cours
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-foreground-500">
                        {metier ? metier.name : "Artisan"} · {readingMinutes(article)} min
                      </span>
                      <h3 className="mt-1 font-heading font-semibold text-base text-foreground-950 leading-snug">
                        <Link to={`/ressources/${article.slug}`} className="hover:text-primary-700 cursor-pointer">
                          {article.title}
                        </Link>
                      </h3>
                      <p className="mt-1.5 text-sm text-foreground-600 leading-relaxed">{article.excerpt}</p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-start gap-2 shrink-0">
                      <Link
                        to={`/ressources/${article.slug}`}
                        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                      >
                        <i className="ri-book-open-line"></i>
                        Lire
                      </Link>
                      <button
                        type="button"
                        onClick={() => (lu ? marquerCommeNonLu(article.slug) : marquerCommeLu(article.slug))}
                        className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                          lu
                            ? "bg-secondary-100 text-secondary-900 border-secondary-200 hover:bg-secondary-200"
                            : "bg-background-50 text-foreground-700 border-background-200 hover:border-secondary-300 hover:text-secondary-700"
                        }`}
                      >
                        <i className={lu ? "ri-check-double-line" : "ri-check-line"}></i>
                        {lu ? "Lu" : "Marquer lu"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-10">
              <Link
                to="/ressources"
                className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-700 hover:text-secondary-800 transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line"></i>
                Retour à toutes les ressources
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}