import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import type { Ville } from "@/mocks/villes";
import { metiers } from "@/mocks/metiers";

/**
 * Données structurées d'une page « zone d'intervention » (ville) :
 * - Service (ArtiFlow-pro pour les artisans de la ville), avec une zone
 *   desservie déclarée comme City + région administrative ;
 * - FAQPage (à partir de la FAQ locale visible).
 *
 * Le BreadcrumbList est injecté par le composant `FilAriane`, à partir de la
 * même liste que le fil visible — plus de doublon ni d'écart possible.
 *
 * On n'utilise volontairement PAS de LocalBusiness ici : ArtiFlow-pro est un
 * logiciel en ligne, il n'a pas d'établissement physique dans chaque ville.
 */
export function useVilleSchema(ville: Ville | null, faq: { question: string; answer: string }[]) {
  const origin = getSiteOrigin();

  const serviceData = ville
    ? {
        "@context": "https://schema.org",
        "@type": "Service",
        name: `ArtiFlow-pro pour les artisans du bâtiment à ${ville.name}`,
        serviceType: `Logiciel de devis, relances et suivi de chantier pour artisans à ${ville.name}`,
        description: ville.intro,
        url: `${origin}/zones-intervention/${ville.slug}`,
        inLanguage: "fr-FR",
        areaServed: [
          {
            "@type": "City",
            name: ville.name,
            containedInPlace: {
              "@type": "AdministrativeArea",
              name: ville.region,
            },
          },
          ...ville.agglomeration.map((commune) => ({ "@type": "City", name: commune })),
        ],
        availableChannel: {
          "@type": "ServiceChannel",
          serviceUrl: `${origin}/zones-intervention/${ville.slug}`,
          availableLanguage: ["fr-FR"],
        },
        audience: {
          "@type": "BusinessAudience",
          name: metiers.map((m) => m.name).join(", "),
        },
        provider: {
          "@type": "Organization",
          "@id": `${origin}/#organization`,
          name: "ArtiFlow-pro",
          url: origin,
        },
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: `Métiers couverts à ${ville.name}`,
          itemListElement: metiers.map((m) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: `${m.name} — logiciel de devis`,
              url: `${origin}/metiers/${m.slug}`,
            },
          })),
        },
      }
    : null;

  const faqData =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;

  useStructuredData("artiflow-ville-service-schema", serviceData);
  useStructuredData("artiflow-ville-faq-schema", faqData);
}