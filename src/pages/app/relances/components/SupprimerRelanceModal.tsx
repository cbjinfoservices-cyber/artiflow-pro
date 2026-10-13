import Modal from "@/pages/app/components/Modal";

interface Props {
  onConfirm: () => void;
  onClose: () => void;
}

/** Modale de confirmation de suppression d'une relance. */
export default function SupprimerRelanceModal({ onConfirm, onClose }: Props) {
  return (
    <Modal title="Supprimer cette relance ?" onClose={onClose}>
      <p className="text-sm text-foreground-600">Cette relance ne sera plus envoyée à votre client.</p>
      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
        >
          Supprimer
        </button>
      </div>
    </Modal>
  );
}