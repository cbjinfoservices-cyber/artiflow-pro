import { useState } from "react";
import Modal from "@/pages/app/components/Modal";

/**
 * Petite fenêtre pour enregistrer un devis existant comme modèle réutilisable,
 * directement depuis la liste des devis (sans ouvrir le détail).
 */
export default function EnregistrerModeleModal({
  defaultNom,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  defaultNom: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (nom: string) => void;
}) {
  const [nom, setNom] = useState(defaultNom);
  const trimmed = nom.trim();

  return (
    <Modal
      title="Enregistrer comme modèle"
      subtitle="Ce devis deviendra un modèle réutilisable en un clic depuis votre tableau de bord."
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
            onClick={() => onSubmit(trimmed)}
            disabled={busy || trimmed.length === 0}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-bookmark-line"></i>}
            Enregistrer le modèle
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Nom du modèle</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Rénovation salle de bain"
            autoFocus
            className="h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
          />
        </label>
        <p className="text-xs text-foreground-500 flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          L'objet et toutes les lignes du devis seront copiés dans le modèle.
        </p>
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