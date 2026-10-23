import { useEffect } from "react";

/**
 * Précharge une image critique (par exemple le visuel héros d'une page métier ou
 * ville) en injectant un `<link rel="preload" as="image">` dans le `<head>` dès
 * le montage de la page, puis en le retirant au démontage. Résultat : le
 * navigateur commence à télécharger l'image avant même son affichage, ce qui
 * stabilise le premier rendu.
 */
export function usePrechargerImage(url?: string | null, media?: string) {
  useEffect(() => {
    if (!url) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = url;
    if (media) link.media = media;
    link.setAttribute("fetchpriority", "high");
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [url, media]);
}