import { marquerCommeLu, marquerCommeNonLu } from "@/lib/lecture";
import { useLectureStatut } from "@/hooks/useLectureStatut";

/** Bouton d'état de lecture d'un guide, utilisé en fin d'article. */
export default function MarquerLuButton({ slug }: { slug: string }) {
  const statut = useLectureStatut(slug);
  const lu = statut === "lu";

  return (
    <button
      type="button"
      onClick={() => (lu ? marquerCommeNonLu(slug) : marquerCommeLu(slug))}
      className={`inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
        lu
          ? "bg-secondary-100 text-secondary-900 border-secondary-200 hover:bg-secondary-200"
          : "bg-background-50 text-foreground-900 border-background-200 hover:border-secondary-300 hover:text-secondary-700"
      }`}
    >
      <i className={lu ? "ri-check-double-line" : "ri-check-line"}></i>
      {lu ? "Marqué comme lu" : "Marquer comme lu"}
    </button>
  );
}