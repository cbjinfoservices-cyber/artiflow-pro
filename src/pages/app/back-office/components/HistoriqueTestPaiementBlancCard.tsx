import { useMemo } from "react";
import { useHistoriqueTestPaiementBlanc } from "@/hooks/useHistoriqueTestPaiementBlanc";
import { formatDepuis, formatHorodatage } from "@/lib/diagnosticUi";

/**
 * Carte back-office de l'HISTORIQUE DES TESTS À BLANC du tunnel de paiement Stripe.
 *
 * Chaque lancement du bouton « Tester un paiement à blanc » (guide de dépannage) ouvre une
 * vraie session Stripe en mode test et est consigné dans la table
 * `test_paiement_blanc_historique`. Cette carte liste ces tests — date, auteur, résultat,
 * message et session — pour suivre l'état du tunnel dans le temps et repérer une régression.
 */
export default function HistoriqueTestPaiementBlancCard() {
  const { items, loading, error, reload } = useHistoriqueTestPaiementBlanc(60);

  const synthese = useMemo(() => {
    const reussis = items.filter((it) => it.ok).length;
    const echecs = items.length - reussis;
    const dernier = items[0] ?? null;
    const taux = items.length > 0 ? Math.round((reussis / items.length) * 100) : 0;
    return { reussis, echecs, dernier, taux };
  }, [items]);

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-flask-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">
              Tests à blanc du paiement
            </h3>
            <p className="text-[11px] text-foreground-500">
              Chaque test du tunnel Stripe (mode test) est historisé — date, auteur, résultat.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && !error && items.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-checkbox-circle-line"></i>
                {synthese.reussis} réussi{synthese.reussis > 1 ? "s" : ""}
              </span>
              {synthese.echecs > 0 && (
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-close-circle-line"></i>
                  {synthese.echecs} en échec
                </span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            title="Rafraîchir l'historique des tests à blanc"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60"
          >
            <i className={loading ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
            Rafraîchir
          </button>
        </div>
      </div>

      {!loading && !error && items.length > 0 && synthese.dernier && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 border-b border-background-200 bg-background-50">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-history-line"></i>
            Dernier test
          </span>
          <span className="text-[11px] text-foreground-600">
            {formatHorodatage(synthese.dernier.created_at)}
            <span className="text-foreground-400"> · {formatDepuis(synthese.dernier.created_at)}</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-medium whitespace-nowrap">
            <i className="ri-percent-line"></i>
            Taux de réussite : <span className="tabular-nums font-bold text-foreground-900">{synthese.taux}%</span>
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-background-200/50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="inline-flex items-center gap-2 text-sm text-foreground-600">
            <i className="ri-error-warning-line text-red-500"></i>
            {error}
          </span>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-foreground-500">
          <i className="ri-flask-line text-foreground-400 text-lg"></i>
          Aucun test à blanc lancé pour l'instant. Utilisez « Tester un paiement à blanc » dans le guide de dépannage.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-background-200">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3">
              <span
                className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg ${
                  it.ok ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700"
                }`}
              >
                <i className={it.ok ? "ri-check-line" : "ri-close-line"}></i>
              </span>
              <span
                className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                  it.ok ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
                }`}
              >
                <i className={it.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                {it.ok ? "Réussi" : "Échec"}
              </span>
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-medium whitespace-nowrap uppercase">
                {it.mode || "test"}
              </span>
              <span className="min-w-0 flex-1 text-xs text-foreground-600 truncate" title={it.message}>
                {it.message || "—"}
              </span>
              {it.session_id && (
                <span
                  className="hidden sm:inline-flex items-center h-6 px-2 rounded-full bg-background-200 text-foreground-500 text-[10px] font-medium whitespace-nowrap"
                  title={`Session Stripe : ${it.session_id}`}
                >
                  {it.session_id}
                </span>
              )}
              <span className="text-[11px] text-foreground-400 whitespace-nowrap">
                {formatHorodatage(it.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}