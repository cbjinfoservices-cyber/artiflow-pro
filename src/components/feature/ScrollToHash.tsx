import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Fait défiler la page jusqu'à l'ancre présente dans l'URL (ex. /a-propos#equipe).
 *
 * React Router ne gère pas nativement le saut vers un fragment : ce petit
 * composant global écoute les changements d'URL et amène la vue sur l'élément
 * ciblé (avec un léger délai pour laisser la page se rendre), ce qui rend
 * fiables tous les liens du type « À propos → section équipe » ou
 * « épisode podcast → fiche du membre ».
 *
 * Le composant réessaie plusieurs fois : certaines pages chargent leurs
 * données après le premier rendu (cartes affichées après un état de chargement),
 * et l'ancre cible n'existe alors qu'une fois ces données arrivées.
 */
export default function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) return undefined;

    const id = decodeURIComponent(hash.replace(/^#/, ""));
    if (!id) return undefined;

    let annule = false;
    let tentatives = 0;

    const essayer = () => {
      if (annule) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      tentatives += 1;
      // Réessaie pendant ~1,8 s max, le temps que la cible finisse de se rendre.
      if (tentatives < 15) window.setTimeout(essayer, 120);
    };

    const timer = window.setTimeout(essayer, 80);

    return () => {
      annule = true;
      window.clearTimeout(timer);
    };
  }, [pathname, hash]);

  return null;
}