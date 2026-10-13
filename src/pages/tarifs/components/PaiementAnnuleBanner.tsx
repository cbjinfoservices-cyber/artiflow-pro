/**
 * Bandeau affiché sur la page Tarifs lorsque l'artisan revient du paiement
 * Stripe après une annulation (paramètre `checkout=cancel`). Son rôle : rassurer
 * clairement — aucune somme n'a été prélevée, aucun abonnement n'a été créé —
 * et proposer de reprendre le paiement là où il s'est arrêté.
 */
export default function PaiementAnnuleBanner({
  onClose,
  onRetry,
}: {
  onClose: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 p-4 md:p-5 rounded-lg bg-secondary-100 border border-secondary-200 animate-fade-in">
      <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-secondary-500 text-background-50 text-xl">
        <i className="ri-arrow-go-back-line"></i>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm md:text-base text-secondary-900">
          Vous avez annulé le paiement — rien n'a été débité
        </p>
        <p className="mt-1 text-xs md:text-sm text-foreground-600 leading-relaxed">
          Aucune somme n'a été prélevée et aucun abonnement n'a été créé. Vous pouvez reprendre votre
          souscription quand vous le souhaitez : c'est sans engagement, et le total exact est toujours
          affiché avant le paiement.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer le paiement
          </button>
        )}
        <a
          href="#offres"
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-background-50 border border-secondary-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-secondary-300 transition-colors"
        >
          <i className="ri-price-tag-3-line"></i>
          Revoir les offres
        </a>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-background-50 border border-secondary-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-secondary-300 transition-colors"
        >
          <i className="ri-check-line"></i>
          Compris
        </button>
      </div>
    </div>
  );
}