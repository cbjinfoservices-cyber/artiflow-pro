import { Link } from "react-router-dom";
import { nouveautes } from "@/mocks/nouveautes";
import { useQuoiDeNeuf } from "@/hooks/useQuoiDeNeuf";

/** Les trois dernières livraisons, la plus récente en tête. */
const dernieres = [...nouveautes]
  .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
  .slice(0, 3);

/**
 * Petit bandeau « Quoi de neuf » affiché dans l'espace artisan, juste au-dessus du contenu.
 * Il signale la dernière fonction livrée aux utilisateurs déjà connectés, avec un accès
 * direct à l'annonce détaillée et au journal public.
 *
 * Il ne réapparaît pas après avoir été fermé, sauf si une nouvelle version sort : la version
 * mémorisée change alors, et le bandeau se remontre une fois.
 *
 * La mémoire de lecture est partagée avec le compteur de l'en-tête et le bloc de la cloche :
 * fermer le bandeau fait donc tomber le compteur dans le même geste.
 */
export default function BandeauQuoiDeNeuf() {
  const { versionVue, derniere, marquerToutVu } = useQuoiDeNeuf();
  // Le bandeau est masqué dès que la dernière version a été vue (fermeture précédente).
  const masque = versionVue === derniere.version;

  if (masque) return null;

  const fermer = () => marquerToutVu();

  const autres = dernieres.length - 1;

  return (
    <div className="mb-4 rounded-lg border border-accent-200 bg-accent-50">
      <div className="flex items-start gap-3 p-3.5 md:p-4">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
          <i className="ri-megaphone-line"></i>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-accent-800">Quoi de neuf</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
              <i className="ri-git-commit-line"></i>v{derniere.version}
            </span>
            <span className="text-[11px] text-accent-800/80 whitespace-nowrap">{derniere.dateLabel}</span>
          </div>

          <p className="mt-1 text-sm font-semibold text-accent-900 leading-snug">{derniere.title}</p>
          <p className="mt-0.5 hidden sm:block text-xs text-accent-800/90 leading-relaxed">{derniere.summary}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {derniere.lien && (
              <Link
                to={derniere.lien}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
              >
                <i className="ri-eye-line"></i>
                Voir l'annonce
              </Link>
            )}
            <Link
              to="/nouveautes"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-200 text-accent-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-400 transition-colors"
            >
              <i className="ri-article-line"></i>
              Tout le journal
            </Link>
            {autres > 0 && (
              <span className="text-[11px] text-accent-800/80 whitespace-nowrap">
                + {autres} autre{autres > 1 ? "s" : ""} nouveauté{autres > 1 ? "s" : ""} récente{autres > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={fermer}
          title="Masquer ce bandeau jusqu'à la prochaine nouveauté"
          aria-label="Masquer le bandeau Quoi de neuf"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-accent-600 hover:bg-accent-100 cursor-pointer transition-colors"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    </div>
  );
}