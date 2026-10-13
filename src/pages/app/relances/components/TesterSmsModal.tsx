import { useState } from "react";
import { sendTestSms } from "@/lib/email";
import Modal from "@/pages/app/components/Modal";

/** Canaux disponibles pour un test ponctuel (pas d'email ici). */
const CANAUX_TEST = ["SMS", "WhatsApp"] as const;

/**
 * Fenêtre « Tester l'envoi SMS » : envoie un message de test à un numéro saisi à la volée
 * pour valider Twilio, sans créer de relance ni toucher à un vrai client.
 */
export default function TesterSmsModal({ onClose }: { onClose: () => void }) {
  const [canal, setCanal] = useState<string>("SMS");
  const [telephone, setTelephone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSend = async () => {
    if (!telephone.trim()) {
      setError("Renseignez un numéro de téléphone.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendTestSms(telephone.trim(), canal, message.trim());
      setNotice(
        `Message de test ${canal} envoyé à ${telephone.trim()}. Vérifiez la réception sur ce numéro pour confirmer que Twilio fonctionne.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'envoi du test a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Tester l'envoi SMS"
      subtitle="Envoyez un message de test à un numéro, sans créer de relance."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-accent-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-accent-600 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            Envoyer le test
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Canal</span>
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            {CANAUX_TEST.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCanal(c)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  canal === c ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className={c === "WhatsApp" ? "ri-whatsapp-line" : "ri-message-3-line"}></i>
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Numéro de téléphone</span>
          <input
            type="tel"
            inputMode="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="06 12 34 56 78 ou +33 6 12 34 56 78"
            className={inputCls}
          />
          <span className="text-[11px] text-foreground-400">
            Format international ou français accepté. Le numéro n'est pas enregistré : il sert uniquement au test.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Message (optionnel)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Laissez vide pour utiliser un message de test par défaut."
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 resize-none"
          />
          <span className="text-[11px] text-foreground-400 text-right">{message.length}/500</span>
        </label>

        {notice && (
          <p className="flex items-start gap-2 text-xs text-accent-700 leading-relaxed">
            <i className="ri-checkbox-circle-line mt-px shrink-0"></i>
            <span>{notice}</span>
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 text-xs text-red-600 leading-relaxed">
            <i className="ri-error-warning-line mt-px shrink-0"></i>
            <span>{error}</span>
          </p>
        )}

        <div className="flex items-start gap-2 p-3 rounded-md bg-background-100 border border-background-200 text-[11px] text-foreground-500 leading-relaxed">
          <i className="ri-information-line mt-px shrink-0 text-primary-600"></i>
          <span>
            Si vous voyez « L'envoi SMS/WhatsApp n'est pas encore configuré », c'est qu'un des identifiants Twilio
            est manquant côté Backend (Account SID, Auth Token ou numéro d'envoi).
          </span>
        </div>
      </div>
    </Modal>
  );
}