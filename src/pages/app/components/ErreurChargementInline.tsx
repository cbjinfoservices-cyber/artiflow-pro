/**
 * Encart d'erreur COMPACT pour une carte du tableau de bord ou de l'espace artisan :
 * message lisible + bouton « Réessayer » qui relance le chargement de la carte concernée.
 *
 * À la différence de l'écran d'erreur plein format (DataState / ErrorBlock), ce composant
 * s'insère dans une carte : il tient sur une ligne et n'écrase pas le reste de la page.
 * L'incident lui-même est déjà consigné dans le journal des erreurs par le hook qui l'a
 * détecté ; ici, on donne simplement à l'artisan un moyen immédiat de recharger.
 */
export default function ErreurChargementInline({
  message,
  onRetry,
  titre,
}: {
  /** Message d'erreur lisible à afficher. */
  message: string;
  /** Relance le chargement de la carte concernée. */
  onRetry: () => void;
  /** Titre court de la carte (« Remplacements comptables », « Récaps hebdo »…). */
  titre?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-background-100 border border-secondary-200">
      <span className="inline-flex items-center gap-2.5 min-w-0">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-600">
          <i className="ri-error-warning-line"></i>
        </span>
        <span className="min-w-0">
          {titre && (
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
              {titre}
            </span>
          )}
          <span className="block text-xs text-foreground-600 leading-relaxed">{message}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={onRetry}
        title="Relancer le chargement de cette carte"
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
      >
        <i className="ri-refresh-line"></i>
        Réessayer
      </button>
    </div>
  );
}