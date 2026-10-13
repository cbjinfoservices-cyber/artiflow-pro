import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import Hero from "./components/Hero";
import SommaireAccueil from "./components/SommaireAccueil";
import ProductPreview from "./components/ProductPreview";
import Features from "./components/Features";
import BeforeAfter from "./components/BeforeAfter";
import Workflow from "./components/Workflow";
import Pricing from "./components/Pricing";
import Simulateur from "./components/Simulateur";
import Preuves from "./components/Preuves";
import Faq from "./components/Faq";
import HubLinks from "./components/HubLinks";
import ContactCta from "./components/ContactCta";
import { faqs } from "@/mocks/landing";
import { useFaqSchema } from "@/hooks/useFaqSchema";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Home() {
  usePageMeta(
    "ArtiFlow-pro — Assistant IA pour artisans du bâtiment",
    "ArtiFlow-pro est le SaaS IA des artisans : devis générés par IA, relances automatiques SMS et WhatsApp, planning intelligent et suivi de chantier. Demandez une démo.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20product%20hero%20banner%20for%20an%20AI%20construction%20assistant%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20gradients%2C%20abstract%20dashboard%20and%20quote%20document%20shapes%2C%20blueprint%20grid%20lines%2C%20dark%20charcoal%20background%2C%20cinematic%20lighting%2C%20premium%20minimal%20editorial%20composition%2C%20wide%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-accueil&orientation=landscape",
    }
  );
  useFaqSchema(faqs, "artiflow-home-faq-schema");
  useBreadcrumbSchema([{ name: "Accueil", path: "/" }], "artiflow-home-breadcrumb-schema");

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />
      <main>
        <Hero />
        <SommaireAccueil />
        <ProductPreview />
        <Features />
        <BeforeAfter />
        <Workflow />
        <Pricing />
        <Simulateur />
        <Preuves />
        <Faq />
        <HubLinks />
        <ContactCta />
      </main>
      <Footer />
    </div>
  );
}