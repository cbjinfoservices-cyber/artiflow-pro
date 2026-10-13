import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { plans } from "@/mocks/landing";
import { comparatif, tarifsFaq } from "@/mocks/tarifs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useDemoModal } from "@/hooks/useDemoModal";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useProductOfferSchema } from "@/hooks/useProductOfferSchema";
import { useMonAbonnement } from "@/hooks/useMonAbonnement";
import { useDureeEssai } from "@/hooks/useDureeEssai";
import PreuveSocialePro from "@/pages/tarifs/components/PreuveSocialePro";
import RecapMensuelAnnuel from "@/pages/tarifs/components/RecapMensuelAnnuel";
import CalculatriceRoi from "@/pages/tarifs/components/CalculatriceRoi";
import SimulateurEntreprise from "@/pages/tarifs/components/SimulateurEntreprise";
import SommaireTarifs from "@/pages/tarifs/components/SommaireTarifs";
import AbonnementCheckoutModal from "@/pages/tarifs/components/AbonnementCheckoutModal";
import ReassurancePaiement from "@/pages/tarifs/components/ReassurancePaiement";
import BandeauDejaAbonne from "@/components/feature/BandeauDejaAbonne";
import PaiementAnnuleBanner from "@/pages/tarifs/components/PaiementAnnuleBanner";
import PaiementSuccesBanner from "@/pages/tarifs/components/PaiementSuccesBanner";
import BandeauPaiementIndisponible from "@/pages/tarifs/components/BandeauPaiementIndisponible";
import MessageSecoursPaiement from "@/pages/tarifs/components/MessageSecoursPaiement";
import BoutonTestPaiement from "@/pages/tarifs/components/BoutonTestPaiement";
import { useDiagnosticPaiementEur } from "@/hooks/useDiagnosticPaiementEur";
import { causesBlocagePaiement } from "@/lib/abonnementPaiement";
import { viderCacheDiagnosticPaiement } from "@/lib/diagnosticPaiementCache";
import ComparerOffresModal from "@/components/feature/ComparerOffresModal";
import FaqAccordion from "@/components/feature/FaqAccordion";
import Infobulle from "@/components/base/Infobulle";

function splitPlanFeatures(features: string[]): { header: string | null; items: string[] } {
  const isHeader = (feature: string) => feature.startsWith("Tout ") && feature.includes("plus");
  if (features.length > 0 && isHeader(features[0])) {
    return { header: features[0], items: features.slice(1) };
  }
  return { header: null, items: features };
}

function upgradeLabel(header: string | null): string {
  if (!header) return "Tout pour bien démarrer";
  if (header.includes("Essentiel")) return "Tout l'Essentiel + ces nouveautés";
  if (header.includes("Pro")) return "Tout le Pro + ces nouveautés";
  return "Nouveautés de cette offre";
}

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <i className="ri-check-line text-accent-600 text-lg"></i>;
  }
  if (value === false) {
    return <i className="ri-subtract-line text-foreground-300 text-lg"></i>;
  }
  return <span className="text-xs font-medium text-foreground-700">{value}</span>;
}

const ANNUAL_PREF_KEY = "artiflow.tarifs.annual";

export default function TarifsPage() {
  const [annual, setAnnual] = useState(() => {
    try {
      return window.localStorage.getItem(ANNUAL_PREF_KEY) === "1";
    } catch {
      return false;
    }
  });
  const { openDemo } = useDemoModal();
  const { abonnement } = useMonAbonnement();
  const { jours: dureeEssai } = useDureeEssai();
  const dejaAbonne = abonnement !== null && ["Actif", "Essai"].includes(abonnement.statut);

  // Diagnostic du compte de paiement : prévient en amont si la carte en euros n'est
  // pas disponible, pour éviter une erreur au moment du clic sur « S'abonner ».
  const { diagnostic: diagnosticPaiement, indisponible: paiementIndisponible, reverifier: reverifierPaiement } =
    useDiagnosticPaiementEur();
  const [bandeauPaiementMasque, setBandeauPaiementMasque] = useState(false);
  // Paiement bloqué = bandeau d'indisponibilité affiché à l'écran. On neutralise alors
  // tous les points d'entrée vers le paiement pour éviter un clic qui échouerait.
  const paiementBloque = paiementIndisponible && !bandeauPaiementMasque;
  // Cause exacte du blocage (compte non activé, carte désactivée…), réutilisée par l'infobulle.
  const [causePaiement] = causesBlocagePaiement(diagnosticPaiement);

  // Retour de Stripe après un paiement : succès ou annulation.
  const [searchParams, setSearchParams] = useSearchParams();
  const [paiementAnnule, setPaiementAnnule] = useState(false);
  const [paiementSucces, setPaiementSucces] = useState(false);
  // Offre/facturation du paiement annulé, pour reprendre exactement le même au clic sur « Réessayer ».
  const [relancePaiement, setRelancePaiement] = useState<{ offre: string; period: "mensuel" | "annuel" } | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "cancel" && checkout !== "success") return;
    if (checkout === "cancel") {
      setPaiementAnnule(true);
      const offre = searchParams.get("offre") ?? "";
      const period = searchParams.get("facturation") === "annuel" ? "annuel" : "mensuel";
      if (offre) setRelancePaiement({ offre, period });
    }
    if (checkout === "success") {
      setPaiementSucces(true);
      // Paiement réussi : on vide le cache du diagnostic puis on relance la vérification
      // pour que le bandeau « paiement indisponible » disparaisse immédiatement.
      viderCacheDiagnosticPaiement();
      reverifierPaiement();
    }
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    next.delete("session_id");
    next.delete("offre");
    next.delete("facturation");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, reverifierPaiement]);

  // Comparaison d'une offre de la grille avec l'offre actuelle de l'artisan connecté.
  const [comparaison, setComparaison] = useState<{ offreA: string; offreB: string } | null>(null);

  const [abonnementState, setAbonnementState] = useState<{ open: boolean; plan: string | null; period: "mensuel" | "annuel" }>(
    { open: false, plan: null, period: "mensuel" }
  );
  const openAbonnement = (plan: string | null, period?: "mensuel" | "annuel") =>
    setAbonnementState({ open: true, plan, period: period ?? (annual ? "annuel" : "mensuel") });
  const closeAbonnement = () => setAbonnementState((prev) => ({ ...prev, open: false }));

  // Reprise du paiement annulé : on rouvre le tunnel sur la même offre et la même facturation.
  const handleRetryPaiement = () => {
    setPaiementAnnule(false);
    openAbonnement(relancePaiement?.offre ?? null, relancePaiement?.period);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(ANNUAL_PREF_KEY, annual ? "1" : "0");
    } catch {
      /* stockage indisponible */
    }
  }, [annual]);

  usePageMeta(
    "Tarifs ArtiFlow-pro · Devis, planning & relances pour artisans",
    "Découvrez les tarifs ArtiFlow-pro : Essentiel à 29 €, Pro à 59 € et Entreprise à 99 € par mois. Sans engagement, 14 jours d'essai et devis IA illimités.",
    {
      type: "website",
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20artistic%20abstract%20composition%20of%20pricing%20tiers%20and%20rising%20value%20curves%20with%20warm%20amber%20and%20deep%20teal%20accents%20on%20a%20charcoal%20background%2C%20elegant%20minimal%20editorial%20banner%2C%20soft%20light%2C%20high%20detail%2C%20strong%20contrast&width=1200&height=630&seq=artiflow-og-tarifs&orientation=landscape",
    }
  );

  useFaqSchema(tarifsFaq, "artiflow-tarifs-faq-schema");
  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Tarifs", path: "/tarifs" },
    ],
    "artiflow-tarifs-breadcrumb-schema"
  );

  useProductOfferSchema(
    plans.map((plan) => ({
      name: plan.name,
      description: plan.tagline,
      price: annual ? Math.round(Number(plan.price) * 0.8) : Number(plan.price),
      currency: "EUR",
      features: plan.features,
      url: "/tarifs#offres",
    })),
    "artiflow-tarifs-offer-schema"
  );

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section id="top" className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12">
            <nav className="flex items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">Accueil</Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Tarifs</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-price-tag-3-line"></i>
                Tarifs clairs
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Le bon prix pour votre activité, sans surprise
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Choisissez l'offre adaptée à votre atelier ou à votre équipe. {dureeEssai > 0 ? `${dureeEssai} jours d'essai sur l'offre Pro` : "Prélèvement mensuel ou annuel"}, résiliable en un clic.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200">
                <button
                  type="button"
                  onClick={() => setAnnual(false)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${!annual ? "bg-primary-500 text-background-50" : "text-foreground-500"}`}
                >
                  Mensuel
                </button>
                <button
                  type="button"
                  onClick={() => setAnnual(true)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${annual ? "bg-primary-500 text-background-50" : "text-foreground-500"}`}
                >
                  Annuel <span className={annual ? "text-background-50" : "text-accent-600"}>-20 %</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  annual
                    ? "bg-accent-500 text-background-50"
                    : "bg-accent-100 text-accent-800 hover:bg-accent-200"
                }`}
              >
                <i className="ri-gift-line"></i>
                Économisez 2 mois
              </button>
            </div>
          </div>

          <div id="offres" className="w-full px-4 md:px-8 lg:px-12 pb-14 scroll-mt-32">
            {paiementSucces ? <PaiementSuccesBanner onClose={() => setPaiementSucces(false)} /> : null}
            {paiementAnnule ? (
              <PaiementAnnuleBanner onClose={() => setPaiementAnnule(false)} onRetry={handleRetryPaiement} />
            ) : null}
            {dejaAbonne && abonnement ? <BandeauDejaAbonne abonnement={abonnement} /> : null}
            {paiementIndisponible && !bandeauPaiementMasque ? (
              <BandeauPaiementIndisponible
                diagnostic={diagnosticPaiement}
                onReverifier={reverifierPaiement}
                onClose={() => setBandeauPaiementMasque(true)}
              />
            ) : null}
            <ReassurancePaiement />
            {paiementIndisponible && bandeauPaiementMasque ? (
              <MessageSecoursPaiement diagnostic={diagnosticPaiement} origine="tarifs" />
            ) : null}

            <BoutonTestPaiement />

            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 md:p-5 rounded-lg bg-accent-100/70 border border-accent-300/60">
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                <i className="ri-award-line text-lg"></i>
              </span>
              <div className="flex-1">
                <p className="font-heading font-semibold text-sm md:text-base text-accent-900">
                  L'offre Pro est la plus choisie par les artisans
                </p>
                <p className="mt-0.5 text-xs md:text-sm text-accent-800/85">
                  Relances SMS &amp; WhatsApp, planning intelligent et signature électronique inclus — {dureeEssai > 0 ? `${dureeEssai} jours d'essai offerts, aucun débit avant la fin` : "sans engagement, résiliable à tout moment"}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
              {plans.map((plan) => {
                const price = annual ? Math.round(Number(plan.price) * 0.8) : Number(plan.price);
                const { header, items } = splitPlanFeatures(plan.features);
                const estActuelle = dejaAbonne && abonnement !== null && abonnement.offre === plan.name;
                return (
                  <article
                    key={plan.name}
                    id={plan.highlighted ? "offre-pro" : undefined}
                    className={`relative flex flex-col p-6 md:p-7 rounded-lg border ${
                      plan.highlighted
                        ? `bg-foreground-950 text-background-50 border-foreground-950 ring-2 ${estActuelle ? "ring-primary-400" : "ring-accent-500/50"}`
                        : `bg-background-50 border-background-200 ${estActuelle ? "ring-2 ring-primary-400" : ""}`
                    }`}
                  >
                    {plan.highlighted && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap">
                        <i className="ri-award-fill"></i>
                        Recommandé pour vous
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className={`font-heading font-bold text-xl ${plan.highlighted ? "text-background-50" : "text-foreground-950"}`}>{plan.name}</h2>
                      {estActuelle && (
                        <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                          <i className="ri-user-star-line"></i>
                          Votre offre
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm ${plan.highlighted ? "text-background-200/80" : "text-foreground-500"}`}>{plan.tagline}</p>

                    <div className="mt-5 flex items-end gap-1">
                      <span className={`font-heading font-extrabold text-4xl ${plan.highlighted ? "text-background-50" : "text-foreground-950"}`}>{price} €</span>
                      <span className={`mb-1 text-sm ${plan.highlighted ? "text-background-200/70" : "text-foreground-500"}`}>
                        {annual ? "/ mois, à l'année" : plan.period}
                      </span>
                    </div>

                    {plan.highlighted && annual && (
                      <p className="mt-2 text-xs font-medium text-accent-400">
                        Soit {Math.round(Number(plan.price) * 0.8) * 12} € par an — {Math.round(Number(plan.price) * 12) - Math.round(Number(plan.price) * 0.8) * 12} € économisés
                      </p>
                    )}

                    {!annual && (
                      <button
                        type="button"
                        onClick={() => setAnnual(true)}
                        className={`mt-2 inline-flex items-center gap-1.5 self-start h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          plan.highlighted
                            ? "bg-accent-500/15 text-accent-400 hover:bg-accent-500/25"
                            : "bg-accent-100 text-accent-800 hover:bg-accent-200"
                        }`}
                      >
                        <i className="ri-gift-line"></i>
                        Passez à l'annuel : économisez {Math.round(Number(plan.price) * 12) - Math.round(Number(plan.price) * 0.8) * 12} € par an
                      </button>
                    )}

                    <div className="mt-6 flex items-center gap-2">
                      <span className={`w-5 h-5 shrink-0 flex items-center justify-center rounded-full ${plan.highlighted ? "bg-accent-500 text-background-50" : header ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"}`}>
                        <i className={`text-[12px] ${header ? "ri-arrow-up-line" : "ri-rocket-line"}`}></i>
                      </span>
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${plan.highlighted ? "text-accent-400" : "text-foreground-500"}`}>
                        {upgradeLabel(header)}
                      </span>
                    </div>

                    <ul className="mt-3 flex flex-col gap-2.5 flex-1">
                      {items.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <i className={`mt-0.5 ri-check-line ${plan.highlighted ? "text-primary-400" : "text-accent-600"}`}></i>
                          <span className={`text-sm ${plan.highlighted ? "text-background-100/90" : "text-foreground-600"}`}>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7 flex flex-col gap-2">
                      {estActuelle && (
                        <Link
                          to="/app/profil?onglet=abonnement"
                          className="inline-flex items-center justify-center gap-2 h-11 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors bg-accent-500 text-background-50 hover:bg-accent-600"
                        >
                          <i className="ri-settings-3-line"></i>
                          Gérer mon abonnement
                        </Link>
                      )}
                      {paiementBloque ? (
                        <Infobulle
                          className="w-full"
                          contenu={`${causePaiement} Le paiement par carte est momentanément indisponible. Contactez le support pour activer votre abonnement.`}
                        >
                          <button
                            type="button"
                            aria-disabled="true"
                            onClick={() => undefined}
                            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-md text-sm font-semibold whitespace-nowrap cursor-not-allowed transition-colors bg-primary-500 text-background-50 opacity-50"
                          >
                            <i className="ri-bank-card-line"></i>
                            S'abonner
                          </button>
                        </Infobulle>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openAbonnement(plan.name)}
                          className="inline-flex items-center justify-center gap-2 h-11 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors bg-primary-500 text-background-50 hover:bg-primary-600"
                        >
                          <i className="ri-bank-card-line"></i>
                          S'abonner
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDemo("tarifs")}
                        className={`inline-flex items-center justify-center gap-2 h-11 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          plan.highlighted
                            ? "bg-background-50/10 text-background-50 border border-background-50/30 hover:bg-background-50/20"
                            : "bg-background-100 text-foreground-900 border border-background-200 hover:bg-background-200"
                        }`}
                      >
                        {plan.cta}
                        <i className="ri-arrow-right-line"></i>
                      </button>
                    </div>
                    {dejaAbonne && abonnement && !estActuelle && (
                      <button
                        type="button"
                        onClick={() => setComparaison({ offreA: abonnement.offre, offreB: plan.name })}
                        className={`mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer underline-offset-2 hover:underline ${
                          plan.highlighted ? "text-accent-400 hover:text-accent-300" : "text-primary-700 hover:text-primary-800"
                        }`}
                      >
                        <i className="ri-scales-3-line"></i>
                        Comparer avec mon offre actuelle
                      </button>
                    )}
                    {plan.highlighted && (
                      <p className="mt-3 text-center text-[11px] text-background-200/70">
                        {dureeEssai > 0 ? `${dureeEssai} jours d'essai · Aucun débit pendant l'essai · ` : ""}Résiliable en 1 clic
                      </p>
                    )}
                    {plan.name === "Entreprise" && (
                      <p className="mt-3 text-center text-[11px] text-foreground-400">
                        À partir de 99 €/mois · 5 utilisateurs inclus, +12 € par utilisateur supplémentaire
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <PreuveSocialePro />

        <SommaireTarifs />

        <RecapMensuelAnnuel
          onChoisir={(plan, period) => openAbonnement(plan, period)}
          onPasserAnnuel={() => setAnnual(true)}
          desactivePaiement={paiementBloque}
        />

        <CalculatriceRoi />

        <section id="comparatif" className="w-full bg-background-100 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-list-check-2"></i>
                Comparatif détaillé
              </span>
              <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                Tout ce que contient chaque offre
              </h2>
            </div>

            <div className="overflow-x-auto rounded-lg border border-background-200 bg-background-50">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="bg-background-100">
                    <th className="text-left px-5 py-4 text-sm font-semibold text-foreground-700 w-[40%]">Fonctionnalité</th>
                    {["Essentiel", "Pro", "Entreprise"].map((p) => {
                      const estColonneActuelle = dejaAbonne && abonnement !== null && abonnement.offre === p;
                      return (
                        <th key={p} className={`px-5 py-4 text-center text-sm font-semibold ${p === "Pro" ? "text-primary-700" : "text-foreground-700"}`}>
                          <span className="inline-flex flex-col items-center gap-1">
                            <span>{p}</span>
                            {estColonneActuelle && (
                              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                                <i className="ri-user-star-line"></i>
                                Votre offre actuelle
                              </span>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                {comparatif.map((group) => (
                  <tbody key={group.title}>
                    <tr className="bg-background-200/50">
                      <td colSpan={4} className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-foreground-500">{group.title}</td>
                    </tr>
                    {group.rows.map((row) => {
                      const isUsersRow = row.label === "Utilisateurs";
                      return (
                        <tr key={row.label} className="border-t border-background-200">
                          <td className="px-5 py-3.5 text-sm text-foreground-800">{row.label}</td>
                          <td className="px-5 py-3.5 text-center"><CellValue value={row.essentiel} /></td>
                          <td className="px-5 py-3.5 text-center bg-primary-50/60"><CellValue value={row.pro} /></td>
                          <td className="px-5 py-3.5 text-center">
                            <CellValue value={row.entreprise} />
                            {isUsersRow && (
                              <button
                                type="button"
                                onClick={() => openDemo("tarifs-comparatif-utilisateurs", { users: 5, plan: "Entreprise" })}
                                className="mt-2 inline-flex items-center gap-1 h-8 px-3 rounded-full bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                              >
                                <i className="ri-team-line"></i>
                                Devis équipe
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </section>

        <SimulateurEntreprise annual={annual} />

        <section id="faq" className="w-full bg-background-100 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-question-answer-line"></i>
                  FAQ tarifs
                </span>
                <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
                  Les questions qu'on nous pose le plus
                </h2>
                <p className="mt-4 text-foreground-600 text-base">
                  Tout ce qu'il faut savoir avant de choisir votre offre ArtiFlow-pro.
                </p>
              </div>

              <FaqAccordion items={tarifsFaq} idPrefix="faq-tarifs" />
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50 text-center">
              <h2 className="font-heading font-bold text-3xl md:text-4xl tracking-tight">
                Encore un doute ? Testez, c'est le plus simple.
              </h2>
              <p className="mt-4 text-sm md:text-base text-background-200/85 max-w-xl mx-auto">
                {dureeEssai > 0 ? `${dureeEssai} jours d'essai, aucun débit avant la fin. ` : ""}On configure votre premier devis avec vous en 20 minutes.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openDemo("tarifs")}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-calendar-check-line"></i>
                  Demander une démo
                </button>
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-login-box-line"></i>
                  Ouvrir mon espace
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <AbonnementCheckoutModal
        open={abonnementState.open}
        plan={abonnementState.plan}
        period={abonnementState.period}
        onClose={closeAbonnement}
      />

      {comparaison ? (
        <ComparerOffresModal
          offreA={comparaison.offreA}
          offreB={comparaison.offreB}
          abonnementId={abonnement?.id ?? null}
          offreActuelle={abonnement?.offre ?? null}
          onClose={() => setComparaison(null)}
        />
      ) : null}
    </div>
  );
}