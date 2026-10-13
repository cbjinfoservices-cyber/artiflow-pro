import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { plans } from "@/mocks/landing";
import Infobulle from "@/components/base/Infobulle";
import MiniCalculateurEconomies from "@/pages/tarifs/components/MiniCalculateurEconomies";

/**
 * Bouton d'entrée vers le paiement. Quand le paiement est indisponible, il est neutralisé
 * (clic ignoré, style estompé) et une infobulle explique pourquoi : évite un clic inutile
 * et oriente vers le support.
 */
function BoutonPaiement({
  desactive,
  onClick,
  className,
  children,
}: {
  desactive?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  const bouton = (
    <button
      type="button"
      onClick={() => {
        if (desactive) return;
        onClick();
      }}
      aria-disabled={desactive}
      className={`w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
        desactive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${className ?? ""}`}
    >
      <i className="ri-bank-card-line"></i>
      {children}
    </button>
  );
  if (!desactive) return bouton;
  return (
    <Infobulle
      className="w-full"
      contenu="Le paiement par carte est momentanément indisponible. Contactez le support pour activer votre abonnement."
    >
      {bouton}
    </Infobulle>
  );
}

const ANNUAL_DISCOUNT = 0.8;

const CONTACT_ANNuel_URL = `/contact?sujet=${encodeURIComponent(
  "Question sur les offres et tarifs"
)}&origine=recap-annuel`;

type Period = "mensuel" | "annuel";

type RecapMensuelAnnuelProps = {
  onChoisir?: (plan: string, period: Period) => void;
  onPasserAnnuel?: () => void;
  /** Neutralise les boutons de paiement quand le paiement carte en EUR est indisponible. */
  desactivePaiement?: boolean;
};

export default function RecapMensuelAnnuel({ onChoisir, onPasserAnnuel, desactivePaiement = false }: RecapMensuelAnnuelProps) {
  const rows = plans.map((plan) => {
    const monthly = Number(plan.price);
    const annualPerMonth = Math.round(monthly * ANNUAL_DISCOUNT);
    const totalMonthly = monthly * 12;
    const totalAnnual = annualPerMonth * 12;
    const savings = totalMonthly - totalAnnual;
    return {
      name: plan.name,
      tagline: plan.tagline,
      monthly,
      annualPerMonth,
      totalMonthly,
      totalAnnual,
      savings,
      highlighted: plan.highlighted,
    };
  });

  const bestSavings = Math.max(...rows.map((row) => row.savings));

  return (
    <section id="recap-12-mois" className="w-full bg-background-100 scroll-mt-32">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
              <i className="ri-calendar-2-line"></i>
              Mensuel ou annuel
            </span>
            <button
              type="button"
              onClick={onPasserAnnuel}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
            >
              <i className="ri-gift-line"></i>
              Économisez 2 mois
            </button>
          </div>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Ce que vous payez vraiment sur 12 mois
          </h2>
          <p className="mt-4 text-base text-foreground-600 leading-relaxed">
            Le paiement annuel applique <strong className="font-semibold text-foreground-800">−20 %</strong> sur
            toutes les offres. Voici le total sur un an et l'économie réalisée pour chaque formule, sans
            engagement caché.
          </p>
        </div>

        <MiniCalculateurEconomies />

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {rows.map((row) => (
            <article
              key={row.name}
              className={`relative flex flex-col rounded-lg border p-6 ${
                row.highlighted
                  ? "border-accent-300 bg-accent-50"
                  : "border-background-200 bg-background-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading font-bold text-lg text-foreground-950">{row.name}</h3>
                  <p className="mt-0.5 text-xs text-foreground-500">{row.tagline}</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-arrow-down-line"></i>
                  −{row.savings} €
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <div className="rounded-md border border-background-200 bg-background-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground-600">Engagement mensuel</span>
                    <span className="font-heading font-bold text-base text-foreground-950">
                      {row.totalMonthly} €<span className="text-xs font-medium text-foreground-500">/an</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-foreground-400">soit {row.monthly} €/mois</p>
                </div>

                <div
                  className={`rounded-md border px-4 py-3 ${
                    row.highlighted
                      ? "border-accent-300 bg-accent-100/70"
                      : "border-accent-200 bg-accent-50/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-accent-800">À l'année (−20 %)</span>
                    <span className="font-heading font-bold text-base text-accent-900">
                      {row.totalAnnual} €<span className="text-xs font-medium text-accent-700">/an</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-accent-700/80">soit {row.annualPerMonth} €/mois</p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-background-200 flex items-center gap-2">
                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                  <i className="ri-wallet-3-line text-sm"></i>
                </span>
                <p className="text-xs text-foreground-600">
                  Vous économisez{" "}
                  <strong className="font-semibold text-foreground-900">{row.savings} €</strong> sur 12 mois
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <BoutonPaiement
                  desactive={desactivePaiement}
                  onClick={() => onChoisir?.(row.name, "mensuel")}
                  className="bg-background-100 border border-background-200 text-foreground-800 hover:bg-background-200"
                >
                  Au mensuel
                </BoutonPaiement>
                <BoutonPaiement
                  desactive={desactivePaiement}
                  onClick={() => onChoisir?.(row.name, "annuel")}
                  className="bg-primary-500 text-background-50 hover:bg-primary-600"
                >
                  À l'annuel
                </BoutonPaiement>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 md:p-5 rounded-lg bg-background-50 border border-background-200">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <i className="ri-lightbulb-line text-lg"></i>
            </span>
            <p className="text-xs md:text-sm text-foreground-700">
              En passant à l'annuel, vous gardez exactement les mêmes fonctions et vous économisez jusqu'à{" "}
              <strong className="font-semibold text-foreground-950">{bestSavings} € par an</strong> selon l'offre
              choisie. Le mois offert, en quelque sorte.
            </p>
          </div>
          <Link
            to={CONTACT_ANNuel_URL}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 shrink-0 rounded-md bg-background-100 border border-background-200 text-foreground-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className="ri-chat-3-line"></i>
            Une question sur l'annuel ?
          </Link>
        </div>
      </div>
    </section>
  );
}