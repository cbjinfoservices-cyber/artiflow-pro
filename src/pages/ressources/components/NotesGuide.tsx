import { useEffect, useRef, useState } from "react";
import { ecrireNote, getNote } from "@/lib/bibliotheque";

const NOTE_MAX = 2000;

/**
 * Bloc de notes personnelles attaché à un guide : ce que vous écrivez est
 * conservé localement et reste associé au guide. L'enregistrement est
 * automatique (léger différé après la frappe).
 */
export default function NotesGuide({ slug }: { slug: string }) {
  const [texte, setTexte] = useState(() => getNote(slug));
  const [etat, setEtat] = useState<"idle" | "saved">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setTexte(getNote(slug));
    setEtat("idle");
  }, [slug]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const onChange = (valeur: string) => {
    const v = valeur.slice(0, NOTE_MAX);
    setTexte(v);
    setEtat("idle");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      ecrireNote(slug, v);
      setEtat("saved");
    }, 600);
  };

  return (
    <div className="mt-10 p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-lg shrink-0">
          <i className="ri-sticky-note-line"></i>
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading font-semibold text-base text-foreground-950">Mes notes</h2>
          <p className="mt-1 text-sm text-foreground-600">
            Notez une astuce, un chiffre ou un fournisseur : votre note reste attachée à ce guide.
          </p>
          <textarea
            value={texte}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            maxLength={NOTE_MAX}
            placeholder="Ex. : pour cette chaudière, prévoir +2 h de raccordement gaz…"
            className="mt-3 w-full p-3.5 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-y"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-foreground-500">
            <span className="inline-flex items-center gap-1.5">
              {etat === "saved" ? (
                <>
                  <i className="ri-check-line text-secondary-600"></i>
                  Note enregistrée
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  Enregistrement automatique
                </>
              )}
            </span>
            <span className="tabular-nums">
              {texte.length}/{NOTE_MAX}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}