import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";

const MOIS: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
};

/**
 * Convertit une date lisible en français ("18 septembre 2026") au format ISO 8601
 * attendu par Schema.org ("2026-09-18"). Retourne undefined si le format est inconnu.
 */
function toIsoDate(frDate?: string): string | undefined {
  if (!frDate) return undefined;
  const match = frDate.trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (!match) return undefined;
  const jour = match[1].padStart(2, "0");
  const mois = MOIS[
    match[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  ];
  if (!mois) return undefined;
  return `${match[3]}-${mois}-${jour}`;
}

export type ArticleSchemaInput = {
  slug: string;
  title: string;
  excerpt: string;
  date?: string;
  /** Date de dernière mise à jour (ISO 8601), pour signaler la fraîcheur du guide. */
  dateModified?: string;
  section?: string;
  image?: string;
  /** Auteur du guide, relié à sa fiche membre (entité Person). */
  author?: { name: string; id: string } | null;
};

/**
 * Ajoute les données structurées Schema.org de type Article sur une page guide.
 */
export function useArticleSchema(article: ArticleSchemaInput | null) {
  const data = article
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        inLanguage: "fr-FR",
        author: article.author
          ? {
              "@type": "Person",
              "@id": `${getSiteOrigin()}/a-propos#${article.author.id}`,
              name: article.author.name,
              url: `${getSiteOrigin()}/a-propos#${article.author.id}`,
            }
          : { "@type": "Organization", name: "ArtiFlow-pro" },
        publisher: { "@type": "Organization", name: "ArtiFlow-pro" },
        ...(article.section ? { articleSection: article.section } : {}),
        ...(article.image ? { image: article.image } : {}),
        ...(toIsoDate(article.date) ? { datePublished: toIsoDate(article.date) } : {}),
        ...(article.dateModified ? { dateModified: article.dateModified } : {}),
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${getSiteOrigin()}/ressources/${article.slug}`,
        },
      }
    : null;

  useStructuredData("artiflow-article-schema", data);
}