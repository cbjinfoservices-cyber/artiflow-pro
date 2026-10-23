import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";

/**
 * Injecte un bloc Schema.org WebSite au niveau du site entier (une seule fois).
 * Il rattache le site à l'entité Organization et aide les moteurs à présenter
 * le nom du site et ses liens de sitelinks dans les résultats de recherche.
 */
export function useWebsiteSchema(id = "artiflow-website-schema") {
  const origin = getSiteOrigin();

  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: origin,
    name: "ArtiFlow-pro",
    inLanguage: "fr-FR",
    description:
      "ArtiFlow-pro est l'assistant IA des artisans du bâtiment : devis générés par IA, relances automatiques, planning intelligent et suivi de chantier.",
    publisher: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: "ArtiFlow-pro",
      url: `${origin}/`,
    },
  };

  useStructuredData(id, data);
}