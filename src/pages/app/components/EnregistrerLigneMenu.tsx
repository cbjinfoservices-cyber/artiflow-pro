import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CategorieEnregistrement } from "@/hooks/useCategoriesEnregistrement";

const LARGEUR_MENU = 248;
const HAUTEUR_ESTIMEE = 300;

/**
 * Petit menu « Enregistrer dans… » : en cliquant, on choisit la catégorie dans
 * laquelle ranger la ligne à sauvegarder dans la bibliothèque de désignations.
 * Utilisé sur les lignes d'un devis ou d'une facture. On peut aussi créer une
 * nouvelle catégorie à la volée.
 */
export default function EnregistrerLigneMenu({
  categories,
  onSave,
  compact = false,
  label = "Enregistrer dans ma bibliothèque",
}: {
  categories: CategorieEnregistrement[];
  onSave: (categorie: string) => Promise<void> | void;
  compact?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Positionne le panneau sous le bouton, en le recalant pour rester dans l'écran.
  const placer = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - LARGEUR_MENU, window.innerWidth - LARGEUR_MENU - 8));
    let top = r.bottom + 6;
    if (top + HAUTEUR_ESTIMEE > window.innerHeight - 8) top = Math.max(8, r.top - HAUTEUR_ESTIMEE - 6);
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) placer();
  }, [open, placer]);

  useEffect(() => {
    if (!open) return undefined;
    const fermerSiExterieur = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (panelRef.current?.contains(cible) || triggerRef.current?.contains(cible)) return;
      setOpen(false);
    };
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // On referme au défilement : le panneau étant positionné en fixe, cela évite qu'il se décale.
    const surScroll = () => setOpen(false);
    document.addEventListener("mousedown", fermerSiExterieur);
    document.addEventListener("keydown", surTouche);
    window.addEventListener("scroll", surScroll, true);
    window.addEventListener("resize", surScroll);
    return () => {
      document.removeEventListener("mousedown", fermerSiExterieur);
      document.removeEventListener("keydown", surTouche);
      window.removeEventListener("scroll", surScroll, true);
      window.removeEventListener("resize", surScroll);
    };
  }, [open]);

  const choisir = async (nom: string) => {
    const valeur = nom.trim();
    if (!valeur || busy !== null) return;
    setBusy(valeur);
    try {
      await onSave(valeur);
      setOpen(false);
      setNouvelle("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        aria-label={label}
        className={
          compact
            ? "w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-accent-700 cursor-pointer"
            : "inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-300 transition-colors"
        }
      >
        <i className={open ? "ri-bookmark-fill" : "ri-bookmark-line"}></i>
        {!compact && <span>{label}</span>}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className="fixed z-[70] rounded-lg bg-background-50 border border-background-300 p-2"
            style={{ top: pos.top, left: pos.left, width: LARGEUR_MENU }}
          >
            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
              Enregistrer dans…
            </p>
            <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
              {categories.map((c) => (
                <button
                  key={c.valeur}
                  type="button"
                  role="menuitem"
                  disabled={busy !== null}
                  onClick={() => choisir(c.valeur)}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm text-foreground-800 hover:bg-background-100 cursor-pointer disabled:opacity-50"
                >
                  {busy === c.valeur ? (
                    <i className="ri-loader-4-line animate-spin text-sm text-primary-600"></i>
                  ) : (
                    <i className="ri-folder-line text-sm text-foreground-400"></i>
                  )}
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                choisir(nouvelle);
              }}
              className="mt-1.5 pt-2 border-t border-background-200 flex items-center gap-1.5"
            >
              <input
                value={nouvelle}
                onChange={(e) => setNouvelle(e.target.value)}
                placeholder="Nouvelle catégorie…"
                className="min-w-0 flex-1 h-9 px-2.5 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
                aria-label="Nom de la nouvelle catégorie"
              />
              <button
                type="submit"
                disabled={!nouvelle.trim() || busy !== null}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-500 text-background-50 cursor-pointer hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Enregistrer dans cette nouvelle catégorie"
                title="Créer et enregistrer dans cette catégorie"
              >
                <i className="ri-add-line"></i>
              </button>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}