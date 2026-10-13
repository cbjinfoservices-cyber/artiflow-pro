import type { ReactNode } from "react";

export interface EtapeGuide {
  /** Icône Remix affichée dans la pastille de gauche. */
  icone: string;
  /** Titre court de l'étape. */
  titre: string;
  /** Explication en langage simple. */
  texte: string;
}

/**
 * Petite carte « guide de première visite » posée en haut d'une page : elle déroule, pas à pas,
 * l'usage de CET écran la première fois, puis disparaît définitivement (mémorisé par l'appelant).
 * Écrite pour quelqu'un qui découvre l'outil : ton rassurant, aucun jargon, et un repère visuel
 * par étape. L'artisan peut la fermer d'un clic (« Compris, ne plus afficher »).
 */
export default function GuidePremiereVisite({
  titre,
  sousTitre,
  etapes,
  onFermer,
  note,
  actions,
}: {
  /** Titre du guide (l'écran concerné). */
  titre: string;
  /** Phrase d'accueil expliquant à quoi sert cet écran. */
  sousTitre: string;
  /** Les étapes à suivre, dans l'ordre. */
  etapes: EtapeGuide[];
  /** Ferme le guide (et le mémorise comme vu). */
  onFermer: () => void;
  /** Remarque rassurante affichée en bas (optionnel). */
  note?: string;
  /** Boutons ou liens additionnels (optionnel). */
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 p-4 md:p-5 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
          <i className="ri-guide-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-950">{titre}</p>
          <p className="text-xs text-foreground-600 mt-0.5 leading-relaxed">{sousTitre}</p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:bg-accent-100 hover:text-accent-700 cursor-pointer transition-colors"
          aria-label="Fermer le guide de première visite"
          title="Fermer le guide"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {etapes.map((etape, index) => (
          <li
            key={etape.titre}
            className="flex flex-col gap-2 p-3 rounded-lg bg-background-50 border border-accent-200"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-xs font-bold">
                {index + 1}
              </span>
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-base">
                <i className={etape.icone}></i>
              </span>
            </div>
            <p className="text-xs font-semibold text-foreground-950">{etape.titre}</p>
            <p className="text-[11px] text-foreground-600 leading-relaxed">{etape.texte}</p>
          </li>
        ))}
      </ol>

      {note && (
        <p className="flex items-start gap-2 text-[11px] text-foreground-500 leading-relaxed">
          <i className="ri-shield-check-line mt-px shrink-0 text-accent-600"></i>
          <span>{note}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <button
          type="button"
          onClick={onFermer}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
        >
          <i className="ri-check-line"></i>
          Compris, ne plus afficher
        </button>
      </div>
    </section>
  );
}