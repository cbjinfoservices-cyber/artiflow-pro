import { statutCreneauMeta, type CreneauPerso } from "@/lib/planningIntervenant";
import type { AbsenceJourResume } from "@/lib/indisponibilites";
import BadgeAbsenceIntervention from "@/components/feature/BadgeAbsenceIntervention";
import {
  dureeMinutes,
  etatPointage,
  formatDuree,
  formatHeurePointage,
  type EtatPointage,
  type Pointage,
} from "@/lib/pointage";
import type { PvStatut } from "@/lib/pvRecette";

/**
 * Carte d'une intervention du planning personnel : heure, intitulé, lieu, statut, note,
 * et actions rapides — pointage (arrivée / départ), PV de recette, « marquer faite » et
 * « modifier ». Un liseré accentué signale une intervention modifiée récemment.
 */
export default function CreneauPersoCard({
  creneau,
  recent,
  busy,
  pointage,
  pvStatut,
  absence = null,
  onToggleFait,
  onEdit,
  onPointer,
  onPv,
}: {
  creneau: CreneauPerso;
  /** Intervention modifiée récemment : à surligner. */
  recent: boolean;
  busy: boolean;
  /** Pointage déjà enregistré pour cette intervention, ou null. */
  pointage: Pointage | null;
  /** Statut du PV de recette, s'il existe déjà. */
  pvStatut: PvStatut | null;
  /** Absence de l'intervenant ce jour-là (congé…), pour signaler le conflit. */
  absence?: AbsenceJourResume | null;
  onToggleFait: (creneau: CreneauPerso) => void;
  onEdit: (creneau: CreneauPerso) => void;
  onPointer: (creneau: CreneauPerso) => void;
  onPv: (creneau: CreneauPerso) => void;
}) {
  const statut = statutCreneauMeta(creneau.statut);
  const estFaite = creneau.statut === "faite";
  const etat: EtatPointage = etatPointage(pointage);
  const minutes = dureeMinutes(pointage);

  const pointageChip =
    etat === "en-cours"
      ? { label: `En cours · ${formatDuree(minutes)}`, icon: "ri-timer-flash-line", tone: "bg-accent-100 text-accent-800" }
      : etat === "termine"
        ? {
            label: `${formatHeurePointage(pointage?.arrivee_le)} → ${formatHeurePointage(pointage?.depart_le)} · ${formatDuree(minutes)}`,
            icon: "ri-checkbox-circle-line",
            tone: "bg-secondary-100 text-secondary-900",
          }
        : { label: "Pointer", icon: "ri-login-box-line", tone: "bg-background-100 border border-background-200 text-foreground-600" };

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-md bg-background-50 border transition-colors ${
        recent ? "border-accent-300 ring-1 ring-accent-200" : "border-background-200"
      }`}
    >
      <span className="w-14 text-sm font-bold text-foreground-800 pt-0.5 tabular-nums">{creneau.heure}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${estFaite ? "text-foreground-500 line-through" : "text-foreground-900"}`}>
            {creneau.libelle}
          </p>
          <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${statut.tone}`}>
            <i className={statut.icon}></i>
            {statut.label}
          </span>
          {absence && <BadgeAbsenceIntervention absence={absence} nom={null} dateISO={creneau.date} />}
          {pvStatut === "valide" && (
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold whitespace-nowrap">
              <i className="ri-shield-check-line"></i>
              PV signé
            </span>
          )}
          {pvStatut === "brouillon" && (
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap">
              <i className="ri-draft-line"></i>
              PV brouillon
            </span>
          )}
          {recent && (
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
              <i className="ri-flashlight-line"></i>
              Modifié
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-map-pin-line"></i>
            {creneau.ville || "Lieu à définir"}
          </span>
        </div>

        {creneau.note && (
          <p className="mt-1.5 text-[11px] text-foreground-600 bg-background-100 border border-background-200 rounded-md px-2 py-1 inline-flex items-start gap-1.5">
            <i className="ri-sticky-note-line mt-0.5"></i>
            <span>{creneau.note}</span>
          </p>
        )}

        {/* Pointage + PV de recette : les deux gestes terrain de l'intervention. */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onPointer(creneau)}
            title="Pointer mon arrivée / mon départ sur cette intervention"
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors hover:brightness-95 ${pointageChip.tone}`}
          >
            <i className={pointageChip.icon}></i>
            {pointageChip.label}
          </button>
          <button
            type="button"
            onClick={() => onPv(creneau)}
            title="Remplir le PV de recette (photos, conformité, signature client)"
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              pvStatut
                ? "bg-background-100 border border-background-200 text-foreground-700 hover:bg-background-200"
                : "bg-background-100 border border-dashed border-background-300 text-foreground-500 hover:border-primary-300 hover:text-primary-700"
            }`}
          >
            <i className="ri-file-shield-2-line"></i>
            {pvStatut ? "Voir le PV" : "PV de recette"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onToggleFait(creneau)}
          disabled={busy}
          title={estFaite ? "Marquer comme à refaire" : "Marquer comme faite"}
          className={`w-8 h-8 flex items-center justify-center rounded-md cursor-pointer transition-colors disabled:opacity-50 ${
            estFaite
              ? "bg-secondary-100 text-secondary-800 hover:bg-secondary-200"
              : "bg-background-100 border border-background-200 text-foreground-500 hover:bg-background-200"
          }`}
        >
          <i className={estFaite ? "ri-arrow-go-back-line" : "ri-check-line"}></i>
        </button>
        <button
          type="button"
          onClick={() => onEdit(creneau)}
          title="Modifier l'heure, l'intitulé ou ajouter une note"
          className="w-8 h-8 flex items-center justify-center rounded-md bg-background-100 border border-background-200 text-foreground-500 hover:bg-background-200 cursor-pointer transition-colors"
        >
          <i className="ri-pencil-line"></i>
        </button>
      </div>
    </div>
  );
}