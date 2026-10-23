import { useEffect, useRef, useState } from "react";
import { originePublique } from "@/lib/site";

/** Copie un texte dans le presse-papiers, avec repli pour les navigateurs sans API Clipboard. */
async function copierTexte(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    // On tente le repli ci-dessous.
  }
  try {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.top = "-1000px";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(zone);
    return ok;
  } catch {
    return false;
  }
}

type Cible = "lien" | "image";

/**
 * Bouton « Partager cette annonce » d'une carte du récapitulatif.
 *
 * Il propose de copier le lien de l'annonce (page dédiée quand elle existe, sinon ancre
 * de la carte) et de copier l'adresse du visuel de partage, utile pour préparer une
 * publication sociale. Le partage natif du système est proposé en complément quand il
 * est disponible.
 */
export default function BoutonPartagerAnnonce({
  titre,
  chemin,
  image,
}: {
  /** Titre de l'annonce, utilisé dans le menu et le partage natif. */
  titre: string;
  /** Chemin interne de l'annonce (page dédiée ou ancre de la carte). */
  chemin: string;
  /** Adresse absolue du visuel de partage 1200 × 630. */
  image?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copie, setCopie] = useState<Cible | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

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

  /** Adresse publique complète de l'annonce (origine + préfixe de publication + chemin). */
  const lienAnnonce = () => {
    const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
    const origine = originePublique();
    return `${origine}${base}${chemin}`;
  };

  const copier = async (quoi: Cible) => {
    const valeur = quoi === "image" ? image : lienAnnonce();
    if (!valeur) return;
    const ok = await copierTexte(valeur);
    setCopie(ok ? quoi : null);
    setOpen(false);
    if (ok) window.setTimeout(() => setCopie(null), 2200);
  };

  const partagerNatif = async () => {
    const url = lienAnnonce();
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: titre, url });
    } catch {
      // Partage annulé par l'utilisateur : rien à signaler.
    }
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Partager cette annonce"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-400 hover:text-primary-700 transition-colors"
      >
        <i className={copie ? "ri-check-line text-accent-600" : "ri-share-forward-line"}></i>
        {copie ? (copie === "image" ? "Image copiée" : "Lien copié") : "Partager"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-[calc(100%+0.5rem)] z-30 w-56 p-1 rounded-md bg-background-50 border border-background-200 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => copier("lien")}
            className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-md text-xs font-medium text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className="ri-link"></i>
            Copier le lien de l'annonce
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => copier("image")}
            disabled={!image}
            className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-md text-xs font-medium text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-image-line"></i>
            Copier l'image de partage
          </button>
          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <button
              type="button"
              role="menuitem"
              onClick={partagerNatif}
              className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-md text-xs font-medium text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-send-plane-line"></i>
              Partager…
            </button>
          )}
        </div>
      )}
    </div>
  );
}