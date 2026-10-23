import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import type { AbonnementItem } from "@/lib/abonnementsApi";
import {
  buildMessageBienvenue,
  buildSujetBienvenue,
  EMAIL_BIENVENUE_RE,
  envoyerBienvenue,
} from "@/lib/bienvenue";

interface EmailBienvenueModalProps {
  abonnement: AbonnementItem;
  onClose: () => void;
  /** Notifie le parent qu'un email de bienvenue a été envoyé. */
  onSent?: () => void;
}

/**
 * Fenêtre d'envoi d'un email de bienvenue à un pro qui vient de s'inscrire. Le message est
 * prérempli (offre, entreprise) mais reste entièrement modifiable avant l'envoi, expédié
 * directement via le Backend (Resend) au nom de l'équipe.
 */
export default function EmailBienvenueModal({ abonnement, onClose, onSent }: EmailBienvenueModalProps) {
  const [sujet, setSujet] = useState(() => buildSujetBienvenue(abonnement));
  const [message, setMessage] = useState(() => buildMessageBienvenue(abonnement));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailValide = useMemo(
    () => !!abonnement.email && EMAIL_BIENVENUE_RE.test(abonnement.email),
    [abonnement.email],
  );
  const peutEnvoyer = emailValide && message.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!abonnement.email) {
      setFormError("Aucune adresse email renseignée pour ce pro.");
      return;
    }
    if (!emailValide) {
      setFormError("L'adresse email de ce pro est invalide.");
      return;
    }
    if (!message.trim()) {
      setFormError("Le message est vide.");
      return;
    }
    setSending(true);
    setFormError(null);
    try {
      await envoyerBienvenue(abonnement, { sujet, message });
      setSent(true);
      onSent?.();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "L'envoi de l'email a échoué. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  const champCls =
    "w-full px-3 py-2 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400";

  return (
    <Modal
      title="Email de bienvenue"
      subtitle={`${abonnement.entreprise} · offre ${abonnement.offre}`}
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
        >
          Fermer
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300">
          <i className="ri-mail-star-line text-accent-700"></i>
          <span className="text-sm font-semibold text-foreground-900">Message prérempli</span>
          <span className="text-xs text-foreground-600">
            Personnalisez-le si besoin, puis envoyez-le directement.
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3 rounded-lg bg-background-100 border border-background-200">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Destinataire</span>
          <span className={`text-sm font-semibold break-all ${emailValide ? "text-foreground-950" : "text-red-600"}`}>
            {abonnement.email ?? "Email non renseigné"}
          </span>
          {!emailValide && (
            <span className="text-[11px] text-red-600">Un email valide est nécessaire pour l'envoi direct.</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="bienvenue-sujet" className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
            Objet
          </label>
          <input
            id="bienvenue-sujet"
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            className={champCls}
            placeholder="Objet de l'email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="bienvenue-message" className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
            Message
          </label>
          <textarea
            id="bienvenue-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            maxLength={500}
            className={`${champCls} resize-y leading-relaxed`}
            placeholder="Votre message de bienvenue…"
          />
          <span className="self-end text-[10px] text-foreground-400">{message.length} / 500</span>
        </div>

        {formError && (
          <p className="flex items-start gap-1.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <i className="ri-error-warning-line mt-px"></i>
            {formError}
          </p>
        )}

        {sent && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300">
            <i className="ri-checkbox-circle-line text-accent-700 mt-px"></i>
            <span className="text-sm text-foreground-900">
              Email de bienvenue envoyé à <strong className="font-semibold">{abonnement.email}</strong>.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={!peutEnvoyer}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
            {sending ? "Envoi en cours…" : "Envoyer l'email de bienvenue"}
          </button>
        </div>

        <p className="text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
          <i className="ri-information-line mt-px"></i>
          L'email est envoyé directement depuis ArtiFlow-pro au nom de votre équipe.
        </p>
      </div>
    </Modal>
  );
}