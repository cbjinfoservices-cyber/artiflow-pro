import { useMemo, useState } from "react";
import type { EscaladeJournalItem } from "@/hooks/useArtisanData";
import { canalIcon } from "@/lib/statuts";
import { formatRunTime, exporterJournalEscalade } from "@/lib/relances";
import { fetchEscaladeJournalAll } from "@/lib/artisanApi";
import JournalDayChart from "@/pages/app/relances/components/JournalDayChart";
import JournalPassagesSpark from "@/pages/app/relances/components/JournalPassagesSpark";

interface Props {
  journal: EscaladeJournalItem[];
  /** Id du passage dont le réessai est en cours. */
  retryingJournalId: number | null;
  onRetryFailures: (run: EscaladeJournalItem) => void;
}

/**
 * Journal de l'escalade serveur : passages de la tâche planifiée, activité par jour,
 * filtres et réessai ciblé d'un passage en échec. Le pilotage global des échecs et le
 * réglage de la surveillance sont regroupés dans le bloc unifié « Surveillance des échecs
 * d'envoi » (partagé avec le tableau de bord).
 */
export default function JournalEscalade({ journal, retryingJournalId, onRetryFailures }: Props) {
  const [openJournalId, setOpenJournalId] = useState<number | null>(null);
  const [journalDay, setJournalDay] = useState<string>("Tous");
  const [journalEchoueOnly, setJournalEchoueOnly] = useState(false);
  // Plage de dates personnalisée pour l'export CSV (vide = tout l'historique).
  const [exportFrom, setExportFrom] = useState<string>("");
  const [exportTo, setExportTo] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Exporte le journal complet en CSV, filtré sur la plage de dates choisie (ou tout si vide).
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const all = await fetchEscaladeJournalAll();
      const { exported } = exporterJournalEscalade(all, {
        from: exportFrom || null,
        to: exportTo || null,
      });
      if (exported === 0) setExportError("Aucun passage sur cette plage de dates.");
    } catch {
      setExportError("L'export a échoué. Réessayez.");
    } finally {
      setExporting(false);
    }
  };

  // Regroupe les passages du journal par jour pour comparer l'activité serveur d'une journée.
  const journalDays = useMemo(() => {
    const map = new Map<string, { day: string; label: string; passages: number; envois: number; echoue: number }>();
    journal.forEach((run) => {
      const key = run.run_at ? run.run_at.slice(0, 10) : "";
      if (!key) return;
      const d = new Date(`${key}T00:00:00`);
      const label = Number.isNaN(d.getTime())
        ? key
        : d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
      const entry = map.get(key) ?? { day: key, label, passages: 0, envois: 0, echoue: 0 };
      entry.passages += 1;
      entry.envois += run.envoye;
      entry.echoue += run.echoue;
      map.set(key, entry);
    });
    return Array.from(map.values());
  }, [journal]);

  // Passages limités au jour sélectionné (ou tous) et, si le filtre est actif, réduits aux échecs.
  const journalFiltered = useMemo(() => {
    const base = journalDay === "Tous" ? journal : journal.filter((run) => run.run_at.slice(0, 10) === journalDay);
    return journalEchoueOnly ? base.filter((run) => run.echoue > 0) : base;
  }, [journal, journalDay, journalEchoueOnly]);

  // Récap agrégé du jour sélectionné (pour comparer l'activité d'une journée).
  const journalDayRecap = useMemo(() => {
    if (journalDay === "Tous") return null;
    return journalDays.find((d) => d.day === journalDay) ?? null;
  }, [journalDay, journalDays]);

  // Pastilles de jour : réduites aux journées en échec quand le filtre est actif.
  const journalDayOptions = useMemo(
    () => (journalEchoueOnly ? journalDays.filter((d) => d.echoue > 0) : journalDays),
    [journalDays, journalEchoueOnly],
  );

  // Nombre de passages comportant au moins un échec d'envoi.
  const nbPassagesEchec = useMemo(() => journal.filter((r) => r.echoue > 0).length, [journal]);

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-lg">
            <i className="ri-server-line"></i>
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-950">Journal des renvois automatiques</p>
            <p className="text-xs text-foreground-600">
              Chaque passage automatique est enregistré ici : heure et nombre d'envois.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-history-line"></i>
            {journal.length} passage{journal.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Export CSV avec plage de dates personnalisée (vide = tout l'historique) */}
      {journal.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-download-2-line"></i>
            Export CSV :
          </span>
          <label className="inline-flex items-center gap-1 text-[11px] text-foreground-600">
            du
            <input
              type="date"
              value={exportFrom}
              max={exportTo || undefined}
              onChange={(e) => setExportFrom(e.target.value)}
              title="Date de début de la plage à exporter"
              className="h-7 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] text-foreground-700 cursor-pointer"
            />
          </label>
          <label className="inline-flex items-center gap-1 text-[11px] text-foreground-600">
            au
            <input
              type="date"
              value={exportTo}
              min={exportFrom || undefined}
              onChange={(e) => setExportTo(e.target.value)}
              title="Date de fin de la plage à exporter"
              className="h-7 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] text-foreground-700 cursor-pointer"
            />
          </label>
          {(exportFrom || exportTo) && (
            <button
              type="button"
              onClick={() => {
                setExportFrom("");
                setExportTo("");
                setExportError(null);
              }}
              title="Revenir à l'export de tout l'historique"
              className="text-[11px] text-foreground-500 hover:text-foreground-800 cursor-pointer whitespace-nowrap"
            >
              Tout
            </button>
          )}
          <button
            type="button"
            onClick={() => { void handleExport(); }}
            disabled={exporting}
            title="Exporter le journal des passages, filtré sur la plage choisie (vide = tout l'historique)"
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60"
          >
            <i className={exporting ? "ri-loader-4-line animate-spin" : "ri-download-2-line"}></i>
            Exporter
          </button>
          {exportError && (
            <span className="inline-flex items-center gap-1 text-[11px] text-red-600">
              <i className="ri-error-warning-line"></i>
              {exportError}
            </span>
          )}
        </div>
      )}

      {/* Récap visuel des passages des 30 derniers jours, au-dessus du journal */}
      {journal.length > 0 && <JournalPassagesSpark journal={journal} />}

      {journalDays.length > 1 && (
        <JournalDayChart days={journalDays} selectedDay={journalDay} onSelect={setJournalDay} />
      )}

      {journalDays.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-calendar-line"></i>
            Jour :
          </span>
          <button
            type="button"
            onClick={() => setJournalDay("Tous")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              journalDay === "Tous"
                ? "bg-secondary-500 text-background-50"
                : "bg-background-100 text-foreground-600 border border-background-200 hover:bg-background-200"
            }`}
          >
            Tous
          </button>
          {journalDayOptions.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => setJournalDay(d.day)}
              title={`${d.passages} passage(s) · ${d.envois} envoi(s)${d.echoue > 0 ? ` · ${d.echoue} échec(s)` : ""}`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                journalDay === d.day
                  ? "bg-secondary-500 text-background-50"
                  : "bg-background-100 text-foreground-600 border border-background-200 hover:bg-background-200"
              }`}
            >
              {d.label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  journalDay === d.day ? "bg-background-50/25" : "bg-background-200 text-foreground-600"
                }`}
              >
                {d.envois}
              </span>
              {d.echoue > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    journalDay === d.day ? "bg-background-50/25 text-background-50" : "bg-red-100 text-red-700"
                  }`}
                >
                  {d.echoue} échec{d.echoue > 1 ? "s" : ""}
                </span>
              )}
            </button>
          ))}
          {journalDayRecap && (
            <span className="text-[11px] text-foreground-500 ml-1 inline-flex items-center gap-1.5">
              <i className="ri-bar-chart-2-line"></i>
              {journalDayRecap.passages} passage{journalDayRecap.passages > 1 ? "s" : ""} · {journalDayRecap.envois} envoi
              {journalDayRecap.envois > 1 ? "s" : ""} ce jour-là
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !journalEchoueOnly;
              setJournalEchoueOnly(next);
              if (next) setJournalDay("Tous");
            }}
            disabled={nbPassagesEchec === 0}
            title="N'afficher que les passages où au moins un envoi a échoué"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              journalEchoueOnly ? "bg-red-500 text-white" : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
            }`}
          >
            <i className="ri-error-warning-line"></i>
            En échec uniquement{nbPassagesEchec > 0 ? ` · ${nbPassagesEchec}` : ""}
            {journalEchoueOnly && <i className="ri-close-line"></i>}
          </button>
        </div>
      )}

      {journalFiltered.length === 0 ? (
        <p className="mt-3 px-3 py-4 text-center text-[11px] text-foreground-500 rounded-md bg-background-50 border border-background-200">
          {journalEchoueOnly ? "Aucun passage en échec sur cette sélection." : "Aucun passage automatique sur ce jour."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          {journalFiltered.slice(0, 8).map((run) => {
            const open = openJournalId === run.id;
            const hasDetail = run.clients.length > 0 || run.clientsEchoues.length > 0;
            return (
              <li key={run.id} className="p-3 rounded-md bg-background-50 border border-background-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-background-100 text-foreground-600 text-sm">
                      <i className="ri-time-line"></i>
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground-950">
                        Passage du {formatRunTime(run.run_at)}
                      </p>
                      <p className="text-[11px] text-foreground-500">
                        {run.envoye > 0
                          ? `${run.envoye} relance${run.envoye > 1 ? "s" : ""} envoyée${run.envoye > 1 ? "s" : ""}`
                          : "Aucun envoi nécessaire"}
                        {run.echoue > 0 ? ` · ${run.echoue} échec${run.echoue > 1 ? "s" : ""}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                        run.envoye > 0 ? "bg-accent-100 text-accent-700" : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      {run.envoye} envoi{run.envoye > 1 ? "s" : ""}
                    </span>
                    {hasDetail && (
                      <button
                        type="button"
                        onClick={() => setOpenJournalId(open ? null : run.id)}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                          run.echoue > 0 ? "text-red-600 hover:text-red-700" : "text-foreground-500 hover:text-primary-700"
                        }`}
                      >
                        <i className={open ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                        Client
                      </button>
                    )}
                  </div>
                </div>
                {open && hasDetail && (
                  <div className="mt-2 pl-11 flex flex-col gap-2.5">
                    {run.clientsEchoues.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-1 inline-flex items-center gap-1">
                          <i className="ri-error-warning-line"></i>
                          Non envoyés ({run.clientsEchoues.length})
                        </p>
                        <ul className="flex flex-col gap-1">
                          {run.clientsEchoues.map((c, idx) => (
                            <li key={`${run.id}-fail-${idx}`} className="text-[11px] flex items-start gap-2 text-red-700">
                              <i className={`${canalIcon(c.canal)} mt-0.5`}></i>
                              <span className="min-w-0">
                                <span className="font-medium">{c.nom}</span>
                                {c.numero && <span className="text-foreground-400"> · {c.numero}</span>}
                                {c.jours > 0 && <span className="text-foreground-400"> · {c.jours} j de retard</span>}
                                <span className="block text-[10px] text-red-500">{c.erreur}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                        {run.relancesEchouees.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onRetryFailures(run)}
                            disabled={retryingJournalId === run.id}
                            className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-500 text-white text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-60"
                            title="Relancer uniquement les clients non envoyés de ce passage"
                          >
                            {retryingJournalId === run.id ? (
                              <i className="ri-loader-4-line animate-spin"></i>
                            ) : (
                              <i className="ri-refresh-line"></i>
                            )}
                            Réessayer les échecs ({run.relancesEchouees.length})
                          </button>
                        )}
                      </div>
                    )}
                    {run.clients.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500 mb-1 inline-flex items-center gap-1">
                          <i className="ri-checkbox-circle-line"></i>
                          Envoyés ({run.clients.length})
                        </p>
                        <ul className="flex flex-col gap-1">
                          {run.clients.map((c, idx) => (
                            <li
                              key={`${run.id}-ok-${idx}`}
                              className="text-[11px] text-foreground-600 flex items-center gap-2"
                            >
                              <i className={canalIcon(c.canal)}></i>
                              <span className="font-medium text-foreground-800">{c.nom}</span>
                              {c.numero && <span className="text-foreground-400">{c.numero}</span>}
                              {c.jours > 0 && <span className="text-foreground-400">· {c.jours} j de retard</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}