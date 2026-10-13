import type { RelanceItem } from "@/hooks/useArtisanData";
import { canalIcon } from "@/lib/statuts";
import { formatShortDate } from "@/lib/dates";
import { joursDeRetard } from "@/lib/relances";

interface Props {
  relance: RelanceItem;
  /** Seuil de reprogrammations avant escalade automatique. */
  seuil: number;
  /** Décalage courant (jours) des reports. */
  decalage: number;
  /** Relances automatiques globalement actives ou non. */
  auto: boolean;
  /** Relance en retard (date prévue dépassée). */
  isLate: boolean;
  // Édition de la date.
  editingDateId: number | null;
  tempDate: string;
  savingDate: boolean;
  // Actions asynchrones en cours.
  duplicatingId: number | null;
  sendingId: number | null;
  onOpenDateEditor: (id: number, current: string | null) => void;
  onTempDateChange: (value: string) => void;
  onSaveDate: () => void;
  onCancelDate: () => void;
  onOpenDuplicate: (r: RelanceItem) => void;
  onOpenHistory: (id: number) => void;
  onSend: (r: RelanceItem) => void;
  onToggle: (id: number, actif: boolean) => void;
  onDelete: (id: number) => void;
}

/**
 * Carte d'une relance : statut, canal, date, reprogrammations, et actions
 * (reprogrammer la date, dupliquer, envoyer, activer/pause, supprimer).
 */
export default function RelanceCard({
  relance: r,
  seuil,
  decalage,
  auto,
  isLate,
  editingDateId,
  tempDate,
  savingDate,
  duplicatingId,
  sendingId,
  onOpenDateEditor,
  onTempDateChange,
  onSaveDate,
  onCancelDate,
  onOpenDuplicate,
  onOpenHistory,
  onSend,
  onToggle,
  onDelete,
}: Props) {
  const daysLate = joursDeRetard(r.date_prevue);

  return (
    <div
      className={`p-4 rounded-lg bg-background-100 border transition-colors ${
        r.actif && auto ? "border-background-200" : "border-background-200 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-lg bg-primary-100 text-primary-700">
            <i className={canalIcon(r.canal)}></i>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground-950">{r.clientNom ?? "Client"}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 font-medium">
                {r.devisNumero ?? "—"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 font-medium">
                {r.canal}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  r.statut === "Envoyée" ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"
                }`}
              >
                {r.statut}
              </span>
              {r.escaladeAuto && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 bg-accent-100 text-accent-700"
                  title="Relance partie automatiquement"
                >
                  <i className="ri-flashlight-line"></i>
                  Renvoi auto
                </span>
              )}
              {r.reprogrammations > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                    r.reprogrammations >= seuil ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"
                  }`}
                  title="Nombre de fois où cette relance a été reportée"
                >
                  <i className="ri-loop-right-line"></i>
                  Reportée {r.reprogrammations}×
                </span>
              )}
            </div>
            <p className="text-sm text-foreground-600 mt-1.5">{r.message ?? "—"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p
                className={`text-[11px] inline-flex items-center gap-1 ${
                  isLate ? "text-primary-700 font-semibold" : "text-foreground-400"
                }`}
              >
                <i className={isLate ? "ri-alarm-warning-line" : "ri-time-line"}></i>
                {r.date_prevue ? formatShortDate(r.date_prevue) : "Sans date"}
                {isLate && (
                  <span className="ml-1">
                    · en retard{daysLate > 0 ? ` de ${daysLate} j` : ""}
                  </span>
                )}
              </p>
              {r.escaladeAuto && r.escaladeLe && (
                <span className="text-[11px] inline-flex items-center gap-1 text-accent-700 font-medium">
                  <i className="ri-send-plane-line"></i>
                  Envoyée le {formatShortDate(r.escaladeLe)}
                </span>
              )}
              {editingDateId !== r.id && (
                <button
                  type="button"
                  onClick={() => onOpenDateEditor(r.id, r.date_prevue)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground-500 hover:text-primary-700 cursor-pointer whitespace-nowrap"
                  title="Changer la date d'envoi"
                >
                  <i className="ri-calendar-line"></i>
                  Changer la date
                </button>
              )}
              {r.reprogrammations > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenHistory(r.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground-500 hover:text-primary-700 cursor-pointer whitespace-nowrap"
                  title="Voir l'historique des reports de cette relance"
                >
                  <i className="ri-history-line"></i>
                  Historique ({r.reprogrammations})
                </button>
              )}
            </div>
            {editingDateId === r.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={tempDate}
                  onChange={(e) => onTempDateChange(e.target.value)}
                  className="h-9 px-2 rounded-md bg-background-50 border border-background-300 text-xs text-foreground-800 outline-none focus:border-primary-400 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={onSaveDate}
                  disabled={savingDate}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
                >
                  {savingDate ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={onCancelDate}
                  className="h-9 px-3 rounded-md text-xs font-medium text-foreground-500 hover:bg-background-200 cursor-pointer whitespace-nowrap"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLate && (
            <button
              type="button"
              onClick={() => onOpenDuplicate(r)}
              disabled={duplicatingId === r.id}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-100 text-primary-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-200 transition-colors disabled:opacity-60"
              title="Dupliquer cette relance avec une nouvelle date (choix du canal)"
            >
              {duplicatingId === r.id ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-copy-line"></i>}
              Dupliquer +{decalage}j
            </button>
          )}
          {r.statut !== "Envoyée" && (
            <button
              type="button"
              onClick={() => onSend(r)}
              disabled={sendingId === r.id}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-accent-100 text-accent-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-60"
              aria-label={`Envoyer la relance ${r.canal}`}
              title={`Envoyer la relance maintenant (${r.canal})`}
            >
              {sendingId === r.id ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
              Envoyer
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggle(r.id, r.actif)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${r.actif ? "bg-primary-500" : "bg-background-300"}`}
            aria-label="Activer la relance"
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-background-50 transition-all ${r.actif ? "left-6" : "left-1"}`}></span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(r.id)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer"
            aria-label="Supprimer la relance"
          >
            <i className="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    </div>
  );
}