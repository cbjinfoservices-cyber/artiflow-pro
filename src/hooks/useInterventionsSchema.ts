import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import { interventionsPubliques } from "@/mocks/interventions";

/**
 * Injecte les données structurées des interventions publiques (conférences,
 * webinaires, tables rondes, masterclasses, interviews) de la page Média : une
 * ItemList contenant un VideoObject par prise de parole (rediffusion filmée).
 * Cela permet aux moteurs et plateformes de rattacher chaque intervention à la
 * marque et à l'intervenant, et de viser les extraits enrichis vidéo.
 */
export function useInterventionsSchema(id = "artiflow-interventions-schema") {
  const origin = getSiteOrigin();
  const organizationId = `${origin}/#organization`;

  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${origin}/podcast#interventions`,
    name: "Interventions publiques ArtiFlow-pro",
    description:
      "Les conférences, webinaires, tables rondes, masterclasses et interviews de l'équipe ArtiFlow-pro, disponibles en rediffusion.",
    numberOfItems: interventionsPubliques.length,
    itemListElement: interventionsPubliques.map((intervention, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "VideoObject",
        "@id": `${origin}/podcast#${intervention.id}-video`,
        name: intervention.title,
        description: intervention.description,
        thumbnailUrl: [intervention.thumbnailUrl],
        uploadDate: intervention.dateISO,
        duration: intervention.durationISO,
        inLanguage: "fr-FR",
        contentUrl: intervention.videoUrl,
        embedUrl: intervention.videoEmbedUrl,
        isPartOf: { "@id": `${origin}/podcast#interventions` },
        about: {
          "@type": "Organization",
          "@id": organizationId,
          name: "ArtiFlow-pro",
        },
        publisher: {
          "@type": "Organization",
          "@id": organizationId,
          name: "ArtiFlow-pro",
        },
        creator: {
          "@type": "Person",
          "@id": `${origin}/a-propos#${intervention.speakerId}`,
          name: intervention.speaker,
        },
      },
    })),
  };

  useStructuredData(id, data);
}