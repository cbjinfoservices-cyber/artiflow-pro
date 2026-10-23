import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ajouterLienCopie } from "@/lib/liensCopiesMemoire";
import { originePublique } from "@/lib/site";

/**
 * Bouton « Partager » réutilisable : ouvre un petit menu proposant de copier un lien
 * partageable de la vue ou de l'ouvrir directement depuis n'importe quel widget.
 * Chaque lien copié alimente aussi l'historique « Liens copiés récemment » du tableau de bord.
 */
export default function BoutonPartager({
  label,
  chemin,
  title,
  compact = false,
  align = "right",
}: {
  /** Libellé enregistré dans l'historique des liens copiés (« Relances programmées »…). */
  label: string;
  /** Chemin interne de la vue à partager / ouvrir (ex. « /app/relances »). */
  chemin: string;
  /** Infobulle du bouton. */
  title?: string;
  /** Réduit le bouton à une icône seule (en-têtes compacts). */
  compact?: boolean;
  /** Côté d'ancrage du menu déroulant. */
  align?: "left" | "right";
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [copie, setCopie] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Ferme le menu au clic extérieur ou avec la touche Échap.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Adresse complète et partageable de la vue (origine + préfixe de publication + chemin).
  const urlPartageable = () => {
    const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
    return `${originePublique()}${base}${chemin}`;
  };

  const copier = async () => {
    const url = urlPartageable();
    try {
      await navigator.clipboard.writeText(url);
      ajouterLienCopie(label, url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
    setOpen(false);
  };

  const ouvrir = () => {
    setOpen(false);
    navigate(chemin);
  };

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title ?? "Partager cette vue"}
        className={`inline-flex items-center ${
          compact ? "justify-center w-9 h-9" : "gap-1.5 h-9 px-3"
        } rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors`}
      >
        <i className="ri-share-forward-line"></i>
        {!compact && <span>Partager</span>}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-2 w-44 p-1 rounded-md bg-background-50 border border-background-200 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={copier}
            className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-md text-xs font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className={copie ? "ri-check-line text-accent-600" : "ri-link"}></i>
            {copie ? "Lien copié" : "Copier le lien"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={ouvrir}
            className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-md text-xs font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className="ri-arrow-right-line"></i>
            Ouvrir la vue
          </button>
        </div>
      )}
    </div>
  );
}