import { useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import {
  dureeMinutes,
  etatPointage,
  formatDuree,
  formatHeurePointage,
  type Pointage,
} from "@/lib/pointage";
import { formatDateLongue } from "@/lib/dates";

/**
 * Fenêtre de pointage d'une intervention : arrivée, départ, pause déjeuner et durée
 * travaillée en direct. Le même écran sert à l'intervenant (depuis son planning) et au
 * responsable (depuis le planning d'équipe).
 */
export default function PointageModal({
  creneau,
  pointage,
  intervenantNom,
  busy,
  error,
  onDemarrer,
  onTerminer,
  onRouvrir,
  onPause,
  onReinitialiser,
  onClose,
}: {
  creneau: { id: number; date: string; heure: string; libelle: string; ville: string | null };
  pointage: Pointage | null;
  intervenantNom: string;
  busy: boolean;
  error: string | null;
  onDemarrer: () => void;
  onTerminer: () => void;
  onRouvrir: () => void;
  onPause: (minutes: number) => void;
  onReinitialiser: () => void;
  onClose: () => void;
}) {
  const [pause, setPause] = useState(pointage?.pause_minutes ?? 0);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    setPause(pointage?.pause_minutes ?? 0);
  }, [pointage?.id, pointage?.pause_minutes]);

  // La durée d'une intervention en cours doit avancer toute seule.
  useEffect(() => {
    if (etatPointage(pointage) !== "en-cours") return;
    const timer = window.setInterval(() => setMaintenant(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [pointage]);

  const etat = etatPointage(pointage);
  const minutes = dureeMinutes(pointage, maintenant);

  const pauseChip = (valeur: number) => (
    <button
      key={valeur}
      type="button"
      onClick={() => {
        setPause(valeur);
        onPause(valeur);
      }}
      disabled={!pointage || busy}
      className={`inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        pause === valeur
          ? "bg-primary-500 text-background-50"
          : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
      }`}
    >
      {valeur === 0 ? "Aucune" : `${valeur} min`}
    </button>
  );

  const etatMeta =
    etat === "en-cours"
      ? { label: "En cours", tone: "bg-accent-100 text-accent-800", icon: "ri-timer-flash-line" }
      : etat === "termine"
        ? { label: "Terminé", tone: "bg-secondary-100 text-secondary-900", icon: "ri-checkbox-circle-line" }
        : { label: "Non pointé", tone: "bg-background-200 text-foreground-600", icon: "ri-time-line" };

  return (
    <Modal
      title="Pointage de l'intervention"
      subtitle={`${formatDateLongue(creneau.date)} · ${creneau.heure}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Fermer
          </button>
          {!pointage && (
            <button
              type="button"
              onClick={onDemarrer}
              disabled={busy}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 disabled:opacity-60"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-login-box-line"></i>}
              Pointer l'arrivée
            </button>
          )}
          {pointage && etat === "en-cours" && (
            <button
              type="button"
              onClick={onTerminer}
              disabled={busy}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 disabled:opacity-60"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-logout-box-line"></i>}
              Pointer le départ
            </button>
          )}
          {pointage && etat === "termine" && (
            <button
              type="button"
              onClick={onRouvrir}
              disabled={busy}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 disabled:opacity-60"
            >
              <i className="ri-arrow-go-back-line"></i>
              Rouvrir
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-background-100 border border-background-200 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950 truncate">{creneau.libelle}</p>
              <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                <i className="ri-user-line"></i> {intervenantNom}
                {creneau.ville && (
                  <>
                    <span className="mx-1">·</span>
                    <i className="ri-map-pin-line"></i> {creneau.ville}
                  </>
                )}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap ${etatMeta.tone}`}
            >
              <i className={etatMeta.icon}></i>
              {etatMeta.label}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-md bg-background-50 border border-background-200 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-foreground-400 font-semibold">Arrivée</p>
              <p className="text-sm font-bold text-foreground-900 tabular-nums">
                {formatHeurePointage(pointage?.arrivee_le)}
              </p>
            </div>
            <div className="rounded-md bg-background-50 border border-background-200 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-foreground-400 font-semibold">Départ</p>
              <p className="text-sm font-bold text-foreground-900 tabular-nums">
                {formatHeurePointage(pointage?.depart_le)}
              </p>
            </div>
            <div className="rounded-md bg-background-50 border border-background-200 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-foreground-400 font-semibold">
                {etat === "en-cours" ? "En cours" : "Travaillé"}
              </p>
              <p className="text-sm font-bold text-primary-700 tabular-nums">{formatDuree(minutes)}</p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground-700 inline-flex items-center gap-1">
              <i className="ri-rest-time-line"></i> Pause déduite
            </span>
            {[0, 15, 30, 45, 60].map(pauseChip)}
          </div>
          <p className="mt-1.5 text-[11px] text-foreground-500">
            La pause est retirée du temps de présence pour obtenir le temps réellement travaillé.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 inline-flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i> {error}
          </p>
        )}

        {pointage && (
          <button
            type="button"
            onClick={onReinitialiser}
            disabled={busy}
            className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-foreground-500 hover:bg-background-200 hover:text-red-600 cursor-pointer disabled:opacity-50"
          >
            <i className="ri-delete-bin-line"></i>
            Remettre le pointage à zéro
          </button>
        )}
      </div>
    </Modal>
  );
}