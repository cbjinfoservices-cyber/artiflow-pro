import { Link } from "react-router-dom";
import BadgeNouveau from "@/components/base/BadgeNouveau";
import { categoriesNouveautes, nouveautes, niveauLabels } from "@/mocks/nouveautes";

const niveauPastille: Record<string, string> = {
  majeur: "bg-primary-500 text-background-50",
  amelioration: "bg-secondary-200 text-secondary-900",
  correctif: "bg-background-200 text-foreground-700",
};

function categorieLabel(key: string): string {
  const found = categoriesNouveautes.find((c) => c.key === key);
  return found ? found.label : key;
}

/** Les quatre dernières livraisons, lues directement dans le journal des nouveautés. */
const dernieres = nouveautes.slice(0, 4);

export default function NouveautesAccueil() {
  return (
    <section id="nouveautes" className="w-full bg-background-100 border-y border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 lg:gap-12">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
              <i className="ri-sparkling-2-line"></i>
              Nouveautés
            </span>
            <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
              Ce qu'on vient de livrer
            </h2>
            <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">
              Les fonctions arrivent du terrain : un artisan signale un manque, on le corrige, on le publie. Voici
              les quatre dernières, en clair.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-background-50 border border-background-200 text-xs font-semibold text-foreground-800">
                <i className="ri-git-commit-line text-primary-600"></i>
                {nouveautes.length} mises à jour publiées
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-background-50 border border-background-200 text-xs font-semibold text-foreground-800">
                <i className="ri-mail-check-line text-accent-600"></i>
                Suivi des emails clients renforcé
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                to="/nouveautes"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-article-line"></i>
                Voir le journal complet
              </Link>
              <a
                href="/nouveautes/rss.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                <i className="ri-rss-line"></i>
                S'abonner au flux RSS
              </a>
            </div>
          </div>

          <ol className="flex flex-col gap-3">
            {dernieres.map((n, index) => {
              const estDerniere = index === 0;
              return (
                <li key={n.id}>
                  <article
                    className={`rounded-lg border p-5 transition-colors ${
                      estDerniere
                        ? "bg-foreground-950 border-foreground-900"
                        : "bg-background-50 border-background-200 hover:border-primary-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${
                          estDerniere ? "bg-primary-500 text-background-50" : niveauPastille[n.niveau]
                        }`}
                      >
                        <i className={n.icon}></i>
                        {niveauLabels[n.niveau]}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap ${
                          estDerniere ? "text-background-200/80" : "text-foreground-500"
                        }`}
                      >
                        <i className="ri-calendar-line"></i>
                        {n.dateLabel}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap ${
                          estDerniere ? "text-background-200/60" : "text-foreground-400"
                        }`}
                      >
                        <i className="ri-git-commit-line"></i>v{n.version}
                      </span>
                      {estDerniere && (
                        <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-50/15 text-background-50 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                          <i className="ri-megaphone-line"></i>
                          Dernière livraison
                        </span>
                      )}
                    </div>

                    <h3
                      className={`mt-3 font-heading font-bold text-lg md:text-xl tracking-tight ${
                        estDerniere ? "text-background-50" : "text-foreground-950"
                      }`}
                    >
                      {n.title}
                    </h3>
                    <p
                      className={`mt-2 text-sm leading-relaxed ${
                        estDerniere ? "text-background-200/85" : "text-foreground-600"
                      }`}
                    >
                      {n.summary}
                    </p>

                    <ul className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                      {n.points.slice(0, 4).map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <i
                            className={`ri-check-line mt-0.5 text-sm ${
                              estDerniere ? "text-primary-400" : "text-accent-600"
                            }`}
                          ></i>
                          <span
                            className={`text-xs leading-snug ${
                              estDerniere ? "text-background-100/85" : "text-foreground-700"
                            }`}
                          >
                            {point}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        to={n.lien ?? "/nouveautes"}
                        className={`inline-flex items-center gap-2 text-xs font-semibold whitespace-nowrap cursor-pointer hover:gap-2.5 transition-all ${
                          estDerniere ? "text-primary-400" : "text-primary-700"
                        }`}
                      >
                        {n.lien ? n.lienLabel ?? "Lire l'annonce" : "Voir dans le journal"}
                        <i className="ri-arrow-right-line"></i>
                      </Link>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                          estDerniere
                            ? "bg-background-50/10 text-background-200"
                            : "bg-background-100 text-foreground-600"
                        }`}
                      >
                        <i className="ri-folder-line"></i>
                        {categorieLabel(n.categorie)}
                      </span>
                      <BadgeNouveau dateISO={n.dateIso} jours={14} />
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}