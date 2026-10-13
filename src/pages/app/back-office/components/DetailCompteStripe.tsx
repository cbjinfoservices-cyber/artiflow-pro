import type { DiagnosticPaiementEurDetail } from "@/lib/abonnementPaiement";

/** Traduit un code pays ISO (ex. "fr") en nom lisible (ex. "France"). */
function nomPays(code: string): string {
  const c = String(code ?? "").trim().toUpperCase();
  if (!c) return "—";
  try {
    const noms = new Intl.DisplayNames(["fr"], { type: "region" });
    return noms.of(c) || c;
  } catch {
    return c;
  }
}

/**
 * Bloc « Vérifier le compte Stripe » du back-office : affiche EN CLAIR le compte que la
 * clé Stripe branchée interroge réellement — nom commercial, identifiant (acct_…), pays
 * et état d'activation. Sert à comprendre en un coup d'œil si l'on configure bien le bon
 * compte Stripe : activer la carte dans le Dashboard ne sert à rien si la clé pointe ailleurs.
 */
export default function DetailCompteStripe({
  detail,
  onClose,
}: {
  detail: DiagnosticPaiementEurDetail;
  onClose: () => void;
}) {
  const actif = detail.chargesActives;

  const lignes: { icon: string; label: string; valeur: string }[] = [
    {
      icon: "ri-store-2-line",
      label: "Nom du compte",
      valeur: detail.compteNom || "—",
    },
    {
      icon: "ri-fingerprint-line",
      label: "Identifiant Stripe",
      valeur: detail.compteId || "—",
    },
    {
      icon: "ri-earth-line",
      label: "Pays du compte",
      valeur: detail.pays ? `${nomPays(detail.pays)} (${detail.pays.toUpperCase()})` : "—",
    },
    {
      icon: actif ? "ri-shield-check-line" : "ri-shield-cross-line",
      label: "État d'activation",
      valeur: actif ? "Activé — encaissement possible" : "Non activé — encaissement impossible",
    },
  ];

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 overflow-hidden animate-fade-in">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-background-100 border-b border-background-200">
        <i className="ri-store-2-line text-foreground-500"></i>
        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground-500">
          Compte Stripe vérifié
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
            actif ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
          }`}
        >
          <i className={actif ? "ri-checkbox-circle-line" : "ri-close-circle-line"}></i>
          {actif ? "Compte activé" : "Compte non activé"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Masquer le détail du compte Stripe"
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 hover:bg-background-200 cursor-pointer transition-colors"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
      <ul className="divide-y divide-background-200">
        {lignes.map((l) => (
          <li key={l.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
              <i className={l.icon}></i>
            </span>
            <span className="min-w-0 flex-1 text-xs text-foreground-700">{l.label}</span>
            <span className="text-xs font-semibold text-foreground-950 text-right break-all">{l.valeur}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-start gap-2 px-4 py-3 bg-secondary-100/50 border-t border-background-200">
        <i className="ri-information-line mt-0.5 text-secondary-700"></i>
        <p className="text-[11px] leading-relaxed text-secondary-900">
          C'est ce compte qui doit porter la carte bancaire activée (Stripe → Paramètres → Moyens de paiement,
          en Test et Live). Si l'identifiant ci-dessus ne correspond pas au compte que vous configurez, la
          carte que vous activez ailleurs n'a aucun effet.
        </p>
      </div>
    </div>
  );
}