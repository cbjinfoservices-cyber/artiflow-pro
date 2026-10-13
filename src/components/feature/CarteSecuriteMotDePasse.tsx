import { useState } from "react";
import { Link } from "react-router-dom";
import { useAncienneteMotDePasse } from "@/hooks/useAncienneteMotDePasse";
import { useAuth } from "@/hooks/useAuth";
import { exporterHistoriqueMotDePasse, libelleAnciennete } from "@/lib/ancienneteMotDePasse";
import { updateMotDePasseAlerteEmailActif, updateMotDePasseRecapMensuelActif } from "@/lib/motDePasse";
import { testerAlerteMotDePasseAncien } from "@/lib/diagnosticEmail";
import ChangerMotDePasseModal from "@/components/feature/ChangerMotDePasseModal";

/** Date lisible en français à partir d'une date ISO. */
function dateFR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Carte « Sécurité du compte » partagée : elle rappelle l'ancienneté et l'historique des
 * changements de mot de passe, ouvre la fenêtre « Modifier mon mot de passe » (même seuil
 * de robustesse partout) et permet d'exporter l'historique en CSV. Utilisée par le profil
 * artisan et la page « Mon compte gestionnaire » pour une sécurité homogène.
 */
export default function CarteSecuriteMotDePasse() {
  const { user, profile, refreshProfile } = useAuth();
  const { jours, ancien, dateRef, historique, seuilJours, enregistrerChangement } = useAncienneteMotDePasse();
  const [open, setOpen] = useState(false);
  const [exporte, setExporte] = useState(false);
  // Interrupteur de l'email d'alerte « mot de passe ancien » (respecté par la tâche planifiée).
  const emailActif = profile?.mot_de_passe_alerte_email_actif !== false;
  const dernierTest = profile?.mot_de_passe_alerte_test_ok_at ?? null;
  const lastTestLabel = dernierTest ? dateFR(dernierTest) : null;
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErreur, setEmailErreur] = useState<string | null>(null);
  // Interrupteur du récap mensuel par email (respecté par la tâche planifiée dédiée).
  const recapActif = profile?.mot_de_passe_recap_mensuel_actif !== false;
  const [recapBusy, setRecapBusy] = useState(false);
  const [recapErreur, setRecapErreur] = useState<string | null>(null);
  const dernierRecap = profile?.mot_de_passe_recap_mensuel_dernier_envoi_at ?? null;
  const lastRecapLabel = dernierRecap ? dateFR(dernierRecap) : null;
  // Test manuel de l'email d'alerte, directement depuis le profil (sans passer par le Diagnostic).
  const [testBusy, setTestBusy] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const testerEmail = async () => {
    if (!user || testBusy) return;
    setTestBusy(true);
    setTestMessage(null);
    try {
      await testerAlerteMotDePasseAncien(user.id);
      setTestOk(true);
      setTestMessage(
        `Email de démonstration envoyé à ${profile?.email ?? user.email ?? "votre adresse"}. Vérifiez votre boîte de réception (et les indésirables).`,
      );
      void refreshProfile();
    } catch (e) {
      setTestOk(false);
      setTestMessage(e instanceof Error ? e.message : "L'envoi du test a échoué.");
    } finally {
      setTestBusy(false);
    }
  };

  const basculerEmail = async () => {
    if (!user || emailBusy) return;
    setEmailBusy(true);
    setEmailErreur(null);
    try {
      await updateMotDePasseAlerteEmailActif(user.id, !emailActif);
      await refreshProfile();
    } catch {
      setEmailErreur("L'enregistrement du réglage a échoué. Réessayez.");
    } finally {
      setEmailBusy(false);
    }
  };

  const basculerRecap = async () => {
    if (!user || recapBusy) return;
    setRecapBusy(true);
    setRecapErreur(null);
    try {
      await updateMotDePasseRecapMensuelActif(user.id, !recapActif);
      await refreshProfile();
    } catch {
      setRecapErreur("L'enregistrement du réglage a échoué. Réessayez.");
    } finally {
      setRecapBusy(false);
    }
  };

  const handleExport = () => {
    if (historique.length === 0) return;
    exporterHistoriqueMotDePasse(historique);
    setExporte(true);
    window.setTimeout(() => setExporte(false), 2500);
  };

  return (
    <>
      <div className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-lock-password-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Sécurité du compte</h3>
            <p className="text-xs text-foreground-500">Gérez le mot de passe qui protège votre espace ArtiFlow-pro.</p>
          </div>
        </div>

        {ancien && (
          <div className="flex items-start gap-3 mb-3 p-3 rounded-md bg-accent-50 border border-accent-200">
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <i className="ri-shield-keyhole-line"></i>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground-950">Mot de passe ancien</p>
                <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
                  <i className="ri-time-line"></i>
                  À renouveler
                </span>
              </div>
              <p className="text-[11px] text-foreground-600 mt-0.5">
                Votre mot de passe n'a pas été changé depuis plus de {Math.round(seuilJours / 30)} mois
                {jours !== null ? ` (${libelleAnciennete(jours)})` : ""}. Le renouveler protège votre espace et vos
                données.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-900">Mot de passe de connexion</p>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              Pour votre sécurité, votre mot de passe actuel vous sera demandé avant tout changement.
            </p>
            <p className="text-[11px] text-foreground-500 mt-1.5 inline-flex items-center gap-1.5">
              <i className="ri-history-line"></i>
              {dateRef ? (
                <>
                  Dernier changement le <strong className="text-foreground-700">{dateFR(dateRef)}</strong>
                  {jours !== null ? ` (il y a ${libelleAnciennete(jours)})` : ""}.
                </>
              ) : (
                <>Date du dernier changement inconnue.</>
              )}
            </p>
            <Link
              to="/guide/mot-de-passe-solide"
              className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
            >
              <i className="ri-book-open-line"></i>
              Lire le guide « Créer un mot de passe solide »
              <i className="ri-arrow-right-line"></i>
            </Link>
            {historique.length > 1 && (
              <div className="mt-2.5">
                <p className="text-[10px] font-semibold text-foreground-400 uppercase tracking-wide mb-1">
                  Derniers changements
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {historique.slice(0, 5).map((d) => (
                    <li
                      key={d}
                      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-background-100 border border-background-200 text-[10px] font-medium text-foreground-600"
                    >
                      <i className="ri-checkbox-circle-line text-foreground-400"></i>
                      {new Date(d).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
            >
              <i className="ri-key-2-line"></i>
              Modifier mon mot de passe
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={historique.length === 0}
              title="Télécharger l'historique des changements de mot de passe au format CSV"
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={exporte ? "ri-check-line text-accent-600" : "ri-download-2-line"}></i>
              {exporte ? "Export généré" : "Exporter l'historique (CSV)"}
            </button>
          </div>
        </div>

        {/* Interrupteur : activer ou couper l'email d'alerte « mot de passe ancien ». */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-900">Email d'alerte « mot de passe ancien »</p>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              Recevoir un email de prévention quand mon mot de passe dépasse 6 mois. Respecté par la tâche
              planifiée.
            </p>
            {emailErreur && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {emailErreur}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold ${emailActif ? "text-primary-700" : "text-foreground-400"}`}>
              {emailActif ? "Activé" : "Coupé"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={emailActif}
              aria-label="Activer ou couper l'email d'alerte mot de passe ancien"
              onClick={() => { void basculerEmail(); }}
              disabled={emailBusy}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                emailActif ? "bg-primary-500" : "bg-background-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-background-50 shadow transition-transform ${
                  emailActif ? "translate-x-5" : "translate-x-0.5"
                }`}
              ></span>
            </button>
          </div>
        </div>

        {/* Interrupteur : activer ou couper le récap mensuel par email. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-900">Récap mensuel par email</p>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              Recevoir, le 1er de chaque mois, un email récapitulant les alertes « mot de passe ancien »
              envoyées. Respecté par la tâche planifiée.
            </p>
            {recapErreur && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {recapErreur}
              </p>
            )}
            {lastRecapLabel && (
              <p className="text-[11px] text-foreground-500 mt-1 flex items-center gap-1.5">
                <i className="ri-mail-check-line text-foreground-400"></i>
                Dernier récap envoyé le {lastRecapLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold ${recapActif ? "text-primary-700" : "text-foreground-400"}`}>
              {recapActif ? "Activé" : "Coupé"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={recapActif}
              aria-label="Activer ou couper le récap mensuel par email"
              onClick={() => { void basculerRecap(); }}
              disabled={recapBusy}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                recapActif ? "bg-primary-500" : "bg-background-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-background-50 shadow transition-transform ${
                  recapActif ? "translate-x-5" : "translate-x-0.5"
                }`}
              ></span>
            </button>
          </div>
        </div>

        {/* Test manuel de l'email d'alerte, directement depuis le profil (sans passer par le Diagnostic). */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-900">Tester l'email d'alerte</p>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              Recevez tout de suite un email de démonstration pour vérifier le rendu et la réception, sans attendre
              le seuil de 6 mois.
            </p>
            {testMessage && (
              <p className={`text-[11px] mt-1 flex items-center gap-1.5 ${testOk ? "text-accent-700" : "text-red-600"}`}>
                <i className={testOk ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                {testMessage}
              </p>
            )}
            {lastTestLabel && (
              <p className="text-[11px] text-foreground-500 mt-1 flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line text-accent-600"></i>
                Dernier test réussi le {lastTestLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { void testerEmail(); }}
            disabled={testBusy || !user}
            title="Envoyer une alerte de démonstration à mon adresse"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <i className={testBusy ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}></i>
            {testBusy ? "Envoi…" : "Tester maintenant"}
          </button>
        </div>
      </div>

      {open && <ChangerMotDePasseModal onClose={() => setOpen(false)} onSuccess={enregistrerChangement} />}
    </>
  );
}