import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import DiagnosticDnsEmail from "@/pages/app/components/DiagnosticDnsEmail";
import {
  chargerHistoriqueEmailsTest,
  chargerStatutEmail,
  envoyerEmailTest,
  libelleStatutDomaine,
  type EmailTestEntree,
  type StatutEmail,
} from "@/lib/diagnosticEmail";

/**
 * Carte « Envoi des emails » de la page Préférences d'affichage.
 *
 * Elle regroupe, à un seul endroit, le repère utile de la configuration d'envoi : la clé API
 * Resend est-elle présente, le domaine d'envoi est-il configuré et vérifié, et l'adresse
 * d'expédition réellement utilisée. Auparavant affiché sur une page Diagnostic dédiée, cet
 * état est conservé ici pour garder le repère sans la page supprimée.
 *
 * Lecture seule et sans incidence sur les données : on ne fait qu'interroger l'état courant.
 */
export default function StatutEnvoiEmailsCard() {
  const { user } = useAuth();
  const [etat, setEtat] = useState<"loading" | "ready" | "error">("loading");
  const [statut, setStatut] = useState<StatutEmail | null>(null);
  const [erreur, setErreur] = useState("");
  const [testEnCours, setTestEnCours] = useState(false);
  const [testNotice, setTestNotice] = useState("");
  const [testErreur, setTestErreur] = useState("");
  // Historique des derniers tests d'email envoyés (date, destinataire, résultat).
  const [historique, setHistorique] = useState<EmailTestEntree[]>([]);
  const [histEtat, setHistEtat] = useState<"loading" | "ready" | "error">("loading");

  const charger = useCallback(async () => {
    setEtat("loading");
    setErreur("");
    try {
      const res = await chargerStatutEmail();
      setStatut(res);
      setEtat("ready");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de vérifier la configuration pour l'instant.");
      setEtat("error");
    }
  }, []);

  const chargerHistorique = useCallback(async () => {
    setHistEtat("loading");
    try {
      const rows = await chargerHistoriqueEmailsTest(8);
      setHistorique(rows);
      setHistEtat("ready");
    } catch {
      setHistEtat("error");
    }
  }, []);

  useEffect(() => {
    void charger();
    void chargerHistorique();
  }, [charger, chargerHistorique]);

  // Envoie un email de test à l'adresse du compte artisan, pour valider la réception de
  // bout en bout (clé API + domaine d'envoi) sans quitter les Préférences.
  const envoyerTest = async () => {
    if (!user?.email) {
      setTestErreur("Aucune adresse email n'est rattachée à votre compte.");
      return;
    }
    setTestEnCours(true);
    setTestNotice("");
    setTestErreur("");
    try {
      await envoyerEmailTest(user.email);
      setTestNotice(`Email de test envoyé à ${user.email}. Vérifiez votre boîte de réception (et les indésirables).`);
      // Le test vient d'être journalisé côté Backend : on rafraîchit l'historique aussitôt.
      void chargerHistorique();
    } catch (e) {
      setTestErreur(e instanceof Error ? e.message : "L'envoi de l'email de test a échoué.");
    } finally {
      setTestEnCours(false);
    }
  };

  /** Date + heure de la dernière vérification, en français. */
  const dateVerif = (iso: string | undefined): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pret = statut?.ready === true;

  const resume = (() => {
    if (etat === "error") return { icone: "ri-error-warning-line", ton: "bg-red-100 text-red-700", texte: "Vérification impossible" };
    if (etat === "loading") return { icone: "ri-loader-4-line", ton: "bg-background-200 text-foreground-600", texte: "Vérification…" };
    return pret
      ? { icone: "ri-shield-check-line", ton: "bg-accent-100 text-accent-700", texte: "Prêt à envoyer" }
      : { icone: "ri-alert-line", ton: "bg-primary-100 text-primary-700", texte: "À finaliser" };
  })();

  /** Une ligne d'état avec pastille de couleur, libellé et détail. */
  const Ligne = ({
    ok,
    icone,
    libelle,
    detail,
    attente,
  }: {
    ok: boolean;
    icone: string;
    libelle: string;
    detail: string;
    attente?: boolean;
  }) => {
    const pastille = attente
      ? "bg-primary-100 text-primary-700"
      : ok
        ? "bg-accent-100 text-accent-700"
        : "bg-red-100 text-red-700";
    const badge = attente
      ? { icone: "ri-time-line", ton: "bg-primary-100 text-primary-700", texte: "En attente" }
      : ok
        ? { icone: "ri-checkbox-circle-line", ton: "bg-accent-100 text-accent-700", texte: "OK" }
        : { icone: "ri-close-circle-line", ton: "bg-red-100 text-red-700", texte: "À faire" };
    return (
      <li className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200">
        <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-md ${pastille}`}>
          <i className={icone}></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-900">{libelle}</p>
          <p className="text-[11px] text-foreground-500 mt-0.5 break-words">{detail}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${badge.ton}`}
        >
          <i className={badge.icone}></i>
          {badge.texte}
        </span>
      </li>
    );
  };

  return (
    <section id="section-envoi-emails" className="scroll-mt-28 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-mail-send-line"></i>
          </span>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground-950">Envoi des emails</h3>
            <p className="text-xs text-foreground-500 mt-0.5 max-w-2xl leading-relaxed">
              L'état réel du canal d'envoi (clé API + domaine vérifié). C'est ce qui conditionne vos devis,
              factures, relances et récapitulatifs automatiques. Simple repère : rien à régler ici.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap ${resume.ton}`}
          >
            <i className={`${resume.icone}${etat === "loading" ? " animate-spin" : ""}`}></i>
            {resume.texte}
          </span>
          <button
            type="button"
            onClick={() => { void charger(); }}
            disabled={etat === "loading"}
            title="Re-vérifier la configuration d'envoi des emails"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`ri-refresh-line${etat === "loading" ? " animate-spin" : ""}`}></i>
            Re-vérifier
          </button>
          <button
            type="button"
            onClick={() => { void envoyerTest(); }}
            disabled={testEnCours}
            title="Recevoir un email de test à l'adresse de votre compte pour valider la réception"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`${testEnCours ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}`}></i>
            {testEnCours ? "Envoi…" : "Envoyer un email de test"}
          </button>
        </div>
      </div>

      {etat === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 p-4 rounded-lg bg-background-50 border border-background-200">
          <i className="ri-error-warning-line text-primary-600 text-lg"></i>
          <p className="text-sm text-foreground-600 flex-1 min-w-[180px]">
            {erreur || "La configuration n'a pas pu être vérifiée."}
          </p>
          <button
            type="button"
            onClick={() => { void charger(); }}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : etat === "loading" ? (
        <p className="mt-4 text-xs text-foreground-500 flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Vérification de la configuration d'envoi…
        </p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            <Ligne
              ok={statut?.keyPresent === true}
              icone="ri-key-2-line"
              libelle="Clé API d'envoi (Resend)"
              detail={
                statut?.keyPresent
                  ? "Présente dans les secrets du Backend."
                  : "Absente : aucun email ne peut partir tant qu'elle n'est pas déposée."
              }
            />
            <Ligne
              ok={statut?.domainPresent === true}
              icone="ri-global-line"
              libelle="Domaine d'envoi"
              detail={
                statut?.domainName
                  ? `Configuré : ${statut.domainName}`
                  : "Aucun domaine d'envoi enregistré pour le moment."
              }
            />
            <Ligne
              ok={statut?.domainStatus === "verified"}
              attente={statut?.domainStatus != null && statut?.domainStatus !== "verified"}
              icone="ri-verified-badge-line"
              libelle="Domaine vérifié (Resend)"
              detail={
                statut?.domainStatus === "verified"
                  ? `${statut?.domainName ?? "Votre domaine"} est vérifié chez Resend : l'envoi depuis cette adresse est autorisé.`
                  : `Statut du domaine chez Resend : ${libelleStatutDomaine(statut?.domainStatus ?? null)}. Tant qu'il n'est pas vérifié, les emails peuvent être refusés.`
              }
            />
            <Ligne
              ok={Boolean(statut?.fromAddress)}
              icone="ri-at-line"
              libelle="Adresse d'expédition"
              detail={statut?.fromAddress ?? "Utilise le domaine d'envoi une fois configuré."}
            />
          </ul>

          {!pret && (
            <p className="mt-3 text-[11px] text-foreground-500 flex items-center gap-1.5">
              <i className="ri-information-line"></i>
              La clé et le domaine d'envoi se configurent depuis le panneau Resend. Une fois les deux validés, cette
              carte passera à « Prêt à envoyer ».
            </p>
          )}

          {statut?.apiError && (
            <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {statut.apiError}
            </p>
          )}

          <DiagnosticDnsEmail dns={statut?.dns ?? null} />

          <p className="mt-3 pt-3 border-t border-background-200 text-[11px] text-foreground-400 flex items-center gap-1.5">
            <i className="ri-time-line"></i>
            Dernière vérification : {dateVerif(statut?.checkedAt)}
          </p>
        </>
      )}

      {testNotice && (
        <p className="mt-3 text-xs text-accent-700 bg-accent-50 border border-accent-200 rounded-md px-3 py-2 flex items-start gap-1.5">
          <i className="ri-checkbox-circle-line mt-0.5 shrink-0"></i>
          <span>{testNotice}</span>
        </p>
      )}

      {testErreur && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-1.5">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>{testErreur}</span>
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-background-200">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground-800 flex items-center gap-1.5">
            <i className="ri-history-line text-foreground-500"></i>
            Derniers tests d'email
          </p>
          <button
            type="button"
            onClick={() => { void chargerHistorique(); }}
            disabled={histEtat === "loading"}
            title="Actualiser l'historique des tests d'email"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`ri-refresh-line${histEtat === "loading" ? " animate-spin" : ""}`}></i>
            Actualiser
          </button>
        </div>

        {histEtat === "loading" ? (
          <p className="mt-2 text-xs text-foreground-500 flex items-center gap-1.5">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement de l'historique…
          </p>
        ) : histEtat === "error" ? (
          <p className="mt-2 text-xs text-foreground-500">
            L'historique des tests n'est pas disponible pour l'instant.
          </p>
        ) : historique.length === 0 ? (
          <p className="mt-2 text-xs text-foreground-500">
            Aucun test d'email envoyé pour le moment. Lancez-en un pour vérifier la réception.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {historique.map((h) => {
              const ok = h.resultat === "succes";
              return (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-3 p-2.5 rounded-md bg-background-50 border border-background-200"
                >
                  <span
                    className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md ${
                      ok ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    <i className={ok ? "ri-checkbox-circle-line" : "ri-close-circle-line"}></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground-900 truncate">{h.destinataire}</p>
                    <p className="text-[11px] text-foreground-500 mt-0.5">
                      {dateVerif(h.created_at)}
                      {!ok && h.message ? ` · ${h.message}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                      ok ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {ok ? "Réussi" : "Échec"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}