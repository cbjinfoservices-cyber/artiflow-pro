import { Link } from "react-router-dom";

/**
 * Bandeau de confirmation affiché sur la page Tarifs lorsque l'artisan revient
 * après un paiement Stripe réussi (paramètre `checkout=success`). Il confirme
 * clairement que le paiement est passé et que l'abonnement est bien actif, puis
 * l'oriente vers la gestion de son abonnement.
 */
export default function PaiementSuccesBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 p-4 md:p-5 rounded-lg bg-primary-100 border border-primary-300 animate-fade-in">
      <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-primary-500 text-background-50 text-xl">
        <i className="ri-checkbox-circle-line"></i>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm md:text-base text-primary-900">
          Paiement confirmé — votre abonnement est actif
        </p>
        <p className="mt-1 text-xs md:text-sm text-foreground-600 leading-relaxed">
          Merci ! Votre paiement a bien été accepté et votre abonnement ArtiFlow-pro est
          désormais actif. Vous retrouverez le récapitulatif de votre offre, vos factures et la
          gestion de votre moyen de paiement depuis votre espace.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <Link
          to="/app/profil?onglet=abonnement"
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-file-list-3-line"></i>
          Voir mon abonnement
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-background-50 border border-primary-300 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-400 transition-colors"
        >
          <i className="ri-check-line"></i>
          Compris
        </button>
      </div>
    </div>
  );
}