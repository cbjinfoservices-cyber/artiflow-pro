import { Link } from "react-router-dom";
import { parcours } from "@/mocks/parcours";
import { articles } from "@/mocks/ressources";
import { getStatut } from "@/lib/lecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";

/**
 * Rappel de progression des parcours guidés dans le tableau de bord : où en est
 * la lecture, quelle étape reprendre, et un accès direct à chaque parcours.
 * La progression est déduite du suivi de lecture local, comme sur /ressources.
 */
export default function RappelParcoursCard() {
  useLectureVersion();

  const titres = new Map(articles.map((a) => [a.slug, a.title]));
  const slugsConnus = new Set(articles.map((a) => a.slug));

  const details = parcours.map((p) => {
    const etapes = p.articleSlugs.filter((slug) => slugsConnus.has(slug));
    const lues = etapes.filter((slug) => getStatut(slug) === "lu").length;
    const total = etapes.length;
    const pct = total > 0 ? Math.round((lues / total) * 100) : 0;
    const suivante = etapes.find((slug) => getStatut(slug) !== "lu");
    return { parcours: p, lues, total, pct, suivante, termine: total > 0 && lues === total };
  });

  const tousLesSlugs = Array.from(
    new Set(details.flatMap((d) => d.parcours.articleSlugs.filter((slug) => slugsConnus.has(slug))))
  );
  const totalGlobal = tousLesSlugs.length;
  const lusGlobal = tousLesSlugs.filter((slug) => getStatut(slug) === "lu").length;
  const pctGlobal = totalGlobal > 0 ? Math.round((lusGlobal / totalGlobal) * 100) : 0;
  const toutTermine = totalGlobal > 0 && lusGlobal === totalGlobal;

  // Parcours à mettre en avant : celui commencé mais pas fini (le plus avancé),
  // sinon un parcours pas encore entamé, sinon le premier.
  const enCours = details
    .filter((d) => d.lues > 0 && !d.termine)
    .sort((a, b) => b.pct - a.pct);
  const aCommencer = details.filter((d) => d.lues === 0);
  const principal = enCours[0] ?? aCommencer[0] ?? details[0];
  const prochaine = principal?.suivante ? titres.get(principal.suivante) : undefined;

  return (
    <div className="p-4 md:p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-xl ${
              toutTermine ? "bg-secondary-100 text-secondary-700" : "bg-accent-100 text-accent-700"
            }`}
          >
            <i className={toutTermine ? "ri-check-double-line" : "ri-route-line"}></i>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">
              Parcours guidés
            </p>
            <p className="font-heading font-bold text-lg text-foreground-950 leading-tight">
              {lusGlobal}/{totalGlobal} guides lus
              <span className="ml-2 text-sm font-semibold text-foreground-600 tabular-nums">
                {pctGlobal}%
              </span>
            </p>
            <p className="mt-1 text-xs text-foreground-600">
              {toutTermine
                ? "Tous les parcours sont terminés. Beau travail."
                : "Reprenez là où vous vous êtes arrêté, sans rechercher le guide."}
            </p>
          </div>
        </div>
        <Link
          to="/ressources#parcours"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-800 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
        >
          <i className="ri-layout-grid-line"></i>
          Tous les parcours
        </Link>
      </div>

      <div className="mt-4 w-full h-2 rounded-full bg-background-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            toutTermine ? "bg-secondary-500" : "bg-primary-500"
          }`}
          style={{ width: `${pctGlobal}%` }}
        ></div>
      </div>

      {principal && (
        <div className="mt-4 p-3 rounded-md bg-background-50 border border-background-200 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
              {principal.lues > 0 && !principal.termine
                ? "Reprendre"
                : principal.termine
                  ? "Parcours terminé"
                  : "Pour commencer"}
            </p>
            <p className="font-heading font-semibold text-sm text-foreground-950 truncate">
              {principal.parcours.name}
            </p>
            <p className="mt-0.5 text-xs text-foreground-600 truncate">
              {principal.suivante && prochaine ? (
                <>
                  Étape suivante : <span className="font-semibold text-foreground-800">{prochaine}</span>
                </>
              ) : (
                "Toutes les étapes de ce parcours sont lues."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {principal.suivante && (
              <Link
                to={`/ressources/${principal.suivante}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-play-circle-line"></i>
                Aller à l'étape suivante
              </Link>
            )}
            <Link
              to={`/ressources/parcours/${principal.parcours.slug}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-800 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              <i className="ri-route-line"></i>
              Voir le parcours
            </Link>
          </div>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-2">
        {details.slice(0, 4).map((d) => (
          <li key={d.parcours.slug}>
            <Link
              to={`/ressources/parcours/${d.parcours.slug}`}
              title={`${d.parcours.name} — ${d.lues}/${d.total} étapes lues`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-secondary-300 hover:text-secondary-800 transition-colors"
            >
              <i className={d.termine ? "ri-check-double-line text-secondary-700" : d.parcours.icon}></i>
              {d.parcours.name}
              <span className="text-foreground-500 tabular-nums">
                {d.lues}/{d.total}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}