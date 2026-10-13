import { useMemo, useState } from "react";
import { useRelancesFactureEnvois } from "@/hooks/useRelancesFactureEnvois";
import { formatEuros } from "@/lib/format";
import { toCsv, downloadCsv } from "@/lib/csv";
import RelancesFactureChart from "@/pages/app/dashboard/components/RelancesFactureChart";

interface HistoriqueRelancesFacturesProps {
  /** Identifiant de l'artisan (RLS garantit qu'il ne voit que ses propres relances). */
  userId: string | null;
  /** Change de valeur pour forcer un rechargement (ex. après un envoi de relance). */
  reloadToken?: number;
}

/** Formate une ligne d'historique (« 07 oct. 2026 · 08:00 »). */
function formatHistorique(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${heure}`;
}

/** Date au format YYYY-MM-DD (pour comparer avec les inputs type="date"). */
function dateIsoCourte(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Nom de fichier d'export daté (« 2026-10-07 »). */
function dateFichier(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Archive comptable des relances de factures envoyées : liste (date, client, montant,
 * palier de retard), mini-graphe hebdomadaire et export CSV. On peut filtrer par client
 * ou par plage de dates avant l'export. Réutilisé par le tableau de bord et la page Profil.
 */
export default function HistoriqueRelancesFactures({ userId, reloadToken = 0 }: HistoriqueRelancesFacturesProps) {
  const { envois, loading, error, reload } = useRelancesFactureEnvois(userId, reloadToken);
  const [client, setClient] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const clients = useMemo(() => {
    const set = new Set<string>();
    envois.forEach((e) => {
      if (e.client_nom) set.add(e.client_nom);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [envois]);

  const filtres = useMemo(() => {
    return envois.filter((e) => {
      if (client && e.client_nom !== client) return false;
      const jour = dateIsoCourte(e.envoye_le);
      if (!jour) return !from && !to;
      if (from && jour < from) return false;
      if (to && jour > to) return false;
      return true;
    });
  }, [envois, client, from, to]);

  const total = useMemo(() => filtres.reduce((sum, e) => sum + Number(e.montant || 0), 0), [filtres]);
  const filtreActif = Boolean(client || from || to);
  const inputCls =
    "h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:border-primary-400 transition-colors";

  const handleExportCsv = () => {
    if (!filtres.length) return;
    const rows = filtres.map((h) => [
      formatHistorique(h.envoye_le),
      h.client_nom,
      h.numero || "—",
      Number(h.montant).toFixed(2).replace(".", ","),
      h.jours_retard,
      h.palier,
      h.auto ? "Auto (récap)" : "Manuel",
    ]);
    const csv = toCsv(
      ["Date d'envoi", "Client", "N° facture", "Montant (€)", "Retard (jours)", "Palier (jours)", "Type"],
      rows,
    );
    downloadCsv(`relances-factures_${dateFichier()}.csv`, csv);
  };

  const reinitialiser = () => {
    setClient("");
    setFrom("");
    setTo("");
  };

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-950 inline-flex items-center gap-2">
            <i className="ri-history-line text-accent-600"></i>
            Archive comptable des relances de factures
          </p>
          <p className="text-xs text-foreground-600 mt-0.5">
            Toutes les relances réellement envoyées, filtrables et exportables pour la comptabilité.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtres.length === 0}
            title="Exporter les relances affichées (selon les filtres) en CSV"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-file-excel-2-line"></i>
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            title="Rafraîchir l'historique"
            className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <i className={loading ? "ri-loader-4-line animate-spin text-sm" : "ri-refresh-line text-sm"}></i>
          </button>
        </div>
      </div>

      {/* Filtres : client + plage de dates */}
      <div className="flex flex-wrap items-end gap-2 mt-3 p-3 rounded-md bg-background-50 border border-background-200">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-foreground-500 uppercase tracking-wide">Client</span>
          <select value={client} onChange={(e) => setClient(e.target.value)} className={`${inputCls} cursor-pointer min-w-[150px]`}>
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-foreground-500 uppercase tracking-wide">Du</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-foreground-500 uppercase tracking-wide">Au</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
        {filtreActif && (
          <button
            type="button"
            onClick={reinitialiser}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium text-foreground-500 hover:bg-background-200 cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className="ri-close-line"></i>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Statistiques de la sélection */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
          <i className="ri-money-euro-circle-line"></i>
          {formatEuros(total)}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-100 text-foreground-700 text-[11px] font-semibold whitespace-nowrap">
          <i className="ri-send-plane-line"></i>
          {filtres.length} relance{filtres.length > 1 ? "s" : ""}
          {filtreActif ? " (filtrées)" : ""}
        </span>
      </div>

      {/* Mini-graphe hebdomadaire de la sélection */}
      {!loading && filtres.length > 0 && (
        <div className="mt-3">
          <RelancesFactureChart envois={filtres} />
        </div>
      )}

      {loading && envois.length === 0 ? (
        <p className="text-xs text-foreground-400 mt-4 inline-flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement de l'historique…
        </p>
      ) : error ? (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p className="text-xs text-red-600 inline-flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer transition-colors"
          >
            <i className="ri-refresh-line"></i> Réessayer
          </button>
        </div>
      ) : envois.length === 0 ? (
        <p className="text-xs text-foreground-400 mt-4">
          Aucune relance de facture envoyée pour l'instant. Dès qu'un rappel partira, il apparaîtra ici.
        </p>
      ) : filtres.length === 0 ? (
        <p className="text-xs text-foreground-400 mt-4">Aucune relance ne correspond à ces filtres.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 mt-3 max-h-96 overflow-y-auto pr-1">
          {filtres.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 rounded-md bg-background-50 border border-background-200"
            >
              <span className="text-xs font-medium text-foreground-800 inline-flex items-center gap-1.5 whitespace-nowrap">
                <i className="ri-calendar-check-line text-foreground-400"></i>
                {formatHistorique(h.envoye_le)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground-900 truncate">{h.client_nom}</span>
                <span className="block text-[11px] text-foreground-500">{h.numero || "—"}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5 ml-auto">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background-100 text-foreground-700 text-[10px] font-semibold whitespace-nowrap">
                  <i className="ri-money-euro-circle-line"></i>
                  {formatEuros(h.montant)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap">
                  <i className="ri-time-line"></i>
                  +{h.palier} j · {h.jours_retard} j réels
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                    h.auto ? "bg-primary-100 text-primary-800" : "bg-secondary-100 text-secondary-800"
                  }`}
                >
                  <i className={h.auto ? "ri-robot-2-line" : "ri-user-line"}></i>
                  {h.auto ? "Auto (récap)" : "Manuel"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}