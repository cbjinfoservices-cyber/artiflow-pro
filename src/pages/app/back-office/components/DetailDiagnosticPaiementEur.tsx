import type { DiagnosticPaiementEurDetail } from "@/lib/abonnementPaiement";

/** Une ligne de contrôle du diagnostic détaillé. */
interface LigneControle {
  icon: string;
  label: string;
  ok: boolean;
  valeur?: string;
}

/**
 * Détail de la vérification du compte de paiement Stripe : chaque contrôle effectué
 * par le diagnostic, avec son résultat. Sert au back-office à identifier PILE le
 * point qui bloque (devise/pays, carte non supportée, compte non activé, carte
 * désactivée à l'affichage) au lieu du simple statut « indisponible ».
 */
export default function DetailDiagnosticPaiementEur({
  detail,
}: {
  detail: DiagnosticPaiementEurDetail;
}) {
  const lignes: LigneControle[] = [
    {
      icon: "ri-money-euro-circle-line",
      label: "Devise EUR acceptée par le pays du compte",
      ok: detail.eurSupportee,
      valeur: detail.pays ? detail.pays.toUpperCase() : "",
    },
    {
      icon: "ri-earth-line",
      label: "Carte bancaire supportée dans le pays",
      ok: detail.carteSupporteePays,
    },
    {
      icon: "ri-shield-check-line",
      label: "Compte Stripe activé (encaissement possible)",
      ok: detail.chargesActives,
    },
    {
      icon: "ri-bank-card-line",
      label: "Carte « disponible » dans la configuration",
      ok: detail.carteDisponible,
    },
    {
      icon: "ri-eye-line",
      label: "Carte activée à l'affichage",
      ok: detail.carteActive,
      valeur: detail.cartePreference ? `préférence : ${detail.cartePreference}` : "",
    },
  ];

  const bloquants = lignes.filter((l) => !l.ok).length;

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-background-100 border-b border-background-200">
        <i className="ri-list-check-2 text-foreground-500"></i>
        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground-500">
          Détail de la vérification
        </span>
        {detail.compteId ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-foreground-500">
            <i className="ri-store-2-line"></i>
            Compte Stripe :
            <code className="font-medium text-foreground-700">{detail.compteId}</code>
          </span>
        ) : null}
        <span
          className={`ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
            bloquants === 0 ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
          }`}
        >
          <i className={bloquants === 0 ? "ri-checkbox-circle-line" : "ri-close-circle-line"}></i>
          {bloquants === 0 ? "Tous les contrôles OK" : `${bloquants} contrôle${bloquants > 1 ? "s" : ""} en échec`}
        </span>
      </div>
      <ul className="divide-y divide-background-200">
        {lignes.map((l) => (
          <li key={l.label} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg ${
                l.ok ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700"
              }`}
            >
              <i className={l.ok ? "ri-check-line" : "ri-close-line"}></i>
            </span>
            <span className="min-w-0 flex-1 text-xs text-foreground-700">
              <i className={`${l.icon} mr-1.5 text-foreground-400`}></i>
              {l.label}
            </span>
            {l.valeur ? (
              <span className="text-[11px] font-medium text-foreground-500 whitespace-nowrap">
                {l.valeur}
              </span>
            ) : null}
            <span
              className={`text-[11px] font-semibold whitespace-nowrap ${
                l.ok ? "text-accent-700" : "text-red-700"
              }`}
            >
              {l.ok ? "OK" : "Échec"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}