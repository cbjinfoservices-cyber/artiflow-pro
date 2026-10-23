import { useStructuredData } from "@/hooks/useStructuredData";

/**
 * Balisage Schema.org LocalBusiness du site entier.
 *
 * Bloc volontairement autonome : il ne dépend pas de `coordonneesEntreprise`
 * et ne remplace aucun autre schéma (Organization, SoftwareApplication,
 * WebSite, FAQPage, Product…). Il est injecté une seule fois depuis App, donc
 * il accompagne toutes les pages via le <head> partagé.
 *
 * Les valeurs reprennent celles publiées sur la page mentions légales :
 * raison sociale ArtiFlow-pro SAS, siège 12 rue des Artisans, 75011 Paris,
 * téléphone 07 88 94 61 91, horaires du lundi au vendredi, 9 h – 18 h.
 */
export function useLocalBusinessGlobalSchema(id = "artiflow-localbusiness-global-schema") {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "ArtiFlow-pro",
    legalName: "ArtiFlow-pro SAS",
    description:
      "SaaS IA des artisans du bâtiment : devis en 2 minutes, relances SMS et WhatsApp automatiques, planning et suivi de chantier.",
    url: "https://artiflow-pro.fr",
    telephone: "+33 7 88 94 61 91",
    email: "contact@artiflow-pro.fr",
    address: {
      "@type": "PostalAddress",
      streetAddress: "12 rue des Artisans",
      postalCode: "75011",
      addressLocality: "Paris",
      addressCountry: "FR",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    geo: {
      "@type": "GeoCoordinates",
      latitude: 48.8618,
      longitude: 2.377,
    },
    priceRange: "€€",
  };

  useStructuredData(id, data);
}