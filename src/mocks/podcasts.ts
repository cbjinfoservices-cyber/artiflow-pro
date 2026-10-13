import { liensExternes } from "@/mocks/liensExternes";
import { estEnLigne } from "@/mocks/interventions";

export type EpisodePodcast = {
  id: string;
  /** Numéro de l'épisode dans l'émission d'accueil. */
  episodeNumber: number;
  /** Émission / média qui héberge l'épisode. */
  show: string;
  title: string;
  date: string;
  dateISO: string;
  /** Durée affichée (ex. « 34 min »). */
  duration: string;
  /** Durée au format ISO 8601, utilisée dans le balisage PodcastEpisode. */
  durationISO: string;
  speaker: string;
  speakerId: string;
  /** Lieu de l'épisode (ville du studio d'enregistrement, ou « En ligne »). */
  location: string;
  description: string;
  /** Fichier audio intégré au lecteur de la page. */
  audioUrl: string;
  /** Lien externe vers l'émission complète sur la plateforme du média. */
  listenUrl: string;
  /** Version vidéo de l'épisode (page de visionnage), pour le balisage VideoObject. */
  videoUrl: string;
  /** URL d'intégration de la version vidéo, pour le balisage VideoObject. */
  videoEmbedUrl: string;
  /** Vignette de l'épisode, utilisée comme miniature du VideoObject. */
  thumbnailUrl: string;
  icon: string;
  tone: "primary" | "accent" | "secondary";
};

export type PlateformePodcast = {
  icon: string;
  label: string;
  href: string;
};

/**
 * Épisodes de podcast où l'équipe ArtiFlow-pro intervient.
 * Chaque épisode dispose d'un fichier audio intégré (lecteur), d'un lien vers
 * la plateforme d'origine du média et d'une version vidéo référencée.
 */
export const episodesPodcast: EpisodePodcast[] = [
  {
    id: "chantier-numerique-ia-chiffrage",
    episodeNumber: 128,
    show: "Le Chantier Numérique",
    title: "L'IA va-t-elle remplacer le chiffrage manuel ?",
    date: "3 octobre 2026",
    dateISO: "2026-10-03",
    duration: "42 min",
    durationISO: "PT42M",
    speaker: "Léa Marchand",
    speakerId: "lea-marchand",
    location: "En ligne",
    description:
      "Léa Marchand démonte l'idée reçue selon laquelle l'IA remplacerait le savoir-faire de l'artisan. On parle chiffrage, confiance et temps rendu au terrain.",
    audioUrl: liensExternes.episodesAudio["chantier-numerique-ia-chiffrage"],
    listenUrl: liensExternes.episodesListen["chantier-numerique-ia-chiffrage"],
    videoUrl: liensExternes.episodesVideo["chantier-numerique-ia-chiffrage"].watch,
    videoEmbedUrl: liensExternes.episodesVideo["chantier-numerique-ia-chiffrage"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20podcast%20episode%20cover%20about%20artificial%20intelligence%20and%20construction%20cost%20estimation%2C%20a%20studio%20microphone%20silhouette%20with%20glowing%20blueprint%20lines%20and%20a%20calculator%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-podcast-thumb-ia-chiffrage&orientation=landscape",
    icon: "ri-mic-line",
    tone: "primary",
  },
  {
    id: "radio-artisan-rgpd",
    episodeNumber: 87,
    show: "Radio Artisan",
    title: "Sécurité et RGPD des outils de chantier",
    date: "26 septembre 2026",
    dateISO: "2026-09-26",
    duration: "28 min",
    durationISO: "PT28M",
    speaker: "Karim Benali",
    speakerId: "karim-benali",
    location: "Paris",
    description:
      "Karim Benali explique, sans jargon, ce qu'un logiciel de chantier devrait faire de vos données, et les questions à poser avant de signer.",
    audioUrl: liensExternes.episodesAudio["radio-artisan-rgpd"],
    listenUrl: liensExternes.episodesListen["radio-artisan-rgpd"],
    videoUrl: liensExternes.episodesVideo["radio-artisan-rgpd"].watch,
    videoEmbedUrl: liensExternes.episodesVideo["radio-artisan-rgpd"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20podcast%20episode%20cover%20about%20data%20privacy%20and%20security%20for%20construction%20apps%2C%20a%20microphone%20silhouette%20beside%20a%20shield%20and%20padlock%20with%20subtle%20circuit%20lines%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-podcast-thumb-rgpd&orientation=landscape",
    icon: "ri-radio-line",
    tone: "accent",
  },
  {
    id: "tech-batiment-entrainer-ia",
    episodeNumber: 54,
    show: "Tech du Bâtiment",
    title: "Comment on entraîne une IA à chiffrer juste",
    date: "18 septembre 2026",
    dateISO: "2026-09-18",
    duration: "35 min",
    durationISO: "PT35M",
    speaker: "Camille Dufour",
    speakerId: "camille-dufour",
    location: "En ligne",
    description:
      "Camille Dufour ouvre la boîte noire : données de chantier, évaluation des modèles et juste métier au cœur d'un outil de chiffrage par IA.",
    audioUrl: liensExternes.episodesAudio["tech-batiment-entrainer-ia"],
    listenUrl: liensExternes.episodesListen["tech-batiment-entrainer-ia"],
    videoUrl: liensExternes.episodesVideo["tech-batiment-entrainer-ia"].watch,
    videoEmbedUrl: liensExternes.episodesVideo["tech-batiment-entrainer-ia"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20podcast%20episode%20cover%20about%20training%20an%20AI%20model%20for%20construction%2C%20a%20microphone%20silhouette%20merged%20with%20a%20neural%20network%20of%20glowing%20nodes%20and%20blueprint%20grid%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-podcast-thumb-ia-modele&orientation=landscape",
    icon: "ri-mic-2-line",
    tone: "secondary",
  },
  {
    id: "artisans-compagnie-accompagnement",
    episodeNumber: 63,
    show: "Artisans & Compagnie",
    title: "Accompagner les artisans, pas les abandonner",
    date: "10 septembre 2026",
    dateISO: "2026-09-10",
    duration: "31 min",
    durationISO: "PT31M",
    speaker: "Antoine Lefèvre",
    speakerId: "antoine-lefevre",
    location: "Lyon",
    description:
      "Antoine Lefèvre raconte l'accompagnement d'ArtiFlow-pro : formation, réponses rapides et améliorations issues des retours du terrain.",
    audioUrl: liensExternes.episodesAudio["artisans-compagnie-accompagnement"],
    listenUrl: liensExternes.episodesListen["artisans-compagnie-accompagnement"],
    videoUrl: liensExternes.episodesVideo["artisans-compagnie-accompagnement"].watch,
    videoEmbedUrl: liensExternes.episodesVideo["artisans-compagnie-accompagnement"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20podcast%20episode%20cover%20about%20supporting%20craftspeople%20and%20tradespeople%2C%20a%20studio%20microphone%20silhouette%20with%20abstract%20helping%20hands%20and%20tool%20shapes%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-podcast-thumb-accompagnement&orientation=landscape",
    icon: "ri-headphone-line",
    tone: "primary",
  },
  {
    id: "product-stories-terrain",
    episodeNumber: 41,
    show: "Product Stories FR",
    title: "Concevoir pour le terrain, pas pour la démo",
    date: "2 septembre 2026",
    dateISO: "2026-09-02",
    duration: "46 min",
    durationISO: "PT46M",
    speaker: "Sophie Renard",
    speakerId: "sophie-renard",
    location: "Nantes",
    description:
      "Sophie Renard détaille la méthode produit d'ArtiFlow-pro : observer le chantier, tester avec des gants et prioriser l'utile avant l'esthétique.",
    audioUrl: liensExternes.episodesAudio["product-stories-terrain"],
    listenUrl: liensExternes.episodesListen["product-stories-terrain"],
    videoUrl: liensExternes.episodesVideo["product-stories-terrain"].watch,
    videoEmbedUrl: liensExternes.episodesVideo["product-stories-terrain"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20podcast%20episode%20cover%20about%20designing%20products%20for%20real%20construction%20sites%2C%20a%20microphone%20silhouette%20with%20sketchbook%20notes%2C%20a%20pencil%20and%20blueprint%20lines%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-podcast-thumb-terrain&orientation=landscape",
    icon: "ri-lightbulb-line",
    tone: "accent",
  },
  {
    id: "growth-tpe-visibilite",
    episodeNumber: 19,
    show: "Growth TPE",
    title: "Faire connaître un SaaS du bâtiment autrement",
    date: "22 août 2026",
    dateISO: "2026-08-22",
    duration: "24 min",
    durationISO: "PT24M",
    speaker: "Julien Barbier",
    speakerId: "julien-barbier",
    location: "Bordeaux",
    description:
      "Julien Barbier revient sur la stratégie de contenu d'ArtiFlow-pro : guides pratiques, newsletter et partenariats plutôt que publicité tapageuse.",
    audioUrl: liensExternes.episodesAudio["growth-tpe-visibilite"],
    listenUrl: liensExternes.episodesListen["growth-tpe-visibilite"],
    videoUrl: liensExternes.episodesVideo["growth-tpe-visibilite"].watch,
    videoEmbedUrl: liensExternes.episodesVideo["growth-tpe-visibilite"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20podcast%20episode%20cover%20about%20growing%20a%20construction%20software%20brand%2C%20a%20microphone%20silhouette%20with%20a%20rising%20bar%20chart%20and%20megaphone%20shape%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-podcast-thumb-growth&orientation=landscape",
    icon: "ri-line-chart-line",
    tone: "secondary",
  },
];

export const episodeVedette: EpisodePodcast = episodesPodcast[0];

/** Épisodes auxquels un membre de l'équipe a participé, repérés par son identifiant. */
export function episodesDuMembre(membreId: string): EpisodePodcast[] {
  return episodesPodcast.filter((episode) => episode.speakerId === membreId);
}

/**
 * Tous les lieux présents dans les épisodes, dans un ordre stable : les villes
 * d'enregistrement d'abord (ordre alphabétique), puis « En ligne » en dernier.
 * Base du filtre « par lieu » de la liste des épisodes de la page Média.
 */
export const lieuxEpisode: string[] = Array.from(
  new Set(episodesPodcast.map((episode) => episode.location))
).sort((a, b) => {
  const aEnLigne = estEnLigne(a);
  const bEnLigne = estEnLigne(b);
  if (aEnLigne !== bEnLigne) return aEnLigne ? 1 : -1;
  return a.localeCompare(b, "fr");
});

/**
 * Nombre d'épisodes pour un lieu donné (ville du studio ou « En ligne »).
 * Sert au récap « interventions · épisodes » par ville (page Média et plan du site).
 */
export function compteEpisodesParLieu(lieu: string): number {
  return episodesPodcast.filter((episode) => episode.location === lieu).length;
}

export const plateformesPodcast: PlateformePodcast[] = [
  {
    icon: "ri-spotify-fill",
    label: "Spotify",
    href: liensExternes.plateformes.spotify,
  },
  {
    icon: "ri-apple-fill",
    label: "Apple Podcasts",
    href: liensExternes.plateformes.apple,
  },
  {
    icon: "ri-youtube-fill",
    label: "YouTube",
    href: liensExternes.plateformes.youtube,
  },
  {
    icon: "ri-rss-fill",
    label: "Flux RSS",
    href: liensExternes.plateformes.rss,
  },
];