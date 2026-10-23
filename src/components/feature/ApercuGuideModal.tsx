import { useEffect } from "react";
import { Link } from "react-router-dom";
import { formatDateLongue } from "@/lib/dates";

export type GuideApercu = {
  slug: string;
  title: string;
  excerpt: string;
  href?: string;
  sections: { title: string; body: string[] }[];
};

/**
 * Aperçu rapide d'un guide révisé, ouvert directement depuis sa carte.
 * Objectif : relire la structure et les premiers paragraphes d'une version
 * mise à jour sans quitter la liste des ressources.
 */
export default function ApercuGuideModal({
  guide,
  categorie,
  miseAJour,
  onClose,
}: {
  guide: GuideApercu;
  categorie: string;
  miseAJour: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const surTouche = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", surTouche);
    const overflowInitial = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = overflowInitial;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`apercu-guide-${guide.slug}`}
    >
      <button
        type="button"
        aria-label="Fermer l'aperçu"
        onClick={onClose}
        className="absolute inset-0 bg-foreground-950/60 backdrop-blur-sm cursor-pointer"
      ></button>

      <div className="relative w-full sm:max-w-2xl max-h-[88vh] flex flex-col rounded-t-lg sm:rounded-lg bg-background-50 border border-background-200 overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-5 md:px-6 pt-5 pb-4 border-b border-background-200 bg-background-100">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                {categorie}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-900 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-history-line"></i>
                Révisé le {formatDateLongue(miseAJour)}
              </span>
            </div>
            <h2
              id={`apercu-guide-${guide.slug}`}
              className="mt-3 font-heading font-semibold text-lg md:text-xl text-foreground-950 leading-snug"
            >
              {guide.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-background-50 border border-background-200 text-foreground-600 hover:text-foreground-950 hover:border-foreground-300 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="px-5 md:px-6 py-5 overflow-y-auto">
          <p className="text-sm text-foreground-600 leading-relaxed">{guide.excerpt}</p>

          <h3 className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-list-check-2 text-secondary-600"></i>
            Ce que contient cette version
          </h3>

          <ol className="mt-3 flex flex-col gap-3">
            {guide.sections.map((section, index) => {
              const extrait = section.body[0] ?? "";
              return (
                <li
                  key={section.title}
                  className="flex gap-3 p-4 rounded-md bg-background-100 border border-background-200"
                >
                  <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-900 text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-heading font-semibold text-sm text-foreground-950 leading-snug">
                      {section.title}
                    </p>
                    {extrait && (
                      <p className="mt-1 text-xs text-foreground-600 leading-relaxed line-clamp-2">
                        {extrait}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="px-5 md:px-6 py-4 border-t border-background-200 bg-background-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500">
            <i className="ri-information-line"></i>
            Aperçu de lecture rapide — le texte intégral reste sur la page du guide.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              Fermer
            </button>
            <Link
              to={guide.href ?? `/ressources/${guide.slug}`}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-book-open-line"></i>
              Lire la version complète
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}