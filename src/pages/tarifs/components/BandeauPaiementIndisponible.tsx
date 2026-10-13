import { Link } from "react-router-dom";
import { causesBlocagePaiement, type DiagnosticPaiementEur } from "@/lib/abonnementPaiement";

/**
 * Bandeau d'information affiché sur la page Tarifs lorsque le diagnostic détecte
 * que le compte de paiement ne peut pas encaisser de carte en euros (EUR).
 *
 * Son rôle : prévenir AVANT le clic sur « S'abonner », expliquer PRÉCISÉMENT ce qui
 * bloque (compte non activé, carte désactivée, devise non acceptée…) à partir du détail
 * du diagnostic — au lieu du message générique —, puis orienter vers le support tout en
 * proposant de revérifier l'état. Ton neutre et rassurant : côté client, le problème
 * vient de la configuration, pas de son navigateur.
 */
type BandeauPaiementIndisponibleProps = {
  /** Diagnostic complet du compte de paiement, pour détailler la cause exacte. */
  diagnostic?: DiagnosticPaiementEur | null;
  /** `true` pendant une nouvelle vérification. */
  chargement?: boolean;
  /** Origine transmise au support pour situer le contexte (page Tarifs, Mon abonnement…). */
  origine?: string;
  onReverifier: () => void;
  onClose: () => void;
};

export default function BandeauPaiementIndisponible({
  diagnostic = null,
  chargement = false,
  origine = "tarifs",
  onReverifier,
  onClose,
}: BandeauPaiementIndisponibleProps) {
  const causes = causesBlocagePaiement(diagnostic);
  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-4 p-4 md:p-5 rounded-lg bg-accent-100/80 border border-accent-300/70 animate-fade-in"
    >
      <div className="flex items-start gap-4">
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-xl">
          <i className="ri-bank-card-2-line"></i>
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-sm md:text-base text-accent-950">
            Le paiement en ligne est momentanément indisponible
          </p>
          <p className="mt-1 text-xs md:text-sm text-accent-900/90 leading-relaxed">
            Une vérification de notre compte de paiement a détecté {causes.length > 1 ? "ces points" : "ce point"} à
            corriger avant d'accepter la carte en euros :
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {causes.map((cause) => (
              <li key={cause} className="flex items-start gap-2 text-xs md:text-sm text-accent-900/90 leading-relaxed">
                <i className="ri-error-warning-line mt-0.5 shrink-0 text-accent-700"></i>
                <span>{cause}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs md:text-sm text-accent-900/90 leading-relaxed">
            Aucune somme n'est engagée : vous pouvez nous écrire et nous activons votre abonnement avec vous, sans
            attendre la remise en service.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Masquer ce message"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-background-50/70 text-accent-800 hover:bg-background-50 cursor-pointer transition-colors"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/contact?sujet=${encodeURIComponent("Aide souscription (moyen de paiement)")}&origine=${encodeURIComponent(
            origine,
          )}`}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-customer-service-2-line"></i>
          Contacter le support
        </Link>
        <button
          type="button"
          onClick={onReverifier}
          disabled={chargement}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-background-50 border border-accent-300 text-accent-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-accent-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <i className={`ri-refresh-line ${chargement ? "animate-spin" : ""}`}></i>
          {chargement ? "Vérification…" : "Revérifier"}
        </button>
      </div>
    </div>
  );
}