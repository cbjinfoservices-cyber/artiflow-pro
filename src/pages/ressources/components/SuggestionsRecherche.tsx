import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { articles, formatLecture } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import HighlightTerm from "@/components/base/HighlightTerm";

/**
 * Suggestions en direct sous la barre de recherche : propose les guides dont le
 * titre correspond à la frappe. Le terme recherché y est surligné.
 */
export default function SuggestionsRecherche({
  recherche,
  onPick,
}: {
  recherche: string;
  onPick?: () => void;
}) {
  const navigate = useNavigate();
  const ref = useRef<HTMLUListElement>(null);
  const [ferme, setFerme] = useState(false);
  const q = recherche.trim().toLowerCase();

  const matches = useMemo(() => {
    if (q.length < 2) return [];
    return articles.filter((a) => a.title.toLowerCase().includes(q)).slice(0, 6);
  }, [q]);

  useEffect(() => {
    setFerme(false);
  }, [q]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFerme(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFerme(true);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (q.length < 2 || matches.length === 0 || ferme) return null;

  return (
    <ul
      ref={ref}
      className="absolute left-0 right-0 top-full z-50 mt-2 p-1.5 rounded-lg bg-background-50 border border-background-200 max-h-80 overflow-y-auto"
    >
      <li className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
        Suggestions
      </li>
      {matches.map((article) => {
        const metier = metiers.find((m) => m.slug === article.category);
        return (
          <li key={article.slug}>
            <button
              type="button"
              onClick={() => {
                setFerme(true);
                navigate(`/ressources/${article.slug}`);
                onPick?.();
              }}
              className="w-full flex items-start gap-3 p-2.5 rounded-md text-left cursor-pointer hover:bg-background-100 transition-colors"
            >
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-background-100 text-foreground-600 text-base">
                <i className="ri-article-line"></i>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground-900 leading-snug">
                  <HighlightTerm text={article.title} term={recherche} />
                </span>
                <span className="block text-xs text-foreground-500 mt-0.5">
                  {metier ? metier.name : "Artisan"} · {formatLecture(article)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}