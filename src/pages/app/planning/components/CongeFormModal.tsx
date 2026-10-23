import { useState } from "react";
import type { Intervenant } from "@/lib/intervenants";
import { MOTIFS_INDISPONIBILITE, type PeriodeAbsence } from "@/lib/indisponibilites";
import { formatShortDate } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";

export interface CongePayload {
  intervenantId: number;
  dateDebut: string;
  dateFin: string;
  motif: string;
  note: string | null;
  /** Journée entière, matin ou après-midi. */
  periode: PeriodeAbsence;
}

/** Absence existante reprise dans la fenêtre quand on la modifie. */
export interface CongeInitial {
  intervenantId: number;
  dateDebut: string;
  dateFin: string;
  motif: string;
  note: string | null;
  periode: PeriodeAbsence;
}

/** Choix de portion de journée proposés dans la fenêtre. */
const PERIODES: { cle: PeriodeAbsence; label: string; icon: string }[] = [
  { cle: "journee", label: "Journée entière", icon: "ri-calendar-2-line" },
  { cle: "matin", label: "Matin", icon: "ri-sun-line" },
  { cle: "apres-midi", label: "Après-midi", icon: "ri-sun-cloudy-line" },
];

/**
 * Fenêtre « Poser un congé » : on choisit la personne, la période et le motif.
 * L'absence apparaît ensuite dans le calendrier du mois, sur chaque jour concerné.
 */
export default function CongeFormModal({
  intervenants,
  defaultDate,
  defaultIntervenantId = null,
  initial = null,
  busy,
  onClose,
  onSubmit,
}: {
  intervenants: Intervenant[];
  defaultDate: string;
  defaultIntervenantId?: number | null;
  /** Absence à modifier : pré-remplit la fenêtre et change les libellés. */
  initial?: CongeInitial | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: CongePayload) => void;
}) {
  const edition = initial !== null;
  const [intervenantId, setIntervenantId] = useState(
    initial
      ? String(initial.intervenantId)
      : defaultIntervenantId
        ? String(defaultIntervenantId)
        : intervenants[0]
          ? String(intervenants[0].id)
          : "",
  );
  const [motif, setMotif] = useState(initial?.motif ?? MOTIFS_INDISPONIBILITE[0].label);
  const [dateDebut, setDateDebut] = useState(initial?.dateDebut ?? defaultDate);
  const [dateFin, setDateFin] = useState(initial?.dateFin ?? defaultDate);
  const [periode, setPeriode] = useState<PeriodeAbsence>(initial?.periode ?? "journee");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const demiJournee = periode !== "journee";

  const inputCls =
    "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!intervenantId) {
      setError("Choisissez la personne concernée.");
      return;
    }
    if (!dateDebut || !dateFin) {
      setError("Indiquez la période de l'absence.");
      return;
    }
    if (dateFin < dateDebut) {
      setError("La date de fin doit être postérieure au début.");
      return;
    }
    if (intervenants.length === 0) {
      setError("Ajoutez d'abord un intervenant à votre équipe.");
      return;
    }
    setError(null);
    onSubmit({
      intervenantId: Number(intervenantId),
      dateDebut,
      dateFin: demiJournee ? dateDebut : dateFin,
      motif,
      note: note.trim() || null,
      periode,
    });
  };

  return (
    <Modal
      title={edition ? "Modifier l'absence" : "Poser un congé"}
      subtitle={
        edition
          ? "Ajustez la personne, le motif, la période ou la demi-journée : l'absence est remplacée d'un coup."
          : "L'absence s'affichera dans le calendrier du mois, jour par jour."
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className={edition ? "ri-save-line" : "ri-calendar-check-line"}></i>}
            {edition ? "Enregistrer les modifications" : "Poser l'absence"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Personne concernée</span>
          <select
            value={intervenantId}
            onChange={(e) => setIntervenantId(e.target.value)}
            className={`${inputCls} cursor-pointer`}
          >
            {intervenants.length === 0 && <option value="">Aucun intervenant</option>}
            {intervenants.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nom}
                {i.metier ? ` · ${i.metier}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-xs font-medium text-foreground-700">Motif</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {MOTIFS_INDISPONIBILITE.map((m) => (
              <button
                key={m.cle}
                type="button"
                onClick={() => setMotif(m.label)}
                aria-pressed={motif === m.label}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  motif === m.label
                    ? "bg-accent-500 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className={m.icon}></i>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">{demiJournee ? "Date" : "Du"}</span>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => {
                setDateDebut(e.target.value);
                if (dateFin < e.target.value) setDateFin(e.target.value);
              }}
              className={inputCls}
            />
          </label>
          {!demiJournee && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Au</span>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputCls} />
            </label>
          )}
        </div>

        <div>
          <span className="text-xs font-medium text-foreground-700">Durée</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {PERIODES.map((p) => {
              const actif = periode === p.cle;
              return (
                <button
                  key={p.cle}
                  type="button"
                  onClick={() => {
                    setPeriode(p.cle);
                    if (p.cle !== "journee") setDateFin(dateDebut);
                  }}
                  aria-pressed={actif}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-primary-500 text-background-50"
                      : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  <i className={p.icon}></i>
                  {p.label}
                </button>
              );
            })}
          </div>
          {demiJournee && (
            <p className="mt-1.5 text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-information-line"></i>
              Une demi-journée se pose sur une seule date et ne décompte que 0,5 jour de congé.
            </p>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Précision (optionnel)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. congés payés, retour le 20"
            className={inputCls}
          />
        </label>

        <p className="text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
          <i className="ri-information-line mt-0.5"></i>
          Du {formatShortDate(dateDebut)}
          {demiJournee ? ` (${periode === "matin" ? "matin" : "après-midi"})` : ` au ${formatShortDate(dateFin)}`} —
          l'absence sera visible sur toutes les vues du planning et dans le PDF à afficher à l'atelier.
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}