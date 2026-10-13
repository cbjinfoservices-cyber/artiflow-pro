import { useState, type FormEvent } from "react";

/**
 * Formulaire d'ajout d'une adresse gestionnaire. Réservé au gestionnaire principal :
 * il est désactivé pour les autres gestionnaires. Le libellé (ex. « Comptable externe »,
 * « Support ») est facultatif et sert uniquement à s'y retrouver dans la liste.
 */
export default function AjoutGestionnaireForm({
  principal,
  disabled,
  busy,
  onSubmit,
}: {
  principal: boolean;
  disabled: boolean;
  busy: boolean;
  onSubmit: (
    email: string,
    voirComptabilite: boolean,
    voirMonAbonnement: boolean,
    libelle: string | null,
  ) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [libelle, setLibelle] = useState("");
  const [voirCompta, setVoirCompta] = useState(true);
  const [voirAbo, setVoirAbo] = useState(true);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const ok = await onSubmit(email, voirCompta, voirAbo, libelle.trim() || null);
    if (ok) {
      setEmail("");
      setLibelle("");
      setVoirCompta(true);
      setVoirAbo(true);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200"
    >
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-user-add-line"></i>
        </span>
        <div>
          <h3 className="font-heading font-bold text-sm text-foreground-950">Ajouter une adresse gestionnaire</h3>
          <p className="text-[11px] text-foreground-500">
            Le compte de connexion doit d'abord exister dans Backend → Authentification, avec la même adresse.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 px-3 h-10 rounded-md bg-background-50 border border-background-200 focus-within:border-primary-400 sm:flex-1">
          <i className="ri-mail-line text-foreground-400 text-sm"></i>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={disabled}
            placeholder="adresse@exemple.fr"
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground-800 outline-none placeholder:text-foreground-400 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-2 px-3 h-10 rounded-md bg-background-50 border border-background-200 focus-within:border-primary-400 sm:w-56">
          <i className="ri-price-tag-3-line text-foreground-400 text-sm"></i>
          <input
            type="text"
            value={libelle}
            maxLength={40}
            onChange={(e) => setLibelle(e.target.value)}
            disabled={disabled}
            placeholder="Libellé (ex. Comptable externe)"
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground-800 outline-none placeholder:text-foreground-400 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-4 px-3 h-10 rounded-md bg-background-50 border border-background-200">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground-700 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={voirCompta}
              onChange={(e) => setVoirCompta(e.target.checked)}
              disabled={disabled}
              className="cursor-pointer"
            />
            Comptabilité
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground-700 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={voirAbo}
              onChange={(e) => setVoirAbo(e.target.checked)}
              disabled={disabled}
              className="cursor-pointer"
            />
            Mon abonnement
          </label>
        </div>

        <button
          type="submit"
          disabled={disabled || busy}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-add-line"></i>}
          Ajouter
        </button>
      </div>

      {!principal && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-foreground-400">
          <i className="ri-lock-line"></i>
          Réservé au gestionnaire principal.
        </p>
      )}
    </form>
  );
}