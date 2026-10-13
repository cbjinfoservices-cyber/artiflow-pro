import { useEffect, useRef, useState } from "react";
import type { Article } from "@/mocks/ressources";
import { exportGuidesCsv, exportSuiviLectureCsv, exportNotesCsv } from "@/lib/ressourcesExport";

/**
 * Menu d'export des guides Ressources : permet de télécharger la liste affichée
 * (résultat courant de la recherche, du filtre et du tri) ou l'intégralité du
 * suivi de lecture, au format CSV (compatible Excel).
 */
export default function ExporterMenu({ liste, fichier }: { liste: Article[]; fichier: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
      >
        <i className="ri-download-2-line"></i>
        Exporter
        <i className={open ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 p-1.5 rounded-lg bg-background-50 border border-background-200"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              exportGuidesCsv(liste, `artiflow-${fichier}.csv`);
              setOpen(false);
            }}
            disabled={liste.length === 0}
            className="w-full flex items-start gap-3 p-2.5 rounded-md text-left cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700 text-lg">
              <i className="ri-file-list-3-line"></i>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground-950">Liste affichée</span>
              <span className="block text-xs text-foreground-500 mt-0.5">
                {liste.length} guide{liste.length > 1 ? "s" : ""} selon vos filtres et tri actuels
              </span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              exportSuiviLectureCsv();
              setOpen(false);
            }}
            className="w-full flex items-start gap-3 p-2.5 rounded-md text-left cursor-pointer hover:bg-background-100 transition-colors"
          >
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700 text-lg">
              <i className="ri-history-line"></i>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground-950">Mon suivi de lecture</span>
              <span className="block text-xs text-foreground-500 mt-0.5">
                Tous les guides avec leur statut : lu, en cours ou à lire
              </span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              exportNotesCsv();
              setOpen(false);
            }}
            className="w-full flex items-start gap-3 p-2.5 rounded-md text-left cursor-pointer hover:bg-background-100 transition-colors"
          >
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700 text-lg">
              <i className="ri-sticky-note-line"></i>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground-950">Mes notes</span>
              <span className="block text-xs text-foreground-500 mt-0.5">
                Vos notes personnelles, guide par guide
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}