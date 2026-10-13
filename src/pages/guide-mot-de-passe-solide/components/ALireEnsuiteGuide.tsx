import { Link } from "react-router-dom";
import ArticleCard from "@/components/feature/ArticleCard";
import { articles } from "@/mocks/ressources";

/**
 * Guides Ressources proposés en fin de lecture du guide « Créer un mot de passe
 * solide ». On choisit un guide représentatif de chacun des grands thèmes
 * (devis, relances, organisation) pour donner à voir tout le catalogue.
 */
const GUIDES_SUGGERES = [
  "devis-chaudiere-en-5-minutes",
  "messages-relance-devis-electricite",
  "organiser-chantiers-par-zone",
];

/** Bloc « À lire ensuite » affiché en bas de la page du guide de sécurité. */
export default function ALireEnsuiteGuide() {
  const selection = GUIDES_SUGGERES.map((slug) => articles.find((a) => a.slug === slug)).filter(
    (article): article is (typeof articles)[number] => Boolean(article)
  );

  if (selection.length === 0) return null;

  return (
    <section className="w-full bg-background-100 border-t border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
              <i className="ri-book-open-line"></i>
              À lire ensuite
            </span>
            <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
              Poursuivez avec nos guides pratiques
            </h2>
            <p className="mt-2 text-sm text-foreground-600 leading-relaxed max-w-2xl">
              Des guides courts, tirés de situations réelles de chantier, pour aller plus loin sur le devis,
              les relances clients et l'organisation.
            </p>
          </div>
          <Link
            to="/ressources"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors self-start sm:self-auto"
          >
            <i className="ri-book-open-line"></i>
            Toutes les ressources
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {selection.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}