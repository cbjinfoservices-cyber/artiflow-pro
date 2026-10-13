import { useEffect } from "react";

/**
 * Affiche le rendu exact de l'email de rappel « J-3 avant prélèvement ».
 * L'email est injecté dans une iframe isolée (sandbox) pour une prévisualisation
 * fidèle, sans exécuter de script.
 */
export default function ApercuRappelModal({
  open,
  html,
  onClose,
}: {
  open: boolean;
  html: string;
  onClose: () => void;
}) {
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu du rappel J-3"
    >
      <div className="fixed inset-0 bg-foreground-950/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-lg sm:rounded-lg bg-background-50 border border-background-200 overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-background-200">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
              <i className="ri-mail-open-line"></i>
            </span>
            <div>
              <h2 className="font-heading font-bold text-base text-foreground-950">Aperçu du rappel J-3</h2>
              <p className="text-xs text-foreground-500 mt-0.5">
                Voici exactement l'email que recevra l'artisan 3 jours avant le prélèvement.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-background-200 cursor-pointer"
          >
            <i className="ri-close-line text-foreground-500"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-background-100 p-3">
          <iframe
            title="Aperçu du rappel J-3"
            srcDoc={html}
            sandbox=""
            className="w-full h-[560px] rounded-lg border border-background-200 bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-background-200">
          <p className="text-[11px] text-foreground-500 flex items-center gap-1.5">
            <i className="ri-information-line text-foreground-400"></i>
            Aperçu sans envoi réel — rien n'est expédié à l'artisan.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className="ri-close-line"></i>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}