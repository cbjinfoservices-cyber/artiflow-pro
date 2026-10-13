import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";

export type OfferPlan = {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  features?: string[];
  url?: string;
};

/**
 * Injecte un bloc Schema.org ItemList de Product/Offer à partir des offres
 * réellement affichées sur la page (nom, prix, devise, disponibilité, atouts).
 * Éligible aux extraits enrichis sur le prix dans les résultats Google.
 */
export function useProductOfferSchema(
  plans: OfferPlan[],
  id = "artiflow-offer-schema"
) {
  const origin = getSiteOrigin();

  const data =
    plans.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: plans.map((plan, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "Product",
              name: plan.name,
              description: plan.description,
              brand: { "@type": "Brand", name: "ArtiFlow-pro" },
              ...(plan.features && plan.features.length > 0
                ? { featureList: plan.features }
                : {}),
              offers: {
                "@type": "Offer",
                price: String(plan.price),
                priceCurrency: plan.currency ?? "EUR",
                availability: "https://schema.org/InStock",
                url: `${origin}${plan.url ?? "/tarifs"}`,
              },
            },
          })),
        }
      : null;

  useStructuredData(data ? id : `${id}-disabled`, data);
}