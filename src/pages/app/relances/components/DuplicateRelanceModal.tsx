import type { RelanceItem } from "@/hooks/useArtisanData";
import { canalIcon, RELANCE_CANAUX } from "@/lib/statuts";
import Modal from "@/pages/app/components/Modal";

interface Props {
  relance: RelanceItem;
  canal: string;
  /** Décalage (jours) appliqué à la nouvelle relance. */
  decalage: number;
  /** Duplication en cours. */
  busy: boolean;
  onSelectCanal: (canal: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

/** Modale de duplication d'une relance (choix du canal d'envoi). */
export default function DuplicateRelanceModal({
  relance,
  canal,
  decalage,
  busy,
  onSelectCanal,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal title="Dupliquer la relance" onClose={onClose}>
      <p className="text-sm text-foreground-600">
        Une nouvelle relance « Programmée » sera créée pour <strong>{relance.clientNom ?? "votre client"}</strong> (
        {relance.devisNumero ?? "—"}), datée à <strong>+{decalage} jours</strong>. Choisissez le canal d'envoi :
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        {RELANCE_CANAUX.filter((c) => c !== "Tous").map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelectCanal(c)}
            className={`inline-flex items-center gap-2 h-10 px-4 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              canal === c
                ? "bg-primary-500 text-background-50"
                : "bg-background-100 text-foreground-700 border border-background-300 hover:bg-background-200"
            }`}
          >
            <i className={canalIcon(c)}></i>
            {c}
          </button>
        ))}
      </div>
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
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
        >
          {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-copy-line"></i>}
          Dupliquer +{decalage}j
        </button>
      </div>
    </Modal>
  );
}