import { useMemo } from "react";
import { articles } from "@/mocks/ressources";
import { getStatut } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";

/**
 * Bandeau de progression en haut du hub Ressources : indique combien de guides
 * ont été lus sur le total, avec une barre de progression. Se recalcule
 * automatiquement à chaque changement de lecture (marqué lu ou en cours).
 */
export default function ProgressionLecture() {
  const version = useLectureVersion();

  const stats = useMemo(() => {
    let lus = 0;
    let enCours = 0;
    articles.forEach((article) => {
      const statut = getStatut(article.slug);
      if (statut === "lu") lus += 1;
      else if (statut === "en-cours") enCours += 1;
    });
    const total = articles.length;
    const pct = total > 0 ? Math.round((lus / total) * 100) : 0;
    return { lus, enCours, total, pct, aLire: total - lus - enCours };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const sousTitre =
    stats.enCours > 0
      ? `${stats.enCours} guide${stats.enCours > 1 ? "s" : ""} en cours · ${stats.aLire} encore à découvrir`
      : stats.aLire > 0
        ? `${stats.aLire} guide${stats.aLire > 1 ? "s" : ""} encore à découvrir`
        : "Bravo, vous avez tout lu !";

  return (
    <section className="w-full bg-background-50 border-b border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-6 md:py-7">
        <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
          <div className="flex items-center gap-3 md:w-80 shrink-0">
            <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-xl">
              <i className="ri-medal-line"></i>
            </span>
            <div className="min-w-0">
              <p className="font-heading font-semibold text-base text-foreground-950">
                {stats.lus} guide{stats.lus > 1 ? "s" : ""} lu{stats.lus > 1 ? "s" : ""} sur {stats.total}
              </p>
              <p className="text-xs text-foreground-500 leading-snug">{sousTitre}</p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs text-foreground-500 mb-1.5">
              <span>Votre progression de lecture</span>
              <span className="font-semibold text-foreground-800 tabular-nums">{stats.pct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-background-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500"
                style={{ width: `${stats.pct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}