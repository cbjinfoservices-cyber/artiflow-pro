import { useState } from "react";

/** Copie un texte (présentation, code à intégrer) dans le presse-papiers, avec un retour visuel bref. */
export default function BoutonCopier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(texte).then(() => {
          setCopie(true);
          setTimeout(() => setCopie(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-background-200 bg-background-50 text-xs font-semibold text-foreground-800 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
    >
      <i className={copie ? "ri-check-line text-accent-700" : "ri-file-copy-line"}></i>
      {copie ? "Copié" : "Copier"}
    </button>
  );
}
