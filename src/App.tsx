import { Suspense, lazy } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import ChargementPage from "@/components/base/ChargementPage";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import DemoModalProvider from "./components/feature/DemoModalProvider";
import ScrollToHash from "@/components/feature/ScrollToHash";
import LienEvitement from "@/components/feature/LienEvitement";
import IntegrationNative from "@/components/feature/IntegrationNative";

// Éléments de confort global (bannière cookies, mesure d'audience, bouton retour haut,
// synchronisation des préférences) : rien d'indispensable au premier affichage. On les
// charge à la demande pour sortir leur code du bundle initial.
const CookieConsent = lazy(() => import("@/components/feature/CookieConsent"));
const AnalyticsGate = lazy(() => import("@/components/feature/AnalyticsGate"));
const BackToTop = lazy(() => import("@/components/feature/BackToTop"));
const SyncPreferencesGlobal = lazy(() => import("@/components/feature/SyncPreferencesGlobal"));
const ResumeRestaurationPreferences = lazy(() => import("@/components/feature/ResumeRestaurationPreferences"));
import { AuthProvider } from "@/hooks/useAuth";
import { useOrganizationSchema } from "@/hooks/useOrganizationSchema";
import { useSoftwareApplicationSchema } from "@/hooks/useSoftwareApplicationSchema";
import { useWebsiteSchema } from "@/hooks/useWebsiteSchema";
import { useLocalBusinessGlobalSchema } from "@/hooks/useLocalBusinessGlobalSchema";


function App() {
  // Entités du site injectées une seule fois, pour toutes les routes.
  // Les blocs sont produits par les modules de schéma dédiés (un par type) et
  // non par le gestionnaire de métadonnées : les deux mécanismes restent
  // séparés, comme le veut le modèle du projet.
  useOrganizationSchema();
  useSoftwareApplicationSchema();
  useWebsiteSchema();
  useLocalBusinessGlobalSchema();

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <DemoModalProvider>
            <LienEvitement />
            <IntegrationNative />
            <ScrollToHash />
            <Suspense fallback={null}>
              <SyncPreferencesGlobal />
              <ResumeRestaurationPreferences />
            </Suspense>
            <Suspense fallback={<ChargementPage />}>
              <AppRoutes />
            </Suspense>
            <Suspense fallback={null}>
              <CookieConsent />
              <AnalyticsGate />
              <BackToTop />
            </Suspense>
          </DemoModalProvider>
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default App;