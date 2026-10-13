import { useEffect, useMemo, useState } from "react";

export type FaqItem = { question: string; answer: string };

type FaqAccordionProps = {
  items: FaqItem[];
  /** Préfixe des ancres, unique par page (ex. "faq-tarifs"). */
  idPrefix: string;
};

function slugifyQuestion(question: string): string {
  return question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Accordéon de FAQ avec une ancre partageable par question.
 * Chaque question possède un identifiant stable, copiable en un clic,
 * et la page s'ouvre directement sur la bonne question si l'URL contient l'ancre.
 */
export default function FaqAccordion({ items, idPrefix }: FaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const itemsWithIds = useMemo(() => {
    const seen = new Map<string, number>();
    return items.map((item, index) => {
      const base = `${idPrefix}-${slugifyQuestion(item.question) || `question-${index + 1}`}`;
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return { ...item, id: count === 0 ? base : `${base}-${count + 1}` };
    });
  }, [items, idPrefix]);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo({ top, behavior: "smooth" });
  };

  // Ouvre la question ciblée par l'ancre de l'URL, sinon la première par défaut.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const match = itemsWithIds.find((item) => item.id === hash);
    if (match) {
      setOpenId(match.id);
      const timer = window.setTimeout(() => scrollToId(match.id), 160);
      return () => window.clearTimeout(timer);
    }
    setOpenId(itemsWithIds[0]?.id ?? null);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Réagit à un changement d'ancre (lien partagé ouvert dans le même onglet).
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (itemsWithIds.some((item) => item.id === hash)) {
        setOpenId(hash);
        scrollToId(hash);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsWithIds]);

  const toggle = (id: string) => {
    const willOpen = openId !== id;
    setOpenId(willOpen ? id : null);
    if (willOpen) {
      try {
        window.history.replaceState(null, "", `#${id}`);
      } catch {
        /* ignore */
      }
    }
  };

  const copyLink = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
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
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2200);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {itemsWithIds.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            id={item.id}
            className="scroll-mt-32 rounded-lg border border-background-200 bg-background-50 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 py-4">
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="flex-1 min-w-0 flex items-center justify-between gap-4 text-left cursor-pointer"
              >
                <span className="font-heading font-semibold text-sm md:text-base text-foreground-950">
                  {item.question}
                </span>
                <span
                  className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-lg transition-colors ${
                    isOpen ? "bg-primary-500 text-background-50" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  <i className={isOpen ? "ri-subtract-line" : "ri-add-line"}></i>
                </span>
              </button>

              <button
                type="button"
                onClick={() => copyLink(item.id)}
                title="Copier le lien vers cette question"
                aria-label="Copier le lien vers cette question"
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-background-200 text-foreground-500 hover:text-foreground-900 hover:bg-background-100 cursor-pointer transition-colors"
              >
                <i className={copiedId === item.id ? "ri-check-line text-accent-600" : "ri-link"}></i>
              </button>
            </div>

            {/* La réponse reste toujours présente dans le HTML (repliée en CSS quand
                l'accordéon est fermé) afin que le balisage Schema.org FAQPage
                corresponde à un contenu réellement indexable. */}
            <div className={`px-5 pb-5 -mt-1 ${isOpen ? "animate-fade-in" : "hidden"}`}>
              <p className="text-sm text-foreground-600 leading-relaxed">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}