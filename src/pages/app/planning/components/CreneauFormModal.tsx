import { useState } from "react";
import type { ChantierItem } from "@/hooks/useArtisanData";
import type { CreneauPayload } from "@/lib/artisanApi";
import type { Intervenant } from "@/lib/intervenants";
import { formatShortDate } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";

export default function CreneauFormModal({
  defaultDate,
  defaultIntervenantId = null,
  chantiers,
  intervenants,
  busy,
  onClose,
  onSubmit,
}: {
  defaultDate: string;
  /** Intervenant pré-sélectionné (quand on ajoute depuis la colonne d'une personne). */
  defaultIntervenantId?: number | null;
  chantiers: ChantierItem[];
  /** Intervenants actifs proposés à l'affectation. */
  intervenants: Intervenant[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: CreneauPayload) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [heure, setHeure] = useState("08:00");
  const [libelle, setLibelle] = useState("");
  const [ville, setVille] = useState("");
  const [chantierId, setChantierId] = useState("");
  const [intervenantId, setIntervenantId] = useState(defaultIntervenantId ? String(defaultIntervenantId) : "");
  const [statut, setStatut] = useState("confirmee");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inputCls = "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!libelle.trim()) {
      setError("Donnez un intitulé à l'intervention.");
      return;
    }
    setError(null);
    onSubmit({
      date,
      heure,
      libelle: libelle.trim(),
      ville: ville.trim(),
      chantier_id: chantierId ? Number(chantierId) : null,
      intervenant_id: intervenantId ? Number(intervenantId) : null,
      statut,
      note: note.trim() || null,
    });
  };

  return (
    <Modal
      title="Ajouter un créneau"
      subtitle={`Le ${formatShortDate(date)}`}
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
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-add-line"></i>}
            Ajouter
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
          <span className="text-xs font-medium text-foreground-700">Intitulé de l'intervention</span>
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Dépannage · M. Petit" className={inputCls} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Ville</span>
            <input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Lyon 3e" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Intervenant (optionnel)</span>
            <select value={intervenantId} onChange={(e) => setIntervenantId(e.target.value)} className={`${inputCls} cursor-pointer`}>
              <option value="">Non affecté</option>
              {intervenants.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nom}
                  {i.metier ? ` · ${i.metier}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Chantier (optionnel)</span>
          <select value={chantierId} onChange={(e) => setChantierId(e.target.value)} className={`${inputCls} cursor-pointer`}>
            <option value="">Aucun</option>
            {chantiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle ?? "Chantier"}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Statut</span>
            <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} cursor-pointer`}>
              <option value="confirmee">Confirmée</option>
              <option value="provisoire">À confirmer</option>
              <option value="faite">Faite</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Note (optionnel)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. prévoir une nacelle" className={inputCls} />
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}