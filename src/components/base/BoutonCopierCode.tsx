import { useState } from "react";

/**
 * Bouton « Copier le code » réutilisable.
 *
 * Il centralise le style ET le retour visuel (icône + libellé « Copié » pendant 2 s) afin
 * que la fiche intervenant et la liste des intervenants se comportent exactement de la même
 * façon. Toute évolution de style se fait ici, en un seul endroit.
 */
export default function BoutonCopierCode({
  code,
  className = "",
}: {
  /** Code d'invitation à copier dans le presse-papiers. */
  code: string;
  /** Classes supplémentaires éventuelles pour ajuster la mise en contexte. */
  className?: string;
}) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copier}
      title="Copier le code d'invitation"
      className={`inline-flex items-center gap-1 h-6 px-2 rounded bg-background-50 border border-secondary-300 text-[10px] font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-50 transition-colors ${className}`}
    >
      <i className={copie ? "ri-check-line" : "ri-file-copy-line"}></i>
      {copie ? "Copié" : "Copier"}
    </button>
  );
}