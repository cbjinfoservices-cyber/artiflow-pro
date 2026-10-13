import { useEffect, useState } from "react";

type BackToTopProps = {
  /** Nombre de pixels à scroller avant l'apparition du bouton. */
  threshold?: number;
};

/**
 * Bouton flottant « Retour en haut » qui apparaît après quelques écrans de scroll.
 * Présent sur toutes les pages longues, placé au-dessus de la barre d'action mobile.
 * Intègre une fine barre de progression de lecture reflétant l'avancée dans la page.
 */
export default function BackToTop({ threshold = 800 }: BackToTopProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > threshold);
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      setProgress(Math.min(1, Math.max(0, ratio)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [threshold]);

  const toTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={`Revenir en haut de la page — lecture à ${Math.round(progress * 100)} %`}
      title="Revenir en haut"
      className={`fixed right-4 md:right-8 bottom-24 lg:bottom-8 z-40 inline-flex items-center justify-center gap-2 h-11 w-11 md:w-auto md:px-4 rounded-full border border-background-200 bg-background-50 text-foreground-800 text-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-300 hover:bg-background-100 hover:border-primary-300 overflow-hidden ${
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none"
      }`}
    >
      <i className="ri-arrow-up-line relative z-10 text-lg"></i>
      <span className="relative z-10 hidden md:inline">Haut de page</span>
      <span
        aria-hidden="true"
        className="absolute left-0 bottom-0 h-0.5 bg-primary-500 transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      ></span>
    </button>
  );
}