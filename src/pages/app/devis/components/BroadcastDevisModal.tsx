import { useState } from "react";
import type { ClientItem, DevisItem } from "@/hooks/useArtisanData";
import Modal from "@/pages/app/components/Modal";

export default function BroadcastDevisModal({
  devis,
  clients,
  busy,
  onClose,
  onSubmit,
}: {
  devis: DevisItem;
  clients: ClientItem[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (clientIds: number[]) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allSelected = clients.length > 0 && selected.length === clients.length;
  const toggleAll = () => setSelected(allSelected ? [] : clients.map((c) => c.id));

  const handleSubmit = () => {
    if (selected.length === 0) {
      setError("Sélectionnez au moins un client.");
      return;
    }
    setError(null);
    onSubmit(selected);
  };

  return (
    <Modal
      title="Envoyer ce devis à plusieurs clients"
      subtitle={`Une copie du devis ${devis.numero} sera créée pour chaque client, puis envoyée par email.`}
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
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
            Envoyer {selected.length > 0 ? `(${selected.length})` : ""}
          </button>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-foreground-500">
          Objet : <strong className="text-foreground-800">{devis.objet ?? "Sans objet"}</strong> ·{" "}
          {devis.clientNom ?? "Sans client"}
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
        >
          {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
      </div>

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
        {clients.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-500">
            Aucun client enregistré. Créez d'abord des fiches clients.
          </p>
        ) : (
          clients.map((c) => {
            const checked = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-3 p-3 rounded-md border text-left cursor-pointer transition-colors ${
                  checked ? "bg-primary-50 border-primary-300" : "bg-background-100 border-background-200 hover:border-primary-200"
                }`}
              >
                <span
                  className={`w-5 h-5 shrink-0 flex items-center justify-center rounded-md border ${
                    checked ? "bg-primary-500 border-primary-500 text-background-50" : "border-background-300 bg-background-50"
                  }`}
                >
                  {checked && <i className="ri-check-line text-xs"></i>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground-900">{c.nom}</span>
                  <span className="block text-[11px] text-foreground-500 truncate">
                    {c.email || "Aucun email"}
                    {c.telephone ? ` · ${c.telephone}` : ""}
                  </span>
                </span>
                {!c.email && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-700 font-semibold whitespace-nowrap">
                    Email manquant
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      <p className="mt-3 text-[11px] text-foreground-400 flex items-center gap-1.5">
        <i className="ri-information-line"></i>
        Chaque client recevra son propre lien de signature en ligne.
      </p>
    </Modal>
  );
}