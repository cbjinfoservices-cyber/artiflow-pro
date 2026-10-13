import { type DragEvent, useEffect, useRef, useState } from "react";
import { ecrireNoteLibre, ecrireTitreNoteLibre, getNoteLibre, getTitreNoteLibre } from "@/lib/bibliotheque";

const NOTE_MAX = 2000;
const TITRE_MAX = 80;

/**
 * Carte d'une note personnelle « libre » : non rattachée à un guide, elle peut
 * être créée directement depuis la bibliothèque. Elle dispose d'un titre
 * optionnel (pour mieux la retrouver) et d'un corps de texte. L'enregistrement
 * est automatique (léger différé après la frappe) et la suppression immédiate.
 */
export default function NoteLibreCard({
  id,
  onDelete,
  draggable = false,
  dragging = false,
  dragOver = false,
  highlighted = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  id: string;
  onDelete?: (id: string) => void;
  draggable?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  highlighted?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  const [titre, setTitre] = useState(() => getTitreNoteLibre(id));
  const [texte, setTexte] = useState(() => getNoteLibre(id));
  const [etat, setEtat] = useState<"idle" | "saved">("idle");
  const timerTexte = useRef<number | null>(null);
  const timerTitre = useRef<number | null>(null);

  useEffect(() => {
    setTitre(getTitreNoteLibre(id));
    setTexte(getNoteLibre(id));
    setEtat("idle");
  }, [id]);

  useEffect(
    () => () => {
      if (timerTexte.current) window.clearTimeout(timerTexte.current);
      if (timerTitre.current) window.clearTimeout(timerTitre.current);
    },
    []
  );

  const onChangeTitre = (valeur: string) => {
    const v = valeur.slice(0, TITRE_MAX);
    setTitre(v);
    setEtat("idle");
    if (timerTitre.current) window.clearTimeout(timerTitre.current);
    timerTitre.current = window.setTimeout(() => {
      ecrireTitreNoteLibre(id, v);
      setEtat("saved");
    }, 600);
  };

  const onChangeTexte = (valeur: string) => {
    const v = valeur.slice(0, NOTE_MAX);
    setTexte(v);
    setEtat("idle");
    if (timerTexte.current) window.clearTimeout(timerTexte.current);
    timerTexte.current = window.setTimeout(() => {
      ecrireNoteLibre(id, v);
      setEtat("saved");
    }, 600);
  };

  const supprimer = () => {
    if (timerTexte.current) window.clearTimeout(timerTexte.current);
    if (timerTitre.current) window.clearTimeout(timerTitre.current);
    ecrireNoteLibre(id, "");
    ecrireTitreNoteLibre(id, "");
    onDelete?.(id);
  };

  return (
    <article
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex flex-col rounded-lg border bg-background-50 p-5 transition-colors ${
        dragOver ? "border-primary-400 ring-2 ring-primary-200" : "border-background-200"
      } ${dragging ? "opacity-50" : ""} ${highlighted ? "animate-retour-highlight" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
          <i className="ri-sticky-note-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 px-2 rounded-md border border-background-200 bg-background-50 hover:border-secondary-300 focus-within:border-secondary-400 focus-within:ring-2 focus-within:ring-secondary-100 transition-colors">
            <i className="ri-pencil-line shrink-0 text-secondary-600 text-sm" aria-hidden="true"></i>
            <label htmlFor={`titre-${id}`} className="sr-only">
              Titre de la note
            </label>
            <input
              id={`titre-${id}`}
              type="text"
              value={titre}
              onChange={(e) => onChangeTitre(e.target.value)}
              maxLength={TITRE_MAX}
              autoFocus={titre === "" && texte === ""}
              placeholder="Renommer la note…"
              className="w-full h-9 bg-transparent font-heading font-semibold text-base text-foreground-950 placeholder:text-foreground-400 placeholder:font-normal focus:outline-none"
            />
          </div>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-foreground-500">
            <i className="ri-sticky-note-line"></i>
            Note libre · non rattachée à un guide
          </p>
        </div>
        <button
          type="button"
          onClick={supprimer}
          aria-label="Supprimer la note"
          title="Supprimer la note"
          className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-md whitespace-nowrap cursor-pointer border border-background-200 bg-background-50 text-foreground-600 hover:border-accent-300 hover:text-accent-700 transition-colors"
        >
          <i className="ri-delete-bin-6-line"></i>
        </button>
        {draggable && (
          <button
            type="button"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            aria-label="Glisser pour réordonner la note"
            title="Glisser pour réordonner"
            className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-md whitespace-nowrap cursor-grab active:cursor-grabbing border border-background-200 bg-background-50 text-foreground-600 hover:animate-wiggle hover:border-primary-300 hover:bg-primary-100 hover:text-primary-700 transition-colors"
          >
            <i className="ri-drag-move-2-line"></i>
          </button>
        )}
      </div>

      <textarea
        value={texte}
        onChange={(e) => onChangeTexte(e.target.value)}
        rows={3}
        maxLength={NOTE_MAX}
        placeholder="Une idée, un fournisseur, un pense-bête… sans lien avec un guide précis."
        className="mt-4 w-full p-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-y"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500">
          {etat === "saved" ? (
            <>
              <i className="ri-check-line text-secondary-600"></i>
              Enregistré
            </>
          ) : (
            <>
              <i className="ri-save-line"></i>
              Enregistrement automatique
            </>
          )}
          <span className="text-foreground-400 tabular-nums">
            {texte.length}/{NOTE_MAX}
          </span>
        </span>
      </div>
    </article>
  );
}