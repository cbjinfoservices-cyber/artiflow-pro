import { useState } from "react";
import type { ClientItem } from "@/hooks/useArtisanData";
import Modal from "@/pages/app/components/Modal";
import { updateClientNotes } from "@/lib/artisanApi";
import { NOTE_PRIORITES } from "@/lib/notePriorites";

/**
 * Édition rapide des notes internes d'un client, directement depuis la liste,
 * sans ouvrir la fiche détail complète. Permet aussi de définir une priorité
 * (à relancer, sensible, urgent, info) affichée en couleur sur la carte.
 */
export default function QuickNoteModal({
  client,
  onClose,
  onSaved,
}: {
  client: ClientItem;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [notes, setNotes] = useState(client.notes ?? "");
  const [priorite, setPriorite] = useState(client.note_priorite ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateClientNotes(client.id, notes, priorite || null);
      await onSaved();
      onClose();
    } catch {
      setError("L'enregistrement de la note a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Note interne"
      subtitle={`Visible uniquement par vous · ${client.nom}`}
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
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
            <i className="ri-flag-line text-foreground-400"></i>
            Priorité (optionnel)
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPriorite("")}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                priorite === ""
                  ? "bg-foreground-900 border-foreground-900 text-background-50"
                  : "bg-background-100 border-background-200 text-foreground-600 hover:border-foreground-400"
              }`}
            >
              <i className="ri-forbid-2-line"></i>
              Aucune
            </button>
            {NOTE_PRIORITES.map((p) => {
              const actif = priorite === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPriorite(p.key)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif ? `${p.badge}` : "bg-background-100 border-background-200 text-foreground-600 hover:border-foreground-400"
                  }`}
                >
                  <i className={p.icon}></i>
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
            <i className="ri-sticky-note-line text-foreground-400"></i>
            Votre note
          </span>
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Préférences, historique, points de vigilance…"
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 resize-none"
          />
          <span className="text-[11px] text-foreground-400">
            La note et sa priorité sont reprises dans l'export PDF de la fiche du client.
          </span>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}