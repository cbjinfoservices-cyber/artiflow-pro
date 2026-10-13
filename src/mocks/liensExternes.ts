/**
 * ⚠️ LIENS EXTERNES — EXEMPLES DE DÉMONSTRATION À REMPLACER
 * ---------------------------------------------------------------------------
 * Toutes les URLs externes de la marque sont regroupées ici, à un seul endroit.
 * Pour brancher les VRAIES URLs (épisodes de podcast, plateformes d'écoute
 * et prises de parole), il suffit de remplacer les valeurs ci-dessous : la page
 * Podcast et les fiches membres se mettent à jour automatiquement
 * (remplacement en une seule passe).
 *
 * Les clés correspondent aux identifiants (« id ») des contenus dans les mocks
 * podcasts.ts et interventions.ts.
 */
export const liensExternes = {
  /** Fichiers audio du lecteur intégré (clé = id de l'épisode). */
  episodesAudio: {
    "chantier-numerique-ia-chiffrage":
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "radio-artisan-rgpd":
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "tech-batiment-entrainer-ia":
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    "artisans-compagnie-accompagnement":
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    "product-stories-terrain":
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    "growth-tpe-visibilite":
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  } as Record<string, string>,

  /** Page d'origine de chaque épisode sur la plateforme du média (clé = id de l'épisode). */
  episodesListen: {
    "chantier-numerique-ia-chiffrage": "https://www.lechantiernumerique.fr/episodes/128",
    "radio-artisan-rgpd": "https://www.radio-artisan.fr/podcasts/87",
    "tech-batiment-entrainer-ia": "https://www.techdubatiment.fr/episodes/54",
    "artisans-compagnie-accompagnement":
      "https://www.artisans-compagnie.fr/episodes/63",
    "product-stories-terrain": "https://www.productstories.fr/episodes/41",
    "growth-tpe-visibilite": "https://www.growth-tpe.fr/episodes/19",
  } as Record<string, string>,

  /**
   * Version vidéo de chaque épisode (clé = id de l'épisode).
   * Renvoie la page de visionnage et l'URL d'intégration, utilisées pour le
   * balisage Schema.org VideoObject (extraits vidéo).
   */
  episodesVideo: {
    "chantier-numerique-ia-chiffrage": {
      watch: "https://www.youtube.com/watch?v=afk1e2b3c4d",
      embed: "https://www.youtube.com/embed/afk1e2b3c4d",
    },
    "radio-artisan-rgpd": {
      watch: "https://www.youtube.com/watch?v=bnm2f3g4h5j",
      embed: "https://www.youtube.com/embed/bnm2f3g4h5j",
    },
    "tech-batiment-entrainer-ia": {
      watch: "https://www.youtube.com/watch?v=cq3g4h5j6k7",
      embed: "https://www.youtube.com/embed/cq3g4h5j6k7",
    },
    "artisans-compagnie-accompagnement": {
      watch: "https://www.youtube.com/watch?v=dr4h5j6k7m8",
      embed: "https://www.youtube.com/embed/dr4h5j6k7m8",
    },
    "product-stories-terrain": {
      watch: "https://www.youtube.com/watch?v=es5j6k7m8n9",
      embed: "https://www.youtube.com/embed/es5j6k7m8n9",
    },
    "growth-tpe-visibilite": {
      watch: "https://www.youtube.com/watch?v=ft6k7m8n9p0",
      embed: "https://www.youtube.com/embed/ft6k7m8n9p0",
    },
  } as Record<string, { watch: string; embed: string }>,

  /** Interventions publiques (clé = id de l'intervention). */
  interventions: {
    "batir-connect-2026-keynote":
      "https://www.batir-connect.fr/programme/keynote-ia-artisans",
    "mercredis-artisan-rgpd":
      "https://www.mercredis-artisan.fr/webinaires/rgpd-outils-chantier",
    "tech-for-good-table-ronde":
      "https://www.techforgood-forum.fr/sessions/metiers-manuels-numerique",
    "chiffrage-ia-webinaire":
      "https://www.rendezvous-chiffrage.fr/webinaires/ia-chiffrage-metier",
    "product-stories-masterclass":
      "https://www.productstories.fr/masterclass/design-terrain",
    "growth-tpe-interview":
      "https://www.growth-tpe.fr/interviews/saas-batiment-pedagogie",
  } as Record<string, string>,

  /**
   * Version vidéo (rediffusion) de chaque intervention publique
   * (clé = id de l'intervention). Renvoie la page de visionnage et l'URL
   * d'intégration, utilisées pour le balisage Schema.org VideoObject.
   */
  interventionsVideo: {
    "batir-connect-2026-keynote": {
      watch: "https://www.youtube.com/watch?v=bg7h8j9k0l1",
      embed: "https://www.youtube.com/embed/bg7h8j9k0l1",
    },
    "mercredis-artisan-rgpd": {
      watch: "https://www.youtube.com/watch?v=ch8j9k0l1m2",
      embed: "https://www.youtube.com/embed/ch8j9k0l1m2",
    },
    "tech-for-good-table-ronde": {
      watch: "https://www.youtube.com/watch?v=di9k0l1m2n3",
      embed: "https://www.youtube.com/embed/di9k0l1m2n3",
    },
    "chiffrage-ia-webinaire": {
      watch: "https://www.youtube.com/watch?v=ej0l1m2n3o4",
      embed: "https://www.youtube.com/embed/ej0l1m2n3o4",
    },
    "product-stories-masterclass": {
      watch: "https://www.youtube.com/watch?v=fk1m2n3o4p5",
      embed: "https://www.youtube.com/embed/fk1m2n3o4p5",
    },
    "growth-tpe-interview": {
      watch: "https://www.youtube.com/watch?v=gl2n3o4p5q6",
      embed: "https://www.youtube.com/embed/gl2n3o4p5q6",
    },
  } as Record<string, { watch: string; embed: string }>,

  /** Plateformes d'écoute du podcast. */
  plateformes: {
    spotify: "https://open.spotify.com/show/artiflowpro",
    apple: "https://podcasts.apple.com/podcast/artiflowpro",
    youtube: "https://www.youtube.com/@artiflowpro",
    rss: "/podcast/rss.xml",
  },
};