import { Link } from "react-router-dom";
import { causesBlocagePaiement, type DiagnosticPaiementEur } from "@/lib/abonnementPaiement";

/**
 * Message de SECOURS affiché sur la page Tarifs lorsque le paiement carte en euros est
 * indisponible ET que le bandeau principal a été masqué. Il garantit qu'un chemin de
 * contact reste toujours visible : l'artisan ne se retrouve jamais sans solution le jour
 * où la carte est refusée, même s'il a fermé le message principal.
 *
 * Il reprend la cause exacte détectée par le diagnostic (compte non activé, carte
 * désactivée…) plutôt qu'un message générique, pour que l'artisan comprenne d'où vient
 * le blocage.
 */
type MessageSecoursPaiementProps = {
  /** Diagnostic complet du compte de paiement, pour rappeler la cause exacte. */
  diagnostic?: DiagnosticPaiementEur | null;
  /** Origine transmise au support pour situer le contexte (page Tarifs, Mon abonnement…). */
  origine?: string;
};

export default function MessageSecoursPaiement({
  diagnostic = null,
  origine = "tarifs",
}: MessageSecoursPaiementProps) {
  const lienSupport = `/contact?sujet=${encodeURIComponent(
    "Aide souscription (moyen de paiement)",
  )}&origine=${encodeURIComponent(origine)}`;
  const [cause] = causesBlocagePaiement(diagnostic);

  return (
    <div
      role="status"
      className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 p-4 md:p-5 rounded-lg bg-secondary-100/70 border border-secondary-200 animate-fade-in"
    >
      <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-500 text-background-50 dark:text-foreground-950">
        <i className="ri-bank-card-line text-lg"></i>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm text-foreground-950">
          Le paiement par carte est momentanément indisponible
        </p>
        <p className="mt-0.5 text-xs md:text-sm text-foreground-700 leading-relaxed">
          {cause} Aucune somme n'est engagée : écrivez-nous et nous activons votre abonnement avec vous.
        </p>
      </div>
      <Link
        to={lienSupport}
        className="inline-flex items-center justify-center gap-1.5 h-10 px-4 shrink-0 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
      >
        <i className="ri-customer-service-2-line"></i>
        Contacter le support
      </Link>
    </div>
  );
}