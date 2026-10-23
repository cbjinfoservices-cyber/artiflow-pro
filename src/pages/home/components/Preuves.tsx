import { Link } from "react-router-dom";
import AnnonceALaUneBanner from "@/components/feature/AnnonceALaUneBanner";
import BadgeNouveau from "@/components/base/BadgeNouveau";
import { testimonials } from "@/mocks/landing";
import { niveauLabels, nouveautes, type NiveauNouveaute } from "@/mocks/nouveautes";

const niveauTone: Record<NiveauNouveaute, string> = {
  majeur: "bg-accent-100 text-accent-800",
  amelioration: "bg-primary-100 text-primary-700",
  correctif: "bg-secondary-100 text-secondary-800",
};

/**
 * Section « preuves sociales » : les avis d'artisans et, juste en dessous,
 * les deux dernières nouveautés produit réunies dans un même bloc pour condenser la page.
 */
export default function Preuves() {
  const dernieres = nouveautes.slice(0, 2);

  return (
    <section id="avis" className="w-full bg-background-100 border-y border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-heart-3-line"></i>
            Ils l'utilisent tous les jours
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Des artisans qui ont arrêté de travailler le soir
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((item) => (
            <figure key={item.name} className="flex flex-col p-5 rounded-lg bg-background-50 border border-background-200">
              <div className="flex items-center gap-0.5 text-primary-500">
                {Array.from({ length: item.rating }).map((_, i) => (
                  <i key={i} className="ri-star-fill text-sm"></i>
                ))}
              </div>
              <blockquote className="flex-1 mt-3 text-sm text-foreground-700 leading-relaxed">« {item.quote} »</blockquote>
              <figcaption className="mt-4 flex items-center gap-3 pt-4 border-t border-background-200">
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                  <img
                    src={item.avatar}
                    alt={`Portrait de ${item.name}, ${item.role} — avis client sur ArtiFlow-pro`}
                    title={`${item.name}, ${item.role} - avis sur ArtiFlow-pro`}
                    width={128}
                    height={128}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground-950">{item.name}</p>
                  <p className="text-xs text-foreground-500">{item.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-9 pt-6 border-t border-background-200">
          <AnnonceALaUneBanner className="mb-6" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h3 className="font-heading font-semibold text-lg text-foreground-950 flex items-center gap-2">
              <i className="ri-sparkling-2-line text-primary-600"></i>
              Le produit avance, vous le voyez
            </h3>
            <Link
              to="/nouveautes"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all whitespace-nowrap cursor-pointer"
            >
              Voir le journal complet
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dernieres.map((n) => (
              <article key={n.id} className="p-5 rounded-lg bg-background-50 border border-background-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground-950 text-background-50 text-[11px] font-bold whitespace-nowrap">
                    <i className="ri-git-commit-line"></i>
                    v{n.version}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${niveauTone[n.niveau]}`}>
                    {niveauLabels[n.niveau]}
                  </span>
                  <BadgeNouveau dateISO={n.dateIso} jours={7} />
                  <time dateTime={n.dateIso} className="ml-auto text-xs text-foreground-500 whitespace-nowrap">
                    {n.dateLabel}
                  </time>
                </div>
                <h4 className="mt-3 font-heading font-semibold text-base text-foreground-950">{n.title}</h4>
                <p className="mt-1 text-sm text-foreground-600 leading-relaxed line-clamp-2">{n.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}