import { useEffect, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";

/** Identifiant posé sur le repère principal pour servir de cible au lien d'évitement. */
const CIBLE_ID = "contenu-principal";

/**
 * Lien d'évitement « Aller au contenu » : c'est le tout premier élément focusable
 * de chaque page, mais il reste invisible tant qu'il n'a pas été atteint au
 * clavier. Une pression sur Tab l'affiche, et son activation amène directement au
 * contenu principal — utile pour les personnes naviguant au clavier ou avec un
 * lecteur d'écran, sans avoir à retraverser toute la barre de navigation.
 */
export default function LienEvitement() {
  const { pathname } = useLocation();

  // Garantit qu'une cible de saut existe sur la page courante : on marque le
  // repère principal (balise <main>) ; à défaut, la première section titrée.
  useEffect(() => {
    const main = document.querySelector("main");
    if (main) {
      if (!main.id) main.id = CIBLE_ID;
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      return;
    }
    const firstHeading = document.querySelector("h1");
    const section = firstHeading?.closest("section");
    if (section) {
      if (!section.id) section.id = CIBLE_ID;
      if (!section.hasAttribute("tabindex")) section.setAttribute("tabindex", "-1");
    }
  }, [pathname]);

  const allerAuContenu = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const cible =
      document.getElementById(CIBLE_ID) ||
      document.querySelector<HTMLElement>("main") ||
      document.querySelector<HTMLElement>("h1");
    if (!cible) return;
    if (!cible.hasAttribute("tabindex")) cible.setAttribute("tabindex", "-1");
    cible.focus({ preventScroll: true });
    cible.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.location.hash !== `#${CIBLE_ID}`) {
      window.history.replaceState(null, "", `#${CIBLE_ID}`);
    }
  };

  return (
    <a href={`#${CIBLE_ID}`} onClick={allerAuContenu} className="lien-evitement">
      <i className="ri-arrow-down-circle-line" aria-hidden="true"></i>
      Aller au contenu
    </a>
  );
}