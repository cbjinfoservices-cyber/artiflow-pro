import { useState } from "react";
import type { DevisItem } from "@/hooks/useArtisanData";
import type { RelancePayload } from "@/lib/artisanApi";
import { RELANCE_CANAUX_FORM } from "@/lib/statuts";
import { todayISO } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";

export default function RelanceFormModal({
  devis,
  busy,
  onClose,
  onSubmit,
}: {
  devis: DevisItem[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: RelancePayload) => void;
}) {
  const [devisId, setDevisId] = useState<string>(devis[0] ? String(devis[0].id) : "");
  const [canal, setCanal] = useState<string>("Email");
  const [datePrevue, setDatePrevue] = useState(todayISO());
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inputCls = "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!devisId) {
      setError("Créez d'abord un devis à relancer.");
      return;
    }
    if (!message.trim()) {
      setError("Rédigez le message de la relance.");
      return;
    }
    setError(null);
    onSubmit({ devis_id: Number(devisId), canal, message: message.trim(), date_prevue: datePrevue || null });
  };

  return (
    <Modal
      title="Programmer une relance"
      subtitle="Un rappel sera planifié pour relancer ce devis."
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
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            Programmer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Devis concerné</span>
          <select value={devisId} onChange={(e) => setDevisId(e.target.value)} className={`${inputCls} cursor-pointer`}>
            {devis.length === 0 && <option value="">Aucun devis disponible</option>}
            {devis.map((d) => (
              <option key={d.id} value={d.id}>
                {d.numero} · {d.clientNom ?? "Sans client"} · {d.objet ?? ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Canal</span>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {RELANCE_CANAUX_FORM.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Date prévue</span>
            <input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            rows={4}
            maxLength={500}
            placeholder="Bonjour, avez-vous pu regarder le devis ? Je reste disponible…"
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 resize-none"
          />
          <span className="text-[11px] text-foreground-400 text-right">{message.length}/500</span>
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}