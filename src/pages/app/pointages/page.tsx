import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useArtisanData } from "@/hooks/useArtisanData";
import { formatMonth, toISODate } from "@/lib/dates";
import { fetchPointages, type Pointage } from "@/lib/pointage";
import { couleurIntervenant } from "@/lib/intervenants";
import { exporterHeuresCsv, recapHeuresParIntervenant, totalRecap } from "@/lib/paie";
import DataState from "@/pages/app/components/DataState";
import PointagesResume from "@/pages/app/pointages/components/PointagesResume";
import PointagesJournal from "@/pages/app/pointages/components/PointagesJournal";

/**
 * Page « Pointages » : les heures de l'équipe, mois par mois, avec un filtre par
 * intervenant et un export CSV détaillé pour la paie. Évite de relire tout le planning
 * intervention par intervention pour retrouver les heures travaillées.
 */
export default function AppPointages() {
  usePageMeta(
    "Pointages · ArtiFlow-pro",
    "Les heures pointées par votre équipe, filtrables par intervenant et par mois, avec export CSV pour la paie.",
  );
  const { loading, error, creneaux, intervenants, reload } = useArtisanData();

  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [suiviLoading, setSuiviLoading] = useState(true);
  const [suiviError, setSuiviError] = useState<string | null>(null);
  const [moisOffset, setMoisOffset] = useState(0);
  const [filtre, setFiltre] = useState<string>("tous");
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [exportOk, setExportOk] = useState<number | null>(null);

  // Les durées « en cours » avancent toutes seules, sans recharger la page.
  useEffect(() => {
    const timer = window.setInterval(() => setMaintenant(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const chargerPointages = useCallback(async () => {
    setSuiviLoading(true);
    setSuiviError(null);
    try {
      setPointages(await fetchPointages());
    } catch {
      setSuiviError("Les pointages n'ont pas pu être chargés. Réessayez dans un instant.");
    } finally {
      setSuiviLoading(false);
    }
  }, []);

  useEffect(() => {
    void chargerPointages();
  }, [chargerPointages]);

  const moisRef = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + moisOffset);
    return d;
  }, [moisOffset]);

  const dates = useMemo(() => {
    const dernierJour = new Date(moisRef.getFullYear(), moisRef.getMonth() + 1, 0).getDate();
    return Array.from({ length: dernierJour }, (_, i) =>
      toISODate(new Date(moisRef.getFullYear(), moisRef.getMonth(), i + 1)),
    );
  }, [moisRef]);

  const labelMois = formatMonth(moisRef);

  const pointagesMois = useMemo(
    () => pointages.filter((p) => dates.includes(p.date)),
    [pointages, dates],
  );

  const pointagesFiltres = useMemo(() => {
    if (filtre === "tous") return pointagesMois;
    if (filtre === "non") return pointagesMois.filter((p) => p.intervenant_id === null);
    const id = Number(filtre);
    return pointagesMois.filter((p) => p.intervenant_id === id);
  }, [pointagesMois, filtre]);

  const personnes = useMemo(() => {
    if (filtre === "non") return [];
    const base = intervenants.filter(
      (i) => i.actif || pointagesMois.some((p) => p.intervenant_id === i.id),
    );
    if (filtre === "tous") return base;
    const id = Number(filtre);
    return intervenants.filter((i) => i.id === id);
  }, [intervenants, filtre, pointagesMois]);

  const recap = useMemo(
    () => recapHeuresParIntervenant(pointagesFiltres, personnes, dates, maintenant),
    [pointagesFiltres, personnes, dates, maintenant],
  );

  const minutesTotal = totalRecap(recap);
  const nbInterventions = recap.reduce((s, l) => s + l.nbPointages, 0);
  const nbJours = useMemo(() => {
    const set = new Set<string>();
    pointagesFiltres.forEach((p) => {
      if (p.arrivee_le) set.add(p.date);
    });
    return set.size;
  }, [pointagesFiltres]);

  const exporter = () => {
    const nb = exporterHeuresCsv({
      pointages: pointagesFiltres,
      intervenants,
      dates,
      creneaux,
      periodeLabel: labelMois,
      fichier: `heures-${labelMois.toLowerCase().replace(/\s+/g, "-")}`,
    });
    setExportOk(nb);
  };

  const recharger = () => {
    void chargerPointages();
    void reload();
  };

  const chips: { cle: string; label: string; couleur: string | null }[] = [
    { cle: "tous", label: "Toute l'équipe", couleur: null },
    ...intervenants.map((i) => ({ cle: String(i.id), label: i.nom, couleur: i.couleur })),
    { cle: "non", label: "Non affecté", couleur: null },
  ];

  return (
    <DataState loading={loading || suiviLoading} error={error ?? suiviError} onRetry={recharger}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-lg text-foreground-950">Pointages</h1>
            <p className="text-xs text-foreground-500">
              Heures réellement travaillées, pause déduite — filtrez par intervenant et par mois.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200">
              <button
                type="button"
                onClick={() => {
                  setMoisOffset((m) => m - 1);
                  setExportOk(null);
                }}
                aria-label="Mois précédent"
                className="w-8 h-8 flex items-center justify-center rounded-full text-foreground-600 hover:bg-background-200 cursor-pointer"
              >
                <i className="ri-arrow-left-s-line"></i>
              </button>
              <span className="min-w-[132px] text-center text-xs font-semibold text-foreground-900 whitespace-nowrap">
                {labelMois}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMoisOffset((m) => m + 1);
                  setExportOk(null);
                }}
                aria-label="Mois suivant"
                className="w-8 h-8 flex items-center justify-center rounded-full text-foreground-600 hover:bg-background-200 cursor-pointer"
              >
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
            {moisOffset !== 0 && (
              <button
                type="button"
                onClick={() => {
                  setMoisOffset(0);
                  setExportOk(null);
                }}
                className="h-8 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200"
              >
                Ce mois
              </button>
            )}
            <Link
              to="/app/planning"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-calendar-2-line"></i>
              Planning
            </Link>
            <button
              type="button"
              onClick={exporter}
              disabled={minutesTotal === 0}
              title={
                minutesTotal === 0
                  ? "Aucune heure pointée sur ce mois"
                  : "Télécharger le détail des heures en CSV (Excel)"
              }
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <i className="ri-download-2-line"></i>
              Export CSV paie
            </button>
          </div>
        </div>

        {/* Filtre par intervenant */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-filter-3-line"></i> Intervenant
          </span>
          {chips.map((c) => {
            const actif = filtre === c.cle;
            return (
              <button
                key={c.cle}
                type="button"
                onClick={() => {
                  setFiltre(c.cle);
                  setExportOk(null);
                }}
                aria-pressed={actif}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  actif
                    ? "bg-foreground-900 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                }`}
              >
                {c.couleur && (
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: couleurIntervenant(c.couleur) }}
                  />
                )}
                {c.label}
              </button>
            );
          })}
        </div>

        {exportOk !== null && (
          <p className="text-[11px] text-secondary-900 bg-secondary-100 border border-secondary-200 rounded-md px-3 py-2 inline-flex items-center gap-1.5 self-start">
            <i className="ri-checkbox-circle-line"></i>
            {exportOk === 0
              ? "Aucune intervention pointée à exporter sur cette sélection."
              : `${exportOk} ligne${exportOk > 1 ? "s" : ""} exportée${exportOk > 1 ? "s" : ""} — le CSV contient aussi le total par intervenant.`}
          </p>
        )}

        <PointagesResume
          recap={recap}
          minutesTotal={minutesTotal}
          nbInterventions={nbInterventions}
          nbJours={nbJours}
          periodeLabel={labelMois}
        />

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground-950">Détail des pointages</h2>
          <p className="text-[11px] text-foreground-500">
            {nbInterventions} intervention{nbInterventions > 1 ? "s" : ""} · {labelMois}
          </p>
        </div>

        <PointagesJournal
          pointages={pointagesFiltres}
          creneaux={creneaux}
          intervenants={intervenants}
          maintenant={maintenant}
        />

        <p className="text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
          <i className="ri-information-line mt-0.5"></i>
          <span>
            Une heure manque ? Le pointage se fait depuis le planning, sur l'intervention concernée
            (bouton « Pointer ») : arrivée, départ et pause y sont saisis en un geste.
          </span>
        </p>
      </div>
    </DataState>
  );
}