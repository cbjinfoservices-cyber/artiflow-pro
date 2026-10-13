import { useEffect, useRef } from "react";

/**
 * Petit message de confirmation flottant, qui disparaît tout seul après quelques secondes.
 * Utilisé par exemple quand un filtre est appliqué depuis un badge.
 *
 * Quand une action est fournie (`actionLabel` + `onAction`), le toast reste affiché jusqu'à une
 * fermeture manuelle (croix) pour laisser le temps de cliquer — par exemple pour renommer un
 * fichier qui vient d'être téléchargé.
 */
export default function Toast({
  message,
  onClose,
  duration = 2800,
  icon = "ri-filter-3-line",
  actionLabel,
  actionIcon = "ri-edit-2-line",
  onAction,
}: {
  message: string;
  onClose: () => void;
  duration?: number;
  icon?: string;
  /** Libellé du bouton d'action optionnel (ex. « Renommer »). */
  actionLabel?: string;
  /** Icône du bouton d'action optionnel (ex. « ri-file-copy-line »). */
  actionIcon?: string;
  /** Callback déclenché au clic sur le bouton d'action. */
  onAction?: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const avecAction = Boolean(actionLabel && onAction);

  useEffect(() => {
    // Un toast portant une action reste affiché tant que l'utilisateur ne l'a pas fermé (duration = 0).
    if (!(duration > 0)) return undefined;
    const timer = setTimeout(() => onCloseRef.current(), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl flex justify-center pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="animate-fade-in pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-full bg-background-50 border border-background-200 text-sm font-medium text-foreground-900"
      >
        <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className={`${icon} text-sm`}></i>
        </span>
        <span className="min-w-0 flex-1 truncate">{message}</span>
        {avecAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className={`${actionIcon}`}></i>
            {actionLabel}
          </button>
        )}
        {avecAction && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-foreground-500 cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className="ri-close-line text-sm"></i>
          </button>
        )}
      </div>
    </div>
  );
}