import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import { episodesPodcast } from "@/mocks/podcasts";
import { profilsSociaux } from "@/mocks/social";

/**
 * Injecte les données structurées de la page Podcast / Média : une
 * PodcastSeries reliée à l'entité Organisation globale, contenant chaque
 * PodcastEpisode (numéro, date, durée, intervenant). Chaque épisode expose en
 * plus un VideoObject (version vidéo de l'épisode) pour viser les extraits
 * enrichis vidéo. Cela aide les moteurs et les plateformes à rattacher les
 * prises de parole à la marque et à chaque personne de l'équipe.
 */
export function usePodcastSchema(id = "artiflow-podcast-schema") {
  const origin = getSiteOrigin();
  const organizationId = `${origin}/#organization`;
  const seriesId = `${origin}/podcast#series`;

  // Date de dernière mise à jour du flux : on prend la date de l'épisode le plus
  // récent, ce qui reflète une série réellement enrichie au fil des parutions.
  const dateModified = episodesPodcast
    .map((episode) => episode.dateISO)
    .sort()
    .at(-1);

  const data = {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    "@id": seriesId,
    name: "ArtiFlow-pro sur les ondes",
    url: `${origin}/podcast`,
    inLanguage: "fr-FR",
    ...(dateModified ? { dateModified } : {}),
    description:
      "Les interviews et prises de parole de l'équipe ArtiFlow-pro dans les podcasts et médias du bâtiment et de la tech.",
    about: {
      "@type": "Organization",
      "@id": organizationId,
      name: "ArtiFlow-pro",
    },
    publisher: {
      "@type": "Organization",
      "@id": organizationId,
      name: "ArtiFlow-pro",
      sameAs: profilsSociaux,
    },
    episode: episodesPodcast.map((episode) => ({
      "@type": "PodcastEpisode",
      "@id": `${origin}/podcast#${episode.id}`,
      episodeNumber: episode.episodeNumber,
      name: episode.title,
      url: `${origin}/podcast#${episode.id}`,
      datePublished: episode.dateISO,
      timeRequired: episode.durationISO,
      description: episode.description,
      partOfSeries: { "@id": seriesId },
      associatedMedia: {
        "@type": "MediaObject",
        contentUrl: episode.audioUrl,
        encodingFormat: "audio/mpeg",
      },
      video: {
        "@type": "VideoObject",
        "@id": `${origin}/podcast#${episode.id}-video`,
        name: episode.title,
        description: episode.description,
        thumbnailUrl: [episode.thumbnailUrl],
        uploadDate: episode.dateISO,
        duration: episode.durationISO,
        inLanguage: "fr-FR",
        contentUrl: episode.videoUrl,
        embedUrl: episode.videoEmbedUrl,
        isPartOf: { "@id": seriesId },
      },
      author: {
        "@type": "Person",
        "@id": `${origin}/a-propos#${episode.speakerId}`,
        name: episode.speaker,
      },
      publisher: {
        "@type": "Organization",
        name: episode.show,
      },
    })),
  };

  useStructuredData(id, data);
}