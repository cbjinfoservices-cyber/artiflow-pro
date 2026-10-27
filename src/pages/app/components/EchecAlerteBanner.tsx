interface Props {
  /** Nombre d'envois ratés sur les nouveaux passages détectés. */
  echecs: number;
  /** Nombre de passages concernés. */
  passages: number;
  onRetry: () => void;
  onDismiss: () => void;
  /** Un réessai global est en cours. */
  retrying: boolean;
  /** Afficher ou non le bouton de réessai global. */
  showRetry: boolean;
}

/**
 * Bandeau d'alerte in-app affiché dès qu'un nouveau passage d'escalade enregistre
 * un échec d'envoi côté serveur, sans attendre l'email récapitulatif.
 * Réutilisé par la page Relances et le tableau de bord.
 */
export default function EchecAlerteBanner({ echecs, passages, onRetry, onDismiss, retrying, showRetry }: Props) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-700 text-lg">
          <i className="ri-alert-line"></i>
        </span>
        <div>
          <p className="text-sm font-semibold text-red-800">Nouvel échec d'envoi détecté</p>
          <p className="text-xs text-red-700 mt-0.5">
            {echecs} envoi{echecs > 1 ? "s" : ""} sur {passages} passage
            {passages > 1 ? "s" : ""} viennent d'échouer côté serveur. Vérifiez la configuration du service
            d'envoi (Brevo).
          </p>
          {showRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-500 text-white text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              {retrying ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-refresh-line"></i>}
              Réessayer les échecs récents
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-red-500 hover:bg-red-100 cursor-pointer"
        aria-label="Masquer l'alerte"
      >
        <i className="ri-close-line"></i>
      </button>
    </div>
  );
}