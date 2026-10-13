import { useState } from "react";
import type { ClientItem } from "@/hooks/useArtisanData";
import type { ChantierPayload } from "@/lib/artisanApi";
import type { Intervenant } from "@/lib/intervenants";
import { CHANTIER_STATUTS_FORM } from "@/lib/statuts";
import Modal from "@/pages/app/components/Modal";

export default function ChantierFormModal({
  clients,
  intervenants,
  busy,
  onClose,
  onSubmit,
}: {
  clients: ClientItem[];
  /** Intervenants actifs proposés comme pilote du chantier. */
  intervenants: Intervenant[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: ChantierPayload) => void;
}) {
  const [libelle, setLibelle] = useState("");
  const [adresse, setAdresse] = useState("");
  const [statut, setStatut] = useState<string>("Planifié");
  const [dateDebut, setDateDebut] = useState("");
  const [montant, setMontant] = useState("");
  const [clientId, setClientId] = useState<string>(clients[0] ? String(clients[0].id) : "");
  const [piloteId, setPiloteId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const inputCls = "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!libelle.trim()) {
      setError("Donnez un libellé à votre chantier.");
      return;
    }
    setError(null);
    onSubmit({
      libelle: libelle.trim(),
      adresse: adresse.trim(),
      statut,
      date_debut: dateDebut || null,
      montant: Number(montant) || 0,
      client_id: clientId ? Number(clientId) : null,
      intervenant_id: piloteId ? Number(piloteId) : null,
    });
  };

  return (
    <Modal
      title="Nouveau chantier"
      subtitle="Suivez l'avancement de vos chantiers étape par étape."
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
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Libellé du chantier</span>
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Rénovation salle de bain" className={inputCls} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Client</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${inputCls} cursor-pointer`}>
              <option value="">Sans client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Statut</span>
            <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {CHANTIER_STATUTS_FORM.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Qui pilote ce chantier ? (optionnel)</span>
          <select value={piloteId} onChange={(e) => setPiloteId(e.target.value)} className={`${inputCls} cursor-pointer`}>
            <option value="">Personne pour l'instant</option>
            {intervenants.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nom}
                {i.metier ? ` · ${i.metier}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Adresse / ville</span>
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Lyon 6e" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Date de début</span>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Montant (€)</span>
          <input value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="decimal" placeholder="4380" className={inputCls} />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}