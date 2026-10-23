import { useMemo, useState } from "react";
import type { CreneauItem } from "@/hooks/useArtisanData";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { normaliseStatutCreneau, statutCreneauMeta } from "@/lib/planningIntervenant";
import { iconeMotif, resumeAbsencesDuJour, suffixePeriode, type AbsenceJourResume, type Indisponibilite } from "@/lib/indisponibilites";
import { formatDateLongue, toISODate } from "@/lib/dates";
import BadgeAbsenceIntervention from "@/components/feature/BadgeAbsenceIntervention";

/** Initiales des jours de la semaine (grille commençant le lundi). */
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Calendrier du mois : une case par jour, avec les interventions de la journée.
 *
 * Tout se fait depuis la grille :
 * - on clique sur une intervention pour l'ouvrir et la modifier (heure, statut, intervenant) ;
 * - on la glisse sur une autre case pour la déplacer de jour, sans changer d'intervenant ;
 * - on clique sur le « + » d'une case pour ajouter une intervention ce jour-là ;
 * - le « + N » ouvre le détail complet du jour quand la case est trop petite pour tout afficher.
 */
export default function PlanningMoisGrid({
  weeks,
  isoList,
  mois,
  creneaux,
  intervenants,
  aConfirmerParJour = {},
  indisponibilites = [],
  onAddFor,
  onEdit,
  onMove,
  onDelete,
  onProposerRemplacant,
}: {
  /** Toutes les cases affichées, dans l'ordre (semaines complètes, du lundi au dimanche). */
  weeks: Date[];
  isoList: string[];
  /** Mois de référence : sert à griser les jours des mois voisins. */
  mois: Date;
  creneaux: CreneauItem[];
  intervenants: Intervenant[];
  /** Nombre d'interventions « à confirmer » par jour (clé = date ISO). */
  aConfirmerParJour?: Record<string, number>;
  /** Congés et indisponibilités à signaler dans les cases (une ligne par jour). */
  indisponibilites?: Indisponibilite[];
  onAddFor: (dateISO: string) => void;
  onEdit: (creneau: CreneauItem) => void;
  /** Déplace une intervention vers un autre jour (l'intervenant est conservé). */
  onMove: (creneauId: number, dateISO: string) => void;
  onDelete: (id: number) => void;
  /** Ouvre la fenêtre « proposer un remplaçant » depuis le badge de congé du détail du jour. */
  onProposerRemplacant?: (creneau: CreneauItem, absence: AbsenceJourResume, nom: string | null) => void;
}) {
  const [jourOuvert, setJourOuvert] = useState<string | null>(null);
  const [enDeplacement, setEnDeplacement] = useState<number | null>(null);
  const [caseSurvolee, setCaseSurvolee] = useState<string | null>(null);

  const intervenantParId = useMemo(() => {
    const map = new Map<number, Intervenant>();
    intervenants.forEach((i) => map.set(i.id, i));
    return map;
  }, [intervenants]);

  const parJour = useMemo(() => {
    const map = new Map<string, CreneauItem[]>();
    creneaux.forEach((c) => {
      map.set(c.date, [...(map.get(c.date) ?? []), c]);
    });
    map.forEach((liste) => liste.sort((a, b) => a.heure.localeCompare(b.heure)));
    return map;
  }, [creneaux]);

  // Absences par jour : elles sont affichées en tête de case, avant les interventions.
  const absencesParJour = useMemo(() => {
    const map = new Map<string, Indisponibilite[]>();
    indisponibilites.forEach((i) => {
      map.set(i.date, [...(map.get(i.date) ?? []), i]);
    });
    return map;
  }, [indisponibilites]);

  const aujourdHui = toISODate(new Date());
  const cleMois = `${mois.getFullYear()}-${mois.getMonth()}`;
  const joursOuverts = jourOuvert !== null ? parJour.get(jourOuvert) ?? [] : [];

  // Semaines affichées : chaque ligne de 7 cases est un vrai lundi → dimanche.
  const rangees = useMemo(() => {
    const rows: { jours: Date[]; isos: string[] }[] = [];
    for (let i = 0; i < isoList.length; i += 7) {
      rows.push({ jours: weeks.slice(i, i + 7), isos: isoList.slice(i, i + 7) });
    }
    return rows;
  }, [weeks, isoList]);

  const estDansMois = (d: Date) => `${d.getFullYear()}-${d.getMonth()}` === cleMois;
  const nbMois = creneaux.filter((c) => {
    const d = new Date(`${c.date}T00:00:00`);
    return !Number.isNaN(d.getTime()) && estDansMois(d);
  }).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-drag-move-2-line"></i>
          Glissez une intervention sur une autre case pour la déplacer. Un clic l'ouvre pour la modifier, le « + »
          ajoute une intervention ce jour-là.
        </p>
        <span className="self-start sm:self-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap">
          <i className="ri-calendar-check-line"></i>
          {nbMois} intervention{nbMois > 1 ? "s" : ""} ce mois
        </span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="min-w-[760px] flex flex-col gap-1.5">
          {/* En-tête des jours */}
          <div className="grid grid-cols-7 gap-1.5">
            {JOURS.map((j) => (
              <div
                key={j}
                className="h-8 flex items-center justify-center rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide"
              >
                {j}
              </div>
            ))}
          </div>

          {rangees.map((rangee) => (
            <div key={rangee.isos[0]} className="grid grid-cols-7 gap-1.5">
              {rangee.jours.map((jour, i) => {
                const iso = rangee.isos[i];
                const slots = parJour.get(iso) ?? [];
                const horsMois = !estDansMois(jour);
                const estAujourdHui = iso === aujourdHui;
                const survolee = caseSurvolee === iso && enDeplacement !== null;
                const nbAConfirmer = aConfirmerParJour[iso] ?? 0;
                const visibles = slots.slice(0, 3);
                const reste = slots.length - visibles.length;

                return (
                  <div
                    key={iso}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setCaseSurvolee(iso);
                    }}
                    onDragLeave={() => setCaseSurvolee((v) => (v === iso ? null : v))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = Number(e.dataTransfer.getData("text/plain") || enDeplacement);
                      setCaseSurvolee(null);
                      setEnDeplacement(null);
                      if (Number.isFinite(id) && id > 0) onMove(id, iso);
                    }}
                    className={`group flex flex-col gap-1 p-1.5 rounded-lg border min-h-[112px] transition-colors ${
                      survolee
                        ? "bg-primary-50 border-primary-400 ring-2 ring-primary-200"
                        : horsMois
                          ? "bg-background-50 border-background-200/60"
                          : "bg-background-50 border-background-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => setJourOuvert(jourOuvert === iso ? null : iso)}
                        title={`Voir le détail du ${formatDateLongue(iso)}`}
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                          estAujourdHui
                            ? "bg-primary-500 text-background-50"
                            : horsMois
                              ? "text-foreground-300 hover:bg-background-200"
                              : "text-foreground-700 hover:bg-background-200"
                        }`}
                      >
                        {jour.getDate()}
                      </button>
                      <div className="flex items-center gap-1">
                        {nbAConfirmer > 0 && (
                          <span
                            title={`${nbAConfirmer} intervention${nbAConfirmer > 1 ? "s" : ""} à confirmer ce jour`}
                            className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent-500 text-background-50 text-[9px] font-bold whitespace-nowrap"
                          >
                            {nbAConfirmer}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onAddFor(iso)}
                          title="Ajouter une intervention ce jour"
                          aria-label={`Ajouter une intervention le ${formatDateLongue(iso)}`}
                          className="w-5 h-5 flex items-center justify-center rounded text-foreground-300 hover:text-primary-700 hover:bg-background-200 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          <i className="ri-add-line text-[12px]"></i>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 flex-1">
                      {(absencesParJour.get(iso) ?? []).map((abs) => {
                        const intervAbs =
                          abs.intervenant_id !== null ? intervenantParId.get(abs.intervenant_id) : undefined;
                        return (
                          <span
                            key={abs.id}
                            title={`${intervAbs?.nom ?? "Équipe"} · ${abs.motif}${suffixePeriode(abs.periode)}${abs.note ? ` — ${abs.note}` : ""}`}
                            className="w-full inline-flex items-center gap-1 px-1 py-0.5 rounded bg-accent-100 border border-accent-200 text-[9px] font-bold text-accent-900 truncate"
                          >
                            <i className={`${iconeMotif(abs.motif)} text-[9px] shrink-0`}></i>
                            <span className="truncate">
                              {intervAbs?.nom ?? "Équipe"} · {abs.motif}{suffixePeriode(abs.periode)}
                            </span>
                          </span>
                        );
                      })}
                      {visibles.map((slot) => {
                        const interv = slot.intervenant_id !== null ? intervenantParId.get(slot.intervenant_id) : undefined;
                        const hex = interv ? couleurIntervenant(interv.couleur) : "#a8a29e";
                        const meta = statutCreneauMeta(normaliseStatutCreneau(slot.statut));
                        const absenceSlot = resumeAbsencesDuJour(
                          absencesParJour.get(iso) ?? [],
                          slot.intervenant_id,
                          slot.date,
                        );
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            draggable
                            onClick={() => onEdit(slot)}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", String(slot.id));
                              e.dataTransfer.effectAllowed = "move";
                              setEnDeplacement(slot.id);
                            }}
                            onDragEnd={() => {
                              setEnDeplacement(null);
                              setCaseSurvolee(null);
                            }}
                            title={`${slot.heure} · ${slot.libelle}${interv ? ` · ${interv.nom}` : " · Non affecté"} (${meta.label})`}
                            className={`w-full text-left flex items-start gap-1 px-1.5 py-1 rounded-md bg-background-100 border border-background-200 hover:border-primary-300 cursor-grab active:cursor-grabbing transition-colors ${
                              enDeplacement === slot.id ? "opacity-50" : ""
                            }`}
                            style={{ borderLeftWidth: 3, borderLeftColor: hex }}
                          >
                            <span className="text-[9px] font-bold text-foreground-700 shrink-0 tabular-nums">
                              {slot.heure.slice(0, 5)}
                            </span>
                            <span className="text-[10px] text-foreground-800 truncate leading-tight">{slot.libelle}</span>
                            {absenceSlot && (
                              <span className="ml-auto shrink-0">
                                <BadgeAbsenceIntervention
                                  absence={absenceSlot}
                                  nom={interv?.nom ?? null}
                                  dateISO={slot.date}
                                  compact
                                />
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {reste > 0 && (
                        <button
                          type="button"
                          onClick={() => setJourOuvert(iso)}
                          className="text-[10px] font-semibold text-primary-700 hover:underline cursor-pointer text-left px-1"
                        >
                          + {reste} autre{reste > 1 ? "s" : ""}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Détail du jour ouvert depuis le calendrier */}
      {jourOuvert && (
        <div className="rounded-lg bg-background-100 border border-background-200 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="font-heading font-semibold text-sm text-foreground-950">
                {formatDateLongue(jourOuvert)}
              </h3>
              <p className="text-[11px] text-foreground-500">
                {joursOuverts.length === 0
                  ? "Aucune intervention prévue ce jour."
                  : `${joursOuverts.length} intervention${joursOuverts.length > 1 ? "s" : ""} prévue${joursOuverts.length > 1 ? "s" : ""}`}
              </p>
              {(absencesParJour.get(jourOuvert) ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(absencesParJour.get(jourOuvert) ?? []).map((abs) => {
                    const intervAbs =
                      abs.intervenant_id !== null ? intervenantParId.get(abs.intervenant_id) : undefined;
                    return (
                      <span
                        key={abs.id}
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent-100 border border-accent-200 text-[10px] font-semibold text-accent-900 whitespace-nowrap"
                      >
                        <i className={iconeMotif(abs.motif)}></i>
                        {intervAbs?.nom ?? "Équipe"} · {abs.motif}{suffixePeriode(abs.periode)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onAddFor(jourOuvert)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-add-line"></i> Ajouter
              </button>
              <button
                type="button"
                onClick={() => setJourOuvert(null)}
                aria-label="Fermer le détail du jour"
                className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-800 hover:bg-background-200 cursor-pointer transition-colors"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          </div>

          {joursOuverts.length > 0 && (
            <div className="flex flex-col gap-2">
              {joursOuverts.map((slot) => {
                const interv = slot.intervenant_id !== null ? intervenantParId.get(slot.intervenant_id) : undefined;
                const meta = statutCreneauMeta(normaliseStatutCreneau(slot.statut));
                const absencesDuJourOuvert = absencesParJour.get(slot.date) ?? [];
                const absenceSlot = resumeAbsencesDuJour(absencesDuJourOuvert, slot.intervenant_id, slot.date);
                return (
                  <div
                    key={slot.id}
                    className="flex items-center gap-3 p-2.5 rounded-md bg-background-50 border border-background-200"
                  >
                    <span className="w-12 text-xs font-bold text-foreground-800 tabular-nums shrink-0">
                      {slot.heure.slice(0, 5)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-foreground-900 truncate">{slot.libelle}</p>
                        <span
                          className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${meta.tone}`}
                        >
                          <i className={meta.icon}></i>
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-foreground-500 inline-flex items-center gap-1">
                          <i className="ri-map-pin-line"></i>
                          {slot.ville || "Lieu à définir"}
                        </span>
                        {interv ? (
                          <span className="text-[10px] font-medium text-foreground-700 inline-flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: couleurIntervenant(interv.couleur) }}
                            />
                            {interv.nom}
                          </span>
                        ) : (
                          <span className="text-[10px] text-foreground-400 inline-flex items-center gap-1">
                            <i className="ri-user-unfollow-line"></i> Non affecté
                          </span>
                        )}
                        <BadgeAbsenceIntervention
                          absence={absenceSlot}
                          nom={interv?.nom ?? null}
                          dateISO={slot.date}
                          onProposerRemplacant={
                            onProposerRemplacant
                              ? () => onProposerRemplacant(slot, absenceSlot, interv?.nom ?? null)
                              : undefined
                          }
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit(slot)}
                      title="Modifier l'intervention"
                      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-background-100 hover:bg-background-200 hover:text-primary-700 cursor-pointer transition-colors"
                    >
                      <i className="ri-pencil-line text-foreground-500 text-[13px]"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(slot.id)}
                      title="Supprimer l'intervention"
                      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-background-100 hover:bg-background-200 hover:text-red-600 cursor-pointer transition-colors"
                    >
                      <i className="ri-delete-bin-line text-foreground-500 text-[13px]"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}