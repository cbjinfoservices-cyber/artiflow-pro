import { useState } from "react";
import { formatEuros } from "@/lib/format";
import { OFFRES_DETAILS } from "@/lib/monAbonnement";
import type { ModePaiement } from "@/lib/abonnementPaiement";
import Infobulle from "@/components/base/Infobulle";

export default function ComparaisonOffres({
  offreActuelle,
  onChoisir,
  desactivePaiement = false,
}: {
  offreActuelle: string;
  onChoisir?: (plan: string, mode: ModePaiement) => void;
  /** Quand `true`, le bouton « S'abonner » est neutralisé (paiement carte indisponible). */
  desactivePaiement?: boolean;
}) {
  const [mode, setMode] = useState<ModePaiement>("recurrent");
  const unique = mode === "unique";
  const ctaLabel = unique ? "Payer en une fois" : "S'abonner";
  const ctaIcone = unique ? "ri-hand-coin-line" : "ri-bank-card-line";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading font-semibold text-base text-foreground-950">Comparer les offres</h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500">
          <i className="ri-shield-check-line text-foreground-400"></i>
          Paiement sécurisé par carte · changement d'offre immédiat
        </span>
      </div>

      <div className="flex flex-col gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-wallet-3-line text-foreground-400"></i>
            Type de paiement
          </span>
          <div className="flex gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
            <button
              type="button"
              onClick={() => setMode("recurrent")}
              aria-pressed={!unique}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                !unique ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-loop-right-line"></i>
              Abonnement
            </button>
            <button
              type="button"
              onClick={() => setMode("unique")}
              aria-pressed={unique}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                unique ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-hand-coin-line"></i>
              Paiement unique
            </button>
          </div>
        </div>
        <p className="text-[11px] text-foreground-500 leading-relaxed">
          {unique
            ? "Vous payez une seule fois pour la période choisie (1 mois, ou 12 mois à l'annuel −20 %). Rien ne se renouvelle automatiquement."
            : "Prélèvement automatique chaque mois (ou chaque année), sans engagement, résiliable à tout moment."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {OFFRES_DETAILS.map((offre) => {
          const actuelle = offre.nom === offreActuelle;
          return (
            <div
              key={offre.nom}
              className={`flex flex-col gap-4 p-5 rounded-lg border ${
                actuelle ? "bg-primary-50 border-primary-300" : "bg-background-100 border-background-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-heading font-bold text-lg text-foreground-950">{offre.nom}</h4>
                {actuelle ? (
                  <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                    <i className="ri-check-line"></i>
                    Offre actuelle
                  </span>
                ) : null}
              </div>

              <div>
                <p className="font-heading font-bold text-2xl text-foreground-950">
                  {formatEuros(offre.prix)}
                  <span className="text-sm font-medium text-foreground-500"> /mois</span>
                </p>
                <p className="text-xs text-foreground-500 mt-1">{offre.accroche}</p>
              </div>

              <ul className="flex flex-col gap-2 flex-1">
                {offre.inclus.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground-700">
                    <i className="ri-check-line text-accent-600 mt-0.5"></i>
                    {item}
                  </li>
                ))}
              </ul>

              {actuelle ? (
                <span className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-200 text-foreground-600 text-sm font-semibold whitespace-nowrap">
                  <i className="ri-check-double-line"></i>
                  Vous êtes sur cette offre
                </span>
              ) : desactivePaiement ? (
                <Infobulle
                  className="w-full"
                  contenu="Le paiement par carte est momentanément indisponible. Contactez le support pour activer votre abonnement."
                >
                  <button
                    type="button"
                    aria-disabled="true"
                    onClick={() => undefined}
                    className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-not-allowed transition-colors opacity-50"
                  >
                    <i className={ctaIcone}></i>
                    {ctaLabel}
                  </button>
                </Infobulle>
              ) : (
                <button
                  type="button"
                  onClick={() => onChoisir?.(offre.nom, mode)}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className={ctaIcone}></i>
                  {ctaLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}