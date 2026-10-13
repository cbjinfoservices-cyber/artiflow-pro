import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { supabase } from "@/lib/supabase";
import { recordRecontact } from "@/lib/abonnementsApi";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";

export interface CibleEssaiFinJour {
  abonnementId: number;
  entreprise: string;
  email: string | null;
  offre: string;
  montant: number;
  echeance: string | null;
}

/** Moment de la relance : le jour même de la fin d'essai, ou la veille (relance préventive). */
export type ModeRelanceEssai = "aujourdhui" | "demain";

interface Props {
  cibles: CibleEssaiFinJour[];
  mode?: ModeRelanceEssai;
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

/** Remplace les jetons {entreprise}, {offre}, {montant} et {echeance} par les valeurs du compte. */
function personnaliser(texte: string, c: CibleEssaiFinJour): string {
  return texte
    .replace(/\{entreprise\}/gi, c.entreprise)
    .replace(/\{offre\}/gi, c.offre)
    .replace(/\{montant\}/gi, formatEuros(c.montant))
    .replace(/\{echeance\}/gi, c.echeance ? formatShortDate(c.echeance) : "—");
}

/** Corps de l'email « dernière chance » : envoyé le jour même de la fin de l'essai. */
function buildMessageAujourdhui(): string {
  return [
    "Bonjour,",
    "",
    "Dernier jour de votre essai ArtiFlow-pro ! À partir de demain, votre abonnement {offre} se poursuit automatiquement et le premier prélèvement de {montant}/mois sera effectué sur la carte enregistrée.",
    "",
    "Aucune action n'est nécessaire pour continuer. Pour résilier avant le premier prélèvement, rendez-vous dès aujourd'hui dans la rubrique « Mon abonnement ».",
    "",
    "Bien cordialement,",
    "L'équipe ArtiFlow-pro",
  ].join("\n");
}

/** Corps de l'email préventif : envoyé la veille de la fin de l'essai (J-1). */
function buildMessageDemain(): string {
  return [
    "Bonjour,",
    "",
    "Votre essai ArtiFlow-pro se termine demain. Après-demain, votre abonnement {offre} se poursuit automatiquement et le premier prélèvement de {montant}/mois sera effectué sur la carte enregistrée.",
    "",
    "Il vous reste une journée pour en profiter. Aucune action n'est nécessaire pour continuer ; pour résilier avant le premier prélèvement, rendez-vous dans la rubrique « Mon abonnement ».",
    "",
    "Bien cordialement,",
    "L'équipe ArtiFlow-pro",
  ].join("\n");
}

interface ConfigMode {
  titre: string;
  /** Suffixe de date repris dans le sous-titre (« … se terminant aujourd'hui/demain »). */
  suffixe: string;
  listeLabel: string;
  sujetDefaut: string;
  messageDefaut: () => string;
  echeanceFallback: string;
  piedInfo: string;
}

const CONFIG: Record<ModeRelanceEssai, ConfigMode> = {
  aujourdhui: {
    titre: "Relancer les essais qui finissent aujourd'hui",
    suffixe: "aujourd'hui",
    listeLabel: "Essais se terminant aujourd'hui",
    sujetDefaut: "Dernier jour de votre essai — votre offre {offre} démarre demain",
    messageDefaut: buildMessageAujourdhui,
    echeanceFallback: "fin d'essai aujourd'hui",
    piedInfo:
      "Dernière chance avant le premier prélèvement : chaque envoi est consigné dans le journal des recontacts (origine « essai »). Le statut de l'abonnement n'est pas modifié automatiquement.",
  },
  demain: {
    titre: "Relancer les essais qui finissent demain",
    suffixe: "demain",
    listeLabel: "Essais se terminant demain",
    sujetDefaut: "Votre essai {offre} se termine demain — premier prélèvement dans 2 jours",
    messageDefaut: buildMessageDemain,
    echeanceFallback: "fin d'essai demain",
    piedInfo:
      "Relance préventive la veille de la fin d'essai : chaque envoi est consigné dans le journal des recontacts (origine « essai »). Le statut de l'abonnement n'est pas modifié automatiquement.",
  },
};

/**
 * Envoi en un clic d'un email de relance aux essais qui se terminent aujourd'hui (« dernière
 * chance » avant le tout premier prélèvement) ou demain (relance préventive).
 * Le message peut être personnalisé avec les jetons {entreprise}, {offre}, {montant} et {echeance}.
 * Chaque envoi est journalisé (origine « essai ») dans le journal des recontacts.
 */
export default function RelancerEssaisFinJourModal({ cibles, mode = "aujourdhui", onClose, onSent }: Props) {
  const cfg = CONFIG[mode];
  const valides = useMemo(() => cibles.filter((c) => c.email && EMAIL_RE.test(c.email)), [cibles]);
  const invalides = cibles.length - valides.length;
  const montantTotal = useMemo(() => valides.reduce((s, c) => s + c.montant, 0), [valides]);

  const [sujet, setSujet] = useState(cfg.sujetDefaut);
  const [message, setMessage] = useState(() => cfg.messageDefaut());
  const [sending, setSending] = useState(false);
  const [resultats, setResultats] = useState<ResultatLigne[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const peutEnvoyer = valides.length > 0 && message.trim().length > 0 && sujet.trim().length > 0 && !sending;

  const handleSendAll = async () => {
    if (valides.length === 0) {
      setFormError("Aucun destinataire avec un email valide.");
      return;
    }
    if (!message.trim()) {
      setFormError("Le message est vide.");
      return;
    }
    if (!sujet.trim()) {
      setFormError("L'objet est vide.");
      return;
    }
    setSending(true);
    setFormError(null);
    setResultats(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-recontact-artisan", {
        body: {
          recipients: valides.map((c) => ({
            to: c.email,
            entreprise: c.entreprise,
            sujet: personnaliser(sujet.trim(), c),
            message: personnaliser(message.trim(), c),
          })),
        },
      });
      if (error) {
        let msg = "L'envoi des relances a échoué. Réessayez.";
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
        throw new Error(payload?.error || "L'envoi des relances a échoué.");
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
            sujet: personnaliser(sujet.trim(), c),
            statut: ok ? "envoye" : "echec",
            erreur: ok ? null : r?.error ?? "Envoi impossible",
            origine: "essai",
          });
          return ligne;
        }),
      );
      setResultats(lignes);
      onSent?.();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "L'envoi des relances a échoué. Réessayez.");
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
      title={cfg.titre}
      subtitle={`${cibles.length} essai${cibles.length > 1 ? "s" : ""} se terminant ${cfg.suffixe} · ${formatEuros(montantTotal)} de premier prélèvement`}
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
          <i className="ri-timer-flash-line text-accent-700"></i>
          <span className="text-sm font-semibold text-foreground-900">
            {valides.length} destinataire{valides.length > 1 ? "s" : ""} avec email valide
          </span>
          {invalides > 0 && (
            <span className="text-xs text-foreground-600">
              · {invalides} ignoré{invalides > 1 ? "s" : ""} (email manquant ou invalide)
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
            {cfg.listeLabel}
          </span>
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
                  <div className="shrink-0 text-right">
                    <span className="block text-xs font-semibold text-foreground-900 whitespace-nowrap">
                      {c.offre} · {formatEuros(c.montant)}/mois
                    </span>
                    <span className="block text-[10px] text-foreground-500 whitespace-nowrap">
                      {c.echeance ? `fin le ${formatShortDate(c.echeance)}` : cfg.echeanceFallback}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="relance-essais-sujet" className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
            Objet
          </label>
          <input
            id="relance-essais-sujet"
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            className={champCls}
            placeholder="Objet de l'email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="relance-essais-message" className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
            Message
          </label>
          <textarea
            id="relance-essais-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            maxLength={500}
            className={`${champCls} resize-y leading-relaxed`}
            placeholder="Votre message…"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-foreground-400 inline-flex items-center gap-1">
              <i className="ri-magic-line"></i>
              Jetons disponibles : &#123;entreprise&#125; &#123;offre&#125; &#123;montant&#125; &#123;echeance&#125;
            </span>
            <span className="text-[10px] text-foreground-400">{message.length} / 500</span>
          </div>
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
                <strong className="font-semibold">{nbEnvoyes}</strong> relance{nbEnvoyes > 1 ? "s" : ""} envoyée{nbEnvoyes > 1 ? "s" : ""}
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
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
            {sending ? "Envoi en cours…" : `Envoyer à ${valides.length} compte${valides.length > 1 ? "s" : ""}`}
          </button>
        </div>

        <p className="text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
          <i className="ri-information-line mt-px"></i>
          {cfg.piedInfo}
        </p>
      </div>
    </Modal>
  );
}