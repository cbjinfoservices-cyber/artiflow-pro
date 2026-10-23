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
  /**
   * Type Schema.org émis. « Article » par défaut ; « BlogPosting » pour un billet
   * éditorial signé par l'entreprise (l'auteur devient alors l'organisation).
   */
  schemaType?: "Article" | "BlogPosting";
  /** Description dédiée au balisage (par défaut, l'extrait du guide). */
  description?: string;
  /** Date de publication ISO 8601 explicite, prioritaire sur la date lisible. */
  datePublishedIso?: string;
  /** Date de dernière modification ISO 8601 explicite, prioritaire sur `dateModified`. */
  dateModifiedIso?: string;
};

/**
 * Ajoute les données structurées Schema.org de type Article sur une page guide.
 */
export function useArticleSchema(article: ArticleSchemaInput | null) {
  const origin = getSiteOrigin();
  const type = article?.schemaType ?? "Article";
  const estBillet = type === "BlogPosting";
  const datePublication = article?.datePublishedIso ?? toIsoDate(article?.date);
  const dateModification = article?.dateModifiedIso ?? article?.dateModified;
  const editeur = {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: "ArtiFlow-pro",
    url: origin,
  };

  const data = article
    ? {
        "@context": "https://schema.org",
        "@type": type,
        headline: article.title,
        description: article.description ?? article.excerpt,
        inLanguage: "fr-FR",
        author: estBillet
          ? { ...editeur }
          : article.author
            ? {
                "@type": "Person",
                "@id": `${origin}/a-propos#${article.author.id}`,
                name: article.author.name,
                url: `${origin}/a-propos#${article.author.id}`,
              }
            : { "@type": "Organization", name: "ArtiFlow-pro" },
        publisher: editeur,
        ...(article.section ? { articleSection: article.section } : {}),
        ...(article.image ? { image: article.image } : {}),
        ...(datePublication ? { datePublished: datePublication } : {}),
        ...(dateModification ? { dateModified: dateModification } : {}),
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${origin}/ressources/${article.slug}`,
        },
      }
    : null;

  useStructuredData("artiflow-article-schema", data);
}