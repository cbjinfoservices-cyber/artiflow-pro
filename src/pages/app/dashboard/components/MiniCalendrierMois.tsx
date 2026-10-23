import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CreneauItem } from "@/hooks/useArtisanData";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import type { Indisponibilite } from "@/lib/indisponibilites";
import {
  addDays,
  formatDateLongue,
  formatDayName,
  formatMonth,
  startOfWeek,
  toISODate,
} from "@/lib/dates";

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Mini-calendrier du mois sur le tableau de bord : une case par jour avec le nombre
 * d'interventions, et le détail du jour sélectionné à côté. Permet de voir la charge du
 * mois et de savoir qui travaille où, sans quitter le tableau de bord.
 */
export default function MiniCalendrierMois({
  creneaux,
  indisponibilites = [],
  intervenants = [],
}: {
  creneaux: CreneauItem[];
  indisponibilites?: Indisponibilite[];
  intervenants?: Intervenant[];
}) {
  const [offset, setOffset] = useState(0);
  const [jourOuvert, setJourOuvert] = useState<string | null>(null);

  const base = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + offset, 1);
  }, [offset]);

  const { cases, cleMois } = useMemo(() => {
    const debut = startOfWeek(base);
    const dernier = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const indexFin = (dernier.getDay() + 6) % 7;
    const fin = addDays(dernier, 6 - indexFin);
    const liste: Date[] = [];
    for (let d = debut; d.getTime() <= fin.getTime(); d = addDays(d, 1)) liste.push(d);
    return { cases: liste, cleMois: `${base.getFullYear()}-${base.getMonth()}` };
  }, [base]);

  const dansMois = (d: Date) => `${d.getFullYear()}-${d.getMonth()}` === cleMois;

  const parJour = useMemo(() => {
    const map = new Map<string, CreneauItem[]>();
    creneaux.forEach((c) => map.set(c.date, [...(map.get(c.date) ?? []), c]));
    map.forEach((liste) => liste.sort((a, b) => a.heure.localeCompare(b.heure)));
    return map;
  }, [creneaux]);

  const absencesParJour = useMemo(() => {
    const map = new Map<string, Indisponibilite[]>();
    indisponibilites.forEach((i) => map.set(i.date, [...(map.get(i.date) ?? []), i]));
    return map;
  }, [indisponibilites]);

  const intervenantParId = useMemo(() => {
    const map = new Map<number, Intervenant>();
    intervenants.forEach((i) => map.set(i.id, i));
    return map;
  }, [intervenants]);

  const aujourdHui = toISODate(new Date());
  const totalMois = creneaux.filter((c) => {
    const d = new Date(`${c.date}T00:00:00`);
    return !Number.isNaN(d.getTime()) && dansMois(d);
  }).length;

  // Par défaut, on montre le détail du jour le plus proche : aujourd'hui si on est sur le
  // mois en cours, sinon le premier jour du mois affiché.
  const jourAffiche = jourOuvert ?? (offset === 0 ? aujourdHui : toISODate(base));
  const slotsJour = parJour.get(jourAffiche) ?? [];
  const absencesJour = absencesParJour.get(jourAffiche) ?? [];

  const toneCase = (nb: number) => {
    if (nb === 0) return "bg-background-100 text-foreground-400 border-background-200";
    if (nb >= 5) return "bg-accent-100 text-accent-900 border-accent-200";
    if (nb >= 3) return "bg-primary-100 text-primary-900 border-primary-200";
    return "bg-secondary-100 text-secondary-900 border-secondary-200";
  };

  return (
    <div className="rounded-lg bg-background-50 border border-background-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-sm text-foreground-950">Planning du mois</h3>
          <p className="text-[11px] text-foreground-500 mt-0.5">
            {totalMois === 0
              ? "Aucune intervention planifiée sur ce mois."
              : `${totalMois} intervention${totalMois > 1 ? "s" : ""} sur ${formatMonth(base).toLowerCase()}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setOffset((o) => o - 1);
              setJourOuvert(null);
            }}
            aria-label="Mois précédent"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer transition-colors"
          >
            <i className="ri-arrow-left-s-line text-foreground-700"></i>
          </button>
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              setJourOuvert(aujourdHui);
            }}
            title="Revenir au mois en cours"
            className={`h-8 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              offset === 0
                ? "bg-background-100 border border-background-200 text-foreground-700"
                : "bg-secondary-100 text-secondary-900 hover:bg-secondary-200"
            }`}
          >
            {formatMonth(base)}
          </button>
          <button
            type="button"
            onClick={() => {
              setOffset((o) => o + 1);
              setJourOuvert(null);
            }}
            aria-label="Mois suivant"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer transition-colors"
          >
            <i className="ri-arrow-right-s-line text-foreground-700"></i>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[296px_1fr] gap-5 mt-4">
        {/* Grille du mois */}
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {JOURS.map((j, i) => (
              <span
                key={`${j}-${i}`}
                className="text-[10px] font-semibold text-foreground-400 text-center uppercase"
              >
                {j}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cases.map((jour) => {
              const iso = toISODate(jour);
              const nb = (parJour.get(iso) ?? []).length;
              const abs = (absencesParJour.get(iso) ?? []).length;
              const horsMois = !dansMois(jour);
              const estAujourdHui = iso === aujourdHui;
              const selectionne = iso === jourAffiche;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setJourOuvert(iso)}
                  title={`${formatDateLongue(iso)} : ${nb} intervention${nb > 1 ? "s" : ""}${
                    abs ? ` · ${abs} absence${abs > 1 ? "s" : ""}` : ""
                  }`}
                  aria-pressed={selectionne}
                  className={`relative aspect-square flex flex-col items-center justify-center rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                    horsMois ? "opacity-40 " : ""
                  }${
                    selectionne
                      ? "bg-foreground-900 text-background-50 border-foreground-900"
                      : estAujourdHui
                        ? "bg-primary-500 text-background-50 border-primary-500"
                        : toneCase(nb)
                  }`}
                >
                  <span>{jour.getDate()}</span>
                  {nb > 0 && (
                    <span
                      className={`text-[9px] font-bold leading-none mt-0.5 ${
                        selectionne || estAujourdHui ? "text-background-50/85" : "opacity-80"
                      }`}
                    >
                      {nb}
                    </span>
                  )}
                  {abs > 0 && !selectionne && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent-500" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap text-[10px] text-foreground-500 mt-2.5">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary-500" /> 1-2
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary-500" /> 3-4
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent-500" /> 5 et +
            </span>
          </div>
        </div>

        {/* Détail du jour sélectionné */}
        <div className="flex flex-col rounded-md bg-background-100 border border-background-200 p-3.5 min-h-[168px]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground-900 truncate">
                {formatDayName(new Date(`${jourAffiche}T00:00:00`))} {formatDateLongue(jourAffiche)}
              </p>
              <p className="text-[11px] text-foreground-500">
                {slotsJour.length === 0
                  ? "Aucune intervention."
                  : `${slotsJour.length} intervention${slotsJour.length > 1 ? "s" : ""} ce jour`}
              </p>
            </div>
            <Link
              to="/app/planning?vue=mois"
              className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors"
            >
              <i className="ri-calendar-line"></i> Ouvrir
            </Link>
          </div>

          {slotsJour.length === 0 && absencesJour.length === 0 ? (
            <p className="text-[11px] text-foreground-400 mt-3">
              Journée libre : rien n'est planifié, vous pouvez y poser une intervention.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 mt-3">
              {absencesJour.map((abs) => {
                const interv = abs.intervenant_id !== null ? intervenantParId.get(abs.intervenant_id) : undefined;
                return (
                  <div
                    key={`abs-${abs.id}`}
                    className="flex items-center gap-2 px-2 py-1 rounded-md bg-accent-100 border border-accent-200"
                  >
                    <i className="ri-suitcase-line text-accent-700 text-[11px]"></i>
                    <span className="text-[11px] font-semibold text-accent-900 truncate">
                      {interv?.nom ?? "Équipe"} · {abs.motif}
                    </span>
                  </div>
                );
              })}
              {slotsJour.map((slot) => {
                const interv = slot.intervenant_id !== null ? intervenantParId.get(slot.intervenant_id) : undefined;
                return (
                  <div key={slot.id} className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold text-foreground-800 tabular-nums shrink-0 w-11">
                      {slot.heure.slice(0, 5)}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: interv ? couleurIntervenant(interv.couleur) : "#a8a29e" }}
                    />
                    <span className="text-[11px] text-foreground-700 truncate">{slot.libelle}</span>
                    {interv && <span className="text-[10px] text-foreground-400 truncate">{interv.nom}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}