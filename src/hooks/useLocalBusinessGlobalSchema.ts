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
 * raison sociale CBJ-INFOSERVICES (SARL), siège 14 voie des Meuniers, 94550 Chevilly-Larue,
 * téléphone 07 88 94 61 91, horaires du lundi au vendredi, 9 h – 18 h.
 */
export function useLocalBusinessGlobalSchema(id = "artiflow-localbusiness-global-schema") {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "ArtiFlow-pro",
    legalName: "CBJ-INFOSERVICES",
    vatID: "FR85990157562",
    taxID: "990157562",
    description:
      "SaaS IA des artisans du bâtiment : devis en 2 minutes, relances SMS et WhatsApp automatiques, planning et suivi de chantier.",
    url: "https://artiflow-pro.com",
    telephone: "+33 7 88 94 61 91",
    email: "contact@artiflow-pro.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "14 voie des Meuniers",
      postalCode: "94550",
      addressLocality: "Chevilly-Larue",
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
    priceRange: "€€",
  };

  useStructuredData(id, data);
}