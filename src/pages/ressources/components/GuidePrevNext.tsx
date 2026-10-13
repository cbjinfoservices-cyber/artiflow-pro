import { Link } from "react-router-dom";

export type GuideNavItem = { slug: string; title: string };

type GuidePrevNextProps = {
  prev?: GuideNavItem;
  next?: GuideNavItem;
};

/**
 * Navigation « Guide précédent / suivant » affichée en bas de chaque guide
 * pour enchaîner la lecture dans l'ordre du catalogue.
 */
export default function GuidePrevNext({ prev, next }: GuidePrevNextProps) {
  if (!prev && !next) return null;

  return (
    <nav aria-label="Navigation entre les guides" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {prev ? (
        <Link
          to={`/ressources/${prev.slug}`}
          className="group flex items-start gap-3 p-5 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
        >
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-background-100 text-foreground-700 text-base group-hover:bg-primary-100 group-hover:text-primary-700 transition-colors">
            <i className="ri-arrow-left-line"></i>
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground-500">
              Guide précédent
            </span>
            <span className="mt-1 font-heading font-semibold text-sm text-foreground-950 leading-snug">
              {prev.title}
            </span>
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" aria-hidden="true" />
      )}

      {next ? (
        <Link
          to={`/ressources/${next.slug}`}
          className="group flex items-start gap-3 p-5 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer sm:flex-row-reverse sm:text-right"
        >
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-background-100 text-foreground-700 text-base group-hover:bg-primary-100 group-hover:text-primary-700 transition-colors">
            <i className="ri-arrow-right-line"></i>
          </span>
          <span className="flex flex-col min-w-0 sm:items-end">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground-500">
              Guide suivant
            </span>
            <span className="mt-1 font-heading font-semibold text-sm text-foreground-950 leading-snug">
              {next.title}
            </span>
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" aria-hidden="true" />
      )}
    </nav>
  );
}