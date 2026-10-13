import Modal from "@/pages/app/components/Modal";

interface Props {
  /** Nombre de relances en retard concernées. */
  count: number;
  /** Décalage (jours) appliqué aux relances reculées. */
  decalage: number;
  /** Reprogrammation en cours. */
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Modale de confirmation : recule d'un coup toutes les relances en retard. */
export default function ConfirmReprogAllModal({ count, decalage, busy, onConfirm, onClose }: Props) {
  return (
    <Modal title="Décaler toutes les relances en retard ?" onClose={onClose}>
      <p className="text-sm text-foreground-600">
        {count} relance(s) en retard seront reculées à <strong>+{decalage} jours</strong> à partir d'aujourd'hui. Leur
        message et leur canal restent inchangés.
      </p>
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
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-secondary-600 whitespace-nowrap disabled:opacity-60"
        >
          {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-calendar-check-line"></i>}
          Tout décaler
        </button>
      </div>
    </Modal>
  );
}