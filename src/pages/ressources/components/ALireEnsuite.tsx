import { useMemo } from "react";
import { Link } from "react-router-dom";
import { articles, readingMinutes, type Article } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import { sujets } from "@/mocks/sujets";
import { getStatut } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";

/**
 * Recommandation « À lire ensuite » : choisit le guide le plus pertinent après
 * celui-ci, en privilégiant le même corps d'état, puis le même thème, puis
 * n'importe quel guide non encore lu.
 */
export default function ALireEnsuite({ article }: { article: Article }) {
  const version = useLectureVersion();

  const reco = useMemo(() => {
    const estCandidat = (a: Article) => a.slug !== article.slug && getStatut(a.slug) !== "lu";

    let cible = articles.find((a) => a.category === article.category && estCandidat(a));
    let raison = "Dans votre corps d'état";

    if (!cible) {
      const themes = sujets.filter((s) => s.articleSlugs.includes(article.slug));
      for (const theme of themes) {
        const trouve = articles.find((a) => theme.articleSlugs.includes(a.slug) && estCandidat(a));
        if (trouve) {
          cible = trouve;
          raison = `Dans le thème « ${theme.name} »`;
          break;
        }
      }
    }

    if (!cible) {
      cible = articles.find(estCandidat);
      raison = "À découvrir dans la bibliothèque";
    }
    if (!cible) cible = articles.find((a) => a.slug !== article.slug);

    return cible ? { article: cible, raison } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, version]);

  if (!reco) return null;
  const cible = reco.article;
  const metier = metiers.find((m) => m.slug === cible.category);

  return (
    <div className="mt-12 pt-8 border-t border-background-200">
      <h2 className="font-heading font-bold text-xl text-foreground-950 tracking-tight">
        À lire ensuite
      </h2>
      <Link
        to={`/ressources/${cible.slug}`}
        className="group mt-4 flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-accent-950 overflow-hidden hover:bg-accent-900 transition-colors cursor-pointer"
      >
        <div className="w-full sm:w-40 h-32 sm:h-24 shrink-0 rounded-md overflow-hidden bg-foreground-950">
          {metier && (
            <img
              src={metier.cardImage}
              alt={`Guide ${metier.name} · ${cible.title}`}
              title={`${cible.title} · ArtiFlow-pro`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-accent-200">
            <i className="ri-lightbulb-flash-line"></i>
            {reco.raison}
          </span>
          <h3 className="mt-1.5 font-heading font-semibold text-base text-background-50 leading-snug">
            {cible.title}
          </h3>
          <p className="mt-1.5 text-xs text-background-200/80">
            {metier ? metier.name : "Artisan"} · {readingMinutes(cible)} min de lecture
          </p>
        </div>
        <span className="hidden sm:flex w-10 h-10 shrink-0 items-center justify-center rounded-md bg-background-50/10 text-background-50 text-lg group-hover:bg-background-50/20 transition-colors">
          <i className="ri-arrow-right-line"></i>
        </span>
      </Link>
    </div>
  );
}