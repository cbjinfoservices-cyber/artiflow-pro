import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";

export type BreadcrumbItem = { name: string; path: string };

/**
 * Injecte un bloc Schema.org BreadcrumbList à partir du fil d'Ariane visible.
 * Le premier élément correspond généralement à l'accueil.
 */
export function useBreadcrumbSchema(
  items: BreadcrumbItem[],
  id = "artiflow-breadcrumb-schema"
) {
  const origin = getSiteOrigin();

  const data =
    items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: `${origin}${item.path}`,
          })),
        }
      : null;

  useStructuredData(data ? id : `${id}-disabled`, data);
}