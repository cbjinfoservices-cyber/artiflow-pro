import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { formatDuree, totalMinutes, type Pointage } from "@/lib/pointage";
import { exporterHeuresCsv, recapHeuresParIntervenant, totalRecap } from "@/lib/paie";

/**
 * Récapitulatif des heures pointées de la semaine, personne par personne (vue patron).
 * Sert de base à la paie : chaque intervenant a son total, son nombre de jours pointés,
 * et le bouton d'export produit un CSV détaillé prêt à transmettre au comptable.
 */
export default function RecapHeuresEquipe({
  pointages,
  intervenants,
  isoList,
  labelSemaine,
  creneaux,
  filtreIntervenant,
  onFiltrer,
}: {
  /** Tous les pointages visibles par le compte (toutes semaines confondues). */
  pointages: Pointage[];
  intervenants: Intervenant[];
  /** Les 5 jours de la semaine affichée, en ISO. */
  isoList: string[];
  labelSemaine: string;
  creneaux: { id: number; libelle: string; ville: string | null }[];
  /** Filtre intervenant courant du planning (« tous », « non », ou un identifiant). */
  filtreIntervenant: string;
  /** Applique un filtre intervenant depuis le récap (échange avec le planning). */
  onFiltrer: (valeur: string) => void;
}) {
  const [exporte, setExporte] = useState<number | null>(null);

  const personnes = useMemo(() => {
    const base = intervenants.filter((i) => i.actif);
    if (filtreIntervenant === "tous" || filtreIntervenant === "non") return base;
    const id = Number(filtreIntervenant);
    return base.filter((i) => i.id === id);
  }, [intervenants, filtreIntervenant]);

  const recap = useMemo(
    () => recapHeuresParIntervenant(pointages, personnes, isoList),
    [pointages, personnes, isoList],
  );

  // L'export suit le filtre intervenant du planning : on n'exporte que la sélection affichée.
  const pointagesExport = useMemo(() => {
    if (filtreIntervenant === "tous") return pointages;
    if (filtreIntervenant === "non") return pointages.filter((p) => p.intervenant_id === null);
    const id = Number(filtreIntervenant);
    return pointages.filter((p) => p.intervenant_id === id);
  }, [pointages, filtreIntervenant]);

  const total = totalRecap(recap);
  const nbInterventions = recap.reduce((s, l) => s + l.nbPointages, 0);
  const enCours = recap.some((l) => l.enCours);
  const maxMinutes = Math.max(1, ...recap.map((l) => l.minutes));
  const minutesSemaine = totalMinutes(
    pointagesExport.filter((p) => isoList.includes(p.date)),
  );

  const exporter = () => {
    const nb = exporterHeuresCsv({
      pointages: pointagesExport,
      intervenants,
      dates: isoList,
      creneaux,
      periodeLabel: `Semaine du ${isoList[0] ?? ""} au ${isoList[isoList.length - 1] ?? ""}`,
      fichier: `heures-semaine-${isoList[0] ?? "periode"}`,
    });
    setExporte(nb);
  };

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <i className="ri-time-line text-lg"></i>
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground-950">Heures de la semaine par intervenant</h2>
            <p className="text-[11px] text-foreground-500 truncate">
              {labelSemaine} · {nbInterventions} intervention{nbInterventions > 1 ? "s" : ""} pointée
              {nbInterventions > 1 ? "s" : ""}
              {enCours ? " · un pointage est en cours" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-800 whitespace-nowrap">
            <i className="ri-timer-line text-primary-600"></i>
            {total > 0 ? `${formatDuree(total)} au total` : "Aucune heure pointée"}
          </span>
          <button
            type="button"
            onClick={exporter}
            disabled={minutesSemaine === 0}
            title={
              minutesSemaine === 0
                ? "Aucune heure pointée sur cette semaine"
                : "Télécharger le détail des heures au format CSV (Excel), prêt pour la paie"
            }
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line"></i>
            Export CSV paie
          </button>
          <Link
            to="/app/pointages"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className="ri-external-link-line"></i>
            Page Pointages
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {recap.map((ligne) => {
          const actif =
            ligne.intervenantId !== null && filtreIntervenant === String(ligne.intervenantId);
          return (
            <button
              key={ligne.intervenantId ?? "non-affecte"}
              type="button"
              onClick={() =>
                onFiltrer(
                  actif ? "tous" : ligne.intervenantId === null ? "non" : String(ligne.intervenantId),
                )
              }
              title={
                actif
                  ? "Retirer le filtre sur cette personne"
                  : "Filtrer le planning sur cette personne"
              }
              className={`text-left rounded-md border p-3 transition-colors cursor-pointer ${
                actif
                  ? "bg-primary-100 border-primary-300"
                  : "bg-background-50 border-background-200 hover:border-primary-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: ligne.couleur
                        ? couleurIntervenant(ligne.couleur)
                        : "#a8a29e",
                    }}
                  />
                  <span className="text-xs font-semibold text-foreground-900 truncate">{ligne.nom}</span>
                </span>
                {ligne.enCours && (
                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                    <i className="ri-timer-flash-line"></i>
                    en cours
                  </span>
                )}
              </div>

              <p
                className={`mt-1 text-base font-bold tabular-nums ${
                  ligne.minutes > 0 ? "text-foreground-950" : "text-foreground-400"
                }`}
              >
                {ligne.minutes > 0 ? formatDuree(ligne.minutes) : "—"}
              </p>

              <div className="mt-1.5 h-1.5 rounded-full bg-background-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${ligne.enCours ? "bg-accent-500" : "bg-primary-500"}`}
                  style={{ width: `${Math.round((ligne.minutes / maxMinutes) * 100)}%` }}
                />
              </div>

              <p className="mt-1 text-[10px] text-foreground-500">
                {ligne.nbPointages === 0
                  ? "aucun pointage"
                  : `${ligne.nbJours} jour${ligne.nbJours > 1 ? "s" : ""} · ${ligne.nbPointages} intervention${
                      ligne.nbPointages > 1 ? "s" : ""
                    }`}
              </p>
            </button>
          );
        })}
      </div>

      {exporte !== null && (
        <p className="mt-3 text-[11px] text-secondary-900 bg-secondary-100 border border-secondary-200 rounded-md px-3 py-2 inline-flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {exporte === 0
            ? "Aucune intervention pointée à exporter sur cette semaine."
            : `${exporte} ligne${exporte > 1 ? "s" : ""} exportée${exporte > 1 ? "s" : ""} — CSV téléchargé avec les totaux par intervenant.`}
        </p>
      )}
    </section>
  );
}