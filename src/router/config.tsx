import { Navigate, type RouteObject } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/home/page";
import TarifsPage from "@/pages/tarifs/page";
import MetiersPage from "@/pages/metiers/page";
import MetierPage from "@/pages/metier/page";
import RessourcesPage from "@/pages/ressources/page";
import RessourcesSujetsPage from "@/pages/ressources/sujets/page";
import RessourcesParcoursPage from "@/pages/ressources/parcours/page";
import RessourcesBibliothequePage from "@/pages/ressources/bibliotheque/page";
import ArticlePage from "@/pages/ressources/detail/page";
import PlanDuSitePage from "@/pages/plan-du-site/page";
import MentionsLegalesPage from "@/pages/mentions-legales/page";
import RgpdPage from "@/pages/rgpd/page";
import CgvPage from "@/pages/cgv/page";
import CookiesPage from "@/pages/cookies/page";
import AccessibilitePage from "@/pages/accessibilite/page";
import ContactPage from "@/pages/contact/page";
import AProposPage from "@/pages/a-propos/page";
import AuteurPage from "@/pages/auteur/page";
import PodcastPage from "@/pages/podcast/page";
import NouveautesPage from "@/pages/nouveautes/page";
import RejoindrePage from "@/pages/rejoindre/page";
import AppLayout from "@/pages/app/components/AppLayout";
import AuthGuard from "@/pages/app/components/AuthGuard";
import GestionnaireGuard from "@/pages/app/components/GestionnaireGuard";
import GestionnaireSectionGuard from "@/pages/app/components/GestionnaireSectionGuard";
import ArtisanOnlyGuard from "@/pages/app/components/ArtisanOnlyGuard";
import AuthPage from "@/pages/app/auth/page";
import ResetPasswordPage from "@/pages/app/auth/reset-password/page";
import AppDemarrage from "@/pages/app/demarrage/page";
import AppDashboard from "@/pages/app/dashboard/page";
import AppDevis from "@/pages/app/devis/page";
import AppBibliothequeLignes from "@/pages/app/bibliotheque-lignes/page";
import AppFactures from "@/pages/app/factures/page";
import AppClients from "@/pages/app/clients/page";
import AppProfessionnels from "@/pages/app/professionnels/page";
import AppAbonnements from "@/pages/app/abonnements/page";
import AppBackOffice from "@/pages/app/back-office/page";
import AppAuditSeo from "@/pages/app/audit-seo/page";
import AppMonCompteGestionnaire from "@/pages/app/mon-compte-gestionnaire/page";
import AppComptabilite from "@/pages/app/comptabilite/page";
import AppPlanning from "@/pages/app/planning/page";
import AppRelances from "@/pages/app/relances/page";
import AppRelancesProgrammees from "@/pages/app/relances-programmees/page";
import AppEnvois from "@/pages/app/envois/page";
import AppEnvoisAutomatiques from "@/pages/app/envois-automatiques/page";
import AppChantiers from "@/pages/app/chantiers/page";
import AppProfil from "@/pages/app/profil/page";
import AppPreferences from "@/pages/app/preferences/page";
import SignatureDevisPage from "@/pages/signature-devis/page";
import GuideMotDePasseSolidePage from "@/pages/guide-mot-de-passe-solide/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/tarifs",
    element: <TarifsPage />,
  },
  {
    path: "/metiers",
    element: <MetiersPage />,
  },
  {
    path: "/metiers/:slug",
    element: <MetierPage />,
  },
  {
    path: "/ressources",
    element: <RessourcesPage />,
  },
  {
    path: "/ressources/sujets",
    element: <RessourcesSujetsPage />,
  },
  {
    path: "/ressources/parcours/:slug",
    element: <RessourcesParcoursPage />,
  },
  {
    path: "/ressources/bibliotheque",
    element: <RessourcesBibliothequePage />,
  },
  {
    path: "/ressources/:slug",
    element: <ArticlePage />,
  },
  {
    path: "/plan-du-site",
    element: <PlanDuSitePage />,
  },
  {
    path: "/mentions-legales",
    element: <MentionsLegalesPage />,
  },
  {
    path: "/rgpd",
    element: <RgpdPage />,
  },
  {
    path: "/cgv",
    element: <CgvPage />,
  },
  {
    path: "/cookies",
    element: <CookiesPage />,
  },
  {
    path: "/accessibilite",
    element: <AccessibilitePage />,
  },
  {
    path: "/contact",
    element: <ContactPage />,
  },
  {
    path: "/a-propos",
    element: <AProposPage />,
  },
  {
    path: "/auteurs/:id",
    element: <AuteurPage />,
  },
  {
    path: "/podcast",
    element: <PodcastPage />,
  },
  {
    path: "/nous-rejoindre",
    element: <RejoindrePage />,
  },
  {
    path: "/nouveautes",
    element: <NouveautesPage />,
  },
  {
    path: "/app",
    children: [
      { path: "auth", element: <AuthPage /> },
      { path: "auth/reset-password", element: <ResetPasswordPage /> },
      {
        element: <AuthGuard />,
        children: [
          { path: "demarrage", element: <ArtisanOnlyGuard><AppDemarrage /></ArtisanOnlyGuard> },
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <ArtisanOnlyGuard><AppDashboard /></ArtisanOnlyGuard> },
              { path: "devis", element: <ArtisanOnlyGuard><AppDevis /></ArtisanOnlyGuard> },
              { path: "bibliotheque-lignes", element: <ArtisanOnlyGuard><AppBibliothequeLignes /></ArtisanOnlyGuard> },
              { path: "factures", element: <ArtisanOnlyGuard><AppFactures /></ArtisanOnlyGuard> },
              { path: "clients", element: <ArtisanOnlyGuard><AppClients /></ArtisanOnlyGuard> },
              { path: "professionnels", element: <ArtisanOnlyGuard><AppProfessionnels /></ArtisanOnlyGuard> },
              { path: "abonnements", element: <GestionnaireGuard><AppAbonnements /></GestionnaireGuard> },
              { path: "back-office", element: <GestionnaireGuard><AppBackOffice /></GestionnaireGuard> },
              { path: "audit-seo", element: <GestionnaireGuard><AppAuditSeo /></GestionnaireGuard> },
              { path: "mon-compte-gestionnaire", element: <GestionnaireGuard><AppMonCompteGestionnaire /></GestionnaireGuard> },
              // Le suivi de l'abonnement vit désormais dans un onglet du profil : les anciens
              // liens (emails, badges, retour de paiement Stripe) y sont redirigés en douceur.
              { path: "mon-abonnement", element: <Navigate to="/app/profil?onglet=abonnement" replace /> },
              { path: "comptabilite", element: <GestionnaireSectionGuard section="comptabilite"><AppComptabilite /></GestionnaireSectionGuard> },
              { path: "planning", element: <ArtisanOnlyGuard><AppPlanning /></ArtisanOnlyGuard> },
              { path: "relances", element: <ArtisanOnlyGuard><AppRelances /></ArtisanOnlyGuard> },
              { path: "relances-programmees", element: <ArtisanOnlyGuard><AppRelancesProgrammees /></ArtisanOnlyGuard> },
              { path: "envois", element: <ArtisanOnlyGuard><AppEnvois /></ArtisanOnlyGuard> },
              { path: "envois-automatiques", element: <ArtisanOnlyGuard><AppEnvoisAutomatiques /></ArtisanOnlyGuard> },
              { path: "chantiers", element: <ArtisanOnlyGuard><AppChantiers /></ArtisanOnlyGuard> },
              { path: "profil", element: <ArtisanOnlyGuard><AppProfil /></ArtisanOnlyGuard> },
              { path: "preferences", element: <AppPreferences /> },
              // Redirection douce : les anciens liens vers l'ancienne page Diagnostic
              // (déjà partagés ou reçus par email) arrivent au tableau de bord.
              { path: "diagnostic", element: <Navigate to="/app" replace /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "/guide/mot-de-passe-solide",
    element: <GuideMotDePasseSolidePage />,
  },
  {
    path: "/signature-devis/:token",
    element: <SignatureDevisPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;