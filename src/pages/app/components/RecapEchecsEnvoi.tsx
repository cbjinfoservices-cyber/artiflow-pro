import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  chargerEchecsEnvoiRecap,
  chargerHistoriqueReessais,
  enregistrerReessai,
  envoyerAlerteReessaiEchec,
  exporterHistoriqueReessais,
  type RecapEchecsEnvoi,
  type ReessaiHistorique,
} from "@/lib/echecsEnvoi";
import { retryEscaladeFailures } from "@/lib/artisanApi";
import { envoyerEmailTest } from "@/lib/diagnosticEmail";
import { useAuth } from "@/hooks/useAuth";
import { useEchecsSurveillance } from "@/hooks/useEchecsSurveillance";
import type { EscaladeJournalItem } from "@/hooks/useArtisanData";
import EchecAlerteBanner from "@/pages/app/components/EchecAlerteBanner";
import SurveillanceEchecsReglage from "@/pages/app/components/SurveillanceEchecsReglage";
import ExportCsvMensuelReglage from "@/pages/app/components/ExportCsvMensuelReglage";

interface Props {
  /** Journal d'escalade du compte (sert à la détection en direct des nouveaux échecs). */
  journal: EscaladeJournalItem[];
  /** Rafraîchit les données après un réessai (silencieux). */
  onRetried: () => void;
}

/** Fenêtres proposées pour choisir la période affichée. */
const FENETRES = [
  { value: 1, label: "24 h" },
  { value: 7, label: "7 j" },
  { value: 30, label: "30 j" },
] as const;

/**
 * Bloc unique de pilotage des échecs d'envoi, partagé par le tableau de bord ET la page
 * Relances : il réunit le réglage de la surveillance (fréquence, bandeau, notification
 * navigateur), le bandeau d'alerte in-app, le récapitulatif des échecs sur la période
 * choisie (24 h / 7 j / 30 j), un réessai en un clic et son petit historique. Un seul
 * endroit à surveiller, où que l'on soit dans l'application.
 */
export default function RecapEchecsEnvoiCard({ journal, onRetried }: Props) {
  const { user } = useAuth();

  // Surveillance : fréquence, bandeau d'alerte in-app, notification navigateur.
  const {
    surveillanceFreq,
    alerteBandeau,
    echecAlerte,
    changeSurveillance,
    toggleAlerteBandeau,
    dismissAlerte,
    notifNav,
    notifPermission,
    toggleNotifNav,
    seuilAlerte,
    changeSeuilAlerte,
  } = useEchecsSurveillance(journal, onRetried, user?.id);

  const [fenetre, setFenetre] = useState<number>(1);
  const [recap, setRecap] = useState<RecapEchecsEnvoi | null>(null);
  const [pret, setPret] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historique, setHistorique] = useState<ReessaiHistorique[]>([]);

  const charger = useCallback(async (jours: number, silencieux = false) => {
    if (!silencieux) setEnCours(true);
    try {
      const res = await chargerEchecsEnvoiRecap(jours, user?.id ?? null);
      setRecap(res);
    } catch {
      // Une lecture ratée ne doit pas alarmer à tort.
      setRecap(null);
    } finally {
      setPret(true);
      setEnCours(false);
    }
  }, [user?.id]);

  const chargerHisto = useCallback(async () => {
    if (!user?.id) {
      setHistorique([]);
      return;
    }
    setHistorique(await chargerHistoriqueReessais(user.id));
  }, [user?.id]);

  useEffect(() => {
    void charger(fenetre, true);
  }, [charger, fenetre]);

  useEffect(() => {
    void chargerHisto();
  }, [chargerHisto]);

  const total = recap?.total ?? 0;
  const testsEchoues = recap?.testsEchoues ?? 0;
  const relancesEchouees = recap?.relancesEchouees ?? 0;
  const passagesEscalade = recap?.passagesEscalade ?? 0;
  const idsEscalade = recap?.idsEscalade ?? [];
  const peutReessayer = idsEscalade.length > 0 || testsEchoues > 0;

  const labelFenetre = FENETRES.find((f) => f.value === fenetre)?.label ?? "24 h";

  const quand = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const handleRetry = async () => {
    if (!user || retrying) return;
    setRetrying(true);
    setError(null);
    setNotice(null);
    const succes: string[] = [];
    const echecs: string[] = [];
    let relancees = 0;
    let encoreEchoue = 0;
    let testRelance = false;
    try {
      // 1) Relance réelle des envois d'escalade ratés (email/SMS/WhatsApp clients).
      if (idsEscalade.length > 0) {
        try {
          const res = await retryEscaladeFailures(user.id, idsEscalade);
          relancees = res.envoye;
          encoreEchoue = res.echoue;
          if (res.envoye > 0) {
            succes.push(`${res.envoye} envoi${res.envoye > 1 ? "s" : ""} relancé${res.envoye > 1 ? "s" : ""}`);
          }
          if (res.echoue > 0) {
            echecs.push(`${res.echoue} encore en échec`);
          }
        } catch {
          echecs.push("la relance des envois clients a échoué");
        }
      }
      // 2) Si des tests email avaient raté, on rejoue un test pour valider la config.
      if (testsEchoues > 0 && user.email) {
        try {
          await envoyerEmailTest(user.email);
          testRelance = true;
          succes.push("nouveau test d'envoi envoyé");
        } catch {
          echecs.push("le test d'envoi n'a pas pu être expédié");
        }
      }
      onRetried();
      await charger(fenetre, true);
      // 3) On consigne le réessai dans le petit historique (date + résultat).
      const resume = [...succes, ...echecs].join(" · ");
      try {
        await enregistrerReessai(user.id, {
          fenetreJours: fenetre,
          relancesRelancees: relancees,
          relancesEchouees: encoreEchoue,
          testRelance,
          resume,
        });
        await chargerHisto();
      } catch {
        /* le journal des réessais est best effort */
      }
      // 4) Si le réessai reste en échec, on prévient l'artisan par email dès que plusieurs
      //    tentatives consécutives n'ont rien donné (décision et envoi côté Backend).
      if (encoreEchoue > 0) {
        try {
          const alerte = await envoyerAlerteReessaiEchec({ seuil: seuilAlerte });
          if (alerte.sent) {
            succes.push("email d'alerte envoyé");
          }
        } catch {
          /* l'alerte email est best effort : elle ne bloque pas le réessai */
        }
      }
      setNotice(succes.length > 0 ? `${succes.join(" · ")}.` : null);
      setError(
        echecs.length > 0
          ? `${echecs.join(" · ")}. Vérifiez la configuration du service d'envoi (Brevo).`
          : null,
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200 animate-fade-in">
      {/* En-tête : pilotage de la surveillance */}
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-lg">
          <i className="ri-radar-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-950">Surveillance des échecs d'envoi</p>
          <p className="text-xs text-foreground-600 mt-0.5">
            {total > 0
              ? `${total} échec${total > 1 ? "s" : ""} d'envoi détecté${total > 1 ? "s" : ""} sur les ${labelFenetre} (tests email + relances d'escalade).`
              : "Aucun échec d'envoi détecté. La surveillance veille en arrière-plan."}
          </p>
          <div className="mt-2.5">
            <SurveillanceEchecsReglage
              freq={surveillanceFreq}
              bandeau={alerteBandeau}
              notifNav={notifNav}
              notifPermission={notifPermission}
              seuilAlerte={seuilAlerte}
              onChangeFreq={changeSurveillance}
              onToggleBandeau={toggleAlerteBandeau}
              onToggleNotif={toggleNotifNav}
              onChangeSeuilAlerte={changeSeuilAlerte}
            />
          </div>
        </div>
      </div>

      {/* Bandeau d'alerte in-app dès qu'un nouvel échec est détecté */}
      {echecAlerte && (
        <div className="mt-3">
          <EchecAlerteBanner
            echecs={echecAlerte.echecs}
            passages={echecAlerte.passages}
            onRetry={handleRetry}
            onDismiss={dismissAlerte}
            retrying={retrying}
            showRetry={peutReessayer}
          />
        </div>
      )}

      {/* Zone échecs : filtre de période, réessai et détail */}
      <div className="mt-4 pt-4 border-t border-background-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground-950">Échecs d'envoi</p>
            <div className="flex gap-0.5 p-1 rounded-full bg-background-50 border border-background-200">
              {FENETRES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFenetre(f.value)}
                  title={`Afficher les échecs des ${f.label === "24 h" ? "dernières 24 heures" : f.label === "7 j" ? "7 derniers jours" : "30 derniers jours"}`}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    fenetre === f.value
                      ? "bg-red-500 text-white"
                      : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {total > 0 && (
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {total} sur {labelFenetre}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {peutReessayer && (
              <button
                type="button"
                onClick={() => { void handleRetry(); }}
                disabled={retrying}
                title="Relancer en un clic les envois ratés sur la période affichée, sans passer par la page Relances"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-red-500 text-white text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {retrying ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-refresh-line"></i>}
                Réessayer
              </button>
            )}
            <button
              type="button"
              onClick={() => { void charger(fenetre); }}
              disabled={enCours || retrying}
              title="Recalculer les échecs de la période affichée"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60"
            >
              <i className={enCours ? "ri-loader-4-line animate-spin" : "ri-restart-line"}></i>
              Actualiser
            </button>
            <Link
              to="/app/relances"
              title="Ouvrir le journal des envois pour réessayer"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-arrow-right-line"></i>
              Voir le journal
            </Link>
          </div>
        </div>

        {/* Petit historique des réessais : date + résultat, sous le bouton Réessayer */}
        {historique.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Derniers réessais
              </p>
              <button
                type="button"
                onClick={() => exporterHistoriqueReessais(historique)}
                title="Exporter le journal des réessais (date, fenêtre, résultat) au format CSV"
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-download-2-line"></i>
                Exporter CSV
              </button>
            </div>
            <ul className="mt-1.5 flex flex-col gap-1">
              {historique.map((h) => {
                const rate = h.relancesEchouees > 0;
                return (
                  <li key={h.id} className="flex items-center gap-2 text-[11px]">
                    <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${rate ? "bg-red-500" : "bg-accent-500"}`}></span>
                    <span className="text-foreground-500 whitespace-nowrap">{quand(h.quand)}</span>
                    <span className="inline-flex items-center gap-1 shrink-0 text-foreground-400">
                      <i className="ri-filter-3-line"></i>
                      {h.fenetreJours === 1 ? "24 h" : `${h.fenetreJours} j`}
                    </span>
                    <span className="text-foreground-600 truncate">
                      {h.resume || (h.relancesRelancees > 0 ? `${h.relancesRelancees} envoi(s) relancé(s)` : "Réessai effectué")}
                    </span>
                    {h.testRelance && (
                      <span className="inline-flex items-center gap-1 shrink-0 text-foreground-400">
                        <i className="ri-mail-send-line"></i>
                        test
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {notice && (
          <p className="mt-3 text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-3 text-xs text-red-700 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        )}

        {/* Contenu : rien tant que la lecture n'est pas finie */}
        {!pret ? (
          <p className="mt-3 text-xs text-foreground-500 flex items-center gap-1.5">
            <i className="ri-loader-4-line animate-spin"></i>
            Lecture des échecs en cours…
          </p>
        ) : total === 0 ? (
          <p className="mt-3 text-xs text-foreground-600 flex items-center gap-1.5">
            <i className="ri-shield-check-line text-accent-600"></i>
            Aucun échec d'envoi sur les {labelFenetre}. Tout est en ordre.
          </p>
        ) : (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-700">
              Sur les {labelFenetre} :{" "}
              {testsEchoues > 0 && (
                <>
                  {testsEchoues} test{testsEchoues > 1 ? "s" : ""} email
                </>
              )}
              {testsEchoues > 0 && relancesEchouees > 0 && " · "}
              {relancesEchouees > 0 && (
                <>
                  {relancesEchouees} relance{relancesEchouees > 1 ? "s" : ""} d'escalade
                </>
              )}{" "}
              refusé{testsEchoues + relancesEchouees > 1 ? "s" : ""}
              {passagesEscalade > 0 && (
                <> sur {passagesEscalade} passage{passagesEscalade > 1 ? "s" : ""} d'escalade</>
              )}
              . Vérifiez la configuration du service d'envoi (Brevo).
            </p>

            {(recap?.parCanal.length ?? 0) > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {recap?.parCanal.map((c) => (
                  <span
                    key={c.canal}
                    className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background-50 border border-red-200 text-[11px] font-semibold text-red-700 whitespace-nowrap"
                  >
                    <i className="ri-route-line"></i>
                    {c.canal} · {c.count}
                  </span>
                ))}
              </div>
            )}

            {(recap?.derniers.length ?? 0) > 0 && (
              <ul className="mt-2.5 divide-y divide-red-200/70 rounded-md bg-background-50 border border-red-200 overflow-hidden">
                {recap?.derniers.map((e, i) => (
                  <li key={`${e.quand}-${e.destinataire}-${i}`} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-600 text-sm">
                      <i className={e.canal.toLowerCase().includes("email") ? "ri-mail-line" : "ri-chat-1-line"}></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground-900">
                        <span className="font-semibold">{e.canal}</span> · <span className="break-all">{e.destinataire}</span>
                        <span className="text-foreground-400"> · {e.source === "test" ? "test" : "escalade"}</span>
                      </p>
                      {e.message && <p className="text-[11px] text-red-700 mt-0.5 break-words">{e.message}</p>}
                    </div>
                    <span className="text-[11px] text-foreground-500 whitespace-nowrap shrink-0">{quand(e.quand)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Export CSV mensuel par email : journal des réessais + journal d'escalade */}
      <div className="mt-4 pt-4 border-t border-background-200">
        <ExportCsvMensuelReglage />
      </div>
    </div>
  );
}