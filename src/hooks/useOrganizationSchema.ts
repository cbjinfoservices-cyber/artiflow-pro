import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import { logoArtiFlowPro, profilsSociaux } from "@/mocks/social";

/**
 * Injecte un bloc Schema.org Organization au niveau du site entier.
 * Injecté une seule fois depuis App, il accompagne toutes les pages et aide
 * les moteurs de recherche à identifier la marque, son logo, son contact et
 * ses profils sociaux officiels (sameAs), pour consolider l'entité de marque
 * dans le Knowledge Graph.
 */
export function useOrganizationSchema(id = "artiflow-organization-schema") {
  const origin = getSiteOrigin();

  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: "ArtiFlow-pro",
    url: origin,
    logo: logoArtiFlowPro,
    sameAs: profilsSociaux,
    description:
      "ArtiFlow-pro est l'assistant IA des artisans du bâtiment : devis générés par IA, relances automatiques, planning intelligent et suivi de chantier.",
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+33788946191",
        email: "contact@artiflow-pro.fr",
        contactType: "customer service",
        areaServed: "FR",
        availableLanguage: ["French"],
      },
    ],
  };

  useStructuredData(id, data);
}