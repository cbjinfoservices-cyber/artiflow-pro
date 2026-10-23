import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import { logoArtiFlowPro, profilsSociaux } from "@/mocks/social";

/** Description officielle de l'entreprise, reprise du contenu réel du site. */
const DESCRIPTION_ORGANISATION =
  "L'assistant IA des artisans du bâtiment. Devis, relances, planning et chantiers — réglés depuis le téléphone, sans paperasse.";

/**
 * Injecte un bloc Schema.org Organization au niveau du site entier.
 * Injecté une seule fois depuis App, il accompagne toutes les pages et aide
 * les moteurs de recherche (et les moteurs d'IA) à identifier la marque, son
 * logo, son contact, ses fondateurs et ses profils sociaux officiels
 * (sameAs), pour consolider l'entité de marque dans le Knowledge Graph.
 *
 * L'origine est lue depuis l'environnement : aucun domaine n'est figé ici.
 */
export function useOrganizationSchema(id = "artiflow-organization-schema") {
  const origin = getSiteOrigin();

  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: "ArtiFlow-pro",
    url: `${origin}/`,
    logo: logoArtiFlowPro,
    description: DESCRIPTION_ORGANISATION,
    email: "contact@artiflow-pro.com",
    telephone: "+33788946191",
    areaServed: {
      "@type": "Country",
      name: "France",
    },
    founder: [
      {
        "@type": "Person",
        name: "Léa Marchand",
        jobTitle: "Directrice générale",
      },
      {
        "@type": "Person",
        name: "Karim Benali",
        jobTitle: "Directeur technique",
      },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "contact@artiflow-pro.com",
      telephone: "+33788946191",
      availableLanguage: "fr",
      hoursAvailable: "Mo-Fr 09:00-18:00",
    },
    sameAs: profilsSociaux,
  };

  useStructuredData(id, data);
}