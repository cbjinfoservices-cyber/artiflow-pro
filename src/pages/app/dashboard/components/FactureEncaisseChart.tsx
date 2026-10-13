import { useEffect, useMemo, useState } from "react";
import type { FactureItem } from "@/hooks/useArtisanData";
import { formatCompactEuros, formatEuros } from "@/lib/format";
import {
  SEUILS_ENCAISSEMENT,
  lireSeuilEncaissement,
  ecrireSeuilEncaissement,
  SEUIL_ENCAISSEMENT_EVENT,
} from "@/lib/encaissementSeuil";

/** Un avoir (note de crédit) porte le préfixe AV et n'entre pas dans le facturé. */
function isAvoir(numero: string): boolean {
  return numero.trim().toUpperCase().startsWith("AV");
}

interface MoisBucket {
  key: string;
  label: string;
  longLabel: string;
  facture: number;
  encaisse: number;
  taux: number | null;
}

/**
 * Graphique de comparaison « facturé vs encaissé » sur les 6 derniers mois.
 * Pour chaque mois : le montant facturé TTC (factures émises, hors avoirs) et le
 * montant réellement encaissé TTC (factures réglées, datées au règlement), avec le
 * taux d'encaissement du mois (encaissé / facturé). Une ligne de synthèse donne le
 * taux d'encaissement global de la période.
 */
export default function FactureEncaisseChart({ factures }: { factures: FactureItem[] }) {
  // Seuil d'alerte partagé avec le bandeau « taux d'encaissement faible » du tableau de bord.
  const [seuil, setSeuil] = useState<number>(() => lireSeuilEncaissement());
  useEffect(() => {
    const sync = () => setSeuil(lireSeuilEncaissement());
    window.addEventListener(SEUIL_ENCAISSEMENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEUIL_ENCAISSEMENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const buckets: MoisBucket[] = useMemo(() => {
    const now = new Date();
    const raw: MoisBucket[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      raw.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        longLabel: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        facture: 0,
        encaisse: 0,
        taux: null,
      });
    }
    const byKey = new Map(raw.map((b) => [b.key, b]));

    const keyOf = (value: string | null | undefined): string | null => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    factures.forEach((f) => {
      // Facturé du mois : factures émises (hors avoirs).
      if (!isAvoir(f.numero)) {
        const k = keyOf(f.date_emission ?? f.created_at);
        const bucket = k ? byKey.get(k) : undefined;
        if (bucket) bucket.facture += Number(f.total_ttc || 0);
      }
      // Encaissé du mois : factures réglées, datées au jour réel du règlement.
      if (f.statut === "Payée") {
        const k = keyOf(f.date_paiement ?? f.date_emission ?? f.created_at);
        const bucket = k ? byKey.get(k) : undefined;
        if (bucket) bucket.encaisse += Number(f.total_ttc || 0);
      }
    });

    return raw.map((b) => ({
      ...b,
      taux: b.facture > 0 ? Math.round((b.encaisse / b.facture) * 100) : null,
    }));
  }, [factures]);

  const max = Math.max(...buckets.map((b) => Math.max(b.facture, b.encaisse)), 1);
  const totalFacture = buckets.reduce((s, b) => s + b.facture, 0);
  const totalEncaisse = buckets.reduce((s, b) => s + b.encaisse, 0);
  const tauxGlobal = totalFacture > 0 ? Math.round((totalEncaisse / totalFacture) * 100) : null;

  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-bar-chart-grouped-line"></i>
          </span>
          <div>
            <h2 className="font-heading font-semibold text-base text-foreground-950">Facturé vs encaissé</h2>
            <p className="text-xs text-foreground-500 mt-0.5">6 derniers mois · montants TTC, avec le taux d'encaissement</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary-500"></span>
            Facturé
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent-500"></span>
            Encaissé
          </span>
          <label className="inline-flex items-center gap-1 h-8 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
            <i className="ri-alarm-warning-line"></i>
            <span className="text-foreground-400">Seuil</span>
            <select
              value={seuil}
              onChange={(e) => ecrireSeuilEncaissement(Number(e.target.value))}
              title="Choisir le seuil d'alerte : on vous prévient quand le taux d'encaissement d'un mois passe en dessous"
              className="bg-transparent text-foreground-800 font-bold cursor-pointer outline-none"
            >
              {SEUILS_ENCAISSEMENT.map((s) => (
                <option key={s} value={s}>
                  {s} %
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-end gap-3 h-48">
        {buckets.map((b, i) => {
          const isCurrent = i === buckets.length - 1;
          const taux = b.taux;
          return (
            <div
              key={b.key}
              className="flex-1 flex flex-col items-center gap-2 min-w-0"
              title={`${b.longLabel} : facturé ${formatEuros(b.facture)} · encaissé ${formatEuros(b.encaisse)}${taux !== null ? ` · encaissement ${taux} %` : ""}`}
            >
              <div className="w-full flex-1 flex items-end justify-center gap-1.5">
                <div
                  className={`flex-1 max-w-[22px] rounded-t-md transition-all ${isCurrent ? "bg-primary-600" : "bg-primary-400 hover:bg-primary-500"}`}
                  style={{ height: `${Math.max((b.facture / max) * 100, b.facture > 0 ? 4 : 0)}%` }}
                ></div>
                <div
                  className={`flex-1 max-w-[22px] rounded-t-md transition-all ${isCurrent ? "bg-accent-600" : "bg-accent-400 hover:bg-accent-500"}`}
                  style={{ height: `${Math.max((b.encaisse / max) * 100, b.encaisse > 0 ? 4 : 0)}%` }}
                ></div>
              </div>
              <span className={`text-[10px] ${isCurrent ? "text-foreground-950 font-semibold" : "text-foreground-400"}`}>
                {b.label}
              </span>
              <span
                className={`text-[10px] font-semibold whitespace-nowrap ${
                  taux === null
                    ? "text-foreground-300"
                    : taux >= 90
                      ? "text-accent-700"
                      : taux >= 50
                        ? "text-secondary-700"
                        : "text-primary-700"
                }`}
                title="Taux d'encaissement du mois"
              >
                {taux === null ? "—" : `${taux} %`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-background-200 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-foreground-500">
          Facturé <strong className="text-foreground-800">{formatEuros(totalFacture)}</strong> · encaissé{" "}
          <strong className="text-foreground-800">{formatEuros(totalEncaisse)}</strong> sur la période
          <span className="hidden sm:inline"> ({formatCompactEuros(totalEncaisse)} perçus)</span>
        </p>
        <span
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold ${
            tauxGlobal === null
              ? "bg-background-200 text-foreground-500"
              : tauxGlobal >= 90
                ? "bg-accent-100 text-accent-800"
                : tauxGlobal >= 50
                  ? "bg-secondary-100 text-secondary-800"
                  : "bg-primary-100 text-primary-700"
          }`}
        >
          <i className="ri-percent-line"></i>
          Taux d'encaissement : {tauxGlobal === null ? "—" : `${tauxGlobal} %`}
        </span>
      </div>
    </div>
  );
}