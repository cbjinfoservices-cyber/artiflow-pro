import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useArtisanData } from "@/hooks/useArtisanData";
import { canalIcon } from "@/lib/statuts";
import { toCsv, downloadCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import RechercheRepliable from "@/components/feature/RechercheRepliable";

const CANAUX = ["Tous", "Email", "SMS", "WhatsApp"] as const;
const TYPES = ["Tous", "Devis", "Facture", "Relance"] as const;
const PERIODES = ["Tout", "Ce mois", "Ce trimestre", "Cette année", "Personnalisé"] as const;

/** Vrai si un envoi provient du jeu de données d'exemple (et non d'un envoi réel). */
function estExemple(mode: string | null): boolean {
  return (mode ?? "").toLowerCase() === "exemple";
}

function formatDayFr(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Nombre de jours entiers écoulés depuis la date prévue d'une relance (0 si non dépassée). */
function joursDeRetard(datePrevue: string | null): number {
  if (!datePrevue) return 0;
  const d = new Date(`${datePrevue.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function periodRange(periode: string): { start: Date; end: Date } | null {
  const now = new Date();
  if (periode === "Ce mois") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  if (periode === "Ce trimestre") {
    const q = Math.floor(now.getMonth() / 3);
    return { start: new Date(now.getFullYear(), q * 3, 1), end: new Date(now.getFullYear(), q * 3 + 3, 1) };
  }
  if (periode === "Cette année") {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }
  return null;
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: string): string {
  if (type === "relance") return "Relance";
  if (type === "devis") return "Devis";
  return "Facture";
}

type CanalKey = "Email" | "SMS" | "WhatsApp";

function canalKey(canal: string): CanalKey {
  if (canal === "SMS") return "SMS";
  if (canal === "WhatsApp") return "WhatsApp";
  return "Email";
}

function monthKeyOf(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth()}`;
}

const CANAL_DOT: Record<string, string> = {
  Email: "bg-primary-500",
  SMS: "bg-secondary-500",
  WhatsApp: "bg-accent-500",
};

const CANAL_TONE: Record<string, string> = {
  Email: "bg-primary-100 text-primary-700",
  SMS: "bg-secondary-100 text-secondary-700",
  WhatsApp: "bg-accent-100 text-accent-700",
};

export default function AppEnvois() {
  usePageMeta("Envois · ArtiFlow-pro", "Tous vos envois de devis, factures et relances au même endroit.");
  const { loading, error, envois, devis, factures, relances, reload } = useArtisanData();

  const [canal, setCanal] = useState<string>("Tous");
  const [type, setType] = useState<string>("Tous");
  const [periode, setPeriode] = useState<string>("Tout");
  const [mois, setMois] = useState<string | null>(null);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [query, setQuery] = useState("");
  const [groupeOnly, setGroupeOnly] = useState(false);
  const [masquerExemples, setMasquerExemples] = useState(false);

  const factureNumero = useMemo(() => {
    const map = new Map<number, string>();
    factures.forEach((f) => map.set(f.id, f.numero));
    return map;
  }, [factures]);

  const devisNumero = useMemo(() => {
    const map = new Map<number, string>();
    devis.forEach((d) => map.set(d.id, d.numero));
    return map;
  }, [devis]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const range = periodRange(periode);
    return envois.filter((e) => {
      const matchCanal = canal === "Tous" || e.canal === canal;
      const matchType = type === "Tous" || typeLabel(e.type) === type;
      const matchGroupe = !groupeOnly || (e.type === "relance" && e.groupe);
      const matchExemple = !masquerExemples || !estExemple(e.mode);
      let matchPeriode = true;
      if (mois) {
        matchPeriode = monthKeyOf(e.created_at) === mois;
      } else if (periode === "Personnalisé") {
        const d = new Date(e.created_at);
        const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
        const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
        matchPeriode =
          !Number.isNaN(d.getTime()) &&
          (start === null || d >= start) &&
          (end === null || d <= end);
      } else if (range) {
        const d = new Date(e.created_at);
        matchPeriode = !Number.isNaN(d.getTime()) && d >= range.start && d < range.end;
      }
      const reference =
        (e.facture_id !== null ? factureNumero.get(e.facture_id) : undefined) ??
        (e.devis_id !== null ? devisNumero.get(e.devis_id) : undefined) ??
        "";
      const matchQuery =
        !q ||
        (e.destinataire ?? "").toLowerCase().includes(q) ||
        (e.sujet ?? "").toLowerCase().includes(q) ||
        reference.toLowerCase().includes(q);
      return matchCanal && matchType && matchPeriode && matchQuery && matchGroupe && matchExemple;
    });
  }, [envois, canal, type, periode, mois, customStart, customEnd, query, factureNumero, devisNumero, groupeOnly, masquerExemples]);

  const stats = useMemo(() => {
    const count = (c: string) => envois.filter((e) => e.canal === c).length;
    return { total: envois.length, email: count("Email"), sms: count("SMS"), whatsapp: count("WhatsApp") };
  }, [envois]);

  // Dernier envoi RÉEL (hors jeu de données d'exemple), mis en avant en haut de la page.
  const dernierReel = useMemo(
    () => envois.find((e) => !estExemple(e.mode)) ?? null,
    [envois],
  );

  // Récap des relances en retard (non envoyées, date prévue dépassée).
  const retardRecap = useMemo(() => {
    const today = todayISO();
    const enRetard = relances.filter(
      (r) => r.statut !== "Envoyée" && r.date_prevue !== null && r.date_prevue.slice(0, 10) < today,
    );
    const critiques = enRetard.filter((r) => joursDeRetard(r.date_prevue) >= 30).length;
    const plusAncien = enRetard.reduce((max, r) => Math.max(max, joursDeRetard(r.date_prevue)), 0);
    return { total: enRetard.length, critiques, plusAncien };
  }, [relances]);

  // Historique des relances parties en lot (envoi groupé / escalade automatique).
  const groupeRelances = useMemo(
    () => envois.filter((e) => e.type === "relance" && e.groupe),
    [envois],
  );
  const groupeStats = useMemo(() => {
    const count = (c: string) => groupeRelances.filter((e) => e.canal === c).length;
    return {
      total: groupeRelances.length,
      email: count("Email"),
      sms: count("SMS"),
      whatsapp: count("WhatsApp"),
      last: groupeRelances[0]?.created_at ?? null,
    };
  }, [groupeRelances]);

  const handleExportGroupes = () => {
    if (!groupeRelances.length) return;
    const rows = groupeRelances.map((e) => {
      const reference = (e.devis_id !== null ? devisNumero.get(e.devis_id) : undefined) ?? "";
      return [formatDateTime(e.created_at), e.canal, e.destinataire ?? "", reference, e.sujet ?? ""];
    });
    const csv = toCsv(["Date", "Canal", "Destinataire", "Référence", "Objet"], rows);
    downloadCsv(`relances-groupees-artiflow-${todayISO()}.csv`, csv);
  };

  // Exporte la liste actuellement filtrée « Relances groupées » (filtres inclus).
  const handleExportGroupesFiltres = () => {
    const list = filtered.filter((e) => e.type === "relance" && e.groupe);
    if (!list.length) return;
    const rows = list.map((e) => {
      const reference = (e.devis_id !== null ? devisNumero.get(e.devis_id) : undefined) ?? "";
      return [formatDateTime(e.created_at), e.canal, e.destinataire ?? "", reference, e.sujet ?? ""];
    });
    const csv = toCsv(["Date", "Canal", "Destinataire", "Référence", "Objet"], rows);
    downloadCsv(`relances-groupees-filtrees-${todayISO()}.csv`, csv);
  };

  const hasActiveFilters =
    canal !== "Tous" ||
    type !== "Tous" ||
    periode !== "Tout" ||
    query.trim() !== "" ||
    mois !== null ||
    customStart !== "" ||
    customEnd !== "" ||
    groupeOnly ||
    masquerExemples;

  const resetFilters = () => {
    setCanal("Tous");
    setType("Tous");
    setPeriode("Tout");
    setMois(null);
    setCustomStart("");
    setCustomEnd("");
    setQuery("");
    setGroupeOnly(false);
    setMasquerExemples(false);
  };

  const filteredSummary = useMemo(() => {
    const count = (c: string) => filtered.filter((e) => e.canal === c).length;
    return { total: filtered.length, email: count("Email"), sms: count("SMS"), whatsapp: count("WhatsApp") };
  }, [filtered]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const list: {
      key: string;
      label: string;
      longLabel: string;
      total: number;
      Email: number;
      SMS: number;
      WhatsApp: number;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        longLabel: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        total: 0,
        Email: 0,
        SMS: 0,
        WhatsApp: 0,
      });
    }
    const byKey = new Map(list.map((b) => [b.key, b]));
    filtered.forEach((e) => {
      const d = new Date(e.created_at);
      if (Number.isNaN(d.getTime())) return;
      const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (!bucket) return;
      bucket[canalKey(e.canal)] += 1;
      bucket.total += 1;
    });
    return list.slice(1).map((b, idx) => {
      const prevTotal = list[idx].total;
      const dominant: CanalKey | null =
        b.total === 0 ? null : (["Email", "SMS", "WhatsApp"] as CanalKey[]).reduce((a, c) => (b[c] > b[a] ? c : a), "Email" as CanalKey);
      const delta = prevTotal === 0 ? null : Math.round(((b.total - prevTotal) / prevTotal) * 100);
      return { ...b, dominant, prevTotal, delta };
    });
  }, [filtered]);

  const periodeLabel = useMemo(() => {
    if (mois) {
      return monthlyStats.find((m) => m.key === mois)?.longLabel ?? "mois sélectionné";
    }
    if (periode === "Personnalisé") {
      if (customStart && customEnd) return `du ${formatDayFr(customStart)} au ${formatDayFr(customEnd)}`;
      if (customStart) return `à partir du ${formatDayFr(customStart)}`;
      if (customEnd) return `jusqu'au ${formatDayFr(customEnd)}`;
      return "plage personnalisée";
    }
    if (periode === "Tout") return "toutes périodes";
    return periode.toLowerCase();
  }, [mois, periode, customStart, customEnd, monthlyStats]);

  const handleExport = () => {
    const rows = filtered.map((e) => {
      const reference =
        (e.facture_id !== null ? factureNumero.get(e.facture_id) : undefined) ??
        (e.devis_id !== null ? devisNumero.get(e.devis_id) : undefined) ??
        "";
      return [
        formatDateTime(e.created_at),
        e.canal,
        typeLabel(e.type),
        reference,
        e.destinataire ?? "",
        e.sujet ?? "",
      ];
    });
    const csv = toCsv(["Date", "Canal", "Type", "Référence", "Destinataire", "Objet"], rows);

    const canalOrder = ["Email", "SMS", "WhatsApp"];
    const typeOrder = ["Devis", "Facture", "Relance"];
    const countBy = (predicate: (e: (typeof filtered)[number]) => boolean) => filtered.filter(predicate).length;
    const canalRows = canalOrder.map((c) => `${c};${countBy((e) => e.canal === c)}`);
    const typeRows = typeOrder.map((t) => `${t};${countBy((e) => typeLabel(e.type) === t)}`);
    const recap = [
      "",
      "Récapitulatif de la sélection",
      `Total des envois;${filtered.length}`,
      "",
      "Nombre par canal",
      ...canalRows,
      "",
      "Nombre par type",
      ...typeRows,
    ].join("\r\n");

    const suffixe = periode === "Tout" ? "" : `-${periode.toLowerCase().replace(/\s+/g, "-")}`;
    downloadCsv(`envois-artiflow-${todayISO()}${suffixe}.csv`, `${csv}\r\n\r\n${recap}`);
  };

  const handleExportComparatif = () => {
    const rows = monthlyStats.map((m) => [
      m.longLabel,
      m.total,
      m.Email,
      m.SMS,
      m.WhatsApp,
      m.prevTotal,
      m.delta === null ? "" : `${m.delta > 0 ? "+" : ""}${m.delta} %`,
    ]);
    const csv = toCsv(
      ["Mois", "Total envois", "Email", "SMS", "WhatsApp", "Mois précédent", "Variation"],
      rows,
    );
    downloadCsv(`comparatif-envois-artiflow-${todayISO()}.csv`, csv);
  };

  if (!loading && !error && envois.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="ri-send-plane-line"
          title="Aucun envoi pour l'instant"
          text="Dès que vous envoyez un devis, une facture ou une relance à un client, l'historique s'affiche ici — tous canaux confondus."
        >
          <SampleDataButton onSeeded={reload} />
        </EmptyState>
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-background-100 border border-background-200">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Total des envois</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg bg-primary-50 border border-primary-200">
            <p className="text-[11px] font-semibold text-primary-700 uppercase tracking-wide">Emails</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{stats.email}</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary-50 border border-secondary-200">
            <p className="text-[11px] font-semibold text-secondary-700 uppercase tracking-wide">SMS</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{stats.sms}</p>
          </div>
          <div className="p-4 rounded-lg bg-accent-50 border border-accent-200">
            <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide">WhatsApp</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{stats.whatsapp}</p>
          </div>
        </div>

        {dernierReel ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-accent-50 border border-accent-200">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
                <i className="ri-checkbox-circle-line"></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground-950">Dernier envoi réel</p>
                <p className="text-xs text-foreground-600 mt-0.5 truncate">
                  {typeLabel(dernierReel.type)} · {dernierReel.destinataire ?? "—"} · {formatDateTime(dernierReel.created_at)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap self-start sm:self-auto">
              <i className="ri-time-line"></i>
              Tracé dans l'historique
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary-50 border border-secondary-200">
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
              <i className="ri-flask-line"></i>
            </span>
            <p className="text-xs text-foreground-600 leading-relaxed">
              Aucun envoi réel pour l'instant : les lignes ci-dessous proviennent du jeu de données d'exemple
              (repérées par une pastille « Exemple »). Dès que vous envoyez un vrai devis, une facture ou une
              relance à un client, il apparaîtra en tête et sera marqué comme réel.
            </p>
          </div>
        )}

        {retardRecap.total > 0 && (
          <Link
            to="/app/relances"
            className="flex items-center gap-4 p-4 rounded-lg bg-primary-50 border border-primary-200 hover:border-primary-300 cursor-pointer transition-colors"
          >
            <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xl">
              <i className="ri-alarm-warning-line"></i>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap">
                  <i className="ri-notification-3-line"></i>
                  {retardRecap.total} relance{retardRecap.total > 1 ? "s" : ""} en retard
                </span>
                {retardRecap.critiques > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-fire-line"></i>
                    dont {retardRecap.critiques} depuis plus de 30 jours
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-600 mt-1.5">
                La plus ancienne attend depuis <strong>{retardRecap.plusAncien} jour{retardRecap.plusAncien > 1 ? "s" : ""}</strong>.
                Les relances escaladées automatiquement sont comptabilisées dans l'historique ci-dessous.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 text-primary-700 text-xs font-semibold whitespace-nowrap border border-primary-200">
              Voir les relances
              <i className="ri-arrow-right-line"></i>
            </span>
          </Link>
        )}

        {groupeStats.total > 0 && (
          <div className="p-4 rounded-lg bg-background-100 border border-background-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
                  <i className="ri-send-plane-2-line"></i>
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground-950">Historique des relances groupées</p>
                  <p className="text-xs text-foreground-600">
                    {groupeStats.total} relance{groupeStats.total > 1 ? "s" : ""} partie{groupeStats.total > 1 ? "s" : ""} en lot
                    {groupeStats.last ? ` · dernier envoi le ${formatDayFr(groupeStats.last)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-mail-line"></i>
                  {groupeStats.email}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-700 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-message-2-line"></i>
                  {groupeStats.sms}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-700 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-whatsapp-line"></i>
                  {groupeStats.whatsapp}
                </span>
                <button
                  type="button"
                  onClick={handleExportGroupes}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                  title="Exporter l'historique des relances groupées au format CSV"
                >
                  <i className="ri-download-2-line"></i>
                  <span className="hidden sm:inline">Exporter CSV</span>
                </button>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {groupeRelances.slice(0, 10).map((e) => {
                const reference = (e.devis_id !== null ? devisNumero.get(e.devis_id) : undefined) ?? "—";
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-sm ${
                          CANAL_TONE[e.canal] ?? "bg-background-200 text-foreground-600"
                        }`}
                      >
                        <i className={canalIcon(e.canal)}></i>
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground-950 truncate">{e.destinataire ?? "—"}</p>
                        <p className="text-[11px] text-foreground-500 truncate">
                          {reference} · {formatDateTime(e.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-accent-100 text-accent-700 font-semibold whitespace-nowrap">
                      Groupée
                    </span>
                  </li>
                );
              })}
            </ul>
            {groupeRelances.length > 10 && (
              <p className="mt-2 text-[11px] text-foreground-400">
                Les 10 envois groupés les plus récents sont affichés · exportez le CSV pour l'historique complet.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <RechercheRepliable
              carteId="envois"
              carteLabel="Envois"
              value={query}
              onChange={setQuery}
              placeholder="Rechercher un destinataire, un document…"
              conteneurClassName="flex-1 md:w-80 md:flex-none"
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Exporter la sélection affichée (filtres et période inclus) au format CSV, avec un récapitulatif totalisé"
            >
              <i className="ri-file-excel-2-line"></i>
              <span className="hidden sm:inline">Exporter CSV</span>
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 text-foreground-600 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors shrink-0"
                title="Réinitialiser tous les filtres (période, type, canal et recherche)"
              >
                <i className="ri-refresh-line"></i>
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200">
              {PERIODES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPeriode(p);
                    setMois(null);
                    if (p !== "Personnalisé") {
                      setCustomStart("");
                      setCustomEnd("");
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    periode === p ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    type === t ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200">
              {CANAUX.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanal(c)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    canal === c ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setGroupeOnly((v) => !v)}
              title="Afficher uniquement les relances parties en lot (envoi groupé ou escalade automatique)"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                groupeOnly
                  ? "bg-accent-500 text-background-50"
                  : "bg-background-100 text-foreground-600 border border-background-200 hover:bg-background-200"
              }`}
            >
              <i className="ri-send-plane-2-line"></i>
              Relances groupées
              {groupeOnly && <i className="ri-close-line"></i>}
            </button>
            <button
              type="button"
              onClick={() => setMasquerExemples((v) => !v)}
              title="Masquer les lignes issues du jeu de données d'exemple"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                masquerExemples
                  ? "bg-secondary-500 text-background-50"
                  : "bg-background-100 text-foreground-600 border border-background-200 hover:bg-background-200"
              }`}
            >
              <i className="ri-flask-line"></i>
              Exemples masqués
              {masquerExemples && <i className="ri-close-line"></i>}
            </button>
            {groupeOnly && (
              <button
                type="button"
                onClick={handleExportGroupesFiltres}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exporter la liste affichée des relances groupées (filtres et période inclus) au format CSV"
              >
                <i className="ri-download-2-line"></i>
                <span className="hidden sm:inline">Exporter CSV</span>
              </button>
            )}
          </div>
        </div>

        {periode === "Personnalisé" && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 rounded-lg bg-background-100 border border-background-200 animate-fade-in">
            <div className="flex flex-col gap-1">
              <label htmlFor="envois-date-start" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Du
              </label>
              <input
                id="envois-date-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="envois-date-end" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Au
              </label>
              <input
                id="envois-date-end"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-transparent uppercase tracking-wide select-none" aria-hidden="true">
                Action
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomStart("");
                  setCustomEnd("");
                }}
                disabled={!customStart && !customEnd}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-close-circle-line"></i>
                Effacer les dates
              </button>
            </div>
            <p className="sm:ml-auto text-xs text-foreground-500">
              {customStart || customEnd
                ? `Sélection : ${filteredSummary.total} envoi${filteredSummary.total > 1 ? "s" : ""}`
                : "Choisissez une date de début et/ou de fin pour délimiter la période."}
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide">Résumé par mois</p>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[11px] text-foreground-400">6 derniers mois · cliquez un mois pour filtrer la liste</span>
              <button
                type="button"
                onClick={handleExportComparatif}
                disabled={monthlyStats.length === 0}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exporter le comparatif mensuel des envois (mois par mois, avec tendances) au format CSV"
              >
                <i className="ri-file-excel-2-line"></i>
                <span className="hidden sm:inline">Comparatif CSV</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {monthlyStats.map((m) => {
              const dot = m.dominant ? CANAL_DOT[m.dominant] : "bg-background-300";
              const isActive = mois === m.key;
              const up = m.delta !== null && m.delta > 0;
              const down = m.delta !== null && m.delta < 0;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setPeriode("Tout");
                    setMois(isActive ? null : m.key);
                  }}
                  aria-pressed={isActive}
                  title={isActive ? "Retirer le filtre de ce mois" : `Filtrer la liste sur ${m.longLabel}`}
                  className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? "bg-accent-50 border-accent-400 ring-1 ring-accent-400"
                      : "bg-background-100 border-background-200 hover:border-primary-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide truncate">
                      {m.label}
                    </p>
                    <span className="font-heading font-bold text-base text-foreground-950">{m.total}</span>
                  </div>
                  <p className="mt-1 text-[11px] inline-flex items-center gap-1 truncate">
                    {m.delta === null ? (
                      <span className="text-foreground-300">—</span>
                    ) : (
                      <>
                        <span
                          className={`inline-flex items-center gap-0.5 font-semibold ${
                            up ? "text-accent-700" : down ? "text-red-600" : "text-foreground-500"
                          }`}
                        >
                          <i className={up ? "ri-arrow-up-line" : down ? "ri-arrow-down-line" : "ri-subtract-line"}></i>
                          {up ? "+" : ""}
                          {m.delta} %
                        </span>
                        <span className="text-foreground-400">vs mois préc.</span>
                      </>
                    )}
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-background-200 overflow-hidden flex">
                    {m.total > 0 && (
                      <>
                        <span className="bg-primary-500" style={{ width: `${(m.Email / m.total) * 100}%` }}></span>
                        <span className="bg-secondary-500" style={{ width: `${(m.SMS / m.total) * 100}%` }}></span>
                        <span className="bg-accent-500" style={{ width: `${(m.WhatsApp / m.total) * 100}%` }}></span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-foreground-600 inline-flex items-center gap-1.5 truncate">
                    {m.dominant ? (
                      <>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`}></span>
                        {m.dominant} en tête
                      </>
                    ) : (
                      <span className="text-foreground-400">Aucun envoi</span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            Aucun envoi ne correspond à votre recherche.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((e) => {
              const reference =
                (e.facture_id !== null ? factureNumero.get(e.facture_id) : undefined) ??
                (e.devis_id !== null ? devisNumero.get(e.devis_id) : undefined) ??
                "—";
              return (
                <div
                  key={e.id}
                  className="flex items-start justify-between gap-3 p-4 rounded-lg bg-background-100 border border-background-200"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-lg ${
                        CANAL_TONE[e.canal] ?? "bg-background-200 text-foreground-600"
                      }`}
                    >
                      <i className={canalIcon(e.canal)}></i>
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 font-semibold">
                          {typeLabel(e.type)}
                        </span>
                        {estExemple(e.mode) && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 font-semibold">
                            <i className="ri-flask-line"></i>
                            Exemple
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${CANAL_TONE[e.canal] ?? "bg-background-200 text-foreground-600"}`}>
                          {e.canal}
                        </span>
                        <span className="text-sm font-semibold text-foreground-950">{reference}</span>
                      </div>
                      <p className="text-xs text-foreground-700 mt-1.5 inline-flex items-center gap-1.5">
                        <i className="ri-user-line text-foreground-400"></i>
                        {e.destinataire ?? "—"}
                      </p>
                      {e.sujet && <p className="text-xs text-foreground-600 mt-1 break-words">{e.sujet}</p>}
                    </div>
                  </div>
                  <p className="text-[11px] text-foreground-400 whitespace-nowrap inline-flex items-center gap-1 shrink-0">
                    <i className="ri-time-line"></i>
                    {formatDateTime(e.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-background-100 border border-background-200">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <i className="ri-calculator-line"></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground-950">Total cumulé · {periodeLabel}</p>
                <p className="text-[11px] text-foreground-500">Calculé sur la sélection filtrée affichée ci-dessus</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Envois</span>
                <span className="font-heading font-bold text-xl text-foreground-950">{filteredSummary.total}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold whitespace-nowrap">
                  <i className="ri-mail-line"></i>
                  Email · {filteredSummary.email}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-700 text-xs font-semibold whitespace-nowrap">
                  <i className="ri-message-2-line"></i>
                  SMS · {filteredSummary.sms}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-700 text-xs font-semibold whitespace-nowrap">
                  <i className="ri-whatsapp-line"></i>
                  WhatsApp · {filteredSummary.whatsapp}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </DataState>
  );
}