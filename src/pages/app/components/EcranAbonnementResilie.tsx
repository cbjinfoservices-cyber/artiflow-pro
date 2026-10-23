import { Link } from "react-router-dom";

/**
 * Écran affiché aux artisans dont l'abonnement est résilié.
 *
 * L'accès aux pages métier (devis, factures, clients, planning…) est suspendu
 * immédiatement après la résiliation. Le profil reste accessible pour consulter
 * l'état de l'abonnement et reprendre une offre en un clic.
 */
export default function EcranAbonnementResilie({ offre }: { offre?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 min-h-[420px]">
      <span className="w-16 h-16 flex items-center justify-center rounded-full bg-background-200 text-foreground-500 text-2xl">
        <i className="ri-lock-2-line"></i>
      </span>
      <h2 className="mt-5 font-heading font-bold text-xl text-foreground-950">
        Votre abonnement est résilié
      </h2>
      <p className="mt-2 max-w-md text-sm text-foreground-500 leading-relaxed">
        Votre accès aux devis, factures, clients et à votre planning est suspendu depuis la résiliation
        {offre ? ` de votre offre ArtiFlow-pro ${offre}` : ""}. Vos données sont conservées : reprenez une offre
        et vous retrouverez votre espace exactement comme vous l'avez laissé.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/app/profil?onglet=abonnement"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-vip-crown-2-line"></i>
          Reprendre une offre
        </Link>
        <Link
          to="/#contact"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
        >
          <i className="ri-customer-service-2-line"></i>
          Poser une question
        </Link>
      </div>
      <p className="mt-6 text-[11px] text-foreground-400 inline-flex items-center gap-1.5">
        <i className="ri-information-line"></i>
        Votre abonnement est réglé ? L'accès se rouvre dès la confirmation.
      </p>
    </div>
  );
}