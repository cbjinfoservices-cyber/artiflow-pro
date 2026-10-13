import { useEffect, useMemo, useState } from "react";
import { runEscaladeNow } from "@/lib/artisanApi";
import Infobulle from "@/components/base/Infobulle";
import type { EscaladeJournalItem } from "@/hooks/useArtisanData";

const FREQUENCE_KEY = "artiflow.relances.escaladeFrequence";
// Fréquences proposées (en minutes) pour estimer le prochain passage de la tâche planifiée.
const FREQUENCE_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 h" },
  { value: 360, label: "6 h" },
  { value: 1440, label: "24 h" },
] as const;
const FREQUENCE_DEFAUT = 60;

/** Formate un horodatage en « sam. 07 oct. 15:00 ». */
function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formate une durée en millisecondes en texte court (« 42 min », « 1 h 5 min »). */
function formatDelay(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 1) return "moins d'une minute";
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

interface Props {
  journal: EscaladeJournalItem[];
  userId: string | null;
  onReload: () => Promise<void>;
}

/**
 * Bandeau « Escalade serveur 24/7 » : rappelle le dernier passage, estime le prochain
 * selon la fréquence de la tâche planifiée, et permet de déclencher un passage immédiat.
 */
export default function EscaladeServeurPanel({ journal, userId, onReload }: Props) {
  const [frequence, setFrequence] = useState<number>(FREQUENCE_DEFAUT);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const saved = Number(localStorage.getItem(FREQUENCE_KEY));
    if (FREQUENCE_OPTIONS.some((o) => o.value === saved)) setFrequence(saved);
  }, []);

  // Rafraîchit le compte à rebours du prochain passage.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const changeFrequence = (value: number) => {
    setFrequence(value);
    localStorage.setItem(FREQUENCE_KEY, String(value));
  };

  const lastRun = journal.length > 0 ? journal[0].run_at : null;

  const lastRunTs = useMemo(() => {
    const t = Date.parse(lastRun ?? "");
    return Number.isNaN(t) ? null : t;
  }, [lastRun]);

  // Prochain passage estimé = dernier passage + fréquence de la tâche planifiée.
  const nextRunTs = useMemo(
    () => (lastRunTs === null ? null : lastRunTs + frequence * 60000),
    [lastRunTs, frequence],
  );

  const sinceLast = lastRunTs === null ? null : now - lastRunTs;
  const isDue = nextRunTs !== null && nextRunTs <= now;

  const handleRun = async () => {
    if (!userId) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runEscaladeNow(userId);
      await onReload();
      setNow(Date.now());
      if (res.envoye > 0) {
        setResult(
          `${res.envoye} relance${res.envoye > 1 ? "s" : ""} renvoyée${res.envoye > 1 ? "s" : ""} vers vos clients (${
            res.examined
          } retard${res.examined > 1 ? "s" : ""} examiné${res.examined > 1 ? "s" : ""}).`,
        );
      } else if (res.examined > 0) {
        setResult(`${res.examined} retard${res.examined > 1 ? "s" : ""} examiné${res.examined > 1 ? "s" : ""}, aucun envoi déclenché pour l'instant.`);
      } else {
        setResult("Passage effectué : aucun dossier en retard à renvoyer.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le passage automatique a échoué.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-secondary-50 border border-secondary-200">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-lg">
            <i className="ri-timer-flash-line"></i>
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground-950">Relance automatique des retards</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold">
                <i className="ri-checkbox-blank-circle-fill text-[6px]"></i>
                Tâche planifiée
              </span>
            </div>
            <p className="text-xs text-foreground-600 mt-0.5">
              {lastRun ? (
                <>
                  Dernier passage il y a <strong>{sinceLast !== null ? formatDelay(sinceLast) : "—"}</strong>
                  {" · "}
                  prochain passage estimé{" "}
                  <strong>{nextRunTs !== null ? formatDateTime(nextRunTs) : "—"}</strong>
                  {isDue
                    ? " (attendu d'un instant à l'autre)"
                    : nextRunTs !== null
                      ? ` (dans ${formatDelay(nextRunTs - now)})`
                      : ""}
                </>
              ) : (
                "Aucun passage enregistré pour l'instant — le premier passage apparaîtra ici."
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-[11px] text-foreground-500">Fréquence de la tâche planifiée</span>
              <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
                {FREQUENCE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => changeFrequence(o.value)}
                    title={`Estimer le prochain passage toutes les ${o.label}`}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      frequence === o.value
                        ? "bg-secondary-500 text-background-50"
                        : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <Infobulle
          contenu="Lancer tout de suite un passage de relance automatique des retards, sans attendre la prochaine heure prévue."
          position="haut"
          largeur={280}
        >
          <button
            type="button"
            onClick={handleRun}
            disabled={running || !userId}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-60 shrink-0"
          >
            {running ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-play-circle-line"></i>}
            {running ? "Passage en cours…" : "Lancer maintenant"}
          </button>
        </Infobulle>
      </div>
      {result && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5 mt-3">
          <i className="ri-checkbox-circle-line"></i>
          {result}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5 mt-3">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      )}
    </div>
  );
}