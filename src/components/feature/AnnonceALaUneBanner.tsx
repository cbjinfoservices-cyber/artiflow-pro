import { Link } from "react-router-dom";
import { estNouveau } from "@/lib/dates";
import { nouveautes } from "@/mocks/nouveautes";

type AnnonceALaUneBannerProps = {
  /** Identifiant de la nouveauté mise en avant (clé `id` dans les mocks). */
  id?: string;
  /** Seuil de fraîcheur en jours : la bannière disparaît au-delà. */
  jours?: number;
  /** Libellé du bouton d'action. */
  ctaLabel?: string;
  className?: string;
};

/**
 * Bannière « Annonce à la une » réutilisable : elle met en avant une nouveauté
 * datée tant qu'elle est fraîche (moins de 7 jours par défaut), puis disparaît
 * toute seule. Reprise sur l'accueil, le journal des nouveautés et la page Tarifs
 * pour prolonger l'annonce là où le visiteur défile.
 */
export default function AnnonceALaUneBanner({
  id = "personnalisation-documents",
  jours = 7,
  ctaLabel = "Lire l'annonce",
  className = "",
}: AnnonceALaUneBannerProps) {
  const annonce = nouveautes.find((n) => n.id === id);
  if (!annonce || !annonce.lien || !estNouveau(annonce.dateIso, jours)) return null;

  return (
    <Link
      to={annonce.lien}
      className={`group flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-lg bg-accent-950 text-background-50 hover:bg-accent-900 transition-colors ${className}`}
    >
      <span className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-accent-500 text-background-50 text-xl">
        <i className="ri-megaphone-line"></i>
      </span>
      <div className="flex-1">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-50/15 text-background-50 text-[10px] font-bold uppercase tracking-wide">
          <i className="ri-sparkling-2-line"></i>
          Annonce à la une
        </span>
        <h4 className="mt-2 font-heading font-semibold text-base md:text-lg">{annonce.title}</h4>
        <p className="mt-1 text-sm text-background-200/85 leading-relaxed">{annonce.summary}</p>
      </div>
      <span className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap group-hover:gap-3 transition-all">
        {ctaLabel}
        <i className="ri-arrow-right-line"></i>
      </span>
    </Link>
  );
}