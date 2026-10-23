import type { Mesure } from "@/lib/auditMetadonnees";

/** Apparence de la pastille selon l'état de la mesure. */
const STYLE: Record<Mesure["etat"], string> = {
  ok: "bg-secondary-100 text-secondary-800 border-secondary-200",
  court: "bg-accent-100 text-accent-900 border-accent-200",
  long: "bg-accent-200 text-accent-900 border-accent-300",
};

/** Icône de la pastille selon l'état de la mesure. */
const ICONE: Record<Mesure["etat"], string> = {
  ok: "ri-check-line",
  court: "ri-arrow-down-line",
  long: "ri-arrow-up-line",
};

/**
 * Compteur de caractères d'un champ SEO, avec sa plage attendue.
 *
 * Il évite d'avoir à recopier un titre ou une description ailleurs pour compter :
 * la longueur réelle et la limite sont affichées côte à côte, en vert quand
 * c'est dans la plage et en ambre quand ça déborde.
 */
export default function CompteurCaracteres({
  prefixe,
  mesure,
  plage,
}: {
  prefixe: string;
  mesure: Mesure;
  plage: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${STYLE[mesure.etat]}`}
      title={`${prefixe} : ${mesure.longueur} caractères (attendu ${plage})`}
    >
      <i className={ICONE[mesure.etat]}></i>
      {prefixe}
      <span className="tabular-nums">{mesure.libelle}</span>
      <span className="font-normal opacity-70">· {plage}</span>
    </span>
  );
}