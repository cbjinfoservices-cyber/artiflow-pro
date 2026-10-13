import { useMemo, useState } from "react";
import type { RelanceItem } from "@/hooks/useArtisanData";
import {
  fetchEscaladeJournalAll,
  type ReprogrammationFullItem,
} from "@/lib/artisanApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatShortDate, todayISO } from "@/lib/dates";
import { canalIcon, RELANCE_CANAUX } from "@/lib/statuts";
import { formatRunTime, joursDeRetard } from "@/lib/relances";
import Infobulle from "@/components/base/Infobulle";

interface Props {
  /** Toutes les relances de l'artisan (sert à nommer chaque reprogrammation et à exporter les retards). */
  relances: RelanceItem[];
  /** Historique agrégé des reprogrammations (chargé par le hook partagé, pour le badge de l'onglet). */
  rows: ReprogrammationFullItem[];
  loading: boolean;
  error: string | null;
  /** Filtres pilotés par l'URL : la vue reste identique après un rafraîchissement ou un partage de lien. */
  periode: number;
  canal: string;
  recherche: string;
  onPeriodeChange: (value: number) => void;
  onCanalChange: (value: string) => void;
  onRechercheChange: (value: string) => void;
}

// Filtres de période des reprogrammations affichées (en jours).
const PERIODES = [
  { value: 0, label: "Tout" },
  { value: 30, label: "30 j" },
  { value: 7, label: "7 j" },
] as const;

/**
 * Onglet « Historique » de la page Relances : regroupe l'historique des reprogrammations
 * (toutes relances confondues, filtrable par période, par client/devis et par canal) et
 * tous les exports CSV au même endroit, pour désencombrer la vue principale.
 * Les filtres sont contrôlés par le parent et reflétés dans l'URL (vue partageable).
 */
export default function HistoriqueTab({
  relances,
  rows,
  loading,
  error,
  periode,
  canal,
  recherche,
  onPeriodeChange,
  onCanalChange,
  onRechercheChange,
}: Props) {
  const [exportingJournal, setExportingJournal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const relanceById = useMemo(() => {
    const map = new Map<number, RelanceItem>();
    relances.forEach((r) => map.set(r.id, r));
    return map;
  }, [relances]);

  // Compteur par canal (sur l'ensemble des reprogrammations, indépendant du filtre courant).
  const parCanal = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((h) => {
      const c = relanceById.get(h.relance_id)?.canal ?? "Email";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    return counts;
  }, [rows, relanceById]);

  // Reprogrammations filtrées par période, par recherche (client ou devis) et par canal.
  const filtered = useMemo(() => {
    const cutoff = periode > 0 ? Date.now() - periode * 86400000 : 0;
    const q = recherche.trim().toLowerCase();
    return rows.filter((h) => {
      const t = Date.parse(h.created_at);
      if (periode > 0 && (Number.isNaN(t) || t < cutoff)) return false;
      const r = relanceById.get(h.relance_id);
      if (canal !== "Tous" && (r?.canal ?? "Email") !== canal) return false;
      if (!q) return true;
      const hay = `${r?.clientNom ?? ""} ${r?.devisNumero ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, periode, recherche, canal, relanceById]);

  // Toutes les relances en retard (date prévue dépassée, envoi non effectué).
  const retards = useMemo(() => {
    const today = todayISO();
    return [...relances]
      .filter((r) => r.statut !== "Envoyée" && r.date_prevue !== null && r.date_prevue.slice(0, 10) < today)
      .sort((a, b) => (a.date_prevue ?? "").localeCompare(b.date_prevue ?? ""));
  }, [relances]);

  // Exporte les reprogrammations affichées au format CSV.
  const exportReproCsv = () => {
    if (!filtered.length) return;
    const data = filtered.map((h) => {
      const r = relanceById.get(h.relance_id);
      return [
        r?.clientNom ?? "",
        r?.devisNumero ?? "",
        r?.canal ?? "",
        h.ancienne_date ? formatShortDate(h.ancienne_date) : "Sans date",
        h.nouvelle_date ? formatShortDate(h.nouvelle_date) : "Sans date",
        formatShortDate(h.created_at),
      ];
    });
    const csv = toCsv(["Client", "Devis", "Canal", "Ancienne date", "Nouvelle date", "Repoussée le"], data);
    downloadCsv(`historique-reprogrammations-${todayISO()}.csv`, csv);
  };

  // Exporte toutes les relances en retard (avec leur ancienneté) au format CSV.
  const exportRetardsCsv = () => {
    if (!retards.length) return;
    const data = retards.map((r) => [
      r.clientNom ?? "",
      r.devisNumero ?? "",
      r.canal,
      r.date_prevue ? formatShortDate(r.date_prevue) : "Sans date",
      joursDeRetard(r.date_prevue),
      r.reprogrammations,
      (r.message ?? "").replace(/\s+/g, " ").trim(),
    ]);
    const csv = toCsv(
      ["Client", "Devis", "Canal", "Date prévue", "Jours de retard", "Reprogrammations", "Message"],
      data,
    );
    downloadCsv(`relances-en-retard-${todayISO()}.csv`, csv);
  };

  // Exporte l'intégralité du journal de l'escalade serveur (tous les passages) au format CSV.
  const exportJournalCsv = async () => {
    setExportingJournal(true);
    setNotice(null);
    setExportError(null);
    try {
      const all = await fetchEscaladeJournalAll();
      if (!all.length) {
        setExportError("Aucun passage automatique à exporter pour l'instant.");
        return;
      }
      const data = all.map((run) => [
        formatRunTime(run.run_at),
        run.examined,
        run.envoye,
        run.echoue,
        run.clients.map((c) => `${c.nom} (${c.canal}${c.jours > 0 ? `, ${c.jours}j` : ""})`).join(" | "),
        run.clientsEchoues
          .map((c) => `${c.nom} (${c.canal}${c.numero ? ` ${c.numero}` : ""} — ${c.erreur})`)
          .join(" | "),
      ]);
      const csv = toCsv(
        ["Passage", "Retards examinés", "Envoyés", "Échecs", "Clients relancés", "Clients en échec"],
        data,
      );
      downloadCsv(`journal-escalade-complet-${todayISO()}.csv`, csv);
      setNotice(`${all.length} passage(s) exporté(s) — journal complet des renvois automatiques.`);
    } catch {
      setExportError("L'export du journal a échoué.");
    } finally {
      setExportingJournal(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {notice}
        </p>
      )}
      {exportError && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {exportError}
        </p>
      )}

      <div className="p-4 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-lg">
              <i className="ri-history-line"></i>
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground-950">Historique des reports</p>
              <p className="text-xs text-foreground-600">
                Chaque report de relance, toutes relances confondues, avec l'ancienne et la nouvelle date.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportReproCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60"
          >
            <i className="ri-download-2-line"></i>
            Exporter en CSV
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Infobulle
            contenu="Limiter l'historique des reports aux N derniers jours : « Tout » affiche tous les reports, sans limite de date."
            position="bas"
            largeur={280}
          >
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
              <i className="ri-information-line text-sm"></i>
            </span>
          </Infobulle>
          <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
            {PERIODES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onPeriodeChange(p.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  periode === p.value
                    ? "bg-primary-500 text-background-50"
                    : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
              <i className="ri-filter-3-line"></i>
              Canal :
            </span>
            <Infobulle
              contenu="Ne montrer que les reports liés à un canal d'envoi donné : Email, SMS ou WhatsApp. « Tous » les affiche tous."
              position="bas"
              largeur={280}
            >
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
                <i className="ri-information-line text-sm"></i>
              </span>
            </Infobulle>
            {RELANCE_CANAUX.map((c) => {
              const count = c === "Tous" ? rows.length : parCanal.get(c) ?? 0;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCanalChange(c)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    canal === c
                      ? "bg-secondary-500 text-background-50"
                      : "bg-background-100 text-foreground-600 hover:bg-background-200 border border-background-200"
                  }`}
                >
                  {c !== "Tous" && <i className={canalIcon(c)}></i>}
                  {c}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      canal === c ? "bg-background-50/25" : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
            <input
              type="text"
              value={recherche}
              onChange={(e) => onRechercheChange(e.target.value)}
              placeholder="Client ou devis…"
              className="h-8 pl-8 pr-3 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap">
            {filtered.length} report{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-foreground-500 flex items-center gap-2">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement de l'historique…
          </p>
        ) : error ? (
          <p className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 px-3 py-4 text-center text-[11px] text-foreground-500 rounded-md bg-background-50 border border-background-200">
            Aucun report ne correspond à ces filtres pour l'instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {filtered.slice(0, 60).map((h) => {
              const r = relanceById.get(h.relance_id);
              return (
                <li
                  key={h.id}
                  className="flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200"
                >
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm">
                    <i className="ri-calendar-line"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground-950">
                      {r?.clientNom ?? "Client"}
                      {r?.devisNumero && <span className="text-foreground-400 font-normal"> · {r.devisNumero}</span>}
                      {r?.canal && (
                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold">
                          <i className={canalIcon(r.canal)}></i>
                          {r.canal}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-foreground-600">
                      {h.ancienne_date ? formatShortDate(h.ancienne_date) : "Sans date"}
                      <i className="ri-arrow-right-line mx-1.5 text-foreground-400"></i>
                      <strong>{h.nouvelle_date ? formatShortDate(h.nouvelle_date) : "Sans date"}</strong>
                    </p>
                  </div>
                  <span className="text-[11px] text-foreground-400 whitespace-nowrap shrink-0">
                    Repoussée le {formatShortDate(h.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-4 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
            <i className="ri-download-2-line"></i>
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-950">Exports CSV</p>
            <p className="text-xs text-foreground-600">
              Téléchargez vos données pour les archiver ou les ouvrir dans un tableur.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            onClick={exportRetardsCsv}
            disabled={retards.length === 0}
            title="Télécharger la liste des relances en retard au format CSV"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-300 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60"
          >
            <i className="ri-alarm-warning-line"></i>
            Relances en retard
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background-200 text-foreground-600 font-semibold">
              {retards.length}
            </span>
          </button>
          <button
            type="button"
            onClick={exportJournalCsv}
            disabled={exportingJournal}
            title="Télécharger l'intégralité du journal des renvois automatiques au format CSV"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60"
          >
            {exportingJournal ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-archive-drawer-line"></i>}
            Journal des renvois complet
          </button>
          <button
            type="button"
            onClick={exportReproCsv}
            disabled={filtered.length === 0}
            title="Télécharger l'historique des reports au format CSV"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary-100 text-primary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-200 transition-colors disabled:opacity-60"
          >
            <i className="ri-history-line"></i>
            Historique des reports
          </button>
        </div>
      </div>
    </div>
  );
}