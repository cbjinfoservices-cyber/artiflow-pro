/**
 * Petit indicateur « vue partagée » : signale que la vue affichée provient d'un lien
 * partagé, c'est-à-dire que l'adresse contient des filtres. S'affiche dans l'en-tête
 * des listes (Devis, Factures, Clients), à côté de la recherche et du titre de la vue filtrée.
 */
export default function BadgeVuePartagee({ compact = false }: { compact?: boolean }) {
  const titre = "Vue ouverte via un lien partagé : l'adresse contient vos filtres";

  if (compact) {
    return (
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-accent-100 text-accent-700"
        title={titre}
        aria-label="Vue partagée"
      >
        <i className="ri-share-forward-line text-sm"></i>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap"
      title={titre}
      aria-label="Vue partagée"
    >
      <i className="ri-share-forward-line"></i>
      Vue partagée
    </span>
  );
}