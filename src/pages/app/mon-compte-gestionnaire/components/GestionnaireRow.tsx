import { useState } from "react";
import type { Gestionnaire, GestionnairePatch } from "@/hooks/useAuth";
import { formatShortDate } from "@/lib/dates";
import NoteGestionnaireModal from "@/pages/app/mon-compte-gestionnaire/components/NoteGestionnaireModal";

function Switch({
  actif,
  disabled,
  label,
  onToggle,
}: {
  actif: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? "Réservé au gestionnaire principal" : `Afficher ou masquer « ${label} » pour ce compte`}
      className={`relative w-10 h-6 shrink-0 rounded-full transition-colors ${
        actif ? "bg-accent-500" : "bg-background-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${
          actif ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

/**
 * Une ligne de la liste des gestionnaires : adresse, badge de rôle, libellé éditable, et
 * les deux interrupteurs d'affichage (Comptabilité / Mon abonnement). L'édition du libellé
 * et la suppression sont réservées au gestionnaire principal.
 */
export default function GestionnaireRow({
  gestionnaire,
  estPrincipal,
  estMoi,
  lectureSeule,
  onPatch,
  onSupprimer,
}: {
  gestionnaire: Gestionnaire;
  estPrincipal: boolean;
  estMoi: boolean;
  lectureSeule: boolean;
  onPatch: (id: number, patch: GestionnairePatch) => void;
  onSupprimer: (id: number, email: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(gestionnaire.libelle ?? "");
  const [noteOpen, setNoteOpen] = useState(false);

  const enregistrerLibelle = () => {
    setEditing(false);
    const valeur = draft.trim();
    if (valeur === (gestionnaire.libelle ?? "")) return;
    onPatch(gestionnaire.id, { libelle: valeur || null });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-5 py-4 border-t border-background-200 hover:bg-background-50 transition-colors">
      <div className="md:col-span-5 flex items-start gap-3 min-w-0">
        <span
          className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg ${
            estPrincipal ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-700"
          }`}
        >
          <i className={estPrincipal ? "ri-shield-star-line" : "ri-shield-user-line"}></i>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-950 truncate">{gestionnaire.email}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {estPrincipal && (
              <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold whitespace-nowrap">
                <i className="ri-shield-star-line text-[10px]"></i>
                Principal
              </span>
            )}
            {estMoi && (
              <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap">
                Vous
              </span>
            )}
            <span className="text-[10px] text-foreground-400 whitespace-nowrap">
              Ajouté le {formatShortDate(gestionnaire.created_at)}
            </span>
          </div>

          <div className="mt-1.5">
            {editing ? (
              <input
                autoFocus
                value={draft}
                maxLength={40}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={enregistrerLibelle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    enregistrerLibelle();
                  }
                  if (e.key === "Escape") {
                    setDraft(gestionnaire.libelle ?? "");
                    setEditing(false);
                  }
                }}
                placeholder="Ex. Comptable externe, Support…"
                className="h-7 w-52 max-w-full px-2 rounded-md bg-background-50 border border-primary-300 text-[11px] text-foreground-800 outline-none focus:border-primary-500"
              />
            ) : gestionnaire.libelle ? (
              <button
                type="button"
                disabled={lectureSeule}
                onClick={() => {
                  setDraft(gestionnaire.libelle ?? "");
                  setEditing(true);
                }}
                title={lectureSeule ? gestionnaire.libelle : "Modifier le libellé"}
                className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap ${
                  lectureSeule ? "cursor-default" : "cursor-pointer hover:bg-secondary-200"
                }`}
              >
                <i className="ri-price-tag-3-line text-[10px]"></i>
                {gestionnaire.libelle}
                {!lectureSeule && <i className="ri-pencil-line text-[10px] opacity-70"></i>}
              </button>
            ) : !lectureSeule ? (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setEditing(true);
                }}
                title="Ajouter un libellé à cette adresse (ex. « Comptable externe »)"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground-400 hover:text-primary-700 cursor-pointer transition-colors"
              >
                <i className="ri-add-line"></i>
                Ajouter un libellé
              </button>
            ) : (
              <span className="text-[10px] text-foreground-300">Aucun libellé</span>
            )}
          </div>

          {gestionnaire.note ? (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-background-100 border border-background-200 px-2.5 py-2">
              <i className="ri-sticky-note-line text-foreground-400 text-xs mt-0.5 shrink-0"></i>
              <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-foreground-600 whitespace-pre-wrap break-words">
                {gestionnaire.note}
              </p>
              {!lectureSeule && (
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  title="Modifier la note interne"
                  className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-primary-700 cursor-pointer transition-colors"
                >
                  <i className="ri-pencil-line text-xs"></i>
                </button>
              )}
            </div>
          ) : (
            !lectureSeule && (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                title="Ajouter une note interne (contexte, mission…)"
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-foreground-400 hover:text-primary-700 cursor-pointer transition-colors"
              >
                <i className="ri-sticky-note-line"></i>
                Ajouter une note interne
              </button>
            )
          )}
        </div>
      </div>

      <div className="md:col-span-3 flex items-center gap-2 md:justify-center">
        <span className="md:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1">
          Comptabilité
        </span>
        <Switch
          actif={gestionnaire.voir_comptabilite}
          disabled={lectureSeule}
          label="Comptabilité"
          onToggle={() => onPatch(gestionnaire.id, { voir_comptabilite: !gestionnaire.voir_comptabilite })}
        />
      </div>

      <div className="md:col-span-3 flex items-center gap-2 md:justify-center">
        <span className="md:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1">
          Mon abonnement
        </span>
        <Switch
          actif={gestionnaire.voir_mon_abonnement}
          disabled={lectureSeule}
          label="Mon abonnement"
          onToggle={() => onPatch(gestionnaire.id, { voir_mon_abonnement: !gestionnaire.voir_mon_abonnement })}
        />
      </div>

      <div className="md:col-span-1 flex items-center md:justify-end">
        {!estPrincipal && !lectureSeule && (
          <button
            type="button"
            onClick={() => onSupprimer(gestionnaire.id, gestionnaire.email)}
            title="Retirer cette adresse gestionnaire"
            className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-500 hover:bg-red-100 hover:text-red-600 cursor-pointer transition-colors"
          >
            <i className="ri-delete-bin-line"></i>
          </button>
        )}
      </div>

      {noteOpen && (
        <NoteGestionnaireModal
          gestionnaire={gestionnaire}
          onClose={() => setNoteOpen(false)}
          onSave={(note) => {
            setNoteOpen(false);
            onPatch(gestionnaire.id, { note });
          }}
        />
      )}
    </div>
  );
}