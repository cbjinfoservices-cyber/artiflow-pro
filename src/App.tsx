import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import DemoModalProvider from "./components/feature/DemoModalProvider";
import CookieConsent from "@/components/feature/CookieConsent";
import AnalyticsGate from "@/components/feature/AnalyticsGate";
import BackToTop from "@/components/feature/BackToTop";
import ScrollToHash from "@/components/feature/ScrollToHash";
import SyncPreferencesGlobal from "@/components/feature/SyncPreferencesGlobal";
import ResumeRestaurationPreferences from "@/components/feature/ResumeRestaurationPreferences";
import { useOrganizationSchema } from "@/hooks/useOrganizationSchema";
import { useWebsiteSchema } from "@/hooks/useWebsiteSchema";
import { AuthProvider } from "@/hooks/useAuth";


function App() {
  useOrganizationSchema();
  useWebsiteSchema();

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <DemoModalProvider>
            <ScrollToHash />
            <SyncPreferencesGlobal />
            <ResumeRestaurationPreferences />
            <AppRoutes />
            <CookieConsent />
            <AnalyticsGate />
            <BackToTop />
          </DemoModalProvider>
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default App;