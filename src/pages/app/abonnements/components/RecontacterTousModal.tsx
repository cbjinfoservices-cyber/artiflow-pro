import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { supabase } from "@/lib/supabase";
import { recordRecontact } from "@/lib/abonnementsApi";

export interface CibleRecontact {
  abonnementId: number;
  entreprise: string;
  email: string | null;
  nbChangements: number;
}

interface Props {
  cibles: CibleRecontact[];
  seuilLabel: string;
  onClose: () => void;
  onSent?: () => void;
}

interface ResultatLigne {
  abonnementId: number;
  entreprise: string;
  email: string;
  ok: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildMessageGlobal(nb: number): string {
  return [
    "Bonjour,",
    "",
    `Nous suivons votre abonnement ArtiFlow-pro et avons remarqué que votre formule a évolué plusieurs fois récemment.`,
    "Nous voulons simplement nous assurer que l'offre en cours correspond toujours bien à votre activité, et voir si nous pouvons vous accompagner.",
    "",
    "Seriez-vous disponible pour un échange rapide cette semaine ?",
    "",
    "Bien cordialement,",
    "L'équipe ArtiFlow-pro",
    "",
    `— Message envoyé à ${nb} compte${nb > 1 ? "s" : ""} très volatil${nb > 1 ? "s" : ""}`,
  ].join("\n");
}

/**
 * Envoi en masse du message de recontact à tous les comptes très volatils en un clic.
 * Chaque envoi est journalisé (date, destinataire, statut) dans le journal des recontacts.
 */
export default function RecontacterTousModal({ cibles, seuilLabel, onClose, onSent }: Props) {
  const valides = useMemo(() => cibles.filter((c) => c.email && EMAIL_RE.test(c.email)), [cibles]);
  const invalides = cibles.length - valides.length;

  const [sujet, setSujet] = useState("Votre abonnement ArtiFlow-pro — un point sur votre formule");
  const [message, setMessage] = useState(() => buildMessageGlobal(valides.length));
  const [sending, setSending] = useState(false);
  const [resultats, setResultats] = useState<ResultatLigne[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const peutEnvoyer = valides.length > 0 && message.trim().length > 0 && !sending;

  const handleSendAll = async () => {
    if (valides.length === 0) {
      setFormError("Aucun destinataire avec un email valide.");
      return;
    }
    if (!message.trim()) {
      setFormError("Le message est vide.");
      return;
    }
    setSending(true);
    setFormError(null);
    setResultats(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-recontact-artisan", {
        body: {
          recipients: valides.map((c) => ({ to: c.email, entreprise: c.entreprise })),
          sujet: sujet.trim(),
          message: message.trim(),
        },
      });
      if (error) {
        let msg = "L'envoi groupé a échoué. Réessayez.";
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const parsed = (await ctx.json().catch(() => null)) as { error?: string } | null;
          if (parsed?.error) msg = parsed.error;
        }
        throw new Error(msg);
      }
      const payload = data as
        | { ok?: boolean; error?: string; results?: Array<{ ok: boolean; error?: string }> }
        | null;
      if (!payload || payload.ok === false) {
        throw new Error(payload?.error || "L'envoi groupé a échoué.");
      }
      const results = payload.results ?? [];

      // Même ordre que `valides` (traitement séquentiel côté Backend).
      const lignes: ResultatLigne[] = await Promise.all(
        valides.map(async (c, i) => {
          const r = results[i];
          const ok = !!r?.ok;
          const email = c.email as string;
          const ligne: ResultatLigne = {
            abonnementId: c.abonnementId,
            entreprise: c.entreprise,
            email,
            ok,
            error: r?.error,
          };
          await recordRecontact({
            abonnement_id: c.abonnementId,
            artisan_id: null,
            entreprise: c.entreprise,
            email,
            sujet: sujet.trim(),
            statut: ok ? "envoye" : "echec",
            erreur: ok ? null : r?.error ?? "Envoi impossible",
          });
          return ligne;
        }),
      );
      setResultats(lignes);
      onSent?.();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "L'envoi groupé a échoué. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  const nbEnvoyes = resultats?.filter((r) => r.ok).length ?? 0;
  const nbEchecs = resultats ? resultats.length - nbEnvoyes : 0;

  const champCls =
    "w-full px-3 py-2 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400";

  return (
    <Modal
      title="Recontacter tous les comptes très volatils"
      subtitle={`${cibles.length} compte${cibles.length > 1 ? "s" : ""} à recontacter (${seuilLabel})`}
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
          <i className="ri-fire-line text-accent-700"></i>
          <span className="text-sm font-semibold text-foreground-900">
            {valides.length} destinataire{valides.length > 1 ? "s" : ""} avec email valide
          </span>
          {invalides > 0 && (
            <span className="text-xs text-foreground-600">· {invalides} ignoré{invalides > 1 ? "s" : ""} (email manquant ou invalide)</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Destinataires</span>
          <ul className="max-h-40 overflow-y-auto rounded-lg border border-background-200 divide-y divide-background-200">
            {cibles.map((c) => {
              const ok = !!c.email && EMAIL_RE.test(c.email);
              return (
                <li key={c.abonnementId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground-900 truncate">{c.entreprise}</span>
                    <span className={`block text-[10px] truncate ${ok ? "text-foreground-500" : "text-red-600"}`}>
                      {c.email ?? "Email non renseigné"}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-accent-700 whitespace-nowrap">
                    {c.nbChangements} chg. / 6 mois
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="recontact-tous-sujet" className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
            Objet
          </label>
          <input
            id="recontact-tous-sujet"
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            className={champCls}
            placeholder="Objet de l'email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="recontact-tous-message" className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
            Message commun
          </label>
          <textarea
            id="recontact-tous-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
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

        {resultats && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300">
              <i className="ri-checkbox-circle-line text-accent-700"></i>
              <span className="text-sm text-foreground-900">
                <strong className="font-semibold">{nbEnvoyes}</strong> email{nbEnvoyes > 1 ? "s" : ""} envoyé{nbEnvoyes > 1 ? "s" : ""}
                {nbEchecs > 0 ? ` · ${nbEchecs} échec${nbEchecs > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <ul className="rounded-lg border border-background-200 divide-y divide-background-200">
              {resultats.map((r) => (
                <li key={r.abonnementId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground-900 truncate">{r.entreprise}</span>
                    <span className="block text-[10px] text-foreground-500 truncate">{r.email}</span>
                    {!r.ok && r.error && <span className="block text-[10px] text-red-600 truncate">{r.error}</span>}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold ${
                      r.ok ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
                    }`}
                  >
                    <i className={r.ok ? "ri-check-line text-[10px]" : "ri-error-warning-line text-[10px]"}></i>
                    {r.ok ? "Envoyé" : "Échec"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSendAll}
            disabled={!peutEnvoyer}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
            {sending ? "Envoi en cours…" : `Envoyer à ${valides.length} compte${valides.length > 1 ? "s" : ""}`}
          </button>
        </div>

        <p className="text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
          <i className="ri-information-line mt-px"></i>
          Les emails sont envoyés directement depuis ArtiFlow-pro, et chaque envoi est consigné dans le journal des recontacts.
        </p>
      </div>
    </Modal>
  );
}