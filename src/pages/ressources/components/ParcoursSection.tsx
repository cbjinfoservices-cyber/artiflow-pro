import { Link } from "react-router-dom";
import { parcours } from "@/mocks/parcours";
import { getStatut } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";

/**
 * Section « Parcours guidés » du hub : présente les collections ordonnées de
 * guides avec leur progression (étapes lues / total) et un bouton pour
 * commencer ou reprendre le parcours.
 */
export default function ParcoursSection() {
  const version = useLectureVersion();

  return (
    <section className="w-full bg-background-50 border-t border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
        <div className="mb-7">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
            <i className="ri-route-line"></i>
            Pas à pas
          </span>
          <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
            Parcours guidés
          </h2>
          <p className="mt-2 text-sm text-foreground-600 max-w-2xl">
            Des enchaînements de guides pensés pour progresser dans le bon ordre, du premier devis à la
            relance qui conclut.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {parcours.map((p) => {
            const lus = p.articleSlugs.filter((slug) => getStatut(slug) === "lu").length;
            const total = p.articleSlugs.length;
            const pct = total > 0 ? Math.round((lus / total) * 100) : 0;
            const commence = lus > 0;
            const termine = lus === total && total > 0;
            const prochaineSlug = p.articleSlugs.find((slug) => getStatut(slug) !== "lu") ?? p.articleSlugs[0];

            return (
              <article
                key={p.slug}
                className="flex flex-col p-6 rounded-lg bg-background-100 border border-background-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-xl">
                    <i className={p.icon}></i>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold whitespace-nowrap">
                    {p.niveau}
                  </span>
                </div>

                <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950 leading-snug">
                  {p.name}
                </h3>
                <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">{p.description}</p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-foreground-500 mb-1.5">
                    <span>
                      {lus}/{total} étape{total > 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold text-foreground-800 tabular-nums">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-background-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        termine ? "bg-secondary-500" : "bg-primary-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    to={`/ressources/parcours/${p.slug}`}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className={termine ? "ri-refresh-line" : commence ? "ri-play-line" : "ri-rocket-line"}></i>
                    {termine ? "Revoir" : commence ? "Continuer" : "Commencer"}
                  </Link>
                  <Link
                    to={`/ressources/${prochaineSlug}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-700 hover:text-primary-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-bookmark-3-line"></i>
                    Prochaine étape
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}