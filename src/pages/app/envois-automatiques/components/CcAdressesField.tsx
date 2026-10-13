import type { RecapEchecsBlancCc } from "@/lib/recapEchecsBlanc";

/** Vrai si la valeur ressemble à une adresse email valide. */
function emailValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

interface Props {
  /** Titre du bloc (« Cc du récap d'échecs », « Cc du rappel d'archivage »…). */
  titre: string;
  /** Phrase d'aide affichée sous le titre. */
  description: string;
  /** Adresses valides déjà mémorisées (pour le récapitulatif en bas du bloc). */
  valides: number;
  /** Brouillon affiché (une ligne au minimum), piloté par le parent. */
  brouillon: RecapEchecsBlancCc[];
  /** Met à jour le brouillon à chaque frappe. */
  onChange: (liste: RecapEchecsBlancCc[]) => void;
  /** Enregistre le brouillon (au flou d'un champ, à l'ajout ou au retrait d'une ligne). */
  onCommit: (liste: RecapEchecsBlancCc[]) => void;
}

/**
 * Bloc réutilisable de saisie d'adresses en copie (Cc) : libellé optionnel + adresse email,
 * avec ajout/retrait de lignes. Le parent conserve l'état (brouillon + liste mémorisée) et
 * décide quand enregistrer ; ce composant ne gère que l'affichage et les interactions.
 */
export default function CcAdressesField({ titre, description, valides, brouillon, onChange, onCommit }: Props) {
  const ajouter = () => onChange([...brouillon, { nom: "", email: "" }]);

  const retirer = (index: number) => {
    const next = brouillon.filter((_, i) => i !== index);
    const liste = next.length ? next : [{ nom: "", email: "" }];
    onChange(liste);
    onCommit(liste);
  };

  const maj = (index: number, patch: Partial<RecapEchecsBlancCc>) => {
    onChange(brouillon.map((ligne, i) => (i === index ? { ...ligne, ...patch } : ligne)));
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-background-50 border border-background-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-800">
          <i className="ri-mail-add-line text-secondary-700"></i>
          {titre}
        </span>
        <button
          type="button"
          onClick={ajouter}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
        >
          <i className="ri-add-line"></i>
          Ajouter une adresse
        </button>
      </div>
      <p className="text-[11px] text-foreground-500 leading-relaxed">{description}</p>
      <div className="flex flex-col gap-2">
        {brouillon.map((ligne, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={ligne.nom ?? ""}
              onChange={(e) => maj(index, { nom: e.target.value })}
              onBlur={() => onCommit(brouillon)}
              placeholder="Libellé (optionnel)"
              aria-label={`Libellé de l'adresse en copie ${index + 1}`}
              className="h-9 w-full sm:w-40 px-3 rounded-md bg-background-100 border border-background-200 text-xs text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <input
              type="email"
              value={ligne.email}
              onChange={(e) => maj(index, { email: e.target.value })}
              onBlur={() => onCommit(brouillon)}
              placeholder="adresse@exemple.fr"
              aria-label={`Adresse email en copie ${index + 1}`}
              className={`h-9 flex-1 min-w-[180px] px-3 rounded-md bg-background-100 border text-xs text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                ligne.email.trim() && !emailValide(ligne.email) ? "border-red-300" : "border-background-200"
              }`}
            />
            <button
              type="button"
              onClick={() => retirer(index)}
              title="Retirer cette adresse"
              aria-label="Retirer cette adresse en copie"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-background-100 border border-background-200 text-foreground-500 cursor-pointer hover:border-red-300 hover:text-red-600 transition-colors"
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          </div>
        ))}
      </div>
      {valides > 0 && (
        <p className="text-[11px] text-secondary-700 inline-flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {valides} adresse{valides > 1 ? "s" : ""} recevront une copie.
        </p>
      )}
    </div>
  );
}