import { useState } from "react";
import SignaturePad from "@/components/base/SignaturePad";
import Modal from "@/pages/app/components/Modal";

export default function SignatureModal({
  titre,
  busy,
  onClose,
  onSubmit,
}: {
  titre: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (nom: string, dataUrl: string) => void;
}) {
  const [nom, setNom] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = () => {
    if (!dataUrl) {
      setError("Le client doit signer dans la zone avant de valider.");
      return;
    }
    setError(null);
    onSubmit(nom.trim(), dataUrl);
  };

  return (
    <Modal
      title="Signature du client"
      subtitle={titre}
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
            onClick={handleValidate}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-quill-pen-line"></i>}
            Valider la signature
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Nom du signataire (facultatif)</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Mme Dupont"
            className="h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Signature manuscrite</span>
          <SignaturePad onChange={setDataUrl} />
        </div>

        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        )}

        <p className="text-[11px] text-foreground-400 flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          En signant, le client accepte le devis. Le statut passera automatiquement à « Signé ».
        </p>
      </div>
    </Modal>
  );
}