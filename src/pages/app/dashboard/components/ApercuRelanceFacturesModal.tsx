import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { previewRelanceFactures } from "@/lib/artisanApi";

interface ApercuRelanceFacturesModalProps {
  open: boolean;
  onClose: () => void;
  /** Seuil d'ancienneté de retard appliqué (0 = toutes les factures en retard). */
  minJoursRetard: number;
  /** Délai minimum (jours) entre deux rappels d'une même facture (anti-doublon). */
  delaiMin: number;
}

/**
 * Modale d'aperçu du rappel de facture : affiche l'email exact qui serait envoyé
 * au client pour les impayés ciblés par le filtre d'ancienneté, sans rien expédier.
 */
export default function ApercuRelanceFacturesModal({
  open,
  onClose,
  minJoursRetard,
  delaiMin,
}: ApercuRelanceFacturesModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState("");
  const [subject, setSubject] = useState("");
  const [examined, setExamined] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoading(true);
    setError(null);
    previewRelanceFactures(user.id, minJoursRetard, delaiMin)
      .then((res) => {
        if (!active) return;
        setHtml(res.html);
        setSubject(res.subject);
        setExamined(res.examined);
        setConfigured(res.configured);
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
  }, [open, user, minJoursRetard, delaiMin]);

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
      aria-label="Aperçu du rappel de facture"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg bg-background-50 border border-background-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-background-200">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
              <i className="ri-eye-line"></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">Aperçu du rappel de facture</p>
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold ml-auto whitespace-nowrap">
              <i className="ri-receipt-line"></i>
              {examined} facture{examined > 1 ? "s" : ""} ciblée{examined > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {!loading && !error && !configured && (
          <p className="px-4 py-2 text-[11px] text-foreground-500 bg-background-100 border-b border-background-200 flex items-center gap-1.5">
            <i className="ri-information-line"></i>
            L'aperçu s'affiche même sans Resend configuré, mais l'envoi réel nécessitera une clé API et un domaine
            d'envoi.
          </p>
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
              title="Aperçu du rappel de facture"
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