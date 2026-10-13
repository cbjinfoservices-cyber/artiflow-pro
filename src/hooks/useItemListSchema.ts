import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";

export type ItemListEntry = {
  /** Titre affiché du guide. */
  name: string;
  /** Chemin relatif de la fiche (ex. « /ressources/mon-guide »). */
  path: string;
};

export type ItemListSchemaInput = {
  /** Nom de la liste (ex. « Guides ArtiFlow-pro »). */
  name: string;
  /** Description facultative de la liste. */
  description?: string;
  /** Ordre d'affichage des guides sur la page. */
  items: ItemListEntry[];
};

/**
 * Injecte un bloc Schema.org ItemList pour une page de type hub/listing.
 * Utilisé notamment sur le hub Ressources afin de mieux décrire la liste des
 * guides à destination des moteurs de recherche.
 */
export function useItemListSchema(input: ItemListSchemaInput | null, id = "artiflow-itemlist-schema") {
  const origin = getSiteOrigin();

  const data =
    input && input.items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          numberOfItems: input.items.length,
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          itemListElement: input.items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            url: `${origin}${item.path}`,
          })),
        }
      : null;

  useStructuredData(data ? id : `${id}-disabled`, data);
}