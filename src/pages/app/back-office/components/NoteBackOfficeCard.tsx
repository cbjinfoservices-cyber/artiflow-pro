import { useEffect, useState } from "react";
import { useBackOfficeNote } from "@/hooks/useBackOfficeNote";
import { formatShortDate } from "@/lib/dates";

const MAX_LONGUEUR = 500;

/**
 * Note de synthèse / commentaire interne en tête de la vue d'ensemble Back-office.
 * Visible par tous les gestionnaires, mais modifiable uniquement par le
 * gestionnaire principal. Une note vide n'est affichée qu'au principal (invitation
 * à en écrire une).
 */
export default function NoteBackOfficeCard() {
  const { note, updatedBy, updatedAt, loading, error, saving, canEdit, isGestionnaire, save, reload } =
    useBackOfficeNote();

  const [edition, setEdition] = useState(false);
  const [brouillon, setBrouillon] = useState(note);
  const [message, setMessage] = useState<string | null>(null);

  // Le brouillon suit la note chargée tant qu'on n'est pas en cours d'édition.
  useEffect(() => {
    if (!edition) setBrouillon(note);
  }, [note, edition]);

  if (!isGestionnaire) return null;

  const aNote = note.trim().length > 0;
  // Un gestionnaire non principal ne voit rien s'il n'y a pas de note.
  if (!aNote && !canEdit && !loading) return null;

  const enregistrer = async () => {
    const res = await save(brouillon);
    if (res.error) {
      setMessage(res.error);
    } else {
      setEdition(false);
      setMessage("Note enregistrée");
      window.setTimeout(() => setMessage(null), 2500);
    }
  };

  const annuler = () => {
    setBrouillon(note);
    setEdition(false);
    setMessage(null);
  };

  return (
    <div className="flex flex-col rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-sticky-note-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Note de synthèse</h3>
            <p className="text-[11px] text-foreground-500">
              {updatedAt
                ? `Dernière mise à jour le ${formatShortDate(updatedAt)}${updatedBy ? ` par ${updatedBy}` : ""}`
                : "Commentaire interne partagé du back-office"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground-600">
              <i className="ri-checkbox-circle-line text-accent-600"></i>
              {message}
            </span>
          )}
          {canEdit && !edition && (
            <button
              type="button"
              onClick={() => {
                setBrouillon(note);
                setEdition(true);
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              <i className="ri-edit-line"></i>
              {aNote ? "Modifier" : "Rédiger une note"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-foreground-500">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement…
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="inline-flex items-center gap-2 text-sm text-foreground-600">
            <i className="ri-error-warning-line text-red-500"></i>
            {error}
          </span>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : edition ? (
        <div className="flex flex-col gap-3 p-5">
          <textarea
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value.slice(0, MAX_LONGUEUR))}
            rows={4}
            placeholder="Écrire une note de synthèse à l'attention des gestionnaires…"
            className="w-full resize-y rounded-md bg-background-50 border border-background-200 px-3 py-2 text-sm text-foreground-800 outline-none focus:border-primary-400 placeholder:text-foreground-400"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-foreground-400">
              {brouillon.length} / {MAX_LONGUEUR} caractères
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={annuler}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-background-300 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={enregistrer}
                disabled={saving}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4">
          {aNote ? (
            <p className="text-sm leading-relaxed text-foreground-700 whitespace-pre-wrap">{note}</p>
          ) : (
            <p className="text-sm text-foreground-500">
              Aucune note de synthèse pour l'instant. Cliquez sur « Rédiger une note » pour en ajouter une.
            </p>
          )}
        </div>
      )}
    </div>
  );
}