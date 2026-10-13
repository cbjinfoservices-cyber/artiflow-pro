import { useEffect, useState } from "react";
import { previewClientRelance, sendClientRelanceEmail } from "@/lib/artisanApi";
import { markRelanceClientEnvoyee, type RelanceClientItem } from "@/lib/relancesClient";
import { formatShortDate } from "@/lib/dates";

interface Props {
  relance: RelanceClientItem;
  clientNom: string;
  onClose: () => void;
  /** Appelé après un envoi immédiat réussi, pour rafraîchir la liste. */
  onSent?: () => void;
}

/**
 * Aperçu de l'email de relance client avant envoi : affiche l'objet et le rendu exact
 * de l'email qui partira le jour prévu (message de la relance ou modèle du profil).
 * Le bouton « Envoyer maintenant » permet de déclencher la relance tout de suite,
 * sans attendre la date programmée : le message est expédié puis la relance est
 * marquée comme envoyée. Utilisé depuis la page « Relances programmées ».
 */
export default function PreviewRelanceClientModal({ relance, clientNom, onClose, onSent }: Props) {
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    previewClientRelance(relance.client_id, relance.message ?? "")
      .then((res) => {
        if (!active) return;
        setHtml(res.html);
        setSubject(res.subject);
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
  }, [relance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Expédie la relance immédiatement et la marque comme envoyée (sans attendre la date). */
  const handleSendNow = async () => {
    setSending(true);
    setSendError(null);
    try {
      await sendClientRelanceEmail(relance.client_id, relance.message ?? "");
      await markRelanceClientEnvoyee(relance.id);
      setSent(true);
      onSent?.();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "L'envoi a échoué. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground-950/50 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu de l'email de relance"
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
              <p className="text-sm font-semibold text-foreground-950">Aperçu de la relance email</p>
              <p className="text-xs text-foreground-500 mt-0.5">
                Pour <strong className="text-foreground-800">{clientNom}</strong> · prévue le{" "}
                {formatShortDate(relance.date_prevue)} —{" "}
                {sent ? "relance envoyée." : "rien n'a encore été envoyé."}
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
              <i className="ri-mail-line"></i>
              Relance email
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-white">
          {loading ? (
            <div className="h-[48vh] flex flex-col items-center justify-center gap-3">
              <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
              <p className="text-sm text-foreground-500">Génération de l'aperçu…</p>
            </div>
          ) : error ? (
            <div className="h-[48vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="w-12 h-12 flex items-center justify-center rounded-full bg-red-50 text-red-600 text-xl">
                <i className="ri-error-warning-line"></i>
              </span>
              <p className="text-sm text-foreground-600 max-w-sm">{error}</p>
            </div>
          ) : (
            <iframe title="Aperçu de l'email de relance" srcDoc={html} className="w-full h-[48vh] border-0" sandbox="" />
          )}
        </div>

        {/* Barre d'action : envoi immédiat sans attendre la date programmée */}
        <div className="flex flex-col gap-3 p-4 border-t border-background-200 bg-background-100 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            {sent ? (
              <p className="text-xs text-accent-700 flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line"></i>
                Relance envoyée maintenant à {clientNom}.
              </p>
            ) : sendError ? (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {sendError}
              </p>
            ) : (
              <p className="text-xs text-foreground-500 flex items-center gap-1.5">
                <i className="ri-information-line"></i>
                L'envoi immédiat part tout de suite et marque la relance comme envoyée.
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap transition-colors"
            >
              Fermer
            </button>
            {sent ? (
              <span className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-accent-100 text-accent-800 text-sm font-semibold whitespace-nowrap">
                <i className="ri-send-plane-fill"></i>
                Envoyée
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSendNow}
                disabled={sending || loading || Boolean(error)}
                title="Envoyer cette relance tout de suite, sans attendre la date prévue"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                Envoyer maintenant
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}