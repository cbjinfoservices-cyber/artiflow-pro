import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";

export type MetierSchemaInput = {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  intro: string;
  faq: { question: string; answer: string }[];
};

/**
 * Ajoute les données structurées Schema.org d'une page métier :
 * - Service (métier proposé par ArtiFlow-pro) pour viser les extraits enrichis par corps d'état,
 *   avec une offre tarifaire (Offer) par niveau d'abonnement ;
 * - FAQPage (à partir de la FAQ visible de la page) pour viser les rich snippets ;
 * - BreadcrumbList (fil d'Ariane Accueil > Métiers > métier).
 */
export function useMetierSchema(metier: MetierSchemaInput | null) {
  const origin = getSiteOrigin();

  const faqData =
    metier && metier.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: metier.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;

  const serviceData = metier
    ? {
        "@context": "https://schema.org",
        "@type": "Service",
        name: `ArtiFlow-pro pour les ${metier.shortName.toLowerCase()}s`,
        serviceType: `Devis, relances et suivi de chantier pour ${metier.shortName.toLowerCase()}s`,
        description: metier.intro,
        url: `${origin}/metiers/${metier.slug}`,
        inLanguage: "fr-FR",
        areaServed: { "@type": "Country", name: "France" },
        audience: { "@type": "BusinessAudience", name: metier.name },
        provider: {
          "@type": "Organization",
          "@id": `${origin}/#organization`,
          name: "ArtiFlow-pro",
          url: origin,
        },
        offers: [
          {
            "@type": "Offer",
            name: "Offre Essentiel — ArtiFlow-pro",
            description:
              "Devis illimités générés par IA, modèles par corps de métier, relances email automatiques et 1 utilisateur.",
            url: `${origin}/tarifs`,
            price: "29",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "29",
              priceCurrency: "EUR",
              billingDuration: "P1M",
              unitText: "mois",
            },
          },
          {
            "@type": "Offer",
            name: "Offre Pro — ArtiFlow-pro",
            description:
              "Tout l'Essentiel, plus : relances SMS et WhatsApp, planning intelligent, suivi de chantier et signature électronique.",
            url: `${origin}/tarifs`,
            price: "59",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "59",
              priceCurrency: "EUR",
              billingDuration: "P1M",
              unitText: "mois",
            },
          },
          {
            "@type": "Offer",
            name: "Offre Entreprise — ArtiFlow-pro",
            description:
              "Tout le Pro, plus : multi-utilisateurs, rôles et permissions, paiement en ligne des clients et export comptable automatique.",
            url: `${origin}/tarifs`,
            price: "99",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "99",
              priceCurrency: "EUR",
              billingDuration: "P1M",
              unitText: "mois",
            },
          },
        ],
      }
    : null;

  const breadcrumbData = metier
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: `${origin}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Métiers",
            item: `${origin}/metiers`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: metier.name,
            item: `${origin}/metiers/${metier.slug}`,
          },
        ],
      }
    : null;

  useStructuredData("artiflow-metier-service-schema", serviceData);
  useStructuredData("artiflow-metier-faq-schema", faqData);
  useStructuredData("artiflow-metier-breadcrumb-schema", breadcrumbData);
}