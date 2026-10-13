import { useEffect, useRef, useState } from "react";
import {
  ecrireRechercheRepliableOuverte,
  lireRechercheRepliableOuverte,
} from "@/lib/rechercheRepliablePrefs";

interface RechercheRepliableProps {
  /** Identifiant unique de la carte (sert de clé de mémorisation de l'état ouvert/replié). */
  carteId: string;
  /** Libellé lisible de la carte (repris dans le titre du bouton). */
  carteLabel: string;
  /** Valeur courante de la recherche. */
  value: string;
  /** Met à jour la recherche. */
  onChange: (value: string) => void;
  /** Efface la recherche (bouton ×). Par défaut, remet simplement la valeur à vide. */
  onEffacer?: () => void;
  /** Texte indicatif du champ. */
  placeholder?: string;
  /** Libellé d'accessibilité du champ. */
  ariaLabel?: string;
  /** Classes de largeur du conteneur déplié (adaptées à chaque page). */
  conteneurClassName?: string;
  /** Variante compacte (cartes denses : barre plus basse, texte plus petit). */
  compact?: boolean;
}

/**
 * Barre de recherche REPLIABLE réutilisable : au repos, elle n'affiche qu'une petite pastille
 * « Rechercher » ; dépliée, elle révèle le champ de saisie. Une recherche déjà saisie garde la barre
 * ouverte pour montrer ce qui filtre la carte.
 *
 * L'état ouvert / replié de chaque barre est mémorisé localement (voir rechercheRepliablePrefs) :
 * on le retrouve tel quel à la prochaine visite, comme les autres préférences d'affichage.
 */
export default function RechercheRepliable({
  carteId,
  carteLabel,
  value,
  onChange,
  onEffacer,
  placeholder = "Rechercher…",
  ariaLabel = "Rechercher",
  conteneurClassName = "w-full md:w-72",
  compact = false,
}: RechercheRepliableProps) {
  // État initial : une recherche déjà saisie force l'ouverture ; sinon on reprend la préférence
  // mémorisée de la dernière visite (repliée par défaut).
  const [ouvert, setOuvert] = useState(() =>
    value.trim() !== "" ? true : lireRechercheRepliableOuverte(carteId) ?? false,
  );
  const ouvertRef = useRef(ouvert);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Met à jour l'état et, quand le changement vient de l'utilisateur, mémorise la préférence.
  const majOuvert = (valeur: boolean, persister = true) => {
    ouvertRef.current = valeur;
    setOuvert(valeur);
    if (persister) ecrireRechercheRepliableOuverte(carteId, valeur);
  };

  // À l'ouverture, on donne le focus au champ pour saisir directement.
  useEffect(() => {
    if (ouvert) inputRef.current?.focus();
  }, [ouvert]);

  // Une recherche pré-remplie (ex. lien partagé ?q=…, ou saisie ailleurs) rouvre la barre pour
  // montrer ce qui filtre la carte — sans écraser la préférence mémorisée de l'utilisateur.
  useEffect(() => {
    if (value.trim() !== "" && !ouvertRef.current) majOuvert(true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => majOuvert(true)}
        title={`Rechercher dans ${carteLabel}`}
        aria-label={`Rechercher dans ${carteLabel}`}
        className={`inline-flex items-center gap-2 rounded-md bg-background-100 border border-background-200 text-foreground-500 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors shrink-0 ${
          compact ? "h-8 px-2.5 text-xs" : "h-10 px-3 text-sm"
        }`}
      >
        <i className="ri-search-line"></i>
        <span>Rechercher</span>
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-md bg-background-100 border border-background-200 ${
        compact ? "px-2.5 h-8" : "px-3 h-10"
      } ${conteneurClassName}`}
    >
      <i className="ri-search-line text-foreground-400 text-sm"></i>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`flex-1 bg-transparent text-foreground-800 outline-none placeholder:text-foreground-400 ${
          compact ? "text-xs" : "text-sm"
        }`}
      />
      {value && (
        <button
          type="button"
          onClick={() => (onEffacer ? onEffacer() : onChange(""))}
          className="w-5 h-5 flex items-center justify-center rounded-full text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer"
          aria-label="Effacer la recherche"
          title="Effacer la recherche"
        >
          <i className="ri-close-line text-sm"></i>
        </button>
      )}
      <button
        type="button"
        onClick={() => majOuvert(false)}
        className="w-5 h-5 flex items-center justify-center rounded-full text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer"
        aria-label="Replier la recherche"
        title="Replier la recherche"
      >
        <i className="ri-arrow-up-s-line text-sm"></i>
      </button>
    </div>
  );
}