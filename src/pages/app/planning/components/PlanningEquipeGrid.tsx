import { Fragment } from "react";
import type { CreneauItem } from "@/hooks/useArtisanData";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { formatDayName } from "@/lib/dates";

interface Colonne {
  /** Identifiant de l'intervenant, ou null pour la colonne « non affecté ». */
  id: number | null;
  nom: string;
  metier: string | null;
  hex: string;
}

/**
 * Vue semaine « équipe » : une colonne par intervenant (plus une colonne « non affecté »),
 * une ligne par jour. Chaque case rassemble les interventions de la personne ce jour-là,
 * pour voir d'un coup d'œil qui fait quoi toute la semaine.
 *
 * En haut de chaque colonne, un indicateur de charge affiche le nombre d'interventions de la
 * semaine pour la personne : pratique pour repérer d'un regard qui est surchargé ou disponible.
 * Chaque intervention porte aussi un petit sélecteur qui permet de la réaffecter à quelqu'un
 * d'autre (ou de la désaffecter) en un clic, sans quitter la vue Équipe.
 */
export default function PlanningEquipeGrid({
  days,
  isoList,
  intervenants,
  intervenantsChoix,
  creneaux,
  onAddFor,
  onDelete,
  onReassign,
  inclureNonAffecte = true,
}: {
  days: Date[];
  isoList: string[];
  intervenants: Intervenant[];
  /** Toutes les personnes actives proposées au moment de réaffecter une intervention. */
  intervenantsChoix: Intervenant[];
  creneaux: CreneauItem[];
  onAddFor: (intervenantId: number | null, dateISO: string) => void;
  onDelete: (id: number) => void;
  onReassign: (creneauId: number, intervenantId: number | null) => void;
  /** Afficher la colonne « non affecté » (masquée quand on filtre sur une personne précise). */
  inclureNonAffecte?: boolean;
}) {
  const colonnes: Colonne[] = [
    ...intervenants.map((i) => ({ id: i.id, nom: i.nom, metier: i.metier, hex: couleurIntervenant(i.couleur) })),
  ];
  if (inclureNonAffecte) {
    colonnes.push({ id: null, nom: "Non affecté", metier: null, hex: "#a8a29e" });
  }

  // Regroupe les créneaux par couple (intervenant, date) pour remplir les cases.
  const parCase = new Map<string, CreneauItem[]>();
  // Charge de la semaine par intervenant, pour l'indicateur en haut de colonne.
  const charge = new Map<string, number>();
  creneaux.forEach((c) => {
    const key = `${c.intervenant_id ?? "none"}|${c.date}`;
    parCase.set(key, [...(parCase.get(key) ?? []), c]);
    const cle = String(c.intervenant_id ?? "none");
    charge.set(cle, (charge.get(cle) ?? 0) + 1);
  });
  parCase.forEach((list) => list.sort((a, b) => a.heure.localeCompare(b.heure)));

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div
        className="grid gap-2 min-w-[680px]"
        style={{ gridTemplateColumns: `112px repeat(${colonnes.length}, minmax(190px, 1fr))` }}
      >
        {/* En-tête : nom des intervenants + charge de la semaine */}
        <div />
        {colonnes.map((col) => {
          const nb = charge.get(String(col.id ?? "none")) ?? 0;
          return (
            <div key={col.id ?? "none"} className="flex flex-col gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: col.hex }} />
                <span className="text-sm font-semibold text-foreground-900 truncate">{col.nom}</span>
              </div>
              {col.metier && <span className="text-[11px] text-foreground-500 truncate">{col.metier}</span>}
              <span
                className={`inline-flex items-center gap-1.5 self-start h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                  nb === 0
                    ? "bg-background-200/70 text-foreground-400"
                    : nb >= 5
                      ? "bg-accent-100 text-accent-700"
                      : "bg-secondary-100 text-secondary-800"
                }`}
                title={nb === 0 ? "Aucune intervention cette semaine" : `${nb} intervention${nb > 1 ? "s" : ""} cette semaine`}
              >
                <i className={nb === 0 ? "ri-moon-line" : "ri-route-line"}></i>
                {nb} intervention{nb > 1 ? "s" : ""}
              </span>
            </div>
          );
        })}

        {/* Une ligne par jour */}
        {days.map((day, i) => {
          const iso = isoList[i];
          return (
            <Fragment key={iso}>
              <div className="flex flex-col justify-center gap-1 pr-1">
                <span className="text-xs font-semibold text-foreground-700 capitalize">{formatDayName(day).slice(0, 3)}</span>
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-background-200 text-sm font-bold text-foreground-800">
                  {day.getDate()}
                </span>
              </div>

              {colonnes.map((col) => {
                const slots = parCase.get(`${col.id ?? "none"}|${iso}`) ?? [];
                return (
                  <div
                    key={`${iso}-${col.id ?? "none"}`}
                    className="group flex flex-col gap-1.5 p-2 rounded-lg bg-background-50 border border-background-200 min-h-[64px]"
                  >
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex flex-col gap-1.5 p-2 rounded-md bg-background-100 border border-background-200"
                        style={{ borderLeftWidth: 3, borderLeftColor: col.hex }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold text-foreground-800 shrink-0">{slot.heure}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-foreground-900 truncate">{slot.libelle}</p>
                            {slot.ville && (
                              <p className="text-[10px] text-foreground-500 truncate inline-flex items-center gap-1">
                                <i className="ri-map-pin-line"></i>
                                {slot.ville}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onDelete(slot.id)}
                            title="Supprimer"
                            className="w-6 h-6 shrink-0 flex items-center justify-center rounded hover:bg-background-200 hover:text-red-600 cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            <i className="ri-close-line text-foreground-400"></i>
                          </button>
                        </div>

                        {/* Réaffectation en un clic : choisir une autre personne, ou désaffecter. */}
                        <div className="relative flex items-center gap-1.5 rounded-md bg-background-50 border border-background-200 px-1.5">
                          <i className="ri-shuffle-line text-[11px] text-secondary-600 shrink-0" aria-hidden></i>
                          <select
                            value={slot.intervenant_id === null ? "" : String(slot.intervenant_id)}
                            onChange={(e) => onReassign(slot.id, e.target.value ? Number(e.target.value) : null)}
                            title="Réaffecter cette intervention à une autre personne"
                            aria-label="Réaffecter cette intervention"
                            className="flex-1 h-6 bg-transparent text-[10px] text-foreground-600 outline-none cursor-pointer py-0 truncate"
                          >
                            <option value="">Non affecté</option>
                            {intervenantsChoix.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => onAddFor(col.id, iso)}
                      className="inline-flex items-center justify-center gap-1 h-7 rounded-md border border-dashed border-background-300 text-foreground-400 text-[11px] font-medium hover:border-primary-300 hover:text-primary-600 cursor-pointer transition-colors"
                    >
                      <i className="ri-add-line"></i> Ajouter
                    </button>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}