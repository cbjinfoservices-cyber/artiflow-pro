import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useRegulariteComptable } from "@/hooks/useRegulariteComptable";
import { compterVisuelsManquants } from "@/lib/auditSeo";
import { fetchAbonnements, type AbonnementItem } from "@/lib/abonnementsApi";
import BackOfficeKpis from "@/pages/app/back-office/components/BackOfficeKpis";
import RegulariteComptableCard from "@/pages/app/back-office/components/RegulariteComptableCard";
import AccesGestionnairesCard from "@/pages/app/back-office/components/AccesGestionnairesCard";
import NoteBackOfficeCard from "@/pages/app/back-office/components/NoteBackOfficeCard";
import SuppressionsEnAttenteCard from "@/pages/app/back-office/components/SuppressionsEnAttenteCard";
import BackOfficeEvolutionCard from "@/pages/app/back-office/components/BackOfficeEvolutionCard";
import ControleAccesSecuriteCard from "@/pages/app/back-office/components/ControleAccesSecuriteCard";
import JournalErreursChargementCard from "@/pages/app/back-office/components/JournalErreursChargementCard";
import HistoriquePaiementsEchecsCard from "@/pages/app/back-office/components/HistoriquePaiementsEchecsCard";
import RecapsPaiementEnvoyesCard from "@/pages/app/back-office/components/RecapsPaiementEnvoyesCard";
import HistoriqueAlertesConfigStripeCard from "@/pages/app/back-office/components/HistoriqueAlertesConfigStripeCard";
import GuideDepannagePaiementCard from "@/pages/app/back-office/components/GuideDepannagePaiementCard";
import HistoriqueTestPaiementBlancCard from "@/pages/app/back-office/components/HistoriqueTestPaiementBlancCard";
import BadgeAlerteConfigStripe from "@/pages/app/back-office/components/BadgeAlerteConfigStripe";
import EpisodePiloteCard from "@/pages/app/back-office/components/EpisodePiloteCard";
import DureeEssaiCard from "@/pages/app/back-office/components/DureeEssaiCard";
import TestAbonnementEssaiCard from "@/pages/app/back-office/components/TestAbonnementEssaiCard";
import ApercuEmailEssaiCard from "@/pages/app/back-office/components/ApercuEmailEssaiCard";
import SuiviEnvoisFournisseurCard from "@/pages/app/back-office/components/SuiviEnvoisFournisseurCard";
import GuideDepannageEmailCard from "@/pages/app/back-office/components/GuideDepannageEmailCard";
import AlerteTauxEnvoisCard from "@/pages/app/back-office/components/AlerteTauxEnvoisCard";

/**
 * Page d'accueil du back-office, point d'arrivée d'un compte gestionnaire.
 * Elle rassemble une vue d'ensemble en trois volets : abonnements, régularité
 * comptable de tous les artisans, et accès des gestionnaires au back-office.
 */
export default function AppBackOffice() {
  usePageMeta(
    "Back-office · ArtiFlow-pro",
    "Vue d'ensemble du back-office ArtiFlow-pro : abonnements, régularité comptable des artisans et accès gestionnaires.",
  );

  const { user, gestionnaires, isGestionnairePrincipal, voirComptabilite } = useAuth();
  const [abos, setAbos] = useState<AbonnementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reguRefresh, setReguRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAbos(await fetchAbonnements());
    } catch {
      setError("Impossible de charger les abonnements pour l'instant. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { stats, loading: reguLoading, error: reguError } = useRegulariteComptable(
    `${user?.id ?? ""}:${reguRefresh}`,
  );

  // Pages publiques dont le visuel de partage reste à compléter (image générique).
  const visuelsManquants = compterVisuelsManquants();

  const liens: { to: string; icon: string; titre: string; texte: string; badge?: number }[] = [
    {
      to: "/app/abonnements",
      icon: "ri-money-euro-circle-line",
      titre: "Abonnements",
      texte: "Suivi des offres, MRR et impayés",
    },
    {
      to: "/app/pros-inscrits",
      icon: "ri-user-star-line",
      titre: "Pros inscrits",
      texte: "Les pros inscrits et le détail de leur inscription",
    },
    ...(voirComptabilite
      ? [
          {
            to: "/app/comptabilite",
            icon: "ri-file-chart-line",
            titre: "Comptabilité",
            texte: "Journaux, TVA et envois au comptable",
          },
        ]
      : []),
    {
      to: "/app/mon-compte-gestionnaire",
      icon: "ri-shield-user-line",
      titre: "Compte gestionnaire",
      texte: "Adresses, accès et journal des modifications",
    },
    {
      to: "/app/audit-seo",
      icon: "ri-search-eye-line",
      titre: "Audit SEO",
      texte: "Titres, descriptions et visuels de partage des pages publiques",
      badge: visuelsManquants,
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
            <i className="ri-dashboard-3-line text-2xl"></i>
          </span>
          <div>
            <h2 className="font-heading font-bold text-xl text-foreground-950">Vue d'ensemble du back-office</h2>
            <p className="text-sm text-foreground-500">
              Abonnements, régularité comptable et accès gestionnaires en un coup d'œil.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeAlerteConfigStripe />
          <span
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap ${
              isGestionnairePrincipal ? "bg-primary-100 text-primary-800" : "bg-secondary-100 text-secondary-800"
            }`}
          >
            <i className={isGestionnairePrincipal ? "ri-shield-star-line" : "ri-shield-user-line"}></i>
            {isGestionnairePrincipal ? "Gestionnaire principal" : "Gestionnaire"}
          </span>
        </div>
      </div>

      <NoteBackOfficeCard />

      <SuppressionsEnAttenteCard />

      <DureeEssaiCard />

      <TestAbonnementEssaiCard />

      <ApercuEmailEssaiCard />

      <ApercuEmailEssaiCard variant="essai-j1" />

      <SuiviEnvoisFournisseurCard />

      <GuideDepannageEmailCard />

      <AlerteTauxEnvoisCard />

      <BackOfficeKpis abos={abos} loading={loading} error={error} onRetry={load} />

      <BackOfficeEvolutionCard
        stats={stats}
        loading={reguLoading}
        error={reguError}
        onRetry={() => setReguRefresh((k) => k + 1)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RegulariteComptableCard
          stats={stats}
          loading={reguLoading}
          error={reguError}
          canOpenCompta={voirComptabilite}
        />
        <AccesGestionnairesCard gestionnaires={gestionnaires} isPrincipal={isGestionnairePrincipal} />
      </div>

      <ControleAccesSecuriteCard />

      <JournalErreursChargementCard />

      <HistoriquePaiementsEchecsCard />

      <RecapsPaiementEnvoyesCard />

      <HistoriqueAlertesConfigStripeCard />

      <GuideDepannagePaiementCard />

      <HistoriqueTestPaiementBlancCard />

      <EpisodePiloteCard />

      <div>
        <p className="text-[11px] font-semibold text-foreground-400 uppercase tracking-wide mb-2">Accès rapides</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {liens.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="group flex items-center gap-3 p-4 rounded-lg bg-background-100 border border-background-200 hover:border-primary-300 cursor-pointer transition-colors"
            >
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className={`${l.icon} text-lg`}></i>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground-950">{l.titre}</p>
                  {typeof l.badge === "number" && (
                    <span
                      title={
                        l.badge > 0
                          ? `${l.badge} page${l.badge > 1 ? "s" : ""} à compléter : le visuel de partage retombe sur l'image générique du site.`
                          : "Aucun visuel de partage manquant — toutes les pages sont couvertes."
                      }
                      aria-label={
                        l.badge > 0
                          ? `${l.badge} page${l.badge > 1 ? "s" : ""} avec un visuel de partage manquant`
                          : "Aucun visuel de partage manquant"
                      }
                      className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 ${
                        l.badge > 0
                          ? "bg-accent-500 text-background-50"
                          : "bg-secondary-100 text-secondary-800 border border-secondary-200"
                      }`}
                    >
                      <i className={l.badge > 0 ? "ri-error-warning-line" : "ri-check-line"}></i>
                      {l.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-foreground-500 truncate">{l.texte}</p>
              </div>
              <i className="ri-arrow-right-line ml-auto shrink-0 text-foreground-400 group-hover:text-primary-600 transition-colors"></i>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}