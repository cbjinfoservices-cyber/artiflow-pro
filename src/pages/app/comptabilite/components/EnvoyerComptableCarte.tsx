import { useEffect, useState } from "react";
import Infobulle from "@/components/base/Infobulle";

interface EnvoyerComptableCarteProps {
  /** Email du comptable mémorisé dans le profil (pré-remplissage). */
  defaultEmail: string;
  /** Envoi en cours (bouton désactivé + spinner). */
  busy: boolean;
  /** Message de confirmation après un envoi réussi. */
  notice: string | null;
  /** Message d'erreur renvoyé par l'envoi. */
  error: string | null;
  /** Déclenche l'envoi du journal (PDF consolidé en pièce jointe). */
  onSend: (email: string, message: string) => void;
}

/**
 * Carte d'envoi du journal comptable au comptable : adresse email (mémorisée),
 * petit message d'accompagnement et bouton d'envoi du PDF consolidé en pièce jointe.
 */
export default function EnvoyerComptableCarte({
  defaultEmail,
  busy,
  notice,
  error,
  onSend,
}: EnvoyerComptableCarteProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setEmail(defaultEmail);
  }, [defaultEmail]);

  const handleSend = () => {
    const propre = email.trim();
    if (!propre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propre)) {
      setLocalError("Saisissez une adresse email valide pour votre comptable.");
      return;
    }
    setLocalError(null);
    onSend(propre, message.trim());
  };

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-send-plane-line text-xl"></i>
        </span>
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-base text-foreground-950">Envoyer le journal au comptable</h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            Le PDF consolidé de la période (journal, TVA par taux et synthèse) est transmis en pièce jointe, avec votre
            message. L'adresse est mémorisée pour les prochains envois.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            Email du comptable
          </span>
          <div className="relative">
            <i className="ri-mail-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="comptable@cabinet.fr"
              className="h-11 w-full pl-10 pr-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            Message (facultatif)
          </span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex. : journal du 3e trimestre, merci !"
            maxLength={200}
            className="h-11 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
          />
        </label>
      </div>

      {(localError || error) && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {localError ?? error}
        </p>
      )}
      {notice && !localError && !error && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {notice}
        </p>
      )}

      <div className="flex justify-end">
        <Infobulle
          contenu="Le PDF de la période part en pièce jointe de l'email à votre comptable. Rien n'est envoyé avant que vous cliquiez."
          position="haut"
          largeur={290}
        >
          <button
            type="button"
            onClick={handleSend}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            Envoyer au comptable
          </button>
        </Infobulle>
      </div>
    </div>
  );
}