import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";

/**
 * Injecte un bloc Schema.org SoftwareApplication au niveau du site entier.
 *
 * Il décrit le produit lui-même (nom, catégorie, système d'exploitation,
 * page de tarifs) et se rattache à l'entité Organization via son @id. C'est ce
 * bloc qui permet aux moteurs de comprendre qu'ArtiFlow-pro est bien un
 * logiciel en ligne, et non une simple page de contenu.
 *
 * Les URL sont construites à partir de l'origine réelle du site : aucun
 * domaine n'est écrit en dur.
 */
export function useSoftwareApplicationSchema(
  id = "artiflow-software-application-schema"
) {
  const origin = getSiteOrigin();

  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${origin}/#application`,
    name: "ArtiFlow-pro",
    url: `${origin}/`,
    description:
      "L'assistant IA des artisans du bâtiment. Devis, relances, planning et chantiers — réglés depuis le téléphone, sans paperasse.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    publisher: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: "ArtiFlow-pro",
      url: `${origin}/`,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      url: `${origin}/tarifs`,
    },
  };

  useStructuredData(id, data);
}