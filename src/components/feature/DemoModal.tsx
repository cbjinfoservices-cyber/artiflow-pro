import { useEffect } from "react";
import DemoForm from "@/components/feature/DemoForm";
import type { DemoPrefill } from "@/hooks/useDemoModal";

type DemoModalProps = {
  open: boolean;
  source?: string;
  prefill?: DemoPrefill;
  onClose: () => void;
};

export default function DemoModal({ open, source, prefill, onClose }: DemoModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Demander une démo ArtiFlow-pro"
    >
      <div className="fixed inset-0 bg-foreground-950/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-lg my-auto rounded-lg bg-background-50 border border-background-200 p-6 md:p-8 animate-fade-up">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-background-100 text-foreground-600 hover:bg-background-200 cursor-pointer transition-colors"
        >
          <i className="ri-close-line text-xl"></i>
        </button>

        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
          <i className="ri-calendar-check-line"></i>
          Réserver une démo
        </span>
        <h2 className="mt-3 font-heading font-bold text-2xl text-foreground-950 tracking-tight">
          Voyez ArtiFlow-pro écrire un devis pour vous
        </h2>
        <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
          Laissez-nous vos coordonnées : on vous rappelle pour une démonstration adaptée à votre métier, en 20 minutes.
        </p>

        <div className="mt-6">
          <DemoForm idPrefix="af-modal" source={source} prefill={prefill} />
        </div>
      </div>
    </div>
  );
}