import { Link } from "react-router-dom";
import { parcours } from "@/mocks/parcours";
import { articles } from "@/mocks/ressources";
import { getStatut } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";

/**
 * Bloc affiché en bas d'un guide appartenant à un ou plusieurs parcours guidés :
 * propose d'enchaîner directement sur la prochaine étape non lue, sans revenir
 * à la liste. Si tout le reste du parcours est déjà lu, on propose de le revoir.
 */
export default function EtapeSuivanteParcours({ slug }: { slug: string }) {
  useLectureVersion();

  const titres = new Map(articles.map((a) => [a.slug, a.title]));
  const parcoursDuGuide = parcours.filter((p) => p.articleSlugs.includes(slug));

  if (parcoursDuGuide.length === 0) return null;

  const blocs = parcoursDuGuide.map((p) => {
    const etapes = p.articleSlugs.filter((s) => titres.has(s));
    const position = etapes.indexOf(slug);
    // On repart de l'étape juste après le guide courant, puis on boucle au début.
    const apres = position >= 0 ? [...etapes.slice(position + 1), ...etapes.slice(0, position)] : etapes;
    const suivante = apres.find((s) => getStatut(s) !== "lu");
    const lues = etapes.filter((s) => getStatut(s) === "lu").length;
    const pct = etapes.length > 0 ? Math.round((lues / etapes.length) * 100) : 0;
    const termine = etapes.length > 0 && lues === etapes.length;
    return {
      parcours: p,
      lues,
      total: etapes.length,
      pct,
      termine,
      suivante,
      suivanteTitre: suivante ? titres.get(suivante) : undefined,
    };
  });

  return (
    <section
      aria-label="Parcours guidé"
      className="mt-8 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200"
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
          <i className="ri-route-line"></i>
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">
            Continuer dans le parcours
          </p>
          <h2 className="font-heading font-semibold text-base text-foreground-950">
            {blocs.length > 1 ? "Ce guide fait partie de plusieurs parcours" : "L'étape d'après vous attend"}
          </h2>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {blocs.map((b) => (
          <li
            key={b.parcours.slug}
            className="p-4 rounded-md bg-background-50 border border-background-200"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700 text-base">
                  <i className={b.termine ? "ri-check-double-line" : b.parcours.icon}></i>
                </span>
                <div className="min-w-0">
                  <Link
                    to={`/ressources/parcours/${b.parcours.slug}`}
                    className="font-heading font-semibold text-sm text-foreground-950 hover:text-primary-700 transition-colors cursor-pointer"
                  >
                    {b.parcours.name}
                  </Link>
                  <p className="text-xs text-foreground-500 tabular-nums">
                    {b.lues}/{b.total} étape{b.total > 1 ? "s" : ""} lue{b.lues > 1 ? "s" : ""}
                    {" · "}
                    {b.pct}%
                  </p>
                </div>
              </div>

              {b.suivante ? (
                <Link
                  to={`/ressources/${b.suivante}`}
                  title={b.suivanteTitre ? `Lire « ${b.suivanteTitre} »` : "Lire l'étape suivante"}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-play-circle-line"></i>
                  Aller à l'étape suivante non lue
                  <i className="ri-arrow-right-line"></i>
                </Link>
              ) : (
                <Link
                  to={`/ressources/parcours/${b.parcours.slug}`}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
                >
                  <i className="ri-refresh-line"></i>
                  Revoir le parcours
                </Link>
              )}
            </div>

            <div className="mt-3 w-full h-1.5 rounded-full bg-background-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  b.termine ? "bg-secondary-500" : "bg-primary-500"
                }`}
                style={{ width: `${b.pct}%` }}
              ></div>
            </div>

            <p className="mt-2.5 text-xs text-foreground-500 leading-relaxed">
              {b.suivante ? (
                <>
                  Étape suivante :{" "}
                  <span className="font-semibold text-foreground-800">{b.suivanteTitre}</span>
                </>
              ) : (
                "Toutes les autres étapes de ce parcours sont déjà lues."
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}