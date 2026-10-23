import { useEffect, useState } from "react";
import type { ChantierItem } from "@/hooks/useArtisanData";
import { addEtape, deleteChantier, deleteEtape, toggleEtape, updateChantierNote } from "@/lib/artisanApi";
import { chantierProgress } from "@/lib/chantiers";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { chantierStatusTone } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";
import StatutBadge from "@/pages/app/components/StatutBadge";
import SuiviClientPanel from "@/pages/app/chantiers/components/SuiviClientPanel";

export default function ChantierDetailModal({
  chantier,
  pilote,
  onClose,
  onReload,
  onDeleted,
}: {
  chantier: ChantierItem;
  /** Intervenant qui pilote le chantier, ou null si personne n'est désigné. */
  pilote: Intervenant | null;
  onClose: () => void;
  onReload: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [newEtape, setNewEtape] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Bloc note libre du chantier : suivi, points à retenir, consignes…
  const [note, setNote] = useState(chantier.note ?? "");
  const [noteSaved, setNoteSaved] = useState(false);

  const progress = chantierProgress(chantier);
  const doneCount = chantier.etapes.filter((e) => e.fait).length;

  // Resynchronise la note locale quand on change de chantier ou après un rechargement.
  useEffect(() => {
    setNote(chantier.note ?? "");
    setNoteSaved(false);
  }, [chantier.id, chantier.note]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      await onReload();
    } catch {
      setError("L'action a échoué. Réessayez.");
    }
  };

  const handleAdd = async () => {
    if (!newEtape.trim()) return;
    const label = newEtape.trim();
    setNewEtape("");
    await run(() => addEtape(chantier.id, label));
  };

  const handleDelete = async () => {
    await run(() => deleteChantier(chantier.id));
    onDeleted();
  };

  const handleSaveNote = async () => {
    setNoteSaved(false);
    await run(() => updateChantierNote(chantier.id, note));
    setNoteSaved(true);
  };

  return (
    <Modal
      title={chantier.libelle ?? "Chantier"}
      subtitle={`${chantier.clientNom ?? "Sans client"}${chantier.adresse ? ` · ${chantier.adresse}` : ""}`}
      onClose={onClose}
      wide
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <StatutBadge label={chantier.statut} tone={chantierStatusTone(chantier.statut)} />
        <div className="flex items-center gap-3 text-xs text-foreground-500">
          {chantier.date_debut && (
            <span className="inline-flex items-center gap-1">
              <i className="ri-calendar-line"></i> Début {formatShortDate(chantier.date_debut)}
            </span>
          )}
          <span className="font-semibold text-foreground-950 text-sm">{formatEuros(chantier.montant)}</span>
        </div>
      </div>

      <div className="mb-4">
        {pilote ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: couleurIntervenant(pilote.couleur) }} />
            Pilote : {pilote.nom}
            {pilote.metier ? <span className="font-normal text-secondary-700">· {pilote.metier}</span> : null}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground-400">
            <i className="ri-user-star-line"></i> Aucun pilote désigné pour ce chantier
          </span>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-foreground-500">Avancement ({doneCount}/{chantier.etapes.length} étapes)</span>
          <span className="font-semibold text-foreground-900">{progress} %</span>
        </div>
        <div className="h-2 rounded-full bg-background-200 overflow-hidden">
          <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          value={newEtape}
          onChange={(e) => setNewEtape(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Ajouter une étape…"
          className="flex-1 h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap"
        >
          <i className="ri-add-line"></i> Ajouter
        </button>
      </div>

      {chantier.etapes.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground-500">Aucune étape pour ce chantier. Ajoutez-en une ci-dessus.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {chantier.etapes.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3 rounded-md bg-background-100 border border-background-200">
              <button
                type="button"
                onClick={() => run(() => toggleEtape(e.id, !e.fait))}
                className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-sm cursor-pointer ${
                  e.fait ? "bg-primary-500 text-background-50" : "bg-background-200 text-foreground-400"
                }`}
              >
                <i className={e.fait ? "ri-check-line" : "ri-circle-line"}></i>
              </button>
              <span className={`flex-1 text-sm ${e.fait ? "text-foreground-500 line-through" : "text-foreground-800"}`}>{e.libelle}</span>
              <button
                type="button"
                onClick={() => run(() => deleteEtape(e.id))}
                className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer"
                aria-label="Supprimer l'étape"
              >
                <i className="ri-delete-bin-line"></i>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 p-3.5 rounded-lg bg-background-50 border border-background-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-7 h-7 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-sticky-note-line text-sm"></i>
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-900">Note du chantier</p>
            <p className="text-[11px] text-foreground-500">Consignes, points de suivi, matériaux à prévoir…</p>
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteSaved(false);
          }}
          rows={3}
          placeholder="Ex. : Prévoir l'échelle pour la toiture. Client absent l'après-midi."
          className="w-full px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
        />
        <div className="flex items-center justify-end gap-3 mt-2">
          {noteSaved && (
            <span className="text-[11px] text-accent-700 inline-flex items-center gap-1">
              <i className="ri-checkbox-circle-line"></i>
              Note enregistrée.
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveNote}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap transition-colors"
          >
            <i className="ri-save-line"></i> Enregistrer la note
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <SuiviClientPanel chantier={chantier} onReload={onReload} />

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-background-200">
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-delete-bin-line"></i> Supprimer le chantier
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
        >
          Fermer
        </button>
      </div>
    </Modal>
  );
}