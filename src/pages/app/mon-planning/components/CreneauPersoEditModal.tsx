import { useState } from "react";
import { STATUTS_CRENEAU, statutCreneauMeta, type CreneauPerso, type StatutCreneau } from "@/lib/planningIntervenant";
import { formatDateLongue } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";

/**
 * Modale d'édition d'une intervention du planning personnel : heure, intitulé, statut
 * (confirmée / à confirmer / faite) et note libre. L'intervenant peut ainsi ajuster ses
 * informations ou signaler un imprévu (ex. « client absent »).
 */
export default function CreneauPersoEditModal({
  creneau,
  busy,
  onClose,
  onSubmit,
}: {
  creneau: CreneauPerso;
  busy: boolean;
  onClose: () => void;
  onSubmit: (patch: { heure: string; libelle: string; statut: StatutCreneau; note: string | null }) => void;
}) {
  const [heure, setHeure] = useState(creneau.heure);
  const [libelle, setLibelle] = useState(creneau.libelle);
  const [statut, setStatut] = useState<StatutCreneau>(creneau.statut);
  const [note, setNote] = useState(creneau.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!libelle.trim()) {
      setError("L'intitulé ne peut pas être vide.");
      return;
    }
    setError(null);
    onSubmit({ heure, libelle: libelle.trim(), statut, note: note.trim() || null });
  };

  return (
    <Modal
      title="Modifier l'intervention"
      subtitle={formatDateLongue(creneau.date)}
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
            <span className="text-xs font-medium text-foreground-700">Heure</span>
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={inputCls} />
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
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Intitulé de l'intervention</span>
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Note (optionnel)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Ex. « client absent, à reprogrammer »"
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 resize-none"
          />
          <span className="text-[10px] text-foreground-400 text-right">{note.length}/500</span>
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}