import { useMemo, useState } from "react";
import { TVA_RATES, normalizeTvaRate } from "@/lib/artisanApi";
import type { LigneBibliotheque, LigneBibliothequeInput } from "@/lib/bibliothequeLignes";
import Modal from "@/pages/app/components/Modal";

const TVA_OPTIONS = TVA_RATES.map((t) => ({ value: String(t), label: `${String(t).replace(".", ",")} %` }));

/**
 * Fenêtre de création / édition d'une ligne de désignation personnelle :
 * désignation, unité, prix unitaire, taux de TVA et catégorie.
 */
export default function LigneFormModal({
  initial,
  designationInitiale,
  valeursInitiales,
  categories,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  initial: LigneBibliotheque | null;
  /** Désignation pré-remplie lors d'une création (ex. reprise de la recherche). */
  designationInitiale?: string;
  /** Valeurs pré-remplies lors d'une création (ex. reprise d'une ligne du catalogue métier). */
  valeursInitiales?: Partial<LigneBibliothequeInput>;
  /** Catégories proposées (nom canonique + libellé d'affichage), hors catégories masquées. */
  categories: { valeur: string; label: string }[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: LigneBibliothequeInput) => void;
}) {
  const [designation, setDesignation] = useState(initial?.designation ?? designationInitiale ?? "");
  const [unite, setUnite] = useState(initial?.unite ?? valeursInitiales?.unite ?? "u");
  const [prix, setPrix] = useState(
    initial
      ? String(initial.prix_unitaire)
      : valeursInitiales?.prix_unitaire != null
        ? String(valeursInitiales.prix_unitaire)
        : "",
  );
  const [taux, setTaux] = useState(String(normalizeTvaRate(initial?.taux_tva ?? valeursInitiales?.taux_tva)));
  const [categorie, setCategorie] = useState(initial?.categorie ?? valeursInitiales?.categorie ?? "Général");
  const [localError, setLocalError] = useState<string | null>(null);

  // Options de catégorie : « Général » en tête, puis les catégories gérées ; on garantit
  // que la catégorie d'origine d'une ligne en édition reste sélectionnable même si masquée.
  const optionsCategories = useMemo(() => {
    const map = new Map<string, string>();
    map.set("Général", "Général");
    categories.forEach((c) => map.set(c.valeur, c.label));
    if (initial?.categorie) map.set(initial.categorie, map.get(initial.categorie) ?? initial.categorie);
    return [...map.entries()].map(([valeur, label]) => ({ valeur, label }));
  }, [categories, initial]);

  const handleSubmit = () => {
    if (!designation.trim()) {
      setLocalError("Saisissez la désignation de la ligne.");
      return;
    }
    setLocalError(null);
    onSubmit({
      designation: designation.trim(),
      unite: unite.trim() || "u",
      prix_unitaire: Number(prix) || 0,
      taux_tva: normalizeTvaRate(taux),
      categorie: categorie.trim() || "Général",
    });
  };

  const inputCls = "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  return (
    <Modal
      title={initial ? "Modifier la ligne" : "Nouvelle ligne"}
      subtitle="Enregistrez une ligne réutilisable : désignation, unité, prix et TVA."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Désignation</span>
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="Ex : Fourniture et pose d'un mitigeur lavabo"
            autoFocus
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Unité</span>
            <input
              value={unite}
              onChange={(e) => setUnite(e.target.value)}
              placeholder="u, m², ml, forfait…"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Prix unitaire (€ HT)</span>
            <input
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={inputCls}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Taux de TVA</span>
            <select value={taux} onChange={(e) => setTaux(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {TVA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Catégorie</span>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              {optionsCategories.map((o) => (
                <option key={o.valeur} value={o.valeur}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(localError || error) && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {localError || error}
          </p>
        )}
      </div>
    </Modal>
  );
}