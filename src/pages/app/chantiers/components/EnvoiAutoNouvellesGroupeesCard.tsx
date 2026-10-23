import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import ApercuEmailGroupeModal from "@/pages/app/chantiers/components/ApercuEmailGroupeModal";
import {
  JOURS_RECAP_CHANTIERS,
  MESSAGE_NOUVELLES_AUTO_DEFAUT,
  envoyerEssaiNouvellesGroupees,
  fetchNouvellesAutoSettings,
  libelleJourRecap,
  updateNouvellesAutoSettings,
  type NouvellesAutoSettings,
} from "@/lib/suiviChantier";

const HEURES = [6, 7, 8, 9, 12, 17, 18, 19] as const;

type Feedback = { ton: "ok" | "ko"; texte: string } | null;

/** Libellé du jour choisi, selon la fréquence (jour de semaine ou jour du mois). */
function libelleJourAuto(frequence: "semaine" | "mois", jour: number): string {
  if (frequence === "mois") return jour === 1 ? "1er du mois" : `${jour} du mois`;
  return libelleJourRecap(jour).toLowerCase();
}

/**
 * Réglages de l'envoi groupé automatique : chaque semaine (ou chaque mois), l'application
 * envoie un email personnalisé à tous les clients silencieux, sans intervention.
 * Les chantiers terminés, sans adresse email ou sans suivi partagé sont écartés.
 */
export default function EnvoiAutoNouvellesGroupeesCard({ nbSilencieux }: { nbSilencieux: number }) {
  const { user } = useAuth();
  const [reglages, setReglages] = useState<NouvellesAutoSettings | null>(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Aperçu du rendu de l'email groupé, sans passer par la boîte mail.
  const [apercuOuvert, setApercuOuvert] = useState(false);

  const charger = useCallback(async () => {
    if (!user?.id) return;
    try {
      const values = await fetchNouvellesAutoSettings(user.id);
      setReglages(values);
      setMessage(values.message);
      setErreur(null);
    } catch {
      setErreur("Les réglages de l'envoi automatique n'ont pas pu être chargés.");
    }
  }, [user?.id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const signaler = (ton: "ok" | "ko", texte: string) => {
    setFeedback({ ton, texte });
    window.setTimeout(() => setFeedback(null), 6000);
  };

  const enregistrer = async (
    patch: Partial<Omit<NouvellesAutoSettings, "dernierEnvoi">>,
    messageOk: string,
    jeton: string,
  ) => {
    if (!user?.id || !reglages) return;
    const avant = reglages;
    setReglages({ ...reglages, ...patch });
    setBusy(jeton);
    try {
      await updateNouvellesAutoSettings(user.id, patch);
      signaler("ok", messageOk);
    } catch {
      setReglages(avant);
      signaler("ko", "Le réglage n'a pas pu être enregistré.");
    } finally {
      setBusy(null);
    }
  };

  const basculer = () => {
    if (!reglages) return;
    const cible = !reglages.actif;
    void enregistrer(
      { actif: cible },
      cible
        ? `Envoi automatique activé : chaque ${libelleJourAuto(reglages.frequence, reglages.jour)} à ${String(
            reglages.heure,
          ).padStart(2, "0")}:00, vos clients silencieux recevront des nouvelles.`
        : "Envoi automatique désactivé : plus aucun email ne partira tout seul.",
      "actif",
    );
  };

  const changerFrequence = (frequence: "semaine" | "mois") => {
    if (!reglages) return;
    // On retombe sur un jour valide pour la nouvelle fréquence.
    const jour = frequence === "mois" ? Math.min(28, Math.max(1, reglages.jour)) : Math.min(7, Math.max(1, reglages.jour));
    void enregistrer(
      { frequence, jour },
      `Fréquence enregistrée : chaque ${libelleJourAuto(frequence, jour)}.`,
      "frequence",
    );
  };

  const enregistrerMessage = async () => {
    if (!user?.id || !reglages) return;
    const texte = message.trim();
    setBusy("message");
    try {
      await updateNouvellesAutoSettings(user.id, { message: texte });
      setReglages({ ...reglages, message: texte });
      signaler("ok", texte ? "Message enregistré : il accompagnera chaque envoi automatique." : "Message remis à celui proposé par défaut.");
    } catch {
      signaler("ko", "Le message n'a pas pu être enregistré.");
    } finally {
      setBusy(null);
    }
  };

  /** Envoie à l'artisan lui-même un exemplaire de l'email automatique, sans toucher aux clients. */
  const envoyerEssai = async () => {
    if (!user?.id || busy) return;
    setBusy("essai");
    try {
      const res = await envoyerEssaiNouvellesGroupees(user.id);
      signaler(
        "ok",
        res.destinataire
          ? `Essai envoyé à ${res.destinataire} : ouvrez-le pour vérifier le rendu. Aucun client n'a été contacté.`
          : "Essai envoyé sur votre adresse. Aucun client n'a été contacté.",
      );
    } catch (e) {
      signaler("ko", e instanceof Error ? e.message : "L'essai n'a pas pu être envoyé.");
    } finally {
      setBusy(null);
    }
  };

  const dernierEnvoi = reglages?.dernierEnvoi
    ? new Date(reglages.dernierEnvoi).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <section id="envoi-auto" className="rounded-lg bg-accent-50 border border-accent-100 p-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-robot-2-line text-base"></i>
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground-950">Envoi groupé automatique des nouvelles</h2>
            <p className="text-[11px] text-foreground-600 leading-relaxed">
              Chaque semaine ou chaque mois, un email personnalisé part tout seul aux clients sans nouvelles depuis
              plus de 14 jours.
              {nbSilencieux > 0 ? (
                <strong className="text-foreground-800"> {nbSilencieux} client{nbSilencieux > 1 ? "s" : ""} concerné{nbSilencieux > 1 ? "s" : ""} aujourd&apos;hui.</strong>
              ) : (
                " Aucun client silencieux pour l'instant."
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={basculer}
          disabled={busy === "actif" || !reglages}
          aria-pressed={Boolean(reglages?.actif)}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0 ${
            reglages?.actif
              ? "bg-accent-500 text-background-50 hover:bg-accent-600"
              : "bg-background-200 text-foreground-600 hover:bg-background-300"
          }`}
        >
          <i className={reglages?.actif ? "ri-toggle-line" : "ri-toggle-fill"}></i>
          {reglages?.actif ? "Activé" : "Désactivé"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-full bg-background-50 border border-accent-200 w-fit">
          {(["semaine", "mois"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => changerFrequence(f)}
              disabled={busy === "frequence" || !reglages}
              aria-pressed={reglages?.frequence === f}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 ${
                reglages?.frequence === f
                  ? "bg-accent-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {f === "semaine" ? "Chaque semaine" : "Chaque mois"}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
          <span className="whitespace-nowrap">le</span>
          <select
            value={reglages?.jour ?? 5}
            onChange={(e) => {
              if (!reglages) return;
              const jour = Number(e.target.value);
              void enregistrer(
                { jour },
                `Envoi automatique déplacé au ${libelleJourAuto(reglages.frequence, jour)}.`,
                "jour",
              );
            }}
            disabled={busy === "jour" || !reglages}
            aria-label="Jour de l'envoi automatique des nouvelles groupées"
            className="h-8 px-2 rounded-md bg-background-50 border border-accent-200 text-xs text-foreground-800 outline-none cursor-pointer disabled:opacity-60"
          >
            {(reglages?.frequence === "mois"
              ? Array.from({ length: 28 }, (_, i) => ({ valeur: i + 1, libelle: String(i + 1) }))
              : JOURS_RECAP_CHANTIERS
            ).map((j) => (
              <option key={j.valeur} value={j.valeur}>
                {j.libelle}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
          <span className="whitespace-nowrap">à</span>
          <select
            value={reglages?.heure ?? 8}
            onChange={(e) => {
              if (!reglages) return;
              const heure = Number(e.target.value);
              void enregistrer(
                { heure },
                `Envoi automatique prévu à ${String(heure).padStart(2, "0")}:00.`,
                "heure",
              );
            }}
            disabled={busy === "heure" || !reglages}
            aria-label="Heure de l'envoi automatique des nouvelles groupées"
            className="h-8 px-2 rounded-md bg-background-50 border border-accent-200 text-xs text-foreground-800 outline-none cursor-pointer disabled:opacity-60"
          >
            {HEURES.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 rounded-md bg-background-50 border border-accent-200 p-3">
        <label htmlFor="nouvelles-auto-message" className="text-[11px] font-semibold text-foreground-700">
          Message envoyé à chaque client
        </label>
        <textarea
          id="nouvelles-auto-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={MESSAGE_NOUVELLES_AUTO_DEFAUT}
          className="mt-1.5 w-full box-border px-3 py-2 rounded-md bg-background-100 border border-background-200 text-xs text-foreground-800 outline-none focus:border-accent-400 resize-none"
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-foreground-400 tabular-nums">{message.length}/500</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setApercuOuvert(true)}
              disabled={!reglages}
              title="Voir le rendu de l'email groupé dans une fenêtre, sans l'envoyer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-300 text-accent-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-eye-line"></i>
              Aperçu de l&apos;email groupé
            </button>
            <button
              type="button"
              onClick={() => void envoyerEssai()}
              disabled={busy !== null || !reglages}
              title="Recevoir l'email automatique sur votre propre adresse pour vérifier le rendu, sans contacter aucun client"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-300 text-accent-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={busy === "essai" ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}></i>
              {busy === "essai" ? "Envoi de l'essai…" : "M'envoyer un essai"}
            </button>
            <button
              type="button"
              onClick={() => void enregistrerMessage()}
              disabled={busy === "message" || !reglages}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={busy === "message" ? "ri-loader-4-line animate-spin" : "ri-save-line"}></i>
              Enregistrer le message
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-foreground-500 leading-relaxed">
          Laissez vide pour utiliser le message proposé par défaut. Chaque email reprend l&apos;avancement réel du
          chantier, vos couleurs et le lien de suivi du client.
        </p>
      </div>

      <p className="mt-2 text-[11px] text-foreground-500 inline-flex items-start gap-1.5 flex-wrap">
        <i className="ri-information-line mt-px"></i>
        <span>
          {reglages?.actif ? "Prochain envoi" : "Envoi désactivé"} : chaque{" "}
          {libelleJourAuto(reglages?.frequence ?? "semaine", reglages?.jour ?? 5)} à{" "}
          {String(reglages?.heure ?? 8).padStart(2, "0")}:00.
          {dernierEnvoi ? ` Dernier envoi automatique : ${dernierEnvoi}.` : " Aucun envoi automatique pour l'instant."}
        </span>
      </p>
      <p className="mt-1 text-[10px] text-foreground-500 leading-relaxed">
        Sont écartés : les chantiers terminés, les clients sans adresse email et les chantiers dont le suivi n&apos;est
        pas partagé. Les autres envois (manuels, groupés à la demande) ne sont pas affectés.
      </p>

      {erreur && (
        <p className="mt-2 text-[11px] text-red-600 inline-flex items-start gap-1.5">
          <i className="ri-error-warning-line mt-px"></i>
          {erreur}
        </p>
      )}

      {feedback && (
        <p
          className={`mt-2 text-[11px] inline-flex items-start gap-1.5 ${
            feedback.ton === "ok" ? "text-accent-800" : "text-red-600"
          }`}
        >
          <i className={feedback.ton === "ok" ? "ri-checkbox-circle-line mt-px" : "ri-error-warning-line mt-px"}></i>
          <span>{feedback.texte}</span>
        </p>
      )}

      {apercuOuvert && (
        <ApercuEmailGroupeModal message={message} onClose={() => setApercuOuvert(false)} />
      )}
    </section>
  );
}