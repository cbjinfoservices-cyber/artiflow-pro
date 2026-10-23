import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Paragraphe d'un guide, avec prise en charge optionnelle des liens internes.
 *
 * Un lien s'écrit dans le texte sous la forme `[[/chemin|libellé]]`. Le reste du
 * paragraphe est rendu tel quel, ce qui permet d'insérer des renvois naturels
 * vers d'autres pages du site au milieu d'une phrase, sans changer la mise en
 * forme des guides existants (qui n'utilisent pas cette syntaxe).
 */
const MOTIF_LIEN = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

export default function ParagrapheArticle({
  texte,
  className = "",
}: {
  texte: string;
  className?: string;
}) {
  const noeuds: ReactNode[] = [];
  const motif = new RegExp(MOTIF_LIEN.source, "g");
  let dernierIndex = 0;
  let correspondance: RegExpExecArray | null = motif.exec(texte);
  let cle = 0;

  while (correspondance !== null) {
    if (correspondance.index > dernierIndex) {
      noeuds.push(texte.slice(dernierIndex, correspondance.index));
    }
    const [, chemin, libelle] = correspondance;
    noeuds.push(
      <Link
        key={`lien-${cle}`}
        to={chemin}
        className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 cursor-pointer"
      >
        {libelle}
      </Link>
    );
    cle += 1;
    dernierIndex = correspondance.index + correspondance[0].length;
    correspondance = motif.exec(texte);
  }

  if (dernierIndex < texte.length) {
    noeuds.push(texte.slice(dernierIndex));
  }

  return <p className={className}>{noeuds}</p>;
}