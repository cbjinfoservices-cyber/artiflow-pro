import { useEffect } from "react";
import type { ApercuEmailComptable } from "@/lib/abonnementPaiement";

interface ApercuEmailComptableModalProps {
  open: boolean;
  /** Rendu exact de l'email à expédier (objet, corps, pièces annoncées, destinataire). */
  apercu: ApercuEmailComptable | null;
  /** Envoi réel en cours (désactive le bouton de confirmation). */
  envoyant: boolean;
  onClose: () => void;
  /** Confirme et expédie réellement l'email. */
  onConfirm: () => void;
  /** Envoie une copie de test à l'artisan lui-même (même email, même pièces). */
  onTest: () => void;
  /** Envoi du test en cours (désactive le bouton). */
  testLoading: boolean;
  /** Adresse de l'artisan, affichée à côté du bouton de test. */
  testEmail: string | null;
  /** Confirmation affichée après l'envoi d'un test. */
  testNotice: string;
  /** Erreur éventuelle de l'envoi d'un test. */
  testErreur: string;
}

/**
 * Aperçu de l'email du pack comptable (ou du relevé seul) AVANT envoi : objet, corps
 * exact et pièces jointes annoncées, pour valider avant d'expédier au comptable.
 * L'email est injecté dans une iframe isolée (sandbox) pour une prévisualisation fidèle.
 */
export default function ApercuEmailComptableModal({
  open,
  apercu,
  envoyant,
  onClose,
  onConfirm,
  onTest,
  testLoading,
  testEmail,
  testNotice,
  testErreur,
}: ApercuEmailComptableModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !envoyant) onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, envoyant]);

  if (!open || !apercu) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu de l'email au comptable"
    >
      <div className="fixed inset-0 bg-foreground-950/60 backdrop-blur-sm" onClick={() => (envoyant ? undefined : onClose())}></div>

      <div className="relative w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-lg sm:rounded-lg bg-background-50 border border-background-200 overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-background-200">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
              <i className="ri-mail-open-line"></i>
            </span>
            <div>
              <h2 className="font-heading font-bold text-base text-foreground-950">Aperçu de l'email</h2>
              <p className="text-xs text-foreground-500 mt-0.5">
                Vérifiez le message et les pièces annoncées avant d'expédier au comptable.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={envoyant}
            aria-label="Fermer"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-background-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-close-line text-foreground-500"></i>
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4 overflow-y-auto">
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide w-24">Destinataire</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-900">
                <i className="ri-mail-line text-foreground-400"></i>
                {apercu.destinataire}
              </span>
            </div>
            {apercu.cc ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide w-24">En copie (Cc)</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-900">
                  <i className="ri-mail-add-line text-foreground-400"></i>
                  {apercu.cc}
                </span>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide w-24">Objet</span>
              <span className="text-sm font-medium text-foreground-900">{apercu.subject}</span>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide w-24 mt-0.5">
                Pièces jointes
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {apercu.pieces.map((piece) => (
                  <span
                    key={piece}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap"
                  >
                    <i className="ri-attachment-2"></i>
                    {piece}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-background-100 p-2">
            <iframe
              title="Aperçu de l'email au comptable"
              srcDoc={apercu.html}
              sandbox=""
              className="w-full h-[420px] rounded-md border border-background-200 bg-white"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 border-t border-background-200">
          {testNotice ? (
            <p className="text-xs text-accent-800 bg-accent-100/70 border border-accent-300/60 rounded-md px-3 py-2 flex items-center gap-1.5">
              <i className="ri-checkbox-circle-line"></i>
              {testNotice}
            </p>
          ) : null}
          {testErreur ? (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {testErreur}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTest}
              disabled={testLoading || envoyant}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-secondary-300 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
              Envoyer un test à moi-même
            </button>
            {testEmail ? (
              <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
                <i className="ri-arrow-right-line text-foreground-400"></i>
                {testEmail}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-foreground-500 flex items-center gap-1.5">
              <i className="ri-information-line text-foreground-400"></i>
              Aperçu sans envoi au comptable — le test, lui, ne part que vers vous.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={envoyant}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-arrow-left-line"></i>
                Revenir
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={envoyant}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {envoyant ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-fill"></i>}
                Confirmer et envoyer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}