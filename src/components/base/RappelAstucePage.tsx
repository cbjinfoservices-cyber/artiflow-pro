import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { aidePourChemin, demanderOuvertureAide } from "@/lib/aideContextuelle";

/**
 * Rappel discret posé en bas d'un écran : « il existe une astuce pour cette page ».
 *
 * Il n'invente rien : il s'appuie sur le référentiel d'aide contextuelle et ne s'affiche
 * que si des astuces existent réellement pour l'écran courant. Un clic sur le bouton
 * ouvre le panneau Aide (sans changer de page), qui démarre sur ces mêmes astuces.
 *
 * Volontairement sobre : une seule ligne, une teinte calme, et il peut être fermé pour
 * la visite en cours sans laisser de trace.
 */
export default function RappelAstucePage() {
  const location = useLocation();
  const aide = useMemo(() => aidePourChemin(location.pathname), [location.pathname]);
  const [masque, setMasque] = useState(false);

  if (!aide || masque) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-lg bg-background-100 border border-background-200">
      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <i className="ri-lightbulb-line"></i>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground-900">
          Une astuce pour cet écran
          <span className="ml-1.5 font-normal text-foreground-500">· {aide.titre}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-foreground-600 leading-relaxed line-clamp-2">{aide.resume}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={demanderOuvertureAide}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-800 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-800 transition-colors"
        >
          <i className="ri-question-line"></i>
          Ouvrir l'aide
        </button>
        <button
          type="button"
          onClick={() => setMasque(true)}
          aria-label="Masquer ce rappel"
          title="Masquer ce rappel pour cette visite"
          className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer transition-colors"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    </div>
  );
}