import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ecrireTitreNoteLibre, getTitreNoteLibre } from "@/lib/bibliotheque";

const TITRE_MAX = 80;

/**
 * Pastille d'une note libre affichée dans le bandeau « Ma bibliothèque ».
 * Elle mène vers la bibliothèque au clic et permet de renommer le titre
 * directement sur place, sans quitter la page.
 */
export default function NoteLibreChip({ id }: { id: string }) {
  const [titre, setTitre] = useState(() => getTitreNoteLibre(id));
  const [valeur, setValeur] = useState(() => getTitreNoteLibre(id));
  const [edition, setEdition] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const courant = getTitreNoteLibre(id);
    setTitre(courant);
    setValeur(courant);
    setEdition(false);
  }, [id]);

  useEffect(() => {
    if (edition) inputRef.current?.focus();
  }, [edition]);

  const libelle = titre.trim() || "Note libre";

  const enregistrer = () => {
    ecrireTitreNoteLibre(id, valeur);
    setTitre(valeur);
    setEdition(false);
  };

  const annuler = () => {
    setValeur(titre);
    setEdition(false);
  };

  if (edition) {
    return (
      <div className="inline-flex items-center gap-1 max-w-full h-9 pl-3 pr-1 rounded-full border border-secondary-300 bg-background-50">
        <i className="ri-sticky-note-line text-secondary-600"></i>
        <input
          ref={inputRef}
          type="text"
          value={valeur}
          maxLength={TITRE_MAX}
          onChange={(e) => setValeur(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enregistrer();
            else if (e.key === "Escape") annuler();
          }}
          placeholder="Titre de la note…"
          aria-label="Titre de la note libre"
          className="w-40 max-w-full bg-transparent text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={enregistrer}
          aria-label="Valider le titre"
          title="Valider"
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-secondary-700 hover:bg-secondary-100 cursor-pointer transition-colors"
        >
          <i className="ri-check-line"></i>
        </button>
        <button
          type="button"
          onClick={annuler}
          aria-label="Annuler le renommage"
          title="Annuler"
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-500 hover:bg-background-200 cursor-pointer transition-colors"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 max-w-full h-9 pl-3 pr-1 rounded-full border border-secondary-200 bg-secondary-50 hover:bg-secondary-100 hover:border-secondary-300 transition-colors">
      <Link
        to="/ressources/bibliotheque"
        title={libelle}
        className="inline-flex items-center gap-2 min-w-0 max-w-full cursor-pointer"
      >
        <i className="ri-sticky-note-line text-secondary-600"></i>
        <span className="truncate text-sm text-secondary-900">{libelle}</span>
      </Link>
      <button
        type="button"
        onClick={() => {
          setValeur(titre);
          setEdition(true);
        }}
        aria-label={`Renommer « ${libelle} »`}
        title="Renommer"
        className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-secondary-600 hover:bg-secondary-200 hover:text-secondary-900 cursor-pointer transition-colors"
      >
        <i className="ri-pencil-line"></i>
      </button>
    </div>
  );
}