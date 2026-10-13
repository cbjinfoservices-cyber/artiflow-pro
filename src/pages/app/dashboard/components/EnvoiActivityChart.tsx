import { useMemo, useState } from "react";
import type { EnvoiItem } from "@/hooks/useArtisanData";
import { canalIcon } from "@/lib/statuts";

interface MonthBucket {
  key: string;
  label: string;
  longLabel: string;
  Email: number;
  SMS: number;
  WhatsApp: number;
  total: number;
  prevTotal: number;
  delta: number | null;
}

type Canal = "Email" | "SMS" | "WhatsApp";

const CANAL_LEGEND: { key: Canal; color: string; dot: string; tone: string }[] = [
  { key: "Email", color: "bg-primary-500", dot: "bg-primary-500", tone: "bg-primary-100 text-primary-700" },
  { key: "SMS", color: "bg-secondary-500", dot: "bg-secondary-500", tone: "bg-secondary-100 text-secondary-700" },
  { key: "WhatsApp", color: "bg-accent-500", dot: "bg-accent-500", tone: "bg-accent-100 text-accent-700" },
];

function canalKey(canal: string): Canal {
  if (canal === "SMS") return "SMS";
  if (canal === "WhatsApp") return "WhatsApp";
  return "Email";
}

function typeLabel(type: string): string {
  if (type === "relance") return "Relance";
  if (type === "devis") return "Devis";
  return "Facture";
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EnvoiActivityChart({ envois }: { envois: EnvoiItem[] }) {
  const [selected, setSelected] = useState<Canal | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const buckets: MonthBucket[] = useMemo(() => {
    const now = new Date();
    // 7 mois en interne : le mois précédent même pour la barre la plus ancienne (6 affichés)
    const raw: MonthBucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      raw.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        longLabel: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        Email: 0,
        SMS: 0,
        WhatsApp: 0,
        total: 0,
        prevTotal: 0,
        delta: null,
      });
    }
    const byKey = new Map(raw.map((b) => [b.key, b]));
    envois.forEach((e) => {
      const d = new Date(e.created_at);
      if (Number.isNaN(d.getTime())) return;
      const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (!bucket) return;
      bucket[canalKey(e.canal)] += 1;
      bucket.total += 1;
    });
    return raw.slice(1).map((b, idx) => {
      const prevTotal = raw[idx].total;
      const delta = prevTotal === 0 ? null : Math.round(((b.total - prevTotal) / prevTotal) * 100);
      return { ...b, prevTotal, delta };
    });
  }, [envois]);

  const totals = buckets.map((m) => m.Email + m.SMS + m.WhatsApp);
  const maxTotal = Math.max(...totals, 1);
  const maxByCanal: Record<Canal, number> = {
    Email: Math.max(...buckets.map((m) => m.Email), 1),
    SMS: Math.max(...buckets.map((m) => m.SMS), 1),
    WhatsApp: Math.max(...buckets.map((m) => m.WhatsApp), 1),
  };
  const grandTotal = totals.reduce((a, b) => a + b, 0);

  const selectedTotal = selected ? buckets.reduce((sum, m) => sum + m[selected], 0) : grandTotal;

  const selectedBucket = selectedMonth !== null ? buckets[selectedMonth] : null;

  const monthEnvois = useMemo(() => {
    if (!selectedBucket) return [];
    return envois
      .filter((e) => {
        const d = new Date(e.created_at);
        return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${d.getMonth()}` === selectedBucket.key;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [envois, selectedBucket]);

  const handleBarClick = (index: number) => {
    setSelectedMonth((prev) => (prev === index ? null : index));
  };

  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading font-semibold text-base text-foreground-950">Activité des envois</h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            {selected
              ? `${selectedTotal} envoi${selectedTotal > 1 ? "s" : ""} ${selected} sur les 6 derniers mois`
              : grandTotal > 0
                ? `${grandTotal} envoi${grandTotal > 1 ? "s" : ""} sur les 6 derniers mois · cliquez un mois pour voir le détail`
                : "Devis, factures et relances envoyés à vos clients."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CANAL_LEGEND.map((c) => {
            const active = selected === c.key;
            const dimmed = selected !== null && !active;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelected(active ? null : c.key)}
                aria-pressed={active}
                title={active ? `Retirer le filtre ${c.key}` : `Isoler ${c.key}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? "bg-foreground-950 text-background-50"
                    : dimmed
                      ? "text-foreground-400 hover:bg-background-200"
                      : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${active ? c.dot : dimmed ? "bg-background-300" : c.dot}`}></span>
                {c.key}
              </button>
            );
          })}
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium text-foreground-500 hover:bg-background-200 cursor-pointer whitespace-nowrap"
              title="Afficher tous les canaux"
            >
              <i className="ri-close-line"></i> Tout
            </button>
          )}
        </div>
      </div>

      <div className="flex items-end gap-3 h-44">
        {buckets.map((m, i) => {
          const total = totals[i];
          const heightPct = selected
            ? Math.max((m[selected] / maxByCanal[selected]) * 100, 2)
            : Math.max((total / maxTotal) * 100, 2);
          const emailH = total ? (m.Email / total) * 100 : 0;
          const smsH = total ? (m.SMS / total) * 100 : 0;
          const waH = total ? (m.WhatsApp / total) * 100 : 0;
          const displayValue = selected ? m[selected] : total;
          const selectedColor = selected ? CANAL_LEGEND.find((c) => c.key === selected)?.color : undefined;
          const isActiveMonth = selectedMonth === i;
          return (
            <button
              key={`${m.label}-${i}`}
              type="button"
              onClick={() => handleBarClick(i)}
              className="flex-1 flex flex-col items-center gap-2 cursor-pointer group min-w-0"
              title={`Voir le détail des envois de ${m.longLabel}`}
              aria-pressed={isActiveMonth}
            >
              <span className={`text-[10px] font-semibold ${isActiveMonth ? "text-foreground-950" : selected ? "text-foreground-800" : "text-foreground-500"}`}>
                {displayValue > 0 ? displayValue : ""}
              </span>
              <div
                className={`w-full flex flex-col justify-end rounded-t-md overflow-hidden transition-all ${
                  isActiveMonth
                    ? "ring-2 ring-foreground-950 bg-background-300/70"
                    : "bg-background-200/60 group-hover:bg-background-300/50"
                }`}
                style={{ height: `${heightPct}%` }}
              >
                {selected ? (
                  m[selected] > 0 && <div className={`w-full ${selectedColor}`} style={{ height: "100%" }}></div>
                ) : (
                  <>
                    {emailH > 0 && <div className="w-full bg-primary-500" style={{ height: `${emailH}%` }}></div>}
                    {smsH > 0 && <div className="w-full bg-secondary-500" style={{ height: `${smsH}%` }}></div>}
                    {waH > 0 && <div className="w-full bg-accent-500" style={{ height: `${waH}%` }}></div>}
                  </>
                )}
              </div>
              <span className={`text-[10px] ${isActiveMonth ? "text-foreground-950 font-semibold" : "text-foreground-400"}`}>
                {m.label}
              </span>
              <span
                className={`text-[10px] font-semibold inline-flex items-center gap-0.5 whitespace-nowrap ${
                  m.delta === null
                    ? "text-foreground-300"
                    : m.delta > 0
                      ? "text-accent-700"
                      : m.delta < 0
                        ? "text-red-600"
                        : "text-foreground-500"
                }`}
                title="Évolution par rapport au mois précédent"
              >
                {m.delta === null ? (
                  <>
                    <i className="ri-subtract-line"></i>—
                  </>
                ) : (
                  <>
                    <i
                      className={
                        m.delta > 0 ? "ri-arrow-up-line" : m.delta < 0 ? "ri-arrow-down-line" : "ri-subtract-line"
                      }
                    ></i>
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}%
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedBucket && (
        <div className="mt-4 pt-4 border-t border-background-200 animate-fade-in">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground-950 capitalize">
                Détail des envois · {selectedBucket.longLabel}
              </p>
              <p className="text-xs text-foreground-500 mt-0.5">
                {monthEnvois.length} envoi{monthEnvois.length > 1 ? "s" : ""} · Email {selectedBucket.Email} · SMS{" "}
                {selectedBucket.SMS} · WhatsApp {selectedBucket.WhatsApp}
              </p>
              <p className="mt-1 text-[11px] inline-flex items-center gap-1.5 flex-wrap">
                {selectedBucket.delta === null ? (
                  <span className="text-foreground-300">— vs mois précédent</span>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        selectedBucket.delta > 0
                          ? "text-accent-700"
                          : selectedBucket.delta < 0
                            ? "text-red-600"
                            : "text-foreground-500"
                      }`}
                    >
                      <i
                        className={
                          selectedBucket.delta > 0
                            ? "ri-arrow-up-line"
                            : selectedBucket.delta < 0
                              ? "ri-arrow-down-line"
                              : "ri-subtract-line"
                        }
                      ></i>
                      {selectedBucket.delta > 0 ? "+" : ""}
                      {selectedBucket.delta} %
                    </span>
                    <span className="text-foreground-400">
                      vs mois préc. ({selectedBucket.prevTotal} envoi{selectedBucket.prevTotal > 1 ? "s" : ""})
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer"
              aria-label="Fermer le détail du mois"
              title="Fermer"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>

          {monthEnvois.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground-500 rounded-lg bg-background-50 border border-background-200">
              Aucun envoi sur ce mois.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {monthEnvois.map((e) => {
                const tone = CANAL_LEGEND.find((c) => c.key === canalKey(e.canal))?.tone ?? "bg-background-200 text-foreground-600";
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200"
                  >
                    <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-base ${tone}`}>
                      <i className={canalIcon(e.canal)}></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 font-semibold">
                          {typeLabel(e.type)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tone}`}>{e.canal}</span>
                        <span className="text-xs text-foreground-800 truncate">{e.destinataire ?? "—"}</span>
                      </div>
                      {e.sujet && <p className="text-[11px] text-foreground-500 mt-0.5 truncate">{e.sujet}</p>}
                    </div>
                    <span className="text-[11px] text-foreground-400 whitespace-nowrap inline-flex items-center gap-1 shrink-0">
                      <i className="ri-time-line"></i>
                      {formatDateTime(e.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}