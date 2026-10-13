import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { testerPaiementBlanc } from "@/lib/abonnementPaiement";
import {
  lireSessionPaiementCopiee,
  memoriserSessionPaiementCopiee,
} from "@/lib/sessionPaiementCopiee";

/**
 * Bouton « Tester le paiement » directement sur la page Tarifs.
 *
 * Réservé aux comptes gestionnaires connectés : il ouvre une VRAIE session Stripe
 * Checkout en MODE TEST (carte 4242 4242 4242 4242), sans jamais débiter d'argent, afin
 * de valider le tunnel de bout en bout SANS repasser par le back-office. Pour tout autre
 * visiteur (client non connecté), le bouton ne s'affiche pas.
 *
 * Il propose aussi de COPIER l'identifiant de session (cs_…) : ce même identifiant est
 * consigné dans l'historique des tests à blanc du back-office, ce qui permet de retrouver
 * précisément le test lancé depuis ici.
 */
export default function BoutonTestPaiement() {
  const { isGestionnaire } = useAuth();
  const [enCours, setEnCours] = useState(false);
  // Dernier identifiant de session copié : réaffiché au retour sur la page (mémoire navigateur),
  // pour ne pas le perdre entre deux visites.
  const [sessionId, setSessionId] = useState(() => lireSessionPaiementCopiee()?.sessionId ?? "");
  const [copie, setCopie] = useState<"idle" | "ok" | "erreur">("idle");
  const [resultat, setResultat] = useState<{ etat: "succes" | "erreur"; message: string } | null>(null);

  if (!isGestionnaire) return null;

  const lancer = async () => {
    setEnCours(true);
    setResultat(null);
    setCopie("idle");
    try {
      const { url, sessionId: sid } = await testerPaiementBlanc();
      setSessionId(sid);
      window.open(url, "_blank", "noopener,noreferrer");
      setResultat({
        etat: "succes",
        message:
          "Session de test ouverte dans un nouvel onglet. Renseignez la carte 4242 4242 4242 4242 (date future, CVC au hasard) — aucune somme réelle n'est prélevée.",
      });
    } catch (e) {
      setResultat({
        etat: "erreur",
        message: e instanceof Error ? e.message : "Le test de paiement n'a pas pu être lancé.",
      });
    } finally {
      setEnCours(false);
    }
  };

  const copierSession = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      memoriserSessionPaiementCopiee(sessionId);
      setCopie("ok");
      window.setTimeout(() => setCopie("idle"), 2500);
    } catch {
      setCopie("erreur");
      window.setTimeout(() => setCopie("idle"), 2500);
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-3 p-4 md:p-5 rounded-lg bg-background-100 border border-background-200 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
          <i className="ri-flask-line text-lg"></i>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-heading font-semibold text-sm text-foreground-950">Tester le paiement</p>
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">
              <i className="ri-shield-user-line"></i>
              Gestionnaire
            </span>
          </div>
          <p className="mt-0.5 text-xs md:text-sm text-foreground-600 leading-relaxed">
            Ouvre une session Stripe en mode test pour valider le tunnel de bout en bout, sans passer par le
            back-office et sans débiter d'argent réel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={lancer}
            disabled={enCours}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={enCours ? "ri-loader-4-line animate-spin" : "ri-external-link-line"}></i>
            {enCours ? "Ouverture…" : "Lancer un test"}
          </button>
          <button
            type="button"
            onClick={copierSession}
            disabled={!sessionId}
            title={
              sessionId
                ? "Copier l'identifiant de session pour le retrouver dans l'historique des tests du back-office."
                : "L'identifiant sera disponible après un premier lancement de test."
            }
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i
              className={
                copie === "ok"
                  ? "ri-check-line text-accent-600"
                  : copie === "erreur"
                    ? "ri-error-warning-line text-red-500"
                    : "ri-file-copy-line"
              }
            ></i>
            {copie === "ok" ? "Identifiant copié" : "Copier l'identifiant de session"}
          </button>
        </div>
      </div>

      {sessionId && (
        <div className="flex flex-wrap items-center gap-2 rounded-md px-3 py-2 bg-background-50 border border-background-200">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-hashtag"></i>
            Session
          </span>
          <code className="min-w-0 flex-1 truncate text-xs font-mono text-foreground-700" title={sessionId}>
            {sessionId}
          </code>
          <span className="text-[11px] text-foreground-400">
            À retrouver dans « Tests à blanc du paiement » du back-office.
          </span>
        </div>
      )}

      {resultat && (
        <div
          className={`flex items-start gap-2 rounded-md px-3 py-2 border ${
            resultat.etat === "succes"
              ? "bg-accent-100/60 border-accent-300/60"
              : "bg-background-50 border-background-200"
          }`}
        >
          <i
            className={`mt-0.5 shrink-0 ${
              resultat.etat === "succes" ? "ri-checkbox-circle-line text-accent-700" : "ri-error-warning-line text-red-500"
            }`}
          ></i>
          <span className="text-xs text-foreground-600 leading-relaxed">{resultat.message}</span>
        </div>
      )}

      {copie === "erreur" && (
        <p className="text-xs text-red-600 leading-relaxed">
          La copie automatique n'est pas disponible dans ce navigateur. Sélectionnez l'identifiant ci-dessus pour le copier.
        </p>
      )}
    </div>
  );
}