import { useState } from "react";
import type { ClientItem } from "@/hooks/useArtisanData";
import type { ClientPayload } from "@/lib/artisanApi";
import { NOTE_PRIORITES } from "@/lib/notePriorites";
import Modal from "@/pages/app/components/Modal";

export default function ClientFormModal({
  initial,
  busy,
  onClose,
  onSubmit,
  defaultType = "particulier",
}: {
  initial: ClientItem | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: ClientPayload) => void;
  /** Type présélectionné à la création (« professionnel » depuis la page Professionnels). */
  defaultType?: string;
}) {
  const [type, setType] = useState(initial?.type === "professionnel" ? "professionnel" : initial ? "particulier" : defaultType);
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [contactNom, setContactNom] = useState(initial?.contact_nom ?? "");
  const [siret, setSiret] = useState(initial?.siret ?? "");
  const [secteur, setSecteur] = useState(initial?.secteur ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [notePriorite, setNotePriorite] = useState(initial?.note_priorite ?? "");
  const [error, setError] = useState<string | null>(null);

  const pro = type === "professionnel";
  const inputCls =
    "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!nom.trim()) {
      setError(pro ? "La raison sociale est obligatoire." : "Le nom du client est obligatoire.");
      return;
    }
    setError(null);
    onSubmit({
      nom: nom.trim(),
      telephone: telephone.trim(),
      email: email.trim(),
      adresse: adresse.trim(),
      type,
      contact_nom: contactNom.trim(),
      siret: siret.trim(),
      secteur: secteur.trim(),
      notes: notes.trim(),
      note_priorite: notePriorite,
    });
  };

  return (
    <Modal
      title={initial ? "Modifier le client" : pro ? "Nouveau client professionnel" : "Nouveau client"}
      subtitle="Ces informations alimentent vos devis et chantiers."
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
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Type de client</span>
          <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            <button
              type="button"
              onClick={() => setType("particulier")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                !pro ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-user-line"></i>
              Particulier
            </button>
            <button
              type="button"
              onClick={() => setType("professionnel")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                pro ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-building-2-line"></i>
              Professionnel
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">{pro ? "Raison sociale" : "Nom / raison sociale"}</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder={pro ? "SARL Bâti Rhône" : "Mme Dupont"}
            className={inputCls}
          />
        </label>

        {pro && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Interlocuteur</span>
              <input
                value={contactNom}
                onChange={(e) => setContactNom(e.target.value)}
                placeholder="Marc Petit"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Secteur d'activité</span>
              <input
                value={secteur}
                onChange={(e) => setSecteur(e.target.value)}
                placeholder="Rénovation, Immobilier…"
                className={inputCls}
              />
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Téléphone</span>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.fr" className={inputCls} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Adresse</span>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="12 rue de la Charité, Lyon 6e" className={inputCls} />
        </label>

        {pro && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">SIRET (optionnel)</span>
            <input value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="812 345 678 00019" className={inputCls} />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
            <i className="ri-sticky-note-line text-foreground-400"></i>
            Notes internes (optionnel)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes visibles uniquement par vous : préférences, historique, points de vigilance…"
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 resize-none"
          />
        </label>

        {notes.trim().length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
              <i className="ri-flag-line text-foreground-400"></i>
              Priorité de la note
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setNotePriorite("")}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  notePriorite === ""
                    ? "bg-foreground-900 border-foreground-900 text-background-50"
                    : "bg-background-100 border-background-200 text-foreground-600 hover:border-foreground-400"
                }`}
              >
                <i className="ri-forbid-2-line"></i>
                Aucune
              </button>
              {NOTE_PRIORITES.map((p) => {
                const actif = notePriorite === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setNotePriorite(p.key)}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      actif ? `${p.badge}` : "bg-background-100 border-background-200 text-foreground-600 hover:border-foreground-400"
                    }`}
                  >
                    <i className={p.icon}></i>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}