import { canalIcon, RELANCE_CANAUX } from "@/lib/statuts";
import Modal from "@/pages/app/components/Modal";

interface Props {
  /** Nombre de clients ciblés par l'envoi groupé. */
  targets: number;
  /** Palier de retard appliqué (0 = tous les retards). */
  retardPeriode: number;
  canal: string;
  /** Envoi groupé en cours. */
  sending: boolean;
  /** Nombre d'envois déjà traités (progression). */
  done: number;
  onSelectCanal: (canal: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

/** Modale d'envoi groupé des relances en retard (canal unique appliqué à toutes). */
export default function EnvoiGroupeModal({
  targets,
  retardPeriode,
  canal,
  sending,
  done,
  onSelectCanal,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal
      title="Envoi groupé des relances en retard"
      onClose={() => {
        if (!sending) onClose();
      }}
    >
      <p className="text-sm text-foreground-600">
        <strong>{targets}</strong> client(s) parmi les plus en retard
        {retardPeriode > 0 ? ` (plus de ${retardPeriode} jours)` : ""} recevront une relance d'un seul coup. Choisissez
        le canal d'envoi — il sera appliqué à toutes :
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        {RELANCE_CANAUX.filter((c) => c !== "Tous").map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelectCanal(c)}
            disabled={sending}
            className={`inline-flex items-center gap-2 h-10 px-4 rounded-md text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 ${
              canal === c
                ? "bg-accent-500 text-background-50"
                : "bg-background-100 text-foreground-700 border border-background-300 hover:bg-background-200"
            }`}
          >
            <i className={canalIcon(c)}></i>
            {c}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-foreground-500 mt-3 flex items-center gap-1.5">
        <i className="ri-information-line"></i>
        Les relances déjà envoyées ou mises en pause sont ignorées.
      </p>
      {sending && (
        <p className="text-xs text-primary-700 mt-3 flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Envoi en cours… ({done}/{targets})
        </p>
      )}
      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={sending || targets === 0}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-accent-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-accent-600 whitespace-nowrap disabled:opacity-60"
        >
          {sending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-2-line"></i>}
          Envoyer à {targets} client(s)
        </button>
      </div>
    </Modal>
  );
}