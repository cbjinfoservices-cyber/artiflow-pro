import { useState } from "react";
import Modal from "@/pages/app/components/Modal";
import type { Intervenant } from "@/lib/intervenants";
import { STATUTS_CRENEAU, normaliseStatutCreneau, statutCreneauMeta, type StatutCreneau } from "@/lib/planningIntervenant";

/** Champs modifiables en édition rapide depuis le planning d'équipe. */
export interface CreneauEditionPatch {
  date: string;
  heure: string;
  libelle: string;
  ville: string | null;
  statut: StatutCreneau;
  intervenant_id: number | null;
  note: string | null;
}

/**
 * Édition rapide d'une intervention depuis le planning : date, heure, intervenant, statut,
 * intitulé et lieu. Sert au clic sur une intervention de la vue Équipe (le glisser-déposer
 * reste le geste le plus rapide, cette fenêtre couvre les ajustements fins et le mobile).
 */
export default function CreneauQuickEditModal({
  creneau,
  intervenants,
  busy,
  onClose,
  onSubmit,
}: {
  creneau: {
    id: number;
    date: string;
    heure: string;
    libelle: string;
    ville: string | null;
    statut?: string;
    intervenant_id: number | null;
    note?: string | null;
  };
  intervenants: Intervenant[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (patch: CreneauEditionPatch) => void;
}) {
  const [date, setDate] = useState(creneau.date);
  const [heure, setHeure] = useState(creneau.heure);
  const [libelle, setLibelle] = useState(creneau.libelle);
  const [ville, setVille] = useState(creneau.ville ?? "");
  const [statut, setStatut] = useState<StatutCreneau>(normaliseStatutCreneau(creneau.statut));
  const [intervenantId, setIntervenantId] = useState(
    creneau.intervenant_id === null ? "" : String(creneau.intervenant_id),
  );
  const [note, setNote] = useState(creneau.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!libelle.trim()) {
      setError("L'intitulé ne peut pas être vide.");
      return;
    }
    if (!date) {
      setError("Choisissez une date.");
      return;
    }
    setError(null);
    onSubmit({
      date,
      heure: heure || "08:00",
      libelle: libelle.trim(),
      ville: ville.trim() || null,
      statut,
      intervenant_id: intervenantId ? Number(intervenantId) : null,
      note: note.trim() || null,
    });
  };

  return (
    <Modal
      title="Modifier l'intervention"
      subtitle="Déplacez-la dans le temps ou changez d'intervenant"
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
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Heure</span>
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Intitulé</span>
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} className={inputCls} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Intervenant</span>
            <select
              value={intervenantId}
              onChange={(e) => setIntervenantId(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Non affecté</option>
              {intervenants.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nom}
                  {i.metier ? ` · ${i.metier}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Statut</span>
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutCreneau)}
              className={`${inputCls} cursor-pointer`}
            >
              {STATUTS_CRENEAU.map((s) => (
                <option key={s} value={s}>
                  {statutCreneauMeta(s).label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Ville</span>
            <input value={ville} onChange={(e) => setVille(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}