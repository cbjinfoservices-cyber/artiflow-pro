import { useStructuredData } from "@/hooks/useStructuredData";

/**
 * Injecte un bloc Schema.org FAQPage à partir d'une liste de questions/réponses
 * réellement affichées sur la page (obligatoire pour rester éligible aux rich snippets).
 */
export function useFaqSchema(
  faqs: { question: string; answer: string }[],
  id = "artiflow-faq-schema"
) {
  const data =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;

  useStructuredData(data ? id : `${id}-disabled`, data);
}