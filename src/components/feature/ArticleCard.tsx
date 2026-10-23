import { useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { metiers } from "@/mocks/metiers";
import { CATEGORIES_GUIDES_PRATIQUES, formatLecture, isNouveauArticle } from "@/mocks/ressources";
import { getGuideMiseAJour } from "@/mocks/guidesMiseAJour";
import { formatDateLongue } from "@/lib/dates";
import { useLectureStatut } from "@/hooks/useLectureStatut";
import { useFavori } from "@/hooks/useBibliotheque";
import { aUneNote, togglerFavori } from "@/lib/bibliotheque";
import { marquerCommeLu, marquerCommeNonLu } from "@/lib/lecture";
import HighlightTerm from "@/components/base/HighlightTerm";
import ApercuGuideModal from "@/components/feature/ApercuGuideModal";

export type Article = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date: string;
  sections: { title: string; body: string[] }[];
  /** Visuel de partage, utilisé quand le guide n'a pas de métier associé. */
  shareImage?: string;
  /** Adresse canonique quand le guide vit sur sa propre page. */
  href?: string;
};

export default function ArticleCard({
  article,
  showMarquerLu = false,
  highlight,
  draggable = false,
  dragging = false,
  dragOver = false,
  highlighted = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  article: Article;
  showMarquerLu?: boolean;
  highlight?: string;
  draggable?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  highlighted?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  const metier = metiers.find((m) => m.slug === article.category);
  const catPratique = CATEGORIES_GUIDES_PRATIQUES[article.category];
  const nomCategorie = metier?.name ?? catPratique?.name ?? "Artisan";
  const imageCarte = metier?.cardImage ?? article.shareImage;
  const statut = useLectureStatut(article.slug);
  const favori = useFavori(article.slug);
  const note = aUneNote(article.slug);
  const lu = statut === "lu";
  const nouveau = isNouveauArticle(article);
  const miseAJour = getGuideMiseAJour(article.slug);
  const [apercuOuvert, setApercuOuvert] = useState(false);

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group flex flex-col rounded-lg border bg-background-50 overflow-hidden transition-colors ${
        dragOver ? "border-primary-400 ring-2 ring-primary-200" : "border-background-200 hover:border-primary-300"
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-50" : ""} ${
        highlighted ? "animate-retour-highlight" : ""
      }`}
    >
      <div className="relative w-full h-44 overflow-hidden bg-background-100">
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
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background-50/95 text-foreground-900 text-[11px] font-semibold">
          {nomCategorie}
        </span>
        {draggable && (
          <span
            className="absolute bottom-3 right-3 w-7 h-7 flex items-center justify-center rounded-md bg-background-50/95 text-foreground-700 text-base border border-background-200 group-hover:animate-wiggle group-hover:border-primary-300 group-hover:text-primary-700"
            title="Glisser pour réordonner"
            aria-hidden="true"
          >
            <i className="ri-drag-move-2-line"></i>
          </span>
        )}
        {statut !== "a-lire" && (
          <span
            className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
              statut === "lu"
                ? "bg-secondary-500 text-background-50"
                : "bg-accent-500 text-background-50"
            }`}
          >
            <i className={statut === "lu" ? "ri-check-double-line" : "ri-bookmark-line"}></i>
            {statut === "lu" ? "Lu" : "En cours"}
          </span>
        )}
        {nouveau && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-sparkling-2-line"></i>
            Nouveau
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1 p-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-500">
          <span className="inline-flex items-center gap-1">
            <i className="ri-time-line"></i>
            {formatLecture(article)}
          </span>
          <span>{article.date}</span>
          {miseAJour && (
            <span
              className="inline-flex items-center gap-1"
              title={`Dernière mise à jour le ${formatDateLongue(miseAJour)}`}
            >
              <i className="ri-history-line"></i>
              Mis à jour le {formatDateLongue(miseAJour)}
            </span>
          )}
          {note && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-900 font-semibold whitespace-nowrap"
              title="Vous avez une note sur ce guide"
            >
              <i className="ri-sticky-note-line"></i>
              Note
            </span>
          )}
        </div>
        <h3 className="mt-3 font-heading font-semibold text-base text-foreground-950 leading-snug">
          <HighlightTerm text={article.title} term={highlight} />
        </h3>
        <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">
          <HighlightTerm text={article.excerpt} term={highlight} />
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            to={article.href ?? `/ressources/${article.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
          >
            Lire le guide
            <i className="ri-arrow-right-line"></i>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {miseAJour && (
              <button
                type="button"
                onClick={() => setApercuOuvert(true)}
                aria-label={`Voir l'aperçu du guide révisé : ${article.title}`}
                title={`Voir l'aperçu de la version révisée du ${formatDateLongue(miseAJour)}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border bg-accent-100 text-accent-900 border-accent-200 hover:bg-accent-200 transition-colors"
              >
                <i className="ri-eye-line"></i>
                Voir l'aperçu
              </button>
            )}
            <button
              type="button"
              onClick={() => togglerFavori(article.slug)}
              aria-label={favori ? `Retirer « ${article.title} » des favoris` : `Ajouter « ${article.title} » aux favoris`}
              title={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
              className={`w-8 h-8 inline-flex items-center justify-center rounded-full whitespace-nowrap cursor-pointer border transition-colors ${
                favori
                  ? "bg-accent-100 text-accent-700 border-accent-200 hover:bg-accent-200"
                  : "bg-background-50 text-foreground-600 border-background-200 hover:border-accent-300 hover:text-accent-700"
              }`}
            >
              <i className={favori ? "ri-bookmark-3-fill" : "ri-bookmark-3-line"}></i>
            </button>
            {showMarquerLu && (
              <button
                type="button"
                onClick={() => (lu ? marquerCommeNonLu(article.slug) : marquerCommeLu(article.slug))}
                aria-label={lu ? `Annuler le marqueur lu pour ${article.title}` : `Marquer comme lu : ${article.title}`}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                  lu
                    ? "bg-secondary-100 text-secondary-900 border-secondary-200 hover:bg-secondary-200"
                    : "bg-background-50 text-foreground-700 border-background-200 hover:border-secondary-300 hover:text-secondary-700"
                }`}
              >
                <i className={lu ? "ri-check-double-line" : "ri-check-line"}></i>
                {lu ? "Lu" : "Marquer lu"}
              </button>
            )}
          </div>
        </div>
      </div>
      {apercuOuvert && miseAJour && (
        <ApercuGuideModal
          guide={article}
          categorie={nomCategorie}
          miseAJour={miseAJour}
          onClose={() => setApercuOuvert(false)}
        />
      )}
    </article>
  );
}