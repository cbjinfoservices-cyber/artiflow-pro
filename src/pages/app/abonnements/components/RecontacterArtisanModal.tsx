import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { supabase } from "@/lib/supabase";
import { recordRecontact } from "@/lib/abonnementsApi";

interface Props {
  abonnementId: number;
  entreprise: string;
  email: string | null;
  metier: string | null;
  ville: string | null;
  offre: string;
  nbChangements: number;
  seuilLabel: string;
  onClose: () => void;
  /** Notifie le parent qu'un recontact a été envoyé (rafraîchit le journal). */
  onSent?: () => void;
}

function buildMessage(entreprise: string, nbChangements: number): string {
  return [
    `Bonjour,`,
    ``,
    `Nous suivons votre abonnement ArtiFlow-pro et avons remarqué que votre formule a évolué ${nbChangements} fois récemment.`,
    `Nous voulons simplement nous assurer que l'offre en cours correspond toujours bien à votre activité, et voir si nous pouvons vous accompagner.`,
    ``,
    `Seriez-vous disponible pour un échange rapide cette semaine ?`,
    ``,
    `Bien cordialement,`,
    `L'équipe ArtiFlow-pro`,
    ``,
    `— ${entreprise}`,
  ].join("\n");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Fenêtre de recontact d'un artisan très volatil : coordonnées, message suggéré et
 * envoi d'email réel directement via le Backend (Resend), sans passer par la messagerie.
 * La copie reste disponible en secours (WhatsApp / SMS).
 */
export default function RecontacterArtisanModal({
  abonnementId,
  entreprise,
  email,
  metier,
  ville,
  offre,
  nbChangements,
  seuilLabel,
  onClose,
  onSent,
}: Props) {
  const [sujet, setSujet] = useState(`Votre abonnement ArtiFlow-pro — ${entreprise}`);
  const [message, setMessage] = useState(buildMessage(entreprise, nbChangements));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const emailValide = useMemo(() => !!email && EMAIL_RE.test(email), [email]);
  const peutEnvoyer = emailValide && message.trim().length > 0 && !sending;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papier indisponible : on laisse l'utilisateur sélectionner le texte */
    }
  };

  const handleSend = async () => {
    if (!email) {
      setFormError("Aucune adresse email renseignée pour ce contact.");
      return;
    }
    if (!emailValide) {
      setFormError("L'adresse email de ce contact est invalide.");
      return;
    }
    if (!message.trim()) {
      setFormError("Le message est vide.");
      return;
    }
    setSending(true);
    setFormError(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-recontact-artisan", {
        body: { to: email, entreprise, sujet: sujet.trim(), message: message.trim() },
      });
      if (error) {
        let msg = "L'envoi de l'email a échoué. Réessayez.";
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const parsed = (await ctx.json().catch(() => null)) as { error?: string } | null;
          if (parsed?.error) msg = parsed.error;
        }
        throw new Error(msg);
      }
      if (data && (data as { ok?: boolean; error?: string }).ok === false) {
        throw new Error((data as { error?: string }).error || "L'envoi de l'email a échoué.");
      }
      await recordRecontact({
        abonnement_id: abonnementId,
        artisan_id: null,
        entreprise,
        email,
        sujet: sujet.trim(),
        statut: "envoye",
        erreur: null,
      });
      setSent(true);
      onSent?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "L'envoi de l'email a échoué. Réessayez.";
      await recordRecontact({
        abonnement_id: abonnementId,
        artisan_id: null,
        entreprise,
        email,
        sujet: sujet.trim(),
        statut: "echec",
        erreur: msg,
      });
      onSent?.();
      setFormError(msg);
    } finally {
      setSending(false);
    }
  };

  const champCls =
    "w-full px-3 py-2 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400";

  return (
    <Modal
      title="Recontacter l'artisan"
      subtitle={`${entreprise} · ${nbChangements} changement${nbChangements > 1 ? "s" : ""} d'offre`}
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
          <i className="ri-alert-line text-accent-700"></i>
          <span className="text-sm font-semibold text-foreground-900">
            Compte très volatil ({seuilLabel})
          </span>
          <span className="text-xs text-foreground-600">
            {nbChangements} changements d'offre sur les 6 derniers mois · offre actuelle : {offre}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background-100 border border-background-200">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Entreprise</span>
            <span className="text-sm font-semibold text-foreground-950">{entreprise}</span>
            <span className="text-[11px] text-foreground-500">
              {metier ?? "Métier non renseigné"}
              {ville ? ` · ${ville}` : ""}
            </span>
          </div>
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background-100 border border-background-200">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Destinataire</span>
            <span className={`text-sm font-semibold break-all ${emailValide ? "text-foreground-950" : "text-red-600"}`}>
              {email ?? "Email non renseigné"}
            </span>
            {!emailValide && (
              <span className="text-[11px] text-red-600">
                Un email valide est nécessaire pour l'envoi direct.
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="recontact-sujet" className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
            Objet
          </label>
          <input
            id="recontact-sujet"
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            className={champCls}
            placeholder="Objet de l'email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="recontact-message"
              className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400"
            >
              Message
            </label>
            <button
              type="button"
              onClick={copyMessage}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-300 transition-colors"
            >
              <i className={copied ? "ri-check-line text-accent-700" : "ri-file-copy-line"}></i>
              {copied ? "Copié" : "Copier pour WhatsApp / SMS"}
            </button>
          </div>
          <textarea
            id="recontact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            maxLength={500}
            className={`${champCls} resize-y leading-relaxed`}
            placeholder="Votre message…"
          />
          <span className="self-end text-[10px] text-foreground-400">{message.length} / 500</span>
        </div>

        {formError && (
          <p className="flex items-start gap-1.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <i className="ri-error-warning-line mt-px"></i>
            {formError}
          </p>
        )}

        {sent ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300">
            <i className="ri-checkbox-circle-line text-accent-700 mt-px"></i>
            <span className="text-sm text-foreground-900">
              Email envoyé à <strong className="font-semibold">{email}</strong>.
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={!peutEnvoyer}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
            {sending ? "Envoi en cours…" : "Envoyer l'email"}
          </button>
          <button
            type="button"
            onClick={copyMessage}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
          >
            <i className="ri-whatsapp-line"></i>
            Copier le message
          </button>
        </div>

        <p className="text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
          <i className="ri-information-line mt-px"></i>
          L'email est envoyé directement depuis ArtiFlow-pro au nom de votre équipe, sans ouvrir votre messagerie.
        </p>
      </div>
    </Modal>
  );
}