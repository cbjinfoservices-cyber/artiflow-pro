import { useEffect } from "react";
import { getSiteOrigin } from "@/lib/site";

type PageMetaOptions = {
  /** Image de partage social (Open Graph / Twitter). URL absolue de préférence. */
  image?: string;
  /** Type Open Graph de la page : "website" par défaut, "article" pour un guide. */
  type?: string;
  /** Mots-clés propres à la page. À défaut, les mots-clés du site sont utilisés. */
  keywords?: string;
  /**
   * Lecteur audio/vidéo pour la carte Twitter « player » (épisodes de podcast).
   * Quand il est fourni, la carte Twitter devient de type « player » et les
   * métadonnées audio Open Graph (og:audio) sont ajoutées. Sinon, la page
   * reprend la carte « résumé large » et les balises de lecteur sont retirées.
   */
  player?: {
    /** URL HTTPS de la page de lecture intégrée (twitter:player). */
    url: string;
    /** Flux audio ou vidéo direct (twitter:player:stream + og:audio). */
    stream?: string;
    /** Type MIME du flux, par exemple « audio/mpeg ». */
    streamType?: string;
    /** Largeur du lecteur intégré (1280 par défaut). */
    width?: number;
    /** Hauteur du lecteur intégré (720 par défaut). */
    height?: number;
    /** Titre du média, repris dans og:audio:title. */
    title?: string;
  };
};

/** Description de repli du site (reprise de la balise partagée de index.html). */
const DESCRIPTION_SITE =
  "Logiciel IA des artisans du bâtiment : devis dictés en quelques minutes, relances automatiques, planning d'équipe et facture électronique prête.";

/** Mots-clés de repli du site (repris de la balise partagée de index.html). */
const MOTS_CLES_SITE =
  "devis artisan, logiciel IA artisan, relance client automatique, planning artisan, SaaS bâtiment, gestion chantier";

/**
 * Image de partage de repli du site.
 *
 * C'est exactement le visuel choisi dans les Réglages SEO du projet (l'image
 * servie par la plateforme) : le code et l'aperçu réel des liens pointent donc
 * vers le même fichier, au lieu de deux visuels différents selon qui lit la
 * page. Une seule source de vérité, reprise aussi par index.html et le sitemap.
 */
export const IMAGE_PARTAGE_SITE =
  "https://public.readdy.ai/ai/img_res/8e3ba55f81d58fbfb413ad69b5686b01.webp";

/** Balises de lecteur à nettoyer quand la page courante n'est plus un contenu audio. */
const BALISES_LECTEUR = [
  "twitter:player",
  "twitter:player:width",
  "twitter:player:height",
  "twitter:player:stream",
  "twitter:player:stream:content_type",
  "og:audio",
  "og:audio:type",
  "og:audio:title",
];

/**
 * Applique une balise meta (name ou property) en la créant si besoin.
 * Réutilise toujours la même balise : une seule par name/property.
 */
function setMeta(attr: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/** Supprime toutes les balises meta portant ce nom ou cette propriété. */
function removeMeta(key: string) {
  document.head
    .querySelectorAll(`meta[name="${key}"], meta[property="${key}"]`)
    .forEach((tag) => tag.remove());
}

/**
 * Gestionnaire centralisé et « route-aware » des métadonnées du <head>.
 *
 * Appelé sur chaque page, il met à jour le titre, la description, les
 * mots-clés, l'URL canonique et les balises de partage social (Open Graph +
 * Twitter Card). Toutes les valeurs sont réécrites à chaque changement de route
 * (avec un repli raisonnable) afin qu'aucune métadonnée de la page précédente ne
 * fuie vers la suivante. Il ne conserve qu'une seule balise par name/property/rel.
 */
export function usePageMeta(title: string, description?: string, options?: PageMetaOptions) {
  const image = options?.image;
  const type = options?.type ?? "website";
  const keywords = options?.keywords;
  const playerUrl = options?.player?.url;
  const playerStream = options?.player?.stream;
  const playerStreamType = options?.player?.streamType;
  const playerWidth = options?.player?.width;
  const playerHeight = options?.player?.height;
  const playerTitle = options?.player?.title;

  useEffect(() => {
    const metaDescription = description || DESCRIPTION_SITE;
    const metaKeywords = keywords || MOTS_CLES_SITE;
    const shareImage = image || IMAGE_PARTAGE_SITE;
    const imageAlt = description || title;

    // Titre + description + mots-clés (page)
    document.title = title;
    setMeta("name", "description", metaDescription);
    setMeta("name", "keywords", metaKeywords);

    // Open Graph
    setMeta("property", "og:title", title);
    setMeta("property", "og:type", type);
    setMeta("property", "og:description", metaDescription);
    setMeta("property", "og:image", shareImage);
    setMeta("property", "og:image:alt", imageAlt);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");

    // Twitter Card : « player » pour un contenu audio (épisodes de podcast),
    // « résumé large » avec image pour toutes les autres pages.
    if (playerUrl) {
      setMeta("name", "twitter:card", "player");
      setMeta("name", "twitter:player", playerUrl);
      setMeta("name", "twitter:player:width", String(playerWidth ?? 1280));
      setMeta("name", "twitter:player:height", String(playerHeight ?? 720));
      if (playerStream) {
        setMeta("name", "twitter:player:stream", playerStream);
        // Métadonnées audio Open Graph (lecteurs et plateformes compatibles).
        setMeta("property", "og:audio", playerStream);
        if (playerStreamType) {
          setMeta("name", "twitter:player:stream:content_type", playerStreamType);
          setMeta("property", "og:audio:type", playerStreamType);
        }
        if (playerTitle) setMeta("property", "og:audio:title", playerTitle);
      }
    } else {
      setMeta("name", "twitter:card", "summary_large_image");
      // On retire les balises de lecteur d'une éventuelle page audio précédente
      // (changement de route) pour ne pas les laisser fuiter.
      BALISES_LECTEUR.forEach(removeMeta);
    }

    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", metaDescription);
    setMeta("name", "twitter:image", shareImage);
    setMeta("name", "twitter:image:alt", imageAlt);

    // URL courante (partage social + canonique).
    // On retire le slash final pour que « /a-propos » et « /a-propos/ » pointent
    // vers une seule adresse canonique et ne soient pas vus comme du contenu
    // dupliqué. La racine « / » est conservée telle quelle.
    const chemin = window.location.pathname.replace(/\/+$/, "") || "/";
    const url = `${getSiteOrigin()}${chemin}`;
    setMeta("property", "og:url", url);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
  }, [
    title,
    description,
    image,
    type,
    keywords,
    playerUrl,
    playerStream,
    playerStreamType,
    playerWidth,
    playerHeight,
    playerTitle,
  ]);
}