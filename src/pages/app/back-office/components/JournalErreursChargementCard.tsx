import { useMemo, useState } from "react";
import { useJournalErreursChargement } from "@/hooks/useJournalErreursChargement";
import {
  journalErreursVersCsv,
  marquerErreurResolue,
  type ErreurChargement,
} from "@/lib/journalErreursChargement";
import { downloadCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";

/** Date/heure courte (« 12/10 à 08:32 ») d'une entrée du journal. */
function formatHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Filtres de gravité proposés au-dessus de la liste. */
type Filtre = "tous" | "blocage" | "avertissement";

const FILTRES: { valeur: Filtre; label: string; icon: string }[] = [
  { valeur: "tous", label: "Tout", icon: "ri-list-check-2" },
  { valeur: "blocage", label: "Blocages", icon: "ri-close-circle-line" },
  { valeur: "avertissement", label: "Avertissements", icon: "ri-alert-line" },
];

/** Métadonnées d'affichage d'une gravité. */
const GRAVITE_META: Record<ErreurChargement["gravite"], { label: string; icon: string; tone: string }> = {
  blocage: { label: "Blocage", icon: "ri-close-circle-line", tone: "bg-red-100 text-red-700" },
  avertissement: { label: "Avertissement", icon: "ri-alert-line", tone: "bg-secondary-100 text-secondary-800" },
};

/** Un lot d'incidents rattaché au même écran (regroupement par page). */
interface GroupeEcran {
  ecran: string;
  items: ErreurChargement[];
}

/**
 * Carte back-office du JOURNAL DES ERREURS DE CHARGEMENT.
 *
 * Chaque fois qu'un écran (back-office, tableau de bord ou Envois automatiques) n'arrive pas à
 * charger ses données, l'incident est consigné ici avec son message brut et un indice en clair :
 * colonne renommée, table absente, ou liaison entre deux tables non déclarée. C'est l'outil qui
 * permet de repérer en quelques secondes une requête cassée après une évolution de la base.
 *
 * La liste est REGROUPÉE PAR ÉCRAN pour isoler d'un coup d'œil les incidents d'une même page, un
 * filtre « Écran » permet de se concentrer sur une page précise, et chaque incident peut être
 * MARQUÉ COMME RÉSOLU pour suivre ce qui est déjà corrigé (une nouvelle occurrence le rouvre).
 *
 * Le journal est local à ce navigateur (il retrace ce qui s'est produit ici) et borné aux
 * dernières entrées.
 */
export default function JournalErreursChargementCard() {
  const { erreurs, rafraichir, vider } = useJournalErreursChargement();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [ecranFiltre, setEcranFiltre] = useState<string>("tous");
  const [masquerResolus, setMasquerResolus] = useState(false);
  const [confirmerVider, setConfirmerVider] = useState(false);

  /** Liste des écrans présents dans le journal, pour le filtre par page. */
  const ecrans = useMemo(
    () => Array.from(new Set(erreurs.map((e) => e.ecran).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [erreurs],
  );

  const nbResolus = useMemo(() => erreurs.filter((e) => e.resolu).length, [erreurs]);
  /** Blocages encore ouverts (non résolus) : ce qui allume réellement l'alerte. */
  const blocagesActifs = useMemo(
    () => erreurs.filter((e) => e.gravite === "blocage" && !e.resolu).length,
    [erreurs],
  );

  /** Compteurs des puces de gravité, cohérents avec l'option « masquer les résolus ». */
  const compteurs = useMemo(() => {
    const pool = masquerResolus ? erreurs.filter((e) => !e.resolu) : erreurs;
    return {
      tous: pool.length,
      blocage: pool.filter((e) => e.gravite === "blocage").length,
      avertissement: pool.filter((e) => e.gravite === "avertissement").length,
    };
  }, [erreurs, masquerResolus]);

  /** Incidents affichés après application des filtres (gravité, écran, résolus). */
  const visibles = useMemo(() => {
    let liste = erreurs;
    if (masquerResolus) liste = liste.filter((e) => !e.resolu);
    if (filtre !== "tous") liste = liste.filter((e) => e.gravite === filtre);
    if (ecranFiltre !== "tous") liste = liste.filter((e) => e.ecran === ecranFiltre);
    return liste;
  }, [erreurs, filtre, ecranFiltre, masquerResolus]);

  /** Regroupe les incidents visibles par écran, en conservant l'ordre d'apparition. */
  const groupes = useMemo<GroupeEcran[]>(() => {
    const ordre: string[] = [];
    const map = new Map<string, ErreurChargement[]>();
    visibles.forEach((e) => {
      const cle = e.ecran || "Écran inconnu";
      if (!map.has(cle)) {
        map.set(cle, []);
        ordre.push(cle);
      }
      map.get(cle)!.push(e);
    });
    return ordre.map((ecran) => ({ ecran, items: map.get(ecran) ?? [] }));
  }, [visibles]);

  /** Télécharge le journal des erreurs en CSV : trace datée de tous les incidents (avant correction). */
  const exporterCsv = () => {
    if (erreurs.length === 0) return;
    downloadCsv(`journal-erreurs-chargement-${todayISO()}.csv`, journalErreursVersCsv(erreurs));
  };

  return (
    <section id="journal-erreurs" className="scroll-mt-24 rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
            <i className="ri-bug-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">
              Journal des erreurs de chargement
            </h3>
            <p className="text-[11px] text-foreground-500">
              Requêtes qui ont échoué à charger leurs données — regroupées par écran, colonne, table ou liaison en cause.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {blocagesActifs > 0 && (
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold whitespace-nowrap">
              <i className="ri-close-circle-line"></i>
              {blocagesActifs} blocage{blocagesActifs > 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={rafraichir}
            title="Relire le journal"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Rafraîchir
          </button>
          <button
            type="button"
            onClick={exporterCsv}
            disabled={erreurs.length === 0}
            title="Télécharger le journal en CSV (date, gravité, résolu, écran, source, code, indice, message)"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line"></i>
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmerVider) {
                vider();
                setConfirmerVider(false);
              } else {
                setConfirmerVider(true);
                window.setTimeout(() => setConfirmerVider(false), 4000);
              }
            }}
            disabled={erreurs.length === 0}
            title="Vider le journal des erreurs"
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              confirmerVider
                ? "bg-red-500 text-background-50 hover:bg-red-600"
                : "bg-background-50 border border-background-200 text-foreground-700 hover:border-red-300 hover:text-red-700"
            }`}
          >
            <i className={confirmerVider ? "ri-check-line" : "ri-delete-bin-6-line"}></i>
            {confirmerVider ? "Confirmer" : "Vider"}
          </button>
        </div>
      </div>

      {erreurs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-background-200">
          {FILTRES.map((f) => {
            const actif = filtre === f.valeur;
            return (
              <button
                key={f.valeur}
                type="button"
                onClick={() => setFiltre(f.valeur)}
                aria-pressed={actif}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  actif
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-100 text-foreground-600 border border-background-200 hover:border-primary-300 hover:text-primary-700"
                }`}
              >
                <i className={f.icon}></i>
                {f.label}
                <span className={`tabular-nums text-[11px] font-bold ${actif ? "text-background-50/80" : "text-foreground-400"}`}>
                  {compteurs[f.valeur]}
                </span>
              </button>
            );
          })}

          <span className="mx-0.5 h-6 w-px bg-background-200" aria-hidden="true"></span>

          {/* Filtre par écran : isole les incidents d'une même page. */}
          <label className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-background-100 border border-background-200 cursor-pointer">
            <i className="ri-layout-4-line text-foreground-400 text-sm"></i>
            <span className="text-[11px] font-semibold text-foreground-500 whitespace-nowrap">Écran</span>
            <select
              value={ecranFiltre}
              onChange={(e) => setEcranFiltre(e.target.value)}
              aria-label="Filtrer le journal par écran"
              className="bg-transparent text-xs font-medium text-foreground-800 outline-none cursor-pointer pr-1"
            >
              <option value="tous">Tous</option>
              {ecrans.map((ecran) => (
                <option key={ecran} value={ecran}>
                  {ecran}
                </option>
              ))}
            </select>
          </label>

          {/* Bascule : masquer ce qui est déjà traité. */}
          <button
            type="button"
            onClick={() => setMasquerResolus((v) => !v)}
            aria-pressed={masquerResolus}
            title="Masquer les incidents déjà marqués comme résolus"
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              masquerResolus
                ? "bg-accent-500 text-background-50"
                : "bg-background-100 text-foreground-600 border border-background-200 hover:border-accent-300"
            }`}
          >
            <i className={masquerResolus ? "ri-eye-off-line" : "ri-eye-line"}></i>
            Masquer les résolus
            {nbResolus > 0 && (
              <span className={`tabular-nums text-[11px] font-bold ${masquerResolus ? "text-background-50/80" : "text-foreground-400"}`}>
                {nbResolus}
              </span>
            )}
          </button>
        </div>
      )}

      {erreurs.length === 0 ? (
        <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-foreground-500">
          <i className="ri-checkbox-circle-line text-accent-600 text-lg"></i>
          Aucune erreur de chargement enregistrée. Tous les écrans interrogés ont chargé leurs données.
        </div>
      ) : visibles.length === 0 ? (
        <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-foreground-500">
          <i className="ri-filter-off-line text-foreground-400 text-lg"></i>
          Aucune entrée pour ces filtres.
        </div>
      ) : (
        <div className="flex flex-col">
          {groupes.map((groupe) => (
            <div key={groupe.ecran} className="border-b border-background-200 last:border-b-0">
              {/* En-tête de groupe : l'écran concerné et le nombre d'incidents. */}
              <div className="flex items-center gap-2 px-5 pt-3 pb-1.5 bg-background-50/60">
                <i className="ri-layout-4-line text-foreground-400 text-sm"></i>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-600">
                  {groupe.ecran}
                </span>
                <span className="text-[11px] text-foreground-400 tabular-nums">
                  {groupe.items.length} incident{groupe.items.length > 1 ? "s" : ""}
                </span>
              </div>

              <ul className="flex flex-col divide-y divide-background-200">
                {groupe.items.map((e) => {
                  const meta = GRAVITE_META[e.gravite];
                  return (
                    <li
                      key={e.id}
                      className={`flex flex-col gap-1.5 px-5 py-3.5 ${e.resolu ? "bg-background-50/50" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.tone}`}>
                          <i className={meta.icon}></i>
                          {meta.label}
                        </span>
                        {e.source && (
                          <span className="inline-flex items-center h-5 px-2 rounded-full bg-background-200 text-foreground-600 text-[10px] font-medium whitespace-nowrap font-mono">
                            {e.source}
                          </span>
                        )}
                        {e.code && (
                          <span className="inline-flex items-center h-5 px-2 rounded-full bg-background-200 text-foreground-500 text-[10px] font-medium whitespace-nowrap font-mono">
                            {e.code}
                          </span>
                        )}

                        <span className="ml-auto inline-flex items-center gap-2">
                          <span className="text-[11px] text-foreground-400 whitespace-nowrap">
                            {formatHeure(e.quand)}
                          </span>
                          {e.resolu && (
                            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                              <i className="ri-checkbox-circle-line"></i>
                              Résolu
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => marquerErreurResolue(e.id, !e.resolu)}
                            title={e.resolu ? "Rouvrir cet incident" : "Marquer cet incident comme résolu"}
                            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                              e.resolu
                                ? "bg-background-100 border border-background-200 text-foreground-600 hover:border-primary-300"
                                : "bg-accent-500 text-background-50 hover:bg-accent-600"
                            }`}
                          >
                            <i className={e.resolu ? "ri-arrow-go-back-line" : "ri-check-line"}></i>
                            {e.resolu ? "Rouvrir" : "Marquer comme résolu"}
                          </button>
                        </span>
                      </div>

                      {e.indice && (
                        <p className={`inline-flex items-start gap-1.5 text-xs leading-relaxed ${e.resolu ? "text-foreground-500" : "text-foreground-800"}`}>
                          <i className="ri-lightbulb-line text-accent-600 mt-px shrink-0"></i>
                          <span className={`font-semibold ${e.resolu ? "line-through decoration-foreground-300" : ""}`}>
                            {e.indice}
                          </span>
                        </p>
                      )}
                      <p
                        className={`text-[11px] leading-relaxed break-words font-mono ${e.resolu ? "text-foreground-400" : "text-foreground-500"}`}
                        title={e.message}
                      >
                        {e.message}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 px-5 py-2.5 bg-background-50 border-t border-background-200">
        <i className="ri-information-line mt-px shrink-0 text-foreground-400 text-xs"></i>
        <p className="text-[11px] text-foreground-500 leading-relaxed">
          Journal conservé dans ce navigateur (les 40 dernières entrées). « Marquer comme résolu »
          permet de suivre ce qui est déjà corrigé ; une nouvelle occurrence rouvre l'incident.
        </p>
      </div>
    </section>
  );
}