import type { ReactNode } from "react";

/**
 * Met en évidence, dans un texte, toutes les occurrences d'un terme recherché
 * (recherche insensible à la casse). Renvoie le texte brut si aucun terme.
 */
export default function HighlightTerm({ text, term }: { text: string; term?: string }) {
  const cible = term?.trim().toLowerCase() ?? "";
  if (cible === "") return <>{text}</>;

  const source = text.toLowerCase();
  let index = source.indexOf(cible);
  if (index === -1) return <>{text}</>;

  const morceaux: ReactNode[] = [];
  let curseur = 0;
  let cle = 0;

  while (index !== -1) {
    if (index > curseur) morceaux.push(text.slice(curseur, index));
    morceaux.push(
      <mark key={cle} className="bg-accent-200 text-accent-950 rounded-sm px-0.5">
        {text.slice(index, index + cible.length)}
      </mark>
    );
    cle += 1;
    curseur = index + cible.length;
    index = source.indexOf(cible, curseur);
  }
  if (curseur < text.length) morceaux.push(text.slice(curseur));

  return <>{morceaux}</>;
}