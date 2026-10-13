import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  clearPosition,
  getPosition,
  isLu,
  marquerCommeLu,
  marquerCommeNonLu,
  setPosition,
} from "@/lib/lecture";
import { useLectureStatut } from "@/hooks/useLectureStatut";

export type ArticleSommaireSection = { id: string; label: string };
export type ArticleSommaireLien = { slug: string; title: string; minutes?: number };

/** Lien vers un guide lié, avec sa pastille de statut de lecture. */
function GuideLienStatut({ lien }: { lien: ArticleSommaireLien }) {
  const statut = useLectureStatut(lien.slug);
  const badge =
    statut === "lu"
      ? { label: "Lu", icon: "ri-check-double-line", className: "bg-secondary-100 text-secondary-900" }
      : statut === "en-cours"
        ? { label: "En cours", icon: "ri-bookmark-line", className: "bg-accent-100 text-accent-900" }
        : null;

  return (
    <Link
      to={`/ressources/${lien.slug}`}
      className="group flex items-start gap-2 text-sm text-foreground-700 hover:text-foreground-950 cursor-pointer"
    >
      <i className="ri-links-line mt-0.5 text-secondary-600"></i>
      <span className="leading-snug flex-1">{lien.title}</span>
      {badge && (
        <span
          className={`shrink-0 mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${badge.className}`}
        >
          <i className={badge.icon}></i>
          {badge.label}
        </span>
      )}
      {typeof lien.minutes === "number" && (
        <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap">
          +{lien.minutes} min
        </span>
      )}
    </Link>
  );
}

type ArticleSommaireProps = {
  sections: ArticleSommaireSection[];
  related: ArticleSommaireLien[];
  /** Minutes estimées par section (même ordre que `sections`) pour le temps restant. */
  sectionMinutes?: number[];
  /** Slug du guide, pour mémoriser la dernière section lue. */
  guideSlug?: string;
};

/**
 * Sommaire interne d'un guide : navigue entre les sections de l'article
 * (ancres partageables), indique le temps de lecture restant, propose des
 * rebonds vers les guides liés et permet de reprendre la lecture là où
 * l'utilisateur s'était arrêté ou de marquer le guide comme lu.
 */
export default function ArticleSommaire({
  sections,
  related,
  sectionMinutes,
  guideSlug,
}: ArticleSommaireProps) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [resume, setResume] = useState<{ id: string; label: string } | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [lu, setLu] = useState(false);
  const skipFirstPersist = useRef(false);

  // Propose de reprendre la lecture là où l'utilisateur s'était arrêté.
  // L'ancre présente dans l'URL reste prioritaire.
  useEffect(() => {
    if (!guideSlug) return;
    setLu(isLu(guideSlug));
    const firstId = sections[0]?.id ?? "";
    const saved = getPosition(guideSlug);
    setHasSaved(Boolean(saved));
    const hash = window.location.hash.replace("#", "");
    if (hash && sections.some((section) => section.id === hash)) {
      setResume(null);
      return;
    }
    if (!saved || saved === firstId) {
      setResume(null);
      return;
    }
    const target = sections.find((section) => section.id === saved);
    setResume(target ? { id: target.id, label: target.label } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideSlug]);

  // Ouvre directement la bonne section si l'URL contient déjà une ancre
  useEffect(() => {
    const ids = sections.map((section) => section.id);
    const hash = window.location.hash.replace("#", "");
    if (!hash || !ids.includes(hash)) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 160);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mémorise la dernière section lue (on ignore le calcul initial pour ne pas
  // écraser une section mémorisée lors d'une visite précédente, et on n'enregistre
  // pas la première section pour laisser le guide en « à lire »).
  useEffect(() => {
    if (!guideSlug || !active) return;
    if (!skipFirstPersist.current) {
      skipFirstPersist.current = true;
      return;
    }
    if (active === (sections[0]?.id ?? "")) return;
    setPosition(guideSlug, active);
    setHasSaved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideSlug, active]);

  // Met en surbrillance la section en cours de lecture
  useEffect(() => {
    const onScroll = () => {
      const offset = 170;
      let current = sections[0]?.id ?? "";
      sections.forEach((section) => {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= offset) {
          current = section.id;
        }
      });
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
    setResume(null);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resetLecture = () => {
    if (!guideSlug) return;
    clearPosition(guideSlug);
    marquerCommeNonLu(guideSlug);
    setResume(null);
    setHasSaved(false);
    setLu(false);
  };

  const basculerLu = () => {
    if (!guideSlug) return;
    if (lu) {
      marquerCommeNonLu(guideSlug);
      setLu(false);
      return;
    }
    marquerCommeLu(guideSlug);
    setResume(null);
    setHasSaved(false);
    setLu(true);
  };

  if (sections.length === 0) return null;

  const minutes =
    sectionMinutes && sectionMinutes.length === sections.length ? sectionMinutes : null;
  const activeIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === active)
  );
  const remaining = minutes
    ? Math.max(1, Math.round(minutes.slice(activeIndex).reduce((acc, value) => acc + value, 0)))
    : null;

  return (
    <nav
      aria-label="Sommaire du guide"
      className="rounded-lg border border-background-200 bg-background-100 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-background-200">
        <span className="w-7 h-7 flex items-center justify-center rounded-md bg-primary-100 text-primary-700 text-base">
          <i className="ri-list-check-2"></i>
        </span>
        <span className="text-sm font-semibold text-foreground-950">Dans ce guide</span>
        {lu ? (
          <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-medium whitespace-nowrap">
            <i className="ri-check-double-line"></i>
            Lu
          </span>
        ) : (
          remaining !== null && (
            <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-900 text-xs font-medium whitespace-nowrap">
              <i className="ri-time-line"></i>
              ≈ {remaining} min restantes
            </span>
          )
        )}
      </div>

      {resume && (
        <div className="px-2.5 pt-2.5">
          <button
            type="button"
            onClick={() => goTo(resume.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md bg-accent-100 text-accent-900 border border-accent-300 text-left cursor-pointer hover:bg-accent-200 transition-colors"
          >
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-sm">
              <i className="ri-history-line"></i>
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                Reprendre la lecture
              </span>
              <span className="text-sm font-medium leading-snug truncate">{resume.label}</span>
            </span>
            <i className="ri-arrow-down-line ml-auto shrink-0"></i>
          </button>
        </div>
      )}

      <ol className="p-2.5 flex flex-col">
        {sections.map((section, index) => {
          const isActive = section.id === active;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => goTo(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "bg-background-50 text-foreground-950 font-semibold"
                    : "text-foreground-600 hover:bg-background-50 hover:text-foreground-950"
                }`}
              >
                <span
                  className={`w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-[11px] font-semibold ${
                    isActive ? "bg-primary-500 text-background-50" : "bg-background-200 text-foreground-700"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="leading-snug flex-1">{section.label}</span>
                {minutes && (
                  <span className="shrink-0 text-xs text-foreground-500 tabular-nums">
                    {Math.max(1, Math.round(minutes[index]))} min
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {related.length > 0 && (
        <div className="border-t border-background-200 px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Guides liés</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {related.map((lien) => (
              <li key={lien.slug}>
                <GuideLienStatut lien={lien} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {guideSlug && (
        <div className="border-t border-background-200 px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={basculerLu}
            className={`inline-flex items-center gap-2 text-xs font-semibold cursor-pointer transition-colors ${
              lu ? "text-secondary-700 hover:text-secondary-800" : "text-primary-700 hover:text-primary-800"
            }`}
          >
            <i className={lu ? "ri-check-double-line" : "ri-check-line"}></i>
            {lu ? "Lu · annuler" : "Marquer comme lu"}
          </button>
          {hasSaved && !lu && (
            <button
              type="button"
              onClick={resetLecture}
              className="inline-flex items-center gap-2 text-xs font-medium text-foreground-500 hover:text-foreground-900 cursor-pointer transition-colors"
            >
              <i className="ri-restart-line"></i>
              Réinitialiser la lecture
            </button>
          )}
        </div>
      )}
    </nav>
  );
}