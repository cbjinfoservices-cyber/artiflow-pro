import { liensExternes } from "@/mocks/liensExternes";

export type FormatIntervention = "Conférence" | "Webinaire" | "Table ronde" | "Masterclass" | "Interview";

export type InterventionPublique = {
  id: string;
  /** Nature de la prise de parole : conférence, webinaire, table ronde… */
  format: FormatIntervention;
  title: string;
  /** Événement ou média qui a organisé l'intervention. */
  event: string;
  date: string;
  dateISO: string;
  /** Durée affichée (ex. « 40 min »). */
  duration: string;
  /** Durée au format ISO 8601, utilisée dans le balisage VideoObject. */
  durationISO: string;
  /** Lieu (ville ou « En ligne »). */
  location: string;
  speaker: string;
  speakerId: string;
  description: string;
  /** Rediffusion vidéo (page de visionnage), pour le balisage VideoObject. */
  videoUrl: string;
  /** URL d'intégration de la rediffusion, pour le balisage VideoObject. */
  videoEmbedUrl: string;
  /** Vignette de l'intervention, utilisée comme miniature du VideoObject. */
  thumbnailUrl: string;
  icon: string;
  tone: "primary" | "accent" | "secondary";
};

/**
 * Interventions publiques de l'équipe ArtiFlow-pro : conférences, webinaires,
 * tables rondes, masterclasses et interviews. Chaque prise de parole expose une
 * rediffusion vidéo référencée dans le balisage VideoObject (extraits enrichis
 * vidéo). Les liens externes vivent dans `liensExternes.interventions` et
 * `liensExternes.interventionsVideo`.
 */
export const interventionsPubliques: InterventionPublique[] = [
  {
    id: "batir-connect-2026-keynote",
    format: "Conférence",
    title: "L'IA au service des artisans : la keynote",
    event: "Bâtir Connect 2026",
    date: "24 septembre 2026",
    dateISO: "2026-09-24",
    duration: "38 min",
    durationISO: "PT38M",
    location: "Lyon",
    speaker: "Léa Marchand",
    speakerId: "lea-marchand",
    description:
      "Léa Marchand ouvre Bâtir Connect avec une idée simple : l'IA ne remplace pas le savoir-faire, elle enlève la paperasse qui l'étouffe. Démonstration à l'appui sur un devis dicté en direct.",
    videoUrl: liensExternes.interventionsVideo["batir-connect-2026-keynote"].watch,
    videoEmbedUrl: liensExternes.interventionsVideo["batir-connect-2026-keynote"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20conference%20keynote%20stage%20cover%20about%20artificial%20intelligence%20for%20craftspeople%2C%20a%20speaker%20silhouette%20at%20a%20lectern%20with%20glowing%20blueprint%20lines%20and%20tool%20shapes%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-interv-batir-connect&orientation=landscape",
    icon: "ri-slideshow-line",
    tone: "primary",
  },
  {
    id: "mercredis-artisan-rgpd",
    format: "Webinaire",
    title: "RGPD : ce que votre logiciel de chantier fait de vos données",
    event: "Les Mercredis de l'Artisan",
    date: "17 septembre 2026",
    dateISO: "2026-09-17",
    duration: "45 min",
    durationISO: "PT45M",
    location: "En ligne",
    speaker: "Karim Benali",
    speakerId: "karim-benali",
    description:
      "Un webinaire sans jargon : Karim Benali explique quelles données un outil de chantier collecte réellement, ce qu'il en fait, et les questions à poser avant de signer avec un prestataire.",
    videoUrl: liensExternes.interventionsVideo["mercredis-artisan-rgpd"].watch,
    videoEmbedUrl: liensExternes.interventionsVideo["mercredis-artisan-rgpd"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20webinar%20cover%20about%20data%20privacy%20for%20construction%20software%2C%20a%20screen%20and%20microphone%20silhouette%20with%20a%20shield%20and%20padlock%20made%20of%20subtle%20circuit%20lines%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-interv-rgpd-webinaire&orientation=landscape",
    icon: "ri-live-line",
    tone: "accent",
  },
  {
    id: "chiffrage-ia-webinaire",
    format: "Webinaire",
    title: "Chiffrer juste avec l'IA : démonstration pas à pas",
    event: "Rendez-vous du Chiffrage",
    date: "1 octobre 2026",
    dateISO: "2026-10-01",
    duration: "40 min",
    durationISO: "PT40M",
    location: "En ligne",
    speaker: "Sophie Renard",
    speakerId: "sophie-renard",
    description:
      "Sophie Renard déroule un chiffrage complet en direct : description du chantier, génération des lignes, ajustement aux tarifs de l'entreprise, puis envoi du devis avant la fin de la session.",
    videoUrl: liensExternes.interventionsVideo["chiffrage-ia-webinaire"].watch,
    videoEmbedUrl: liensExternes.interventionsVideo["chiffrage-ia-webinaire"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20webinar%20cover%20about%20AI-assisted%20construction%20estimating%2C%20a%20laptop%20screen%20showing%20a%20quote%20table%20silhouette%20with%20a%20calculator%20and%20ruler%20shapes%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-interv-chiffrage-webinaire&orientation=landscape",
    icon: "ri-live-line",
    tone: "primary",
  },
  {
    id: "tech-for-good-table-ronde",
    format: "Table ronde",
    title: "Métiers manuels et numérique : réconcilier les deux",
    event: "Tech for Good Forum",
    date: "8 juillet 2026",
    dateISO: "2026-07-08",
    duration: "52 min",
    durationISO: "PT52M",
    location: "Paris",
    speaker: "Camille Dufour",
    speakerId: "camille-dufour",
    description:
      "Camille Dufour débat avec plusieurs acteurs du terrain : comment la technologie peut servir les métiers manuels sans les dénaturer, et pourquoi la pédagogie compte plus que la promesse.",
    videoUrl: liensExternes.interventionsVideo["tech-for-good-table-ronde"].watch,
    videoEmbedUrl: liensExternes.interventionsVideo["tech-for-good-table-ronde"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20round%20table%20discussion%20cover%20about%20technology%20and%20manual%20trades%2C%20several%20seated%20silhouettes%20around%20an%20oval%20table%20with%20subtle%20digital%20node%20lines%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-interv-tech-for-good&orientation=landscape",
    icon: "ri-group-line",
    tone: "secondary",
  },
  {
    id: "product-stories-masterclass",
    format: "Masterclass",
    title: "Concevoir un produit pour le terrain : la masterclass",
    event: "Product Stories",
    date: "27 août 2026",
    dateISO: "2026-08-27",
    duration: "58 min",
    durationISO: "PT58M",
    location: "Nantes",
    speaker: "Antoine Lefèvre",
    speakerId: "antoine-lefevre",
    description:
      "Antoine Lefèvre partage la méthode produit d'ArtiFlow-pro : observer le chantier, tester avec des gants, et prioriser l'utile avant l'esthétique. Un cas pratique complet, du terrain au prototype.",
    videoUrl: liensExternes.interventionsVideo["product-stories-masterclass"].watch,
    videoEmbedUrl: liensExternes.interventionsVideo["product-stories-masterclass"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20masterclass%20cover%20about%20designing%20software%20for%20construction%20workers%2C%20a%20chalkboard%20silhouette%20with%20sketches%2C%20a%20pencil%20and%20blueprint%20lines%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-interv-product-masterclass&orientation=landscape",
    icon: "ri-graduation-cap-line",
    tone: "accent",
  },
  {
    id: "growth-tpe-interview",
    format: "Interview",
    title: "Rendre un logiciel du bâtiment vraiment pédagogique",
    event: "Growth TPE",
    date: "6 août 2026",
    dateISO: "2026-08-06",
    duration: "26 min",
    durationISO: "PT26M",
    location: "Bordeaux",
    speaker: "Julien Barbier",
    speakerId: "julien-barbier",
    description:
      "Julien Barbier raconte comment ArtiFlow-pro fait de la pédagogie son premier canal d'acquisition : guides pratiques, webinaires et partenariats plutôt que publicité tapageuse.",
    videoUrl: liensExternes.interventionsVideo["growth-tpe-interview"].watch,
    videoEmbedUrl: liensExternes.interventionsVideo["growth-tpe-interview"].embed,
    thumbnailUrl:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20interview%20cover%20about%20growing%20and%20teaching%20around%20construction%20software%2C%20an%20armchair%20and%20microphone%20silhouette%20with%20a%20rising%20bar%20chart%20and%20speech%20bubble%20shapes%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1280&height=720&seq=artiflow-interv-growth-interview&orientation=landscape",
    icon: "ri-chat-voice-line",
    tone: "secondary",
  },
];

/**
 * Icône associée à chaque format de prise de parole (réutilisée par les filtres
 * et le plan du site, pour rester cohérent partout).
 */
export const iconesFormat: Record<FormatIntervention, string> = {
  Conférence: "ri-slideshow-line",
  Webinaire: "ri-live-line",
  "Table ronde": "ri-group-line",
  Masterclass: "ri-graduation-cap-line",
  Interview: "ri-chat-voice-line",
};

/** Tous les formats présents, dans l'ordre d'apparition (base des filtres). */
export const formatsIntervention: FormatIntervention[] = Array.from(
  new Set(interventionsPubliques.map((intervention) => intervention.format))
);

/** Nombre d'interventions pour un format donné (affiché à côté des filtres). */
export function compteParFormat(format: FormatIntervention): number {
  return interventionsPubliques.filter((intervention) => intervention.format === format).length;
}

/**
 * Une intervention est « en ligne » lorsque son lieu désigne une prise de parole
 * à distance plutôt qu'un lieu physique. Sert au repérage visuel et au filtre par
 * lieu (les prises de parole en présentiel remontent avant le distanciel).
 */
export function estEnLigne(location: string): boolean {
  return location.trim().toLocaleLowerCase("fr") === "en ligne";
}

/**
 * Tous les lieux présents dans les interventions, dans un ordre stable : les villes
 * en présentiel d'abord (ordre alphabétique), puis « En ligne » en dernier. Base du
 * filtre « par lieu » de la page Média.
 */
export const lieuxIntervention: string[] = Array.from(
  new Set(interventionsPubliques.map((intervention) => intervention.location))
).sort((a, b) => {
  const aEnLigne = estEnLigne(a);
  const bEnLigne = estEnLigne(b);
  if (aEnLigne !== bEnLigne) return aEnLigne ? 1 : -1;
  return a.localeCompare(b, "fr");
});

/** Nombre d'interventions pour un lieu donné (affiché à côté des filtres). */
export function compteParLieu(lieu: string): number {
  return interventionsPubliques.filter((intervention) => intervention.location === lieu).length;
}

export type IntervenantFiltre = { id: string; name: string };

/**
 * Intervenants présents dans les interventions, dans l'ordre d'apparition.
 * Sert de base au filtre « par intervenant » de la page Média.
 */
export const intervenantsIntervention: IntervenantFiltre[] = interventionsPubliques.reduce<IntervenantFiltre[]>(
  (acc, intervention) => {
    if (!acc.some((intervenant) => intervenant.id === intervention.speakerId)) {
      acc.push({ id: intervention.speakerId, name: intervention.speaker });
    }
    return acc;
  },
  []
);

/** Nombre d'interventions d'un intervenant donné (affiché à côté des filtres). */
export function compteParIntervenant(speakerId: string): number {
  return interventionsPubliques.filter((intervention) => intervention.speakerId === speakerId).length;
}

/** Interventions d'un membre de l'équipe, les plus récentes d'abord. */
export function interventionsDuMembre(speakerId: string): InterventionPublique[] {
  return interventionsPubliques
    .filter((intervention) => intervention.speakerId === speakerId)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}