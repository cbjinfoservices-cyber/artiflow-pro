import { Navigate, type RouteObject } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { lazy } from "react";
import NotFound from "@/pages/NotFound";
// Les gardes d'accès sont légères et partagées par de nombreuses sections :
// on les garde dans le bundle initial pour éviter un aller-retour sur chaque navigation.
import AuthGuard from "@/pages/app/components/AuthGuard";
import GestionnaireGuard from "@/pages/app/components/GestionnaireGuard";
import GestionnaireSectionGuard from "@/pages/app/components/GestionnaireSectionGuard";
import ArtisanOnlyGuard from "@/pages/app/components/ArtisanOnlyGuard";

// La coquille de l'espace connecté (barre latérale, menu mobile, cloche, bandeaux et tous
// les hooks de suivi qu'elle entraîne) représente un gros volume de code qui n'est utile
// qu'à l'intérieur de /app. On la charge à la demande : elle sort du bundle initial et
// n'est téléchargée qu'au moment d'entrer dans l'espace, ce qui allège nettement le
// fichier principal (index-*.js) servi à tous les visiteurs.
const RoleLayout = lazy(() => import("@/pages/app/components/RoleLayout"));

// Chaque page est chargée à la demande (code splitting) : ouvrir une page
// ne télécharge plus le code de toutes les autres, ce qui allège fortement
// le bundle initial et accélère le premier affichage.
const Home = lazy(() => import("@/pages/home/page"));
const TarifsPage = lazy(() => import("@/pages/tarifs/page"));
const MetiersPage = lazy(() => import("@/pages/metiers/page"));
const MetiersRecapitulatifPage = lazy(() => import("@/pages/metiers/recapitulatif/page"));
const MetierPage = lazy(() => import("@/pages/metier/page"));
const ZonesInterventionPage = lazy(() => import("@/pages/zones-intervention/page"));
const VillePage = lazy(() => import("@/pages/ville/page"));
const RessourcesPage = lazy(() => import("@/pages/ressources/page"));
const RessourcesSujetsPage = lazy(() => import("@/pages/ressources/sujets/page"));
const RessourcesParcoursPage = lazy(() => import("@/pages/ressources/parcours/page"));
const RessourcesBibliothequePage = lazy(() => import("@/pages/ressources/bibliotheque/page"));
const ArticlePage = lazy(() => import("@/pages/ressources/detail/page"));
const PlanDuSitePage = lazy(() => import("@/pages/plan-du-site/page"));
const MentionsLegalesPage = lazy(() => import("@/pages/mentions-legales/page"));
const RgpdPage = lazy(() => import("@/pages/rgpd/page"));
const SuppressionComptePage = lazy(() => import("@/pages/suppression-compte/page"));
const AccordSousTraitancePage = lazy(() => import("@/pages/accord-sous-traitance/page"));
const CgvPage = lazy(() => import("@/pages/cgv/page"));
const CookiesPage = lazy(() => import("@/pages/cookies/page"));
const AccessibilitePage = lazy(() => import("@/pages/accessibilite/page"));
const ContactPage = lazy(() => import("@/pages/contact/page"));
const AProposPage = lazy(() => import("@/pages/a-propos/page"));
const AuteurPage = lazy(() => import("@/pages/auteur/page"));
const PodcastPage = lazy(() => import("@/pages/podcast/page"));
const NouveautesPage = lazy(() => import("@/pages/nouveautes/page"));
const NouveautePersonnalisationPage = lazy(() => import("@/pages/nouveautes/personnalisation-documents/page"));
const NouveauteSuiviEmailsPage = lazy(() => import("@/pages/nouveautes/suivi-emails-clients/page"));
const NouveauteRecapitulatifPage = lazy(() => import("@/pages/nouveautes/recapitulatif/page"));
const RejoindrePage = lazy(() => import("@/pages/rejoindre/page"));
const PressePage = lazy(() => import("@/pages/presse/page"));
const PartenairesPage = lazy(() => import("@/pages/partenaires/page"));
const AuthPage = lazy(() => import("@/pages/app/auth/page"));
const ResetPasswordPage = lazy(() => import("@/pages/app/auth/reset-password/page"));
const AppDemarrage = lazy(() => import("@/pages/app/demarrage/page"));
const AppDashboard = lazy(() => import("@/pages/app/dashboard/page"));
const AppDevis = lazy(() => import("@/pages/app/devis/page"));
const AppBibliothequeLignes = lazy(() => import("@/pages/app/bibliotheque-lignes/page"));
const AppFactures = lazy(() => import("@/pages/app/factures/page"));
const AppFacturationElectronique = lazy(() => import("@/pages/app/facturation-electronique/page"));
const AppClients = lazy(() => import("@/pages/app/clients/page"));
const AppAbonnements = lazy(() => import("@/pages/app/abonnements/page"));
const AppProsInscrits = lazy(() => import("@/pages/app/pros-inscrits/page"));
const AppBackOffice = lazy(() => import("@/pages/app/back-office/page"));
const AppAuditSeo = lazy(() => import("@/pages/app/audit-seo/page"));
const AppMonCompteGestionnaire = lazy(() => import("@/pages/app/mon-compte-gestionnaire/page"));
const AppComptabilite = lazy(() => import("@/pages/app/comptabilite/page"));
const AppPlanning = lazy(() => import("@/pages/app/planning/page"));
const AppIntervenants = lazy(() => import("@/pages/app/intervenants/page"));
const AppPointages = lazy(() => import("@/pages/app/pointages/page"));
const AppRelances = lazy(() => import("@/pages/app/relances/page"));
const AppRelancesProgrammees = lazy(() => import("@/pages/app/relances-programmees/page"));
const AppEnvois = lazy(() => import("@/pages/app/envois/page"));
const AppEnvoisAutomatiques = lazy(() => import("@/pages/app/envois-automatiques/page"));
const AppChantiers = lazy(() => import("@/pages/app/chantiers/page"));
const AppProfil = lazy(() => import("@/pages/app/profil/page"));
const AppPreferences = lazy(() => import("@/pages/app/preferences/page"));
const AppMonPlanning = lazy(() => import("@/pages/app/mon-planning/page"));
const SignatureDevisPage = lazy(() => import("@/pages/signature-devis/page"));
const SuiviChantierPage = lazy(() => import("@/pages/suivi/page"));
const EspaceClientPage = lazy(() => import("@/pages/espace-client/page"));
const GuideMotDePasseSolidePage = lazy(() => import("@/pages/guide-mot-de-passe-solide/page"));

const routes: RouteObject[] = [
  {
    path: "/",
    // L'application mobile démarre directement sur l'espace artisan, sans le site vitrine.
    element: Capacitor.isNativePlatform() ? <Navigate to="/app" replace /> : <Home />,
  },
  {
    path: "/tarifs",
    // Pas de vente d'abonnement dans l'application mobile (règles Google Play / App Store).
    element: Capacitor.isNativePlatform() ? <Navigate to="/app/profil?onglet=abonnement" replace /> : <TarifsPage />,
  },
  {
    path: "/metiers",
    element: <MetiersPage />,
  },
  {
    path: "/metiers/recapitulatif",
    element: <MetiersRecapitulatifPage />,
  },
  {
    path: "/metiers/:slug",
    element: <MetierPage />,
  },
  {
    path: "/zones-intervention",
    element: <ZonesInterventionPage />,
  },
  {
    path: "/zones-intervention/:slug",
    element: <VillePage />,
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
    // Page publique exigée par Google Play : demande de suppression du compte et des données.
    path: "/suppression-compte",
    element: <SuppressionComptePage />,
  },
  {
    // Accord de sous-traitance (article 28 du RGPD), annexe des CGV.
    path: "/accord-sous-traitance",
    element: <AccordSousTraitancePage />,
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
    path: "/presse",
    element: <PressePage />,
  },
  {
    path: "/partenaires",
    element: <PartenairesPage />,
  },
  {
    path: "/nouveautes",
    element: <NouveautesPage />,
  },
  {
    path: "/nouveautes/personnalisation-documents",
    element: <NouveautePersonnalisationPage />,
  },
  {
    path: "/nouveautes/suivi-emails-clients",
    element: <NouveauteSuiviEmailsPage />,
  },
  {
    path: "/nouveautes/recapitulatif",
    element: <NouveauteRecapitulatifPage />,
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
            element: <RoleLayout />,
            children: [
              { index: true, element: <ArtisanOnlyGuard><AppDashboard /></ArtisanOnlyGuard> },
              { path: "devis", element: <ArtisanOnlyGuard><AppDevis /></ArtisanOnlyGuard> },
              { path: "bibliotheque-lignes", element: <ArtisanOnlyGuard><AppBibliothequeLignes /></ArtisanOnlyGuard> },
              { path: "factures", element: <ArtisanOnlyGuard><AppFactures /></ArtisanOnlyGuard> },
              { path: "facturation-electronique", element: <ArtisanOnlyGuard><AppFacturationElectronique /></ArtisanOnlyGuard> },
              { path: "clients", element: <ArtisanOnlyGuard><AppClients /></ArtisanOnlyGuard> },
              // Les professionnels ne sont plus un carnet séparé : l'ancienne page (liens déjà
              // partagés, vues épinglées) arrive directement sur le carnet filtré sur les entreprises.
              { path: "professionnels", element: <Navigate to="/app/clients?type=Professionnels" replace /> },
              { path: "abonnements", element: <GestionnaireGuard><AppAbonnements /></GestionnaireGuard> },
              { path: "pros-inscrits", element: <GestionnaireGuard><AppProsInscrits /></GestionnaireGuard> },
              { path: "back-office", element: <GestionnaireGuard><AppBackOffice /></GestionnaireGuard> },
              { path: "audit-seo", element: <GestionnaireGuard><AppAuditSeo /></GestionnaireGuard> },
              { path: "mon-compte-gestionnaire", element: <GestionnaireGuard><AppMonCompteGestionnaire /></GestionnaireGuard> },
              // Le suivi de l'abonnement vit désormais dans un onglet du profil : les anciens
              // liens (emails, badges, retour de paiement Stripe) y sont redirigés en douceur.
              { path: "mon-abonnement", element: <Navigate to="/app/profil?onglet=abonnement" replace /> },
              { path: "comptabilite", element: <GestionnaireSectionGuard section="comptabilite"><AppComptabilite /></GestionnaireSectionGuard> },
              { path: "planning", element: <ArtisanOnlyGuard><AppPlanning /></ArtisanOnlyGuard> },
              { path: "intervenants", element: <ArtisanOnlyGuard><AppIntervenants /></ArtisanOnlyGuard> },
              { path: "pointages", element: <ArtisanOnlyGuard><AppPointages /></ArtisanOnlyGuard> },
              { path: "relances", element: <ArtisanOnlyGuard><AppRelances /></ArtisanOnlyGuard> },
              { path: "relances-programmees", element: <ArtisanOnlyGuard><AppRelancesProgrammees /></ArtisanOnlyGuard> },
              { path: "envois", element: <ArtisanOnlyGuard><AppEnvois /></ArtisanOnlyGuard> },
              { path: "envois-automatiques", element: <ArtisanOnlyGuard><AppEnvoisAutomatiques /></ArtisanOnlyGuard> },
              { path: "chantiers", element: <ArtisanOnlyGuard><AppChantiers /></ArtisanOnlyGuard> },
              { path: "profil", element: <ArtisanOnlyGuard><AppProfil /></ArtisanOnlyGuard> },
              { path: "preferences", element: <AppPreferences /> },
              { path: "mon-planning", element: <AppMonPlanning /> },
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
    path: "/suivi/:token",
    element: <SuiviChantierPage />,
  },
  {
    path: "/espace-client",
    element: <EspaceClientPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;