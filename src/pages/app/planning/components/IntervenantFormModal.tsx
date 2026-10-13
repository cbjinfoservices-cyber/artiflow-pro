import { useState } from "react";
import { COULEURS_INTERVENANT, type Intervenant, type IntervenantPayload } from "@/lib/intervenants";
import Modal from "@/pages/app/components/Modal";

/**
 * Formulaire d'ajout / d'édition d'un intervenant de l'entreprise.
 * On y renseigne le nom, le métier, le téléphone, une couleur de repérage et l'état actif.
 */
export default function IntervenantFormModal({
  intervenant,
  busy,
  onClose,
  onSubmit,
}: {
  /** Intervenant existant en édition, ou null pour une création. */
  intervenant: Intervenant | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: IntervenantPayload) => void;
}) {
  const [nom, setNom] = useState(intervenant?.nom ?? "");
  const [metier, setMetier] = useState(intervenant?.metier ?? "");
  const [telephone, setTelephone] = useState(intervenant?.telephone ?? "");
  const [couleur, setCouleur] = useState(intervenant?.couleur ?? COULEURS_INTERVENANT[0].cle);
  const [actif, setActif] = useState(intervenant?.actif ?? true);
  const [error, setError] = useState<string | null>(null);

  const inputCls = "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!nom.trim()) {
      setError("Indiquez au moins le nom de l'intervenant.");
      return;
    }
    setError(null);
    onSubmit({ nom: nom.trim(), metier: metier.trim() || null, telephone: telephone.trim() || null, couleur, actif });
  };

  return (
    <Modal
      title={intervenant ? "Modifier l'intervenant" : "Ajouter un intervenant"}
      subtitle="Les intervenants sont les personnes que vous pouvez affecter à un créneau."
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
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
            {intervenant ? "Enregistrer" : "Ajouter"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Nom de l'intervenant</span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Karim Benali" className={inputCls} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Métier / rôle (optionnel)</span>
            <input value={metier} onChange={(e) => setMetier(e.target.value)} placeholder="Électricien" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Téléphone (optionnel)</span>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" className={inputCls} />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Couleur de repérage</span>
          <div className="flex flex-wrap gap-2">
            {COULEURS_INTERVENANT.map((c) => (
              <button
                key={c.cle}
                type="button"
                onClick={() => setCouleur(c.cle)}
                aria-label={c.label}
                title={c.label}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-transform ${
                  couleur === c.cle ? "ring-2 ring-offset-2 ring-foreground-400 scale-105" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {couleur === c.cle && <i className="ri-check-line text-white text-sm"></i>}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-md bg-background-100 border border-background-200 cursor-pointer">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="w-4 h-4 accent-primary-500 cursor-pointer" />
          <span className="flex-1">
            <span className="block text-sm font-medium text-foreground-800">Intervenant actif</span>
            <span className="block text-[11px] text-foreground-500">
              Un intervenant inactif reste enregistré mais n'apparaît plus dans les sélecteurs.
            </span>
          </span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}