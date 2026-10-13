import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { articles, readingMinutes } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import { useLectureStatut } from "@/hooks/useLectureStatut";
import { useFavori } from "@/hooks/useBibliotheque";
import { ecrireNote, getNote, togglerFavori } from "@/lib/bibliotheque";
import HighlightTerm from "@/components/base/HighlightTerm";

const NOTE_MAX = 2000;

const STATUT_LABEL: Record<string, string> = {
  lu: "Lu",
  "en-cours": "En cours",
  "a-lire": "À lire",
};

/**
 * Carte d'édition rapide d'une note personnelle : la note reste attachée au
 * guide, l'enregistrement est automatique (léger différé après la frappe) et
 * elle peut être supprimée sans quitter la page. Le titre du guide est
 * cliquable pour ouvrir le guide complet.
 */
export default function NoteEditCard({ slug, highlight }: { slug: string; highlight?: string }) {
  const article = articles.find((a) => a.slug === slug);
  const statut = useLectureStatut(slug);
  const favori = useFavori(slug);
  const [texte, setTexte] = useState(() => getNote(slug));
  const [etat, setEtat] = useState<"idle" | "saved">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setTexte(getNote(slug));
    setEtat("idle");
  }, [slug]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  if (!article) return null;

  const metier = metiers.find((m) => m.slug === article.category);

  const onChange = (valeur: string) => {
    const v = valeur.slice(0, NOTE_MAX);
    setTexte(v);
    setEtat("idle");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      ecrireNote(slug, v);
      setEtat("saved");
    }, 600);
  };

  const supprimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    ecrireNote(slug, "");
  };

  return (
    <article className="flex flex-col rounded-lg border border-background-200 bg-background-50 p-5">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-lg">
          <i className="ri-sticky-note-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-base text-foreground-950 leading-snug">
            <Link
              to={`/ressources/${article.slug}`}
              className="hover:text-primary-700 cursor-pointer"
            >
              <HighlightTerm text={article.title} term={highlight} />
            </Link>
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-tools-line"></i>
              {metier ? metier.name : "Artisan"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-time-line"></i>
              {readingMinutes(article)} min
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                statut === "lu"
                  ? "bg-secondary-100 text-secondary-900"
                  : statut === "en-cours"
                    ? "bg-accent-100 text-accent-900"
                    : "bg-background-100 text-foreground-600"
              }`}
            >
              <i
                className={
                  statut === "lu"
                    ? "ri-check-double-line"
                    : statut === "en-cours"
                      ? "ri-bookmark-line"
                      : "ri-bookmark-line"
                }
              ></i>
              {STATUT_LABEL[statut]}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => togglerFavori(article.slug)}
          aria-label={favori ? `Retirer « ${article.title} » des favoris` : `Ajouter « ${article.title} » aux favoris`}
          title={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
          className={`w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-md whitespace-nowrap cursor-pointer border transition-colors ${
            favori
              ? "bg-accent-100 text-accent-700 border-accent-200 hover:bg-accent-200"
              : "bg-background-50 text-foreground-600 border-background-200 hover:border-accent-300 hover:text-accent-700"
          }`}
        >
          <i className={favori ? "ri-bookmark-3-fill" : "ri-bookmark-3-line"}></i>
        </button>
      </div>

      <textarea
        value={texte}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={NOTE_MAX}
        placeholder="Notez une astuce, un chiffre ou un fournisseur pour ce guide…"
        className="mt-4 w-full p-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-y"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500">
          {etat === "saved" ? (
            <>
              <i className="ri-check-line text-secondary-600"></i>
              Enregistré
            </>
          ) : (
            <>
              <i className="ri-save-line"></i>
              Enregistrement automatique
            </>
          )}
          <span className="text-foreground-400 tabular-nums">
            {texte.length}/{NOTE_MAX}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/ressources/${article.slug}`}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className="ri-book-open-line"></i>
            Ouvrir le guide
          </Link>
          <button
            type="button"
            onClick={supprimer}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
          >
            <i className="ri-delete-bin-6-line"></i>
            Supprimer la note
          </button>
        </div>
      </div>
    </article>
  );
}