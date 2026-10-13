/**
 * Petit badge signalant qu'une désignation de ligne existe déjà dans la
 * bibliothèque de l'artisan, pour éviter les doublons.
 */
export default function DejaBibliothequeBadge({ label = "Déjà dans la bibliothèque" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap"
      title="Cette désignation existe déjà dans votre bibliothèque de lignes"
    >
      <i className="ri-checkbox-circle-line"></i>
      {label}
    </span>
  );
}