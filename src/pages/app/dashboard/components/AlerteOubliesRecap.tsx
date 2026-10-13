import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRecapRecontactHistorique } from "@/hooks/useRecapRecontactHistorique";
import { useTousRecontacts } from "@/hooks/useTousRecontacts";
import { useAlertesAutoRelance } from "@/hooks/useAlertesAutoRelance";
import { fetchAbonnements, type AbonnementItem } from "@/lib/abonnementsApi";
import { updateRecontactOubliesAlerteSnooze } from "@/lib/artisanApi";
import {
  idsOubliesRecaps,
  idsOubliesAutoProchains,
  lireRecapOubliesAutoJours,
  libelleOubliesAutoJours,
  declencherAutoRelanceOubliesMaintenant,
  RECAP_OUBLIES_AUTO_EVENT,
} from "@/lib/recontactSeuil";
import { todayISO, formatShortDate } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import Modal from "@/pages/app/components/Modal";
import RecontacterTousModal, { type CibleRecontact } from "@/pages/app/abonnements/components/RecontacterTousModal";

/**
 * Nombre de comptes oubliés à partir duquel le bandeau se déclenche : en dessous, on
 * considère qu'il n'y a pas d'accumulation significative sur les derniers récaps.
 */
const SEUIL_OUBLIES = 3;

/** Nombre de récaps récents pris en compte pour repérer les oubliés. */
const NB_RECAPS = 12;

/** Date « AAAA-MM-JJ » à N jours d'aujourd'hui, pour proposer une mise de côté. */
function dansNJours(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Date lisible en français à partir d'une date « AAAA-MM-JJ ». */
function dateFR(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Bandeau d'alerte du tableau de bord : quand des comptes listés dans les derniers récaps
 * hebdomadaires n'ont jamais été relancés depuis, ils s'accumulent. Le bandeau donne le compte
 * et un accès direct à la liste des oubliés, pour les recontacter d'un coup sans ouvrir la page Abonnements.
 *
 * Comme les autres alertes du tableau de bord, il peut être mis de côté (raccourci « Masquer
 * aujourd'hui » ou date choisie) : il se remplace alors par une ligne discrète avec un bouton de
 * réactivation. Il affiche aussi le réglage d'auto-relance des oubliés quand celui-ci est actif,
 * et permet d'exporter la liste des oubliés en CSV.
 */
export default function AlerteOubliesRecap() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { items: recaps, loading: loadingRecaps } = useRecapRecontactHistorique(user?.id, NB_RECAPS);
  const { items: recontacts, loading: loadingRecontacts, reload: reloadRecontacts } = useTousRecontacts();
  // Dernière alerte email réellement envoyée à l'artisan par l'auto-relance des oubliés.
  const alertesAuto = useAlertesAutoRelance(user?.id, 1);
  const derniereAlerte = alertesAuto.items[0]?.envoyeLe ?? null;

  const [abos, setAbos] = useState<AbonnementItem[]>([]);
  const [opened, setOpened] = useState(false);
  const [recontactOpen, setRecontactOpen] = useState(false);
  // Mise de côté de l'alerte : date choisie + état du panneau + indicateur d'enregistrement.
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(dansNJours(1));
  const [snoozeBusy, setSnoozeBusy] = useState(false);
  // Délai d'auto-relance des oubliés réglé sur la page Abonnements (0 = jamais).
  const [autoJours, setAutoJours] = useState<number>(() => lireRecapOubliesAutoJours());
  // Déclenchement manuel de l'auto-relance des oubliés dus (sans attendre le passage planifié).
  const [envoiAutoBusy, setEnvoiAutoBusy] = useState(false);
  const [autoMessage, setAutoMessage] = useState<{ ton: "ok" | "info" | "err"; texte: string } | null>(null);

  const snoozeJusqu = profile?.recontact_oublies_alerte_snooze ?? null;
  const snoozeActif = Boolean(snoozeJusqu && snoozeJusqu >= todayISO());

  // Charge le parc d'abonnements pour résoudre les comptes listés dans les récaps.
  useEffect(() => {
    let active = true;
    fetchAbonnements()
      .then((data) => {
        if (active) setAbos(data);
      })
      .catch(() => {
        /* silencieux : sans le parc, on ne peut pas résoudre les comptes oubliés */
      });
    return () => {
      active = false;
    };
  }, []);

  // Suit le réglage d'auto-relance des oubliés quand il change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setAutoJours(lireRecapOubliesAutoJours());
    window.addEventListener(RECAP_OUBLIES_AUTO_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(RECAP_OUBLIES_AUTO_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Comptes oubliés (listés et jamais relancés depuis) sur les derniers récaps.
  const oubliesIds = useMemo(() => idsOubliesRecaps(recaps, recontacts), [recaps, recontacts]);

  // Parmi les oubliés, ceux dont le délai d'auto-relance est écoulé : ils partiront réellement
  // au prochain passage planifié. Sert à afficher le nombre de relances automatiques à venir.
  const nbAutoProchains = useMemo(
    () => idsOubliesAutoProchains(recaps, recontacts, autoJours).size,
    [recaps, recontacts, autoJours],
  );

  // Oubliés résolus depuis le parc (avec leurs coordonnées).
  const oublies = useMemo(() => {
    const parId = new Map(abos.map((a) => [a.id, a]));
    return [...oubliesIds]
      .map((id) => parId.get(id))
      .filter((a): a is AbonnementItem => a !== undefined);
  }, [oubliesIds, abos]);

  const cibles: CibleRecontact[] = useMemo(
    () =>
      oublies.map((a) => ({
        abonnementId: a.id,
        entreprise: a.entreprise,
        email: a.email,
        nbChangements: 0,
      })),
    [oublies],
  );

  const nbAvecEmail = useMemo(() => oublies.filter((a) => !!a.email).length, [oublies]);

  const loading = loadingRecaps || loadingRecontacts;

  // Met de côté l'alerte jusqu'à la date choisie : elle ne s'affichera plus jusque-là.
  const handleSnooze = async (date: string) => {
    if (!user || !date) return;
    setSnoozeBusy(true);
    try {
      await updateRecontactOubliesAlerteSnooze(user.id, date);
      await refreshProfile();
      setSnoozeOpen(false);
    } catch {
      /* confort : l'échec laisse simplement l'alerte affichée */
    } finally {
      setSnoozeBusy(false);
    }
  };

  // Réactive immédiatement l'alerte mise de côté.
  const handleReactiver = async () => {
    if (!user) return;
    setSnoozeBusy(true);
    try {
      await updateRecontactOubliesAlerteSnooze(user.id, null);
      await refreshProfile();
    } catch {
      /* confort */
    } finally {
      setSnoozeBusy(false);
    }
  };

  // Export de la liste des oubliés (entreprise, email, offre) pour la relancer hors de l'app.
  const handleExportCsv = () => {
    const rows = oublies.map((a) => [a.entreprise, a.email ?? "", a.offre, "Oublié (jamais relancé)"]);
    downloadCsv(
      `comptes-oublies-recaps-${todayISO()}.csv`,
      toCsv(["Entreprise", "Email", "Offre", "Statut"], rows),
    );
  };

  // Déclenche tout de suite l'auto-relance des oubliés dont le délai est écoulé, sans attendre
  // le prochain passage planifié. Seuls les comptes « dus » partent ; l'action reste idempotente.
  const handleEnvoyerMaintenant = async () => {
    if (!user) return;
    setEnvoiAutoBusy(true);
    setAutoMessage(null);
    try {
      const res = await declencherAutoRelanceOubliesMaintenant(user.id);
      if (res.nbRelances > 0) {
        setAutoMessage({
          ton: "ok",
          texte: `${res.nbRelances} oublié${res.nbRelances > 1 ? "s" : ""} auto-relancé${res.nbRelances > 1 ? "s" : ""} à l'instant.`,
        });
      } else if (!res.configure) {
        setAutoMessage({ ton: "err", texte: "Resend n'est pas configuré : aucun email n'a pu partir." });
      } else {
        setAutoMessage({ ton: "info", texte: "Aucun oublié dû à relancer pour l'instant." });
      }
      reloadRecontacts();
    } catch {
      setAutoMessage({ ton: "err", texte: "L'envoi a échoué. Réessayez dans un instant." });
    } finally {
      setEnvoiAutoBusy(false);
    }
  };

  // Le bandeau n'apparaît que lorsqu'une accumulation réelle est détectée.
  if (loading || oublies.length < SEUIL_OUBLIES) return null;

  // Alerte mise de côté : on affiche une ligne discrète avec la date et un moyen de réactiver.
  if (snoozeActif) {
    return (
      <div className="p-3 rounded-lg bg-background-100 border border-background-200 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-eye-off-line"></i>
          Alerte « comptes oubliés sur vos derniers récaps » mise de côté jusqu'au{" "}
          <strong className="text-foreground-700">{snoozeJusqu ? dateFR(snoozeJusqu) : "—"}</strong>.
        </p>
        <button
          type="button"
          onClick={handleReactiver}
          disabled={snoozeBusy}
          title="Réafficher tout de suite l'alerte des comptes oubliés"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {snoozeBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-eye-line"></i>}
          Réactiver l'alerte
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 rounded-lg bg-primary-50 border border-primary-200 flex items-start gap-3 animate-fade-in">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-lg">
          <i className="ri-mail-add-line"></i>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground-950">Comptes oubliés sur vos derniers récaps</p>
            <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-primary-100 text-primary-800 text-[11px] font-bold whitespace-nowrap">
              <i className="ri-fire-line"></i>
              {oublies.length} compte{oublies.length > 1 ? "s" : ""} jamais relancé{oublies.length > 1 ? "s" : ""}
            </span>
            {autoJours > 0 && (
              <span
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap"
                title={`Les oubliés sont relancés automatiquement ${libelleOubliesAutoJours(autoJours).toLowerCase()}`}
              >
                <i className="ri-robot-2-line"></i>
                Auto-relance : {libelleOubliesAutoJours(autoJours)}
              </span>
            )}
            {autoJours > 0 && (
              <span
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-primary-100 text-primary-800 text-[11px] font-bold whitespace-nowrap"
                title="Comptes oubliés dont le délai est écoulé : ils seront relancés automatiquement au prochain passage planifié"
              >
                <i className="ri-timer-flash-line"></i>
                {nbAutoProchains > 0
                  ? `${nbAutoProchains} auto-relancé${nbAutoProchains > 1 ? "s" : ""} au prochain passage`
                  : "Aucune auto-relance due pour l'instant"}
              </span>
            )}
            {derniereAlerte && (
              <span
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-bold whitespace-nowrap"
                title="Date de la dernière alerte email envoyée à l'artisan par l'auto-relance des oubliés"
              >
                <i className="ri-notification-3-line"></i>
                Dernière alerte : {formatShortDate(derniereAlerte)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-foreground-600">
            {oublies.length} compte{oublies.length > 1 ? "s" : ""} listé{oublies.length > 1 ? "s" : ""} dans vos derniers
            récaps hebdomadaires n'{oublies.length > 1 ? "ont" : "a"} pas encore été recontacté
            {oublies.length > 1 ? "s" : ""} depuis leur envoi. Vous pouvez les relancer d'un coup.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpened(true)}
              title="Voir la liste des comptes oubliés sur les derniers récaps"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-list-check-2"></i>
              Voir les oubliés
            </button>
            {autoJours > 0 && (
              <button
                type="button"
                onClick={handleEnvoyerMaintenant}
                disabled={envoiAutoBusy || nbAutoProchains === 0}
                title={
                  nbAutoProchains === 0
                    ? "Aucun oublié dont le délai d'auto-relance est écoulé pour l'instant"
                    : `Relancer tout de suite les ${nbAutoProchains} oublié(s) dus, sans attendre le passage planifié`
                }
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {envoiAutoBusy ? (
                  <i className="ri-loader-4-line animate-spin"></i>
                ) : (
                  <i className="ri-send-plane-2-line"></i>
                )}
                {nbAutoProchains > 0
                  ? `Envoyer maintenant les oubliés dus (${nbAutoProchains})`
                  : "Envoyer maintenant les oubliés dus"}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/app/abonnements")}
              title="Ouvrir l'historique complet des récaps sur la page Abonnements"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-primary-200 text-primary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-100 transition-colors"
            >
              <i className="ri-history-line"></i>
              Historique complet
            </button>
            <button
              type="button"
              onClick={() => void handleSnooze(todayISO())}
              disabled={snoozeBusy}
              title="Masquer ce bandeau pour aujourd'hui ; il réapparaîtra demain"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-primary-200 text-primary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {snoozeBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-eye-off-line"></i>}
              Masquer aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => {
                setSnoozeDate(dansNJours(1));
                setSnoozeOpen((v) => !v);
              }}
              aria-expanded={snoozeOpen}
              title="Masquer ce bandeau jusqu'à une date choisie, le temps d'attendre"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                snoozeOpen
                  ? "bg-primary-100 border-primary-300 text-primary-800"
                  : "bg-background-50 border-primary-200 text-primary-800 hover:bg-primary-100"
              }`}
            >
              <i className="ri-calendar-close-line"></i>
              Choisir une date
            </button>
          </div>

          {autoMessage && (
            <p
              className={`mt-3 flex items-start gap-1.5 text-[11px] font-medium ${
                autoMessage.ton === "ok"
                  ? "text-accent-700"
                  : autoMessage.ton === "err"
                    ? "text-red-600"
                    : "text-foreground-500"
              }`}
            >
              <i
                className={`mt-px ${
                  autoMessage.ton === "ok"
                    ? "ri-checkbox-circle-line"
                    : autoMessage.ton === "err"
                      ? "ri-error-warning-line"
                      : "ri-information-line"
                }`}
              ></i>
              {autoMessage.texte}
            </p>
          )}

          {snoozeOpen && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 p-3 rounded-md bg-background-50 border border-primary-200 animate-fade-in">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">
                  Masquer jusqu'au
                </span>
                <input
                  type="date"
                  value={snoozeDate}
                  min={todayISO()}
                  onChange={(e) => setSnoozeDate(e.target.value)}
                  className="h-9 px-3 rounded-md bg-background-100 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleSnooze(snoozeDate)}
                disabled={!snoozeDate || snoozeBusy}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {snoozeBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-eye-off-line"></i>}
                Mettre de côté
              </button>
              {[7, 30, 90].map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setSnoozeDate(dansNJours(j))}
                  title={`Masquer l'alerte pendant ${j} jours`}
                  className="inline-flex items-center h-9 px-3 rounded-md bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
                >
                  +{j} j
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSnoozeOpen(false)}
                className="inline-flex items-center h-9 px-3 rounded-md bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {opened && (
        <Modal
          title="Comptes oubliés sur les derniers récaps"
          subtitle={`${oublies.length} compte${oublies.length > 1 ? "s" : ""} listé${oublies.length > 1 ? "s" : ""} dans vos récaps et jamais relancé${oublies.length > 1 ? "s" : ""} depuis`}
          onClose={() => setOpened(false)}
          wide
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRecontactOpen(true)}
                disabled={nbAvecEmail === 0}
                title={nbAvecEmail === 0 ? "Aucun compte oublié n'a d'email renseigné" : undefined}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-mail-send-line"></i>
                Recontacter les {oublies.length} oubliés
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={oublies.length === 0}
                title="Exporter la liste des comptes oubliés (entreprise, email, offre) au format CSV"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-file-excel-2-line"></i>
                Exporter la liste (CSV)
              </button>
              <button
                type="button"
                onClick={() => setOpened(false)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
              >
                Fermer
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <span className="text-[11px] text-foreground-500">
              {nbAvecEmail} avec email · {oublies.length} affiché{oublies.length > 1 ? "s" : ""}
            </span>
            <ul className="max-h-80 overflow-y-auto rounded-lg border border-background-200 divide-y divide-background-200">
              {oublies.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex items-start gap-2">
                    <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
                      <i className="ri-store-2-line"></i>
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-foreground-900 truncate">{a.entreprise}</span>
                      <span className={`block text-[10px] truncate ${a.email ? "text-foreground-500" : "text-red-600"}`}>
                        {a.email ?? "Email non renseigné"}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center h-5 px-2 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold whitespace-nowrap">
                    {a.offre}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
              <i className="ri-information-line mt-px"></i>
              Chaque recontact est journalisé, comme pour les relances depuis la page Abonnements.
            </p>
          </div>
        </Modal>
      )}

      {recontactOpen && (
        <RecontacterTousModal
          cibles={cibles}
          seuilLabel="comptes oubliés des derniers récaps"
          onClose={() => setRecontactOpen(false)}
          onSent={() => {
            // Un envoi vient d'être journalisé : on ferme les fenêtres et on rafraîchit le journal
            // pour que le bandeau se recalcule (les oubliés viennent d'être relancés).
            setRecontactOpen(false);
            setOpened(false);
            reloadRecontacts();
          }}
        />
      )}
    </>
  );
}