import { Link } from "react-router-dom";
import { causesBlocagePaiement, type DiagnosticPaiementEur } from "@/lib/abonnementPaiement";

/**
 * Petit encart d'information NON BLOQUANT affiché dans l'espace artisan (tableau de bord,
 * Mon abonnement) lorsque le diagnostic détecte que le compte de paiement ne peut pas
 * encaisser de carte en euros.
 *
 * Il reste discret et refermable : il informe sans empêcher de continuer à utiliser l'espace.
 * Comme le bandeau de la page Tarifs, il liste les CAUSES EXACTES détectées (compte non
 * activé, carte désactivée, devise non acceptée…) au lieu du message générique, pour que
 * l'artisan comprenne précisément ce qui bloque.
 */
type EncartPaiementIndisponibleProps = {
  /** Origine du blocage détectée, utilisée en repli quand le détail n'est pas disponible. */
  motif?: "pays" | "carte" | "";
  /** Diagnostic complet du compte de paiement, pour détailler la cause exacte. */
  diagnostic?: DiagnosticPaiementEur | null;
  /** `true` pendant une nouvelle vérification. */
  chargement?: boolean;
  /** Origine transmise au support pour situer le contexte (tableau de bord, mon abonnement…). */
  origine?: string;
  onReverifier: () => void;
  onClose: () => void;
};

export default function EncartPaiementIndisponible({
  motif = "",
  diagnostic = null,
  chargement = false,
  origine = "espace",
  onReverifier,
  onClose,
}: EncartPaiementIndisponibleProps) {
  // Cause(s) exacte(s) : on s'appuie sur le détail du diagnostic ; à défaut, on retombe
  // sur le motif pour ne jamais afficher un message vide.
  const causes = causesBlocagePaiement(
    diagnostic ?? { eurDisponible: false, motif, pays: "", mode: "" },
  );

  return (
    <div
      role="status"
      className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in"
    >
      <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <i className="ri-bank-card-2-line"></i>
      </span>
      <div className="flex-1 min-w-[220px]">
        <p className="text-sm font-semibold text-foreground-950">
          Le paiement en ligne est momentanément indisponible
        </p>
        <p className="text-xs text-foreground-600 leading-relaxed">
          Une vérification de notre compte de paiement a détecté {causes.length > 1 ? "ces points" : "ce point"} à
          corriger avant d'accepter la carte en euros :
        </p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {causes.map((cause) => (
            <li key={cause} className="flex items-start gap-1.5 text-xs text-foreground-600 leading-relaxed">
              <i className="ri-error-warning-line mt-0.5 shrink-0 text-accent-600"></i>
              <span>{cause}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-foreground-600 leading-relaxed">
          Aucune somme n'est engagée : contactez le support et nous activons votre abonnement avec vous.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/contact?sujet=${encodeURIComponent("Aide souscription (moyen de paiement)")}&origine=${encodeURIComponent(
            origine,
          )}`}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-customer-service-2-line"></i>
          Contacter le support
        </Link>
        <button
          type="button"
          onClick={onReverifier}
          disabled={chargement}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-300 text-accent-900 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <i className={`ri-refresh-line ${chargement ? "animate-spin" : ""}`}></i>
          {chargement ? "Vérification…" : "Revérifier"}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Masquer ce message"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-background-50/70 text-accent-800 hover:bg-background-50 cursor-pointer transition-colors"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    </div>
  );
}