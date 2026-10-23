import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";

type NavDropdownProps = {
  /** Libellé visible dans la capsule. */
  label: string;
  /** Destination du clic sur le libellé. */
  to: string;
  /** Classes du déclencheur (variantes claire/sombre et état actif gérées par la barre). */
  baseClass: string;
  /** Libellé accessible du panneau déroulant. */
  menuLabel: string;
  /** Largeur du panneau. */
  panelClassName?: string;
  /** Élément optionnel affiché après le libellé (ex. compteur de nouveaux guides). */
  badge?: ReactNode;
  /** Contenu du panneau ; la fonction reçoit de quoi refermer le menu. */
  children: (close: () => void) => ReactNode;
};

/**
 * Déroulant de la capsule de navigation : s'ouvre au survol ET au focus clavier,
 * navigable aux flèches (haut/bas), Début/Fin pour aller aux extrémités, et se
 * referme avec Échap en rendant le focus au déclencheur.
 */
export default function NavDropdown({
  label,
  to,
  baseClass,
  menuLabel,
  panelClassName = "w-[540px]",
  badge,
  children,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<"first" | "last" | null>(null);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  // Empêche la réouverture automatique au focus juste après une fermeture au clavier.
  const suppressFocusOpen = useRef(false);
  const { pathname } = useLocation();

  const close = () => {
    setOpen(false);
    setFocusTarget(null);
  };

  // Referme le menu dès qu'on change de page.
  useEffect(() => {
    setOpen(false);
    setFocusTarget(null);
  }, [pathname]);

  // Déplace le focus vers le premier ou le dernier élément quand une flèche a ouvert le menu.
  useEffect(() => {
    if (!open || !focusTarget) return;
    const panel = panelRef.current;
    if (panel) {
      const items = Array.from(panel.querySelectorAll<HTMLElement>("a[href]")).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length) {
        (focusTarget === "first" ? items[0] : items[items.length - 1]).focus();
      }
    }
    setFocusTarget(null);
  }, [open, focusTarget]);

  // Ferme au clic en dehors du déroulant.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const listerLiens = () => {
    const panel = panelRef.current;
    if (!panel) return [] as HTMLElement[];
    return Array.from(panel.querySelectorAll<HTMLElement>("a[href]")).filter(
      (el) => el.offsetParent !== null,
    );
  };

  const onTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setFocusTarget("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setFocusTarget("last");
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    const items = listerLiens();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(current + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(current - 1 + items.length) % items.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      suppressFocusOpen.current = true;
      close();
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!wrapRef.current?.contains(document.activeElement)) setOpen(false);
      }}
      onFocus={() => {
        if (suppressFocusOpen.current) {
          suppressFocusOpen.current = false;
          return;
        }
        setOpen(true);
      }}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
          setFocusTarget(null);
        }
      }}
    >
      <Link
        ref={triggerRef}
        to={to}
        className={baseClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onKeyDown={onTriggerKeyDown}
      >
        {label}
        {badge}
        <i
          className={`ri-arrow-down-s-line text-base transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        ></i>
      </Link>
      <div
        ref={panelRef}
        onKeyDown={onPanelKeyDown}
        className={`absolute left-1/2 -translate-x-1/2 top-full pt-3 z-50 transition-all duration-200 ${
          open ? "visible opacity-100 translate-y-0" : "invisible opacity-0 translate-y-1 pointer-events-none"
        }`}
      >
        <div
          id={panelId}
          role="menu"
          aria-label={menuLabel}
          className={`${panelClassName} rounded-2xl border border-background-200 bg-background-50 p-2`}
        >
          {children(close)}
        </div>
      </div>
    </div>
  );
}