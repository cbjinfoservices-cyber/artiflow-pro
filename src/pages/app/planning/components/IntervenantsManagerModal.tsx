import { useState } from "react";
import { couleurIntervenant, type Intervenant, type IntervenantPayload } from "@/lib/intervenants";
import Modal from "@/pages/app/components/Modal";
import IntervenantFormModal from "@/pages/app/planning/components/IntervenantFormModal";

/**
 * Modale de gestion de l'équipe : liste les intervenants, permet d'en ajouter, d'en modifier,
 * de les activer/désactiver et d'en supprimer. Les créneaux d'un intervenant supprimé sont
 * simplement désaffectés (aucune intervention n'est perdue).
 */
export default function IntervenantsManagerModal({
  intervenants,
  busy,
  onClose,
  onSave,
  onToggle,
  onDelete,
}: {
  intervenants: Intervenant[];
  busy: boolean;
  onClose: () => void;
  onSave: (payload: IntervenantPayload, id: number | null) => void;
  onToggle: (id: number, actif: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Intervenant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Intervenant | null>(null);

  const actifs = intervenants.filter((i) => i.actif);
  const inactifs = intervenants.filter((i) => !i.actif);

  const ouvrirCreation = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const ouvrirEdition = (i: Intervenant) => {
    setEditing(i);
    setFormOpen(true);
  };
  const handleSubmit = (payload: IntervenantPayload) => {
    onSave(payload, editing?.id ?? null);
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <>
      <Modal
        title="Intervenants de l'entreprise"
        subtitle="Ajoutez les personnes que vous pouvez affecter à vos interventions."
        onClose={onClose}
        wide
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={ouvrirCreation}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
            >
              <i className="ri-user-add-line"></i> Ajouter un intervenant
            </button>
          </>
        }
      >
        {intervenants.length === 0 ? (
          <div className="flex flex-col items-center text-center px-6 py-10 rounded-lg bg-background-100 border border-background-200">
            <span className="w-14 h-14 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-2xl">
              <i className="ri-team-line"></i>
            </span>
            <p className="mt-4 text-sm text-foreground-600 max-w-sm">
              Vous travaillez seul ? Aucun intervenant n'est nécessaire. Vous avez une équipe ? Ajoutez
              chacun pour répartir les interventions du planning.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {actifs.map((i) => (
                <div key={i.id} className="flex items-center gap-3 p-3 rounded-md bg-background-100 border border-background-200">
                  <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-background-50 text-sm font-bold" style={{ backgroundColor: couleurIntervenant(i.couleur) }}>
                    {i.nom.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground-900 truncate">{i.nom}</p>
                    <p className="text-[11px] text-foreground-500 truncate">
                      {i.metier || "Métier non précisé"}
                      {i.telephone ? ` · ${i.telephone}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggle(i.id, false)}
                    title="Désactiver"
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-amber-600 cursor-pointer"
                  >
                    <i className="ri-pause-circle-line text-foreground-500"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => ouvrirEdition(i)}
                    title="Modifier"
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 cursor-pointer"
                  >
                    <i className="ri-pencil-line text-foreground-500"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(i)}
                    title="Supprimer"
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-red-600 cursor-pointer"
                  >
                    <i className="ri-delete-bin-line text-foreground-500"></i>
                  </button>
                </div>
              ))}
            </div>

            {inactifs.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Inactifs ({inactifs.length})</p>
                {inactifs.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 p-3 rounded-md bg-background-100 border border-background-200 opacity-70">
                    <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-background-50 text-sm font-bold" style={{ backgroundColor: couleurIntervenant(i.couleur) }}>
                      {i.nom.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground-700 truncate">{i.nom}</p>
                      <p className="text-[11px] text-foreground-500 truncate">{i.metier || "Métier non précisé"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggle(i.id, true)}
                      title="Réactiver"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-900 text-xs font-semibold hover:bg-secondary-200 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-play-circle-line"></i> Réactiver
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(i)}
                      title="Supprimer"
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-red-600 cursor-pointer"
                    >
                      <i className="ri-delete-bin-line text-foreground-500"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {formOpen && (
        <IntervenantFormModal intervenant={editing} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />
      )}

      {confirmDelete && (
        <Modal title="Supprimer cet intervenant ?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-foreground-600">
            <strong className="text-foreground-900">{confirmDelete.nom}</strong> sera retiré de l'équipe. Ses interventions
            existantes sont conservées : elles passeront simplement en « non affecté ».
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(confirmDelete.id);
                setConfirmDelete(null);
              }}
              className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
            >
              Supprimer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}