import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { previewRecap } from "@/lib/artisanApi";

interface ApercuRecapModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modale d'aperçu du récapitulatif quotidien : affiche l'email exact tel qu'il serait
 * envoyé (mêmes données, mêmes canaux, même mise en page), sans rien expédier.
 */
export default function ApercuRecapModal({ open, onClose }: ApercuRecapModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState("");
  const [subject, setSubject] = useState("");
  const [counts, setCounts] = useState<{ repros: number; echecs: number; factures: number; devis: number }>({
    repros: 0,
    echecs: 0,
    factures: 0,
    devis: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoading(true);
    setError(null);
    previewRecap(user.id)
      .then((res) => {
        if (!active) return;
        setHtml(res.html);
        setSubject(res.subject);
        setCounts({ repros: res.repros, echecs: res.echecs, factures: res.factures, devis: res.devis });
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Aperçu indisponible.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu du récapitulatif quotidien"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg bg-background-50 border border-background-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-background-200">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-lg">
              <i className="ri-eye-line"></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">Aperçu du récapitulatif</p>
              <p className="text-xs text-foreground-500 mt-0.5">
                Voici exactement l'email qui partira — rien n'a été envoyé.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {!loading && !error && subject && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-background-200 bg-background-100">
            <span className="text-[11px] uppercase tracking-wide text-foreground-500">Objet</span>
            <span className="text-sm font-medium text-foreground-900 truncate">{subject}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold ml-auto">
              <i className="ri-mail-line"></i>
              {counts.repros} reprog. · {counts.echecs} échec{counts.echecs > 1 ? "s" : ""} · {counts.factures} fact. ·{" "}
              {counts.devis} devis
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-white">
          {loading ? (
            <div className="h-[55vh] flex flex-col items-center justify-center gap-3">
              <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
              <p className="text-sm text-foreground-500">Génération de l'aperçu…</p>
            </div>
          ) : error ? (
            <div className="h-[55vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="w-12 h-12 flex items-center justify-center rounded-full bg-red-50 text-red-600 text-xl">
                <i className="ri-error-warning-line"></i>
              </span>
              <p className="text-sm text-foreground-600 max-w-sm">{error}</p>
            </div>
          ) : (
            <iframe
              title="Aperçu du récapitulatif quotidien"
              srcDoc={html}
              className="w-full h-[55vh] border-0"
              sandbox=""
            />
          )}
        </div>
      </div>
    </div>
  );
}