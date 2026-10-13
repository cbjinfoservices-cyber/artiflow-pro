import { useMemo, useState } from "react";
import type { DevisModele, LigneInput } from "@/lib/artisanApi";
import { computeTotaux } from "@/lib/artisanApi";
import { formatEuros } from "@/lib/format";
import Modal from "@/pages/app/components/Modal";

/**
 * Fenêtre d'édition d'un modèle personnalisé : renommer, ajuster l'objet
 * et modifier les lignes (désignation, unité, quantité, prix unitaire).
 */
export default function EditerModeleModal({
  modele,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  modele: DevisModele;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: { nom: string; objet: string; lignes: LigneInput[] }) => void;
}) {
  const [nom, setNom] = useState(modele.nom);
  const [objet, setObjet] = useState(modele.objet);
  const [lignes, setLignes] = useState<LigneInput[]>(modele.lignes.length ? modele.lignes : [
    { designation: "", unite: "u", quantite: 1, prix_unitaire: 0 },
  ]);

  const total = useMemo(() => computeTotaux(lignes).ht, [lignes]);

  const updateLigne = (index: number, patch: Partial<LigneInput>) => {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLigne = () => {
    setLignes((prev) => [...prev, { designation: "", unite: "u", quantite: 1, prix_unitaire: 0 }]);
  };

  const removeLigne = (index: number) => {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const propres = lignes.filter((l) => l.designation.trim().length > 0);
    onSubmit({ nom: nom.trim(), objet: objet.trim(), lignes: propres });
  };

  const canSubmit = nom.trim().length > 0 && !busy;

  return (
    <Modal
      title="Modifier le modèle"
      subtitle="Renommez ce modèle ou ajustez ses lignes, puis enregistrez."
      onClose={onClose}
      wide
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
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer les modifications
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Nom du modèle</span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Rénovation salle de bain"
              className="h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Objet</span>
            <input
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Objet du devis"
              className="h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-500 uppercase tracking-wide">Lignes du modèle</span>
            <button
              type="button"
              onClick={addLigne}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap"
            >
              <i className="ri-add-line"></i> Ajouter une ligne
            </button>
          </div>

          <div className="rounded-lg border border-background-200 overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
              <span className="col-span-5">Désignation</span>
              <span className="col-span-2">Unité</span>
              <span className="col-span-2 text-right">Qté</span>
              <span className="col-span-2 text-right">P.U. (€)</span>
              <span className="col-span-1"></span>
            </div>
            {lignes.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-background-200 items-center">
                <input
                  value={l.designation}
                  onChange={(e) => updateLigne(i, { designation: e.target.value })}
                  placeholder="Désignation"
                  className="col-span-12 sm:col-span-5 h-9 px-2 rounded-md bg-background-50 border border-background-200 text-sm outline-none focus:border-primary-400"
                />
                <input
                  value={l.unite}
                  onChange={(e) => updateLigne(i, { unite: e.target.value })}
                  placeholder="u"
                  className="col-span-4 sm:col-span-2 h-9 px-2 rounded-md bg-background-50 border border-background-200 text-sm outline-none focus:border-primary-400"
                />
                <input
                  type="number"
                  min={0}
                  value={l.quantite}
                  onChange={(e) => updateLigne(i, { quantite: Number(e.target.value) })}
                  className="col-span-4 sm:col-span-2 h-9 px-2 rounded-md bg-background-50 border border-background-200 text-sm text-right outline-none focus:border-primary-400"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={l.prix_unitaire}
                  onChange={(e) => updateLigne(i, { prix_unitaire: Number(e.target.value) })}
                  className="col-span-4 sm:col-span-2 h-9 px-2 rounded-md bg-background-50 border border-background-200 text-sm text-right outline-none focus:border-primary-400"
                />
                <button
                  type="button"
                  onClick={() => removeLigne(i)}
                  disabled={lignes.length <= 1}
                  className="col-span-12 sm:col-span-1 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Supprimer cette ligne"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-accent-50 border border-accent-200">
            <span className="text-xs font-medium text-foreground-700">Total HT estimé</span>
            <span className="text-sm font-bold text-foreground-950">{formatEuros(total)}</span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}