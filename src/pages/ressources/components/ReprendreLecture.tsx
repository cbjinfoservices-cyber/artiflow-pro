import { useMemo } from "react";
import { Link } from "react-router-dom";
import { articles, readingMinutes } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import { getStatut, marquerCommeLu } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";

/**
 * Bandeau « Reprendre la lecture » : liste les guides commencés (section lue
 * mémorisée) et permet de les marquer comme lus d'un clic pour les retirer de
 * la liste. Se masque quand il n'y a plus rien à reprendre.
 */
export default function ReprendreLecture() {
  const version = useLectureVersion();
  const enCours = useMemo(
    () => articles.filter((article) => getStatut(article.slug) === "en-cours"),
    [version]
  );

  if (enCours.length === 0) return null;

  return (
    <section className="w-full bg-background-100 border-t border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-8 md:py-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 text-lg">
            <i className="ri-history-line"></i>
          </span>
          <div>
            <h2 className="font-heading font-semibold text-lg text-foreground-950">
              Reprendre la lecture
            </h2>
            <p className="text-sm text-foreground-600">
              {enCours.length} guide{enCours.length > 1 ? "s" : ""} commencé
              {enCours.length > 1 ? "s" : ""} — reprenez là où vous vous êtes arrêté.
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {enCours.map((article) => {
            const metier = metiers.find((m) => m.slug === article.category);
            return (
              <li
                key={article.slug}
                className="flex items-center gap-3 p-3.5 rounded-lg border border-background-200 bg-background-50"
              >
                <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 text-base">
                  <i className="ri-bookmark-line"></i>
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/ressources/${article.slug}`}
                    className="block font-heading font-semibold text-sm text-foreground-950 hover:text-primary-700 leading-snug truncate cursor-pointer"
                  >
                    {article.title}
                  </Link>
                  <span className="text-xs text-foreground-500">
                    {metier ? metier.name : "Artisan"} · {readingMinutes(article)} min
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => marquerCommeLu(article.slug)}
                  aria-label={`Marquer « ${article.title} » comme lu`}
                  title="Marquer comme lu"
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md border border-background-200 text-foreground-600 hover:border-secondary-300 hover:text-secondary-700 hover:bg-secondary-50 cursor-pointer transition-colors"
                >
                  <i className="ri-check-double-line"></i>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}