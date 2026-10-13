import { useState } from "react";
import Modal from "@/pages/app/components/Modal";
import type { Gestionnaire } from "@/hooks/useAuth";

const NOTE_MAX = 500;

/**
 * Édition de la note interne d'un gestionnaire : un texte plus long que le simple libellé,
 * destiné à préciser sa mission ou son contexte (ex. « Accès support uniquement, à contacter
 * pour les tickets de niveau 2. »). La note s'affiche dans la fiche de la ligne.
 */
export default function NoteGestionnaireModal({
  gestionnaire,
  onClose,
  onSave,
}: {
  gestionnaire: Gestionnaire;
  onClose: () => void;
  onSave: (note: string | null) => void;
}) {
  const [draft, setDraft] = useState(gestionnaire.note ?? "");

  const enregistrer = () => {
    const valeur = draft.trim();
    onSave(valeur || null);
  };

  return (
    <Modal
      title="Note interne"
      subtitle={gestionnaire.email}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-sm font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={enregistrer}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-save-line"></i>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-foreground-500 leading-relaxed">
          Une note visible par les gestionnaires, pour garder le contexte d'un accès (mission, périmètre, contacts…).
          Elle complète le libellé et reste affichée dans la liste.
        </p>
        <div className="rounded-md bg-background-50 border border-background-200 focus-within:border-primary-400 transition-colors">
          <textarea
            autoFocus
            value={draft}
            maxLength={NOTE_MAX}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            placeholder="Ex. Accès support de niveau 2 : gère les relances clients et les tickets escaladés."
            className="w-full resize-none bg-transparent p-3 text-sm text-foreground-800 outline-none placeholder:text-foreground-400"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-foreground-400">
              <i className="ri-information-line text-[10px]"></i>
              Visible par tous les gestionnaires
            </span>
            <span
              className={`text-[10px] ${draft.length >= NOTE_MAX ? "text-red-500 font-semibold" : "text-foreground-400"}`}
            >
              {draft.length} / {NOTE_MAX}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}