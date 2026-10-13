import { useEffect } from "react";

/**
 * Applique une directive robots pour la page courante.
 *
 * Utilisé pour sortir l'espace produit (/app) de l'indexation afin de
 * concentrer le référencement sur les pages marketing. La balise est
 * restaurée (ou retirée) au démontage pour ne jamais contaminer les autres pages.
 */
export function useRobotsMeta(content: string) {
  useEffect(() => {
    const head = document.head;
    const existing = head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing ? existing.getAttribute("content") : null;

    let tag = existing;
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "robots");
      head.appendChild(tag);
    }
    tag.setAttribute("content", content);

    return () => {
      if (!tag) return;
      if (previous === null) {
        tag.remove();
      } else {
        tag.setAttribute("content", previous);
      }
    };
  }, [content]);
}