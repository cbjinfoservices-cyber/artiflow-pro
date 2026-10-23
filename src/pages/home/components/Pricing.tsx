import { Suspense, lazy, useState } from "react";
import { plans } from "@/mocks/landing";
import { useProductOfferSchema } from "@/hooks/useProductOfferSchema";
import { useMonAbonnement } from "@/hooks/useMonAbonnement";
import BandeauDejaAbonne from "@/components/feature/BandeauDejaAbonne";
import { useDiagnosticPaiementEur } from "@/hooks/useDiagnosticPaiementEur";
import Infobulle from "@/components/base/Infobulle";

// La fenêtre de souscription ne s'affiche qu'au clic sur « S'abonner » : on la charge à la
// demande pour ne pas alourdir le démarrage de la page d'accueil.
const AbonnementCheckoutModal = lazy(() => import("@/pages/tarifs/components/AbonnementCheckoutModal"));

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const { abonnement: monAbonnement } = useMonAbonnement();
  // Diagnostic du compte de paiement : on neutralise le bouton « S'abonner » en amont si la
  // carte en euros n'est pas disponible, pour éviter un clic qui finirait sur une erreur.
  const { indisponible: paiementIndisponible } = useDiagnosticPaiementEur();
  const dejaAbonne = monAbonnement !== null && ["Actif", "Essai"].includes(monAbonnement.statut);
  const [abonnement, setAbonnement] = useState<{
    open: boolean;
    plan: string | null;
    period: "mensuel" | "annuel";
  }>({ open: false, plan: null, period: "mensuel" });

  const openAbonnement = (plan: string) =>
    setAbonnement({ open: true, plan, period: annual ? "annuel" : "mensuel" });
  const closeAbonnement = () => setAbonnement((prev) => ({ ...prev, open: false }));

  useProductOfferSchema(
    plans.map((plan) => ({
      name: plan.name,
      description: plan.tagline,
      price: annual ? Math.round(Number(plan.price) * 0.8) : Number(plan.price),
      currency: "EUR",
      features: plan.features,
      url: "/tarifs#offres",
    })),
    "artiflow-home-offer-schema"
  );

  return (
    <section id="tarifs" className="w-full bg-background-50">
      <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-18">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-price-tag-3-line"></i>
            Tarifs
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-950 tracking-tight">
            Un prix simple, sans surprise
          </h2>
          <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
            Sans engagement. 14 jours d'essai sur l'offre Pro. Résiliable en un clic.
          </p>

          <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                !annual ? "bg-background-50 text-foreground-950 shadow-sm" : "text-foreground-500"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                annual ? "bg-background-50 text-foreground-950 shadow-sm" : "text-foreground-500"
              }`}
            >
              Annuel <span className="text-accent-600">-20 %</span>
            </button>
          </div>
        </div>

        {dejaAbonne && monAbonnement ? (
          <div className="mt-10">
            <BandeauDejaAbonne abonnement={monAbonnement} />
          </div>
        ) : null}

        <div className="mt-9 grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {plans.map((plan) => {
            const price = annual ? Math.round(Number(plan.price) * 0.8) : Number(plan.price);
            return (
              <article
                key={plan.name}
                className={`relative flex flex-col p-6 md:p-7 rounded-lg border ${
                  plan.highlighted
                    ? "bg-foreground-950 text-background-50 border-foreground-950 lg:-translate-y-3"
                    : "bg-background-50 border-background-200"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap">
                    Le plus choisi
                  </span>
                )}

                <h3 className={`font-heading font-bold text-xl ${plan.highlighted ? "text-background-50" : "text-foreground-950"}`}>
                  {plan.name}
                </h3>
                <p className={`mt-1 text-sm ${plan.highlighted ? "text-background-200/80" : "text-foreground-500"}`}>{plan.tagline}</p>

                <div className="mt-5 flex items-end gap-1">
                  <span className={`font-heading font-extrabold text-4xl ${plan.highlighted ? "text-background-50" : "text-foreground-950"}`}>
                    {price} €
                  </span>
                  <span className={`mb-1 text-sm ${plan.highlighted ? "text-background-200/70" : "text-foreground-500"}`}>
                    {annual ? "/ mois, à l'année" : plan.period}
                  </span>
                </div>

                <ul className="mt-6 flex flex-col gap-2.5 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <i className={`mt-0.5 ${plan.highlighted ? "ri-check-line text-primary-400" : "ri-check-line text-accent-600"}`}></i>
                      <span className={`text-sm ${plan.highlighted ? "text-background-100/90" : "text-foreground-600"}`}>{feature}</span>
                    </li>
                  ))}
                </ul>

                {paiementIndisponible ? (
                  <Infobulle
                    className="w-full mt-7"
                    contenu="Le paiement par carte est momentanément indisponible. Contactez le support pour activer votre abonnement."
                  >
                    <button
                      type="button"
                      aria-disabled="true"
                      onClick={() => undefined}
                      className={`w-full inline-flex items-center justify-center gap-2 h-11 rounded-md text-sm font-semibold whitespace-nowrap cursor-not-allowed transition-colors opacity-50 ${
                        plan.highlighted
                          ? "bg-primary-500 text-background-50"
                          : "bg-background-100 text-foreground-900 border border-background-200"
                      }`}
                    >
                      <i className="ri-bank-card-line"></i>
                      {plan.cta}
                    </button>
                  </Infobulle>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAbonnement(plan.name)}
                    className={`mt-7 inline-flex items-center justify-center gap-2 h-11 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      plan.highlighted
                        ? "bg-primary-500 text-background-50 hover:bg-primary-600"
                        : "bg-background-100 text-foreground-900 border border-background-200 hover:bg-background-200"
                    }`}
                  >
                    <i className="ri-bank-card-line"></i>
                    {plan.cta}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-foreground-400">
          Offres dédiées pour les équipes de 5 artisans et plus — parlons-en ensemble.
        </p>
      </div>

      {abonnement.open && (
        <Suspense fallback={null}>
          <AbonnementCheckoutModal
            open
            plan={abonnement.plan}
            period={abonnement.period}
            onClose={closeAbonnement}
          />
        </Suspense>
      )}
    </section>
  );
}