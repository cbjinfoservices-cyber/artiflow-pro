import { Link } from "react-router-dom";
import type { RegulariteComptableStats } from "@/hooks/useRegulariteComptable";
import { formatShortDate } from "@/lib/dates";

/** Libellé lisible du mois écoulé (« Septembre 2026 »). */
function moisEcouleLabel(): string {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const s = prev.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Supervision de la régularité comptable de tous les artisans : combien envoient
 * régulièrement leur journal comptable (envoi automatique) et combien sont en retard.
 * Les chiffres proviennent de la fonction Backend réservée aux gestionnaires.
 */
export default function RegulariteComptableCard({
  stats,
  loading,
  error,
  canOpenCompta,
}: {
  stats: RegulariteComptableStats | null;
  loading: boolean;
  error: string | null;
  canOpenCompta: boolean;
}) {
  const suivis = stats?.artisansSuivis ?? 0;
  const reguliers = stats?.artisansReguliers ?? 0;
  const retard = stats?.artisansRetard ?? 0;
  const sansEnvoi = stats?.artisansSansEnvoi ?? 0;
  const moisManquants = stats?.moisManquantsTotal ?? 0;
  const envoisMoisEcoule = stats?.envoisAutoMoisEcoule ?? 0;
  const taux = suivis > 0 ? Math.round((reguliers / suivis) * 100) : 0;

  return (
    <div className="flex flex-col rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
            <i className="ri-file-chart-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Régularité comptable</h3>
            <p className="text-[11px] text-foreground-500">Envoi automatique du journal, tous artisans</p>
          </div>
        </div>
        {canOpenCompta && (
          <Link
            to="/app/comptabilite"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className="ri-arrow-right-up-line"></i>
            Espace comptable
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <i className="ri-loader-4-line animate-spin text-xl text-primary-600"></i>
        </div>
      ) : error ? (
        <div className="p-5 text-xs text-red-600 flex items-center gap-2">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      ) : suivis === 0 ? (
        <div className="p-6 text-center">
          <span className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-background-200 text-foreground-400 text-xl">
            <i className="ri-inbox-archive-line"></i>
          </span>
          <p className="mt-3 text-sm font-medium text-foreground-700">Aucun artisan en envoi automatique</p>
          <p className="mt-1 text-xs text-foreground-500">
            Dès qu'un artisan active l'envoi automatique de son journal comptable, sa régularité apparaîtra ici.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-accent-50 border border-accent-200">
              <span className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide">À jour</span>
              <span className="font-heading font-bold text-2xl text-foreground-950">{reguliers}</span>
              <span className="text-[11px] text-foreground-500">sur {suivis} suivis</span>
            </div>
            <div
              className={`flex flex-col gap-1 p-3 rounded-lg border ${
                retard > 0 ? "bg-red-50 border-red-200" : "bg-background-50 border-background-200"
              }`}
            >
              <span
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  retard > 0 ? "text-red-700" : "text-foreground-500"
                }`}
              >
                En retard
              </span>
              <span className="font-heading font-bold text-2xl text-foreground-950">{retard}</span>
              <span className="text-[11px] text-foreground-500">
                {moisManquants} mois manquant{moisManquants > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] text-foreground-500 mb-1.5">
              <span>Taux de régularité</span>
              <span className="font-semibold text-foreground-800">{taux} %</span>
            </div>
            <div className="h-2 rounded-full bg-background-200 overflow-hidden">
              <div className="h-full rounded-full bg-accent-500" style={{ width: `${taux}%` }}></div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1 border-t border-background-200">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-foreground-600">
                <i className="ri-send-plane-line text-accent-600"></i>
                Envois auto ({moisEcouleLabel()})
              </span>
              <span className="font-semibold text-foreground-950">{envoisMoisEcoule}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-foreground-600">
                <i className="ri-history-line text-secondary-600"></i>
                Dernier envoi automatique
              </span>
              <span className="font-semibold text-foreground-950">
                {stats?.dernierEnvoiAt ? formatShortDate(stats.dernierEnvoiAt) : "—"}
              </span>
            </div>
            {sansEnvoi > 0 && (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-foreground-600">
                  <i className="ri-time-line text-foreground-400"></i>
                  Auto activé, aucun envoi
                </span>
                <span className="font-semibold text-foreground-950">{sansEnvoi}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}