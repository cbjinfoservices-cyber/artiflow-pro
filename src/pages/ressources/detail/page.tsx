import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import ArticleSommaire from "@/components/feature/ArticleSommaire";
import FaqAccordion from "@/components/feature/FaqAccordion";
import GuidePrevNext from "@/pages/ressources/components/GuidePrevNext";
import GuideLienCard from "@/pages/ressources/components/GuideLienCard";
import MarquerLuButton from "@/pages/ressources/components/MarquerLuButton";
import NotesGuide from "@/pages/ressources/components/NotesGuide";
import ALireEnsuite from "@/pages/ressources/components/ALireEnsuite";
import { useFavori } from "@/hooks/useBibliotheque";
import { togglerFavori } from "@/lib/bibliotheque";
import { articles, formatLecture, readingMinutes } from "@/mocks/ressources";
import { auteurIdDuGuide } from "@/mocks/auteurs";
import { equipe } from "@/mocks/equipe";
import { getFaqGuide } from "@/mocks/faqGuides";
import { getHowToGuide } from "@/mocks/howToGuides";
import { getGuideMiseAJour } from "@/mocks/guidesMiseAJour";
import { formatDateLongue } from "@/lib/dates";
import { metiers } from "@/mocks/metiers";
import { sujets } from "@/mocks/sujets";
import { useDemoModal } from "@/hooks/useDemoModal";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useArticleSchema } from "@/hooks/useArticleSchema";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import { useHowToSchema } from "@/hooks/useHowToSchema";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function ArticlePage() {
  const { slug } = useParams();
  const { openDemo } = useDemoModal();

  const article = articles.find((a) => a.slug === slug);
  const metier = article ? metiers.find((m) => m.slug === article.category) : undefined;
  const auteurId = article ? auteurIdDuGuide(article.slug) : undefined;
  const auteur = auteurId ? equipe.find((m) => m.id === auteurId) : undefined;
  const favori = useFavori(article?.slug);
  const guideFaq = getFaqGuide(article?.slug);
  const howTo = getHowToGuide(article?.slug);
  const miseAJour = getGuideMiseAJour(article?.slug);

  usePageMeta(
    article ? `${article.title} | ArtiFlow-pro` : "Guide artisan | ArtiFlow-pro",
    article?.excerpt,
    { image: article?.shareImage ?? metier?.heroImage, type: "article" }
  );

  useArticleSchema(
    article
      ? {
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          date: article.date,
          dateModified: miseAJour,
          section: metier?.name,
          image: article.shareImage ?? metier?.heroImage,
          author: auteur ? { name: auteur.name, id: auteur.id } : null,
        }
      : null
  );

  useFaqSchema(
    guideFaq,
    article ? `artiflow-guide-faq-${article.slug}` : "artiflow-guide-faq-schema"
  );

  useHowToSchema(howTo ? { ...howTo, dateModified: miseAJour } : null);

  useBreadcrumbSchema(
    article
      ? [
          { name: "Accueil", path: "/" },
          { name: "Ressources", path: "/ressources" },
          ...(metier ? [{ name: metier.name, path: `/metiers/${metier.slug}` }] : []),
          { name: article.title, path: `/ressources/${article.slug}` },
        ]
      : [],
    "artiflow-article-breadcrumb-schema"
  );

  if (!article) {
    return <Navigate to="/ressources" replace />;
  }

  // Les guides qui vivent sur leur propre page (ex. guide pratique de sécurité)
  // renvoient vers leur adresse canonique plutôt que d'afficher un doublon ici.
  if (article.href) {
    return <Navigate to={article.href} replace />;
  }

  const currentIndex = articles.findIndex((a) => a.slug === article.slug);
  const prevGuide = currentIndex > 0 ? articles[currentIndex - 1] : undefined;
  const nextGuide =
    currentIndex >= 0 && currentIndex < articles.length - 1 ? articles[currentIndex + 1] : undefined;

  const themes = sujets.filter((s) => s.articleSlugs.includes(article.slug));
  const autres = articles.filter((a) => a.category === article.category && a.slug !== article.slug);
  const suggestions = autres.length > 0 ? autres : articles.filter((a) => a.slug !== article.slug).slice(0, 2);

  const sectionLinks = article.sections.map((section, index) => ({
    id: `${slugify(section.title)}-${index + 1}`,
    label: section.title,
  }));
  const relatedGuides = suggestions.map((s) => ({
    slug: s.slug,
    title: s.title,
    minutes: readingMinutes(s),
  }));

  // Répartit le temps de lecture total proportionnellement à la longueur de chaque section
  const totalMinutes = readingMinutes(article);
  const totalChars =
    article.sections.reduce((acc, section) => acc + [section.title, ...section.body].join(" ").length, 0) || 1;
  const sectionMinutes = article.sections.map((section) => {
    const length = [section.title, ...section.body].join(" ").length;
    return Math.max(0.5, (length / totalChars) * totalMinutes);
  });

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="relative w-full pt-16 md:pt-18 overflow-hidden bg-foreground-950">
          {metier && (
            <img
              src={metier.heroImage}
              alt={`Guide ${metier.name} · ${article.title}`}
              title={`${article.title} · ArtiFlow-pro`}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/85 via-foreground-950/75 to-foreground-950/90"></div>

          <div className="relative w-full px-4 md:px-8 lg:px-12 pt-12 md:pt-16 pb-12 md:pb-16">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-background-200/80 mb-6">
              <Link to="/" className="hover:text-background-50 cursor-pointer">Accueil</Link>
              <i className="ri-arrow-right-s-line"></i>
              <Link to="/ressources" className="hover:text-background-50 cursor-pointer">Ressources</Link>
              {metier && (
                <>
                  <i className="ri-arrow-right-s-line"></i>
                  <Link
                    to={`/metiers/${metier.slug}`}
                    className="hover:text-background-50 cursor-pointer"
                  >
                    {metier.name}
                  </Link>
                </>
              )}
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-background-50">{article.title}</span>
            </nav>

            <div className="max-w-3xl">
              {metier && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500 text-background-50 text-xs font-semibold">
                  <i className="ri-tools-line"></i>
                  {metier.name}
                </span>
              )}
              <h1 className="mt-4 font-heading font-bold text-3xl md:text-5xl text-background-50 tracking-tight leading-tight">
                {article.title}
              </h1>
              <p className="mt-4 text-base md:text-lg text-background-200/85 leading-relaxed">
                {article.excerpt}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-background-200/75">
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-time-line"></i>
                  {formatLecture(article)} de lecture
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-calendar-line"></i>
                  {article.date}
                </span>
                {miseAJour && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-history-line"></i>
                    Mis à jour le {formatDateLongue(miseAJour)}
                  </span>
                )}
                {auteur ? (
                  <Link
                    to={`/auteurs/${auteur.id}`}
                    className="inline-flex items-center gap-1.5 hover:text-background-50 transition-colors cursor-pointer"
                  >
                    <i className="ri-user-voice-line"></i>
                    Par {auteur.name}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-team-line"></i>
                    Équipe ArtiFlow-pro
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14 items-start">
              <article className="lg:col-span-2">
                <ArticleSommaire
                  sections={sectionLinks}
                  related={relatedGuides}
                  sectionMinutes={sectionMinutes}
                  guideSlug={article.slug}
                />

                <div className="mt-9 flex flex-col gap-9">
                  {article.sections.map((section, sIndex) => (
                    <section
                      key={sectionLinks[sIndex].id}
                      id={sectionLinks[sIndex].id}
                      className="scroll-mt-28"
                    >
                      <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
                        {section.title}
                      </h2>
                      <div className="mt-3.5 flex flex-col gap-4">
                        {section.body.map((paragraphe, pIndex) => (
                          <p
                            key={pIndex}
                            className={`leading-relaxed ${
                              sIndex === 0 && pIndex === 0
                                ? "text-base md:text-lg text-foreground-800"
                                : "text-sm md:text-base text-foreground-600"
                            }`}
                          >
                            {paragraphe}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                {guideFaq.length > 0 && (
                  <section id="faq-guide" className="mt-12 pt-9 border-t border-background-200 scroll-mt-28">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-lg">
                        <i className="ri-question-answer-line"></i>
                      </span>
                      <div>
                        <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
                          Questions fréquentes
                        </h2>
                        <p className="mt-1 text-sm text-foreground-600">
                          Les questions que se posent le plus souvent les artisans sur ce sujet.
                        </p>
                      </div>
                    </div>
                    <FaqAccordion items={guideFaq} idPrefix={`faq-${article.slug}`} />
                  </section>
                )}

                <div className="mt-10 p-6 rounded-lg bg-background-100 border border-background-200">
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg shrink-0">
                      <i className="ri-lightbulb-flash-line"></i>
                    </span>
                    <div>
                      <h2 className="font-heading font-semibold text-base text-foreground-950">
                        À retenir
                      </h2>
                      <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
                        Ce guide part d'une situation réelle de chantier. ArtiFlow-pro applique ces bonnes
                        pratiques pour vous : devis dictés, relances automatiques et suivi de chantier,
                        adaptés à votre corps d'état.
                      </p>
                    </div>
                  </div>
                </div>

                <NotesGuide slug={article.slug} />

                <div className="mt-10 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => openDemo(`article-${article.slug}`)}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-calendar-check-line"></i>
                    Demander une démo
                  </button>
                  <Link
                    to="/ressources"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-arrow-left-line"></i>
                    Tous les guides
                  </Link>
                  <MarquerLuButton slug={article.slug} />
                  <button
                    type="button"
                    onClick={() => togglerFavori(article.slug)}
                    aria-pressed={favori}
                    className={`inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                      favori
                        ? "bg-accent-100 text-accent-800 border-accent-200 hover:bg-accent-200"
                        : "bg-background-50 text-foreground-900 border-background-200 hover:border-accent-300 hover:text-accent-700"
                    }`}
                  >
                    <i className={favori ? "ri-bookmark-3-fill" : "ri-bookmark-3-line"}></i>
                    {favori ? "Dans mes favoris" : "Ajouter aux favoris"}
                  </button>
                </div>

                <div className="mt-12 pt-8 border-t border-background-200">
                  <GuidePrevNext
                    prev={prevGuide ? { slug: prevGuide.slug, title: prevGuide.title } : undefined}
                    next={nextGuide ? { slug: nextGuide.slug, title: nextGuide.title } : undefined}
                  />
                </div>

                <ALireEnsuite article={article} />
              </article>

              <aside className="lg:col-span-1 flex flex-col gap-4">
                {themes.map((theme) => {
                  const themeArticles = articles
                    .filter((a) => theme.articleSlugs.includes(a.slug) && a.slug !== article.slug)
                    .slice(0, 3);
                  return (
                    <div key={theme.slug} className="p-5 rounded-lg bg-secondary-50 border border-secondary-200">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-lg">
                          <i className={theme.icon}></i>
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-secondary-700 uppercase tracking-wide">
                            À lire dans ce thème
                          </p>
                          <h2 className="font-heading font-semibold text-base text-foreground-950">
                            {theme.name}
                          </h2>
                        </div>
                      </div>
                      {themeArticles.length > 0 && (
                        <ul className="mt-4 flex flex-col gap-2.5">
                          {themeArticles.map((t) => (
                            <li key={t.slug}>
                              <Link
                                to={`/ressources/${t.slug}`}
                                className="group flex items-start gap-2 text-sm text-foreground-700 hover:text-foreground-950 cursor-pointer"
                              >
                                <i className="ri-article-line mt-0.5 text-secondary-600"></i>
                                <span className="leading-snug">{t.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        to={`/ressources/sujets#sujet-${theme.slug}`}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary-700 hover:gap-3 transition-all cursor-pointer"
                      >
                        Explorer tout le thème
                        <i className="ri-arrow-right-line"></i>
                      </Link>
                    </div>
                  );
                })}

                <h2 className="font-heading font-semibold text-lg text-foreground-950">
                  À lire aussi
                </h2>
                {suggestions.map((s) => (
                  <GuideLienCard key={s.slug} article={s} />
                ))}
                {metier && (
                  <div className="p-5 rounded-lg bg-accent-950 text-background-50">
                    <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-background-50/10 text-accent-200 text-lg">
                      <i className="ri-tools-line"></i>
                    </span>
                    <h3 className="mt-3 font-heading font-semibold text-base text-background-50">
                      ArtiFlow-pro pour les {metier.shortName.toLowerCase()}s
                    </h3>
                    <p className="mt-2 text-sm text-background-200/80 leading-relaxed">{metier.tagline}</p>
                    <Link
                      to={`/metiers/${metier.slug}`}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-400 hover:gap-3 transition-all cursor-pointer"
                    >
                      Découvrir
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}