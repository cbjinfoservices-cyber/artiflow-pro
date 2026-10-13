import { useEffect, useState } from "react";

export type PageSection = { id: string; label: string; icon: string; count?: number };

type PageSectionNavProps = {
  sections: PageSection[];
  ariaLabel: string;
};

export default function PageSectionNav({ sections, ariaLabel }: PageSectionNavProps) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const sectionIds = sections.map((section) => section.id);

  // Défile vers la section demandée si l'URL contient déjà une ancre (ex. /tarifs#recap-12-mois)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash || !sectionIds.includes(hash)) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 140);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const offset = 150;
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
    // Met à jour l'URL (ancre partageable) sans empiler l'historique
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${active}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement("textarea");
        field.value = url;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.focus();
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="sticky top-16 md:top-18 z-40 w-full bg-background-50/95 backdrop-blur border-y border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12">
        <div className="flex items-center gap-3 py-2.5">
          <nav
            aria-label={ariaLabel}
            className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0"
          >
            {sections.map((section) => {
              const isActive = active === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => goTo(section.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary-500 text-background-50"
                      : "text-foreground-600 hover:bg-background-100"
                  }`}
                >
                  <i className={section.icon}></i>
                  {section.label}
                  {typeof section.count === "number" && section.count > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-background-50/25 text-background-50"
                          : "bg-secondary-100 text-secondary-900"
                      }`}
                      title={`${section.count} guide${section.count > 1 ? "s" : ""} non lu${section.count > 1 ? "s" : ""}`}
                    >
                      {section.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={copyLink}
            aria-label="Copier le lien vers cette section"
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-background-200 text-xs font-medium text-foreground-600 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className={copied ? "ri-check-line text-accent-600" : "ri-link"}></i>
            <span className="hidden sm:inline">{copied ? "Lien copié !" : "Copier le lien"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}