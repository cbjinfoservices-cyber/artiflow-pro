/**
 * Compteur « X nouvelles ressources » : signale d'un coup d'œil les guides
 * publiés récemment, sur la pastille « Ressources » de la navigation.
 * Ne rend rien si aucune ressource n'est récente.
 */
export default function CompteurNouvellesRessources({
  count,
  avecLibelle = false,
  className = "",
}: {
  /** Nombre de ressources récentes à afficher. */
  count: number;
  /** Affiche aussi le libellé « nouvelles ressources » (utile en en-tête de section). */
  avecLibelle?: boolean;
  className?: string;
}) {
  if (!count) return null;
  const nombre = count > 99 ? "99+" : String(count);
  const texte = `${count} nouvelle${count > 1 ? "s" : ""} ressource${count > 1 ? "s" : ""} publiée${count > 1 ? "s" : ""} récemment`;
  return (
    <span
      title={texte}
      aria-label={texte}
      className={`inline-flex items-center gap-1 h-5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap tabular-nums ${
        avecLibelle ? "px-2" : "px-1.5"
      } ${className}`}
    >
      <i className="ri-sparkling-2-line text-[10px] leading-none"></i>
      {nombre}
      {avecLibelle && <span className="font-semibold">nouvelles ressources</span>}
    </span>
  );
}