import { Link } from "react-router-dom";
import { readingMinutes, CATEGORIES_GUIDES_PRATIQUES } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import { useLectureStatut } from "@/hooks/useLectureStatut";
import type { Article } from "@/components/feature/ArticleCard";

/** Carte compacte utilisée dans la barre latérale d'un guide (« À lire aussi »). */
export default function GuideLienCard({ article }: { article: Article }) {
  const metier = metiers.find((m) => m.slug === article.category);
  const catPratique = CATEGORIES_GUIDES_PRATIQUES[article.category];
  const nomCategorie = metier?.name ?? catPratique?.name ?? "Artisan";
  const imageCarte = metier?.cardImage ?? article.shareImage;
  const statut = useLectureStatut(article.slug);

  return (
    <Link
      to={article.href ?? `/ressources/${article.slug}`}
      className="group flex flex-col rounded-lg border border-background-200 bg-background-50 overflow-hidden hover:border-primary-300 transition-colors cursor-pointer"
    >
      <div className="relative w-full h-32 overflow-hidden bg-background-100">
        {imageCarte && (
          <img
            src={imageCarte}
            alt={`Guide ${nomCategorie} · ${article.title}`}
            title={`${article.title} · ArtiFlow-pro`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {statut !== "a-lire" && (
          <span
            className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
              statut === "lu"
                ? "bg-secondary-500 text-background-50"
                : "bg-accent-500 text-background-50"
            }`}
          >
            <i className={statut === "lu" ? "ri-check-double-line" : "ri-bookmark-line"}></i>
            {statut === "lu" ? "Lu" : "En cours"}
          </span>
        )}
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-background-50/95 text-foreground-900 text-[11px] font-semibold whitespace-nowrap">
          +{readingMinutes(article)} min
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs text-foreground-500">{nomCategorie}</p>
        <h3 className="mt-1.5 font-heading font-semibold text-sm text-foreground-950 leading-snug">
          {article.title}
        </h3>
      </div>
    </Link>
  );
}