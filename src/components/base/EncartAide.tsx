import type { ReactNode } from "react";

type TonEncart = "primary" | "accent" | "secondary";

const TON_ENCART: Record<TonEncart, { fond: string; bord: string; puce: string; numero: string }> = {
  primary: {
    fond: "bg-primary-50/70",
    bord: "border-primary-200",
    puce: "bg-primary-100 text-primary-700",
    numero: "bg-primary-500 text-background-50",
  },
  accent: {
    fond: "bg-accent-50",
    bord: "border-accent-200",
    puce: "bg-accent-100 text-accent-700",
    numero: "bg-accent-500 text-background-50",
  },
  secondary: {
    fond: "bg-secondary-50",
    bord: "border-secondary-200",
    puce: "bg-secondary-100 text-secondary-700",
    numero: "bg-secondary-500 text-background-50",
  },
};

/**
 * Encart « comment faire » : un petit mode d'emploi posé à côté d'une fonction un peu technique.
 * Il déroule les étapes en langage simple, pour une personne qui découvre l'outil et ne veut pas
 * se perdre dans le jargon. Le ton reprend les couleurs du thème (primary / accent / secondary).
 */
export default function EncartAide({
  titre,
  etapes,
  icone = "ri-question-line",
  ton = "primary",
  note,
  actions,
}: {
  /** Titre de l'encart (l'action ou le sujet concerné). */
  titre: string;
  /** Étapes à suivre, dans l'ordre. */
  etapes: string[];
  /** Icône Remix affichée dans la pastille. */
  icone?: string;
  /** Couleur de l'encart (parmi les rôles du thème). */
  ton?: TonEncart;
  /** Remarque complémentaire affichée en bas (optionnel). */
  note?: string;
  /** Boutons ou liens additionnels (optionnel). */
  actions?: ReactNode;
}) {
  const t = TON_ENCART[ton];
  return (
    <section className={`flex flex-col gap-3 p-4 rounded-lg border ${t.fond} ${t.bord}`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-lg ${t.puce}`}>
          <i className={icone}></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-sm text-foreground-950">{titre}</h3>
          <ol className="mt-2.5 flex flex-col gap-2">
            {etapes.map((etape, index) => (
              <li key={etape} className="flex items-start gap-2.5">
                <span
                  className={`w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold ${t.numero}`}
                >
                  {index + 1}
                </span>
                <span className="text-xs text-foreground-600 leading-relaxed">{etape}</span>
              </li>
            ))}
          </ol>
          {note && (
            <p className="mt-3 flex items-start gap-2 text-[11px] text-foreground-500 leading-relaxed">
              <i className="ri-information-line mt-px shrink-0"></i>
              <span>{note}</span>
            </p>
          )}
          {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}