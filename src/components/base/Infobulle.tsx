import { useRef, useState, type ReactNode } from "react";

type PositionInfobulle = "haut" | "bas" | "droite" | "gauche";

/**
 * Infobulle explicative réutilisable : affiche un court texte d'aide au survol ou au focus de
 * l'élément qu'elle entoure. Parfait pour expliquer un bouton ou un terme un peu technique à
 * quelqu'un qui découvre l'outil.
 *
 * Elle est positionnée en `fixed` : elle échappe ainsi aux conteneurs à défilement (comme le menu
 * latéral) qui rogneraient sinon l'infobulle. Elle se borne toujours à l'écran et se referme dès
 * que le curseur ou le focus s'en va.
 */
export default function Infobulle({
  contenu,
  children,
  position = "haut",
  largeur = 240,
  className = "",
}: {
  /** Texte (ou petit contenu) affiché dans l'infobulle. */
  contenu: ReactNode;
  /** Élément déclencheur (bouton, mot, icône…). */
  children: ReactNode;
  /** Côté d'affichage préféré. */
  position?: PositionInfobulle;
  /** Largeur de l'infobulle, en pixels. */
  largeur?: number;
  /** Classe appliquée à l'enveloppe déclencheuse (inline-flex par défaut). */
  className?: string;
}) {
  const ancre = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<{ left: number; top: number } | null>(null);

  const ouvrir = () => {
    const el = ancre.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const marge = 10;
    // Hauteur approximative : l'infobulle reste collée à l'élément, l'ajustement est cosmétique.
    const hauteur = 48;
    let left = r.left + r.width / 2 - largeur / 2;
    let top = r.top - marge - hauteur;
    if (position === "bas") {
      top = r.bottom + marge;
    } else if (position === "droite") {
      left = r.right + marge;
      top = r.top + r.height / 2 - hauteur / 2;
    } else if (position === "gauche") {
      left = r.left - marge - largeur;
      top = r.top + r.height / 2 - hauteur / 2;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - largeur - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - hauteur - 8));
    setStyle({ left, top });
  };

  const fermer = () => setStyle(null);

  return (
    <span
      ref={ancre}
      className={`inline-flex ${className}`}
      onMouseEnter={ouvrir}
      onMouseLeave={fermer}
      onFocus={ouvrir}
      onBlur={fermer}
    >
      {children}
      {style && (
        <span
          role="tooltip"
          style={{ left: style.left, top: style.top, width: largeur }}
          className="fixed z-[80] rounded-lg bg-foreground-950/95 text-background-50 px-3 py-2 text-[11px] font-normal leading-relaxed text-left pointer-events-none animate-fade-in"
        >
          {contenu}
        </span>
      )}
    </span>
  );
}