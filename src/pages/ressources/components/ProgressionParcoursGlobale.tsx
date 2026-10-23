import { Link } from "react-router-dom";
import { parcours } from "@/mocks/parcours";
import { articles } from "@/mocks/ressources";
import { getStatut } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";

/**
 * Vue d'ensemble de la progression de lecture sur l'ensemble des parcours
 * guidés : un total global, puis le détail parcours par parcours pour voir
 * d'un coup d'œil celui qui reste à terminer.
 */
export default function ProgressionParcoursGlobale({ actif }: { actif?: string }) {
  useLectureVersion();

  const slugsConnus = new Set(articles.map((a) => a.slug));
  const tousLesSlugs = Array.from(
    new Set(parcours.flatMap((p) => p.articleSlugs.filter((slug) => slugsConnus.has(slug))))
  );
  const total = tousLesSlugs.length;
  const lus = tousLesSlugs.filter((slug) => getStatut(slug) === "lu").length;
  const pct = total > 0 ? Math.round((lus / total) * 100) : 0;
  const termine = total > 0 && lus === total;

  return (
    <section className="w-full bg-background-50 border-b border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-10 md:py-12">
        <div className="rounded-lg border border-background-200 bg-background-100 p-5 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-700">
                <i className="ri-bar-chart-box-line"></i>
                Progression globale
              </span>
              <h2 className="mt-2 font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
                Où vous en êtes sur vos parcours
              </h2>
              <p className="mt-1.5 text-sm text-foreground-600">
                {lus} guide{lus > 1 ? "s" : ""} terminé{lus > 1 ? "s" : ""} sur {total} au total, tous
                parcours confondus.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`w-14 h-14 flex items-center justify-center rounded-lg text-xl ${
                  termine
                    ? "bg-secondary-500 text-background-50"
                    : "bg-primary-100 text-primary-700"
                }`}
              >
                <i className={termine ? "ri-check-double-line" : "ri-route-line"}></i>
              </span>
              <div>
                <p className="font-heading font-bold text-3xl text-foreground-950 tabular-nums leading-none">
                  {pct}%
                </p>
                <p className="mt-1 text-xs text-foreground-500 whitespace-nowrap">
                  {termine ? "Tous les parcours terminés" : "de l'ensemble parcouru"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 w-full h-2.5 rounded-full bg-background-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                termine ? "bg-secondary-500" : "bg-primary-500"
              }`}
              style={{ width: `${pct}%` }}
            ></div>
          </div>

          <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {parcours.map((p) => {
              const etapes = p.articleSlugs.filter((slug) => slugsConnus.has(slug));
              const totalParcours = etapes.length;
              const lusParcours = etapes.filter((slug) => getStatut(slug) === "lu").length;
              const pctParcours =
                totalParcours > 0 ? Math.round((lusParcours / totalParcours) * 100) : 0;
              const estTermine = totalParcours > 0 && lusParcours === totalParcours;
              const estActif = p.slug === actif;
              return (
                <li key={p.slug}>
                  <Link
                    to={`/ressources/parcours/${p.slug}`}
                    className={`block p-4 rounded-md border transition-colors cursor-pointer ${
                      estActif
                        ? "bg-background-50 border-primary-300"
                        : "bg-background-50 border-background-200 hover:border-primary-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-base ${
                          estTermine
                            ? "bg-secondary-100 text-secondary-700"
                            : "bg-accent-100 text-accent-700"
                        }`}
                      >
                        <i className={estTermine ? "ri-check-double-line" : p.icon}></i>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-semibold text-sm text-foreground-950 truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-foreground-500">
                          {lusParcours}/{totalParcours} étape{totalParcours > 1 ? "s" : ""}
                          {estActif ? " · parcours en cours de lecture" : ""}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold tabular-nums whitespace-nowrap ${
                          estTermine ? "text-secondary-700" : "text-foreground-700"
                        }`}
                      >
                        {pctParcours}%
                      </span>
                    </div>
                    <div className="mt-3 w-full h-1.5 rounded-full bg-background-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          estTermine ? "bg-secondary-500" : "bg-primary-500"
                        }`}
                        style={{ width: `${pctParcours}%` }}
                      ></div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}