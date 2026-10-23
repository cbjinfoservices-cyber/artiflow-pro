import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

/** Éléments actionnables d'un menu (rôle « menuitem »), visibles et non désactivés. */
function listerItems(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
    (el) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled,
  );
}

type Options = {
  /** Le menu est-il ouvert ? */
  ouvert: boolean;
  /** Ouvre le menu (déclenché par les flèches pressées sur le bouton). */
  ouvrir: () => void;
  /** Ferme le menu. */
  fermer: () => void;
  /** Référence du panneau du menu (contient les éléments navigables). */
  panelRef: RefObject<HTMLElement | null>;
  /** Référence du bouton déclencheur (reçoit le focus à la fermeture par Échap). */
  triggerRef: RefObject<HTMLElement | null>;
};

/**
 * Navigation clavier d'un menu déroulant : flèches haut/bas pour parcourir les
 * éléments, Début/Fin pour sauter aux extrémités, et Échap pour refermer en
 * rendant le focus au bouton déclencheur. Cohérent avec le menu public
 * « Métiers / Ressources » de la barre de navigation.
 */
export function useMenuClavier({ ouvert, ouvrir, fermer, panelRef, triggerRef }: Options) {
  const [focusCible, setFocusCible] = useState<"first" | "last" | null>(null);

  // Déplace le focus vers le premier ou le dernier élément dès qu'une flèche a ouvert le menu.
  useEffect(() => {
    if (!ouvert || !focusCible) return;
    const items = listerItems(panelRef.current);
    if (items.length) {
      (focusCible === "first" ? items[0] : items[items.length - 1]).focus();
    }
    setFocusCible(null);
  }, [ouvert, focusCible, panelRef]);

  const onTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!ouvert) ouvrir();
      setFocusCible("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!ouvert) ouvrir();
      setFocusCible("last");
    } else if (e.key === "Escape" && ouvert) {
      e.preventDefault();
      fermer();
    }
  };

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      fermer();
      triggerRef.current?.focus();
      return;
    }
    const items = listerItems(panelRef.current);
    if (!items.length) return;
    const courant = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      (courant < 0 ? items[0] : items[(courant + 1) % items.length]).focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      (courant < 0 ? items[items.length - 1] : items[(courant - 1 + items.length) % items.length]).focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  };

  return { onTriggerKeyDown, onPanelKeyDown };
}