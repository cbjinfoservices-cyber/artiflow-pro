import { useState } from "react";
import type { ClientItem } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/pages/app/components/Modal";
import { addDays, todayISO, toISODate } from "@/lib/dates";
import {
  createRelanceClient,
  deleteRelanceClient,
  updateRelanceClient,
  type RelanceClientItem,
} from "@/lib/relancesClient";

/** Raccourcis de date proposés pour programmer rapidement une relance. */
const RACCOURCIS: { label: string; jours: number }[] = [
  { label: "Aujourd'hui", jours: 0 },
  { label: "Dans 3 j", jours: 3 },
  { label: "Dans 7 j", jours: 7 },
  { label: "Dans 14 j", jours: 14 },
];

/**
 * Fenêtre de programmation d'une relance client à une date choisie, ouverte depuis le
 * widget « Clients à suivre ». L'email est envoyé automatiquement le jour venu par la
 * tâche planifiée quotidienne. Un message ponctuel peut être saisi ; laissé vide, le
 * message par défaut du profil est utilisé.
 */
export default function ScheduleRelanceModal({
  client,
  existing,
  onClose,
  onSaved,
}: {
  client: ClientItem;
  existing: RelanceClientItem | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [date, setDate] = useState(existing?.date_prevue ?? toISODate(addDays(new Date(), 3)));
  const [message, setMessage] = useState(existing?.message ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user) return;
    if (!date) {
      setError("Choisissez une date d'envoi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (existing) await updateRelanceClient(existing.id, { date_prevue: date, message });
      else await createRelanceClient(user.id, client.id, date, message);
      await onSaved();
      onClose();
    } catch {
      setError("L'enregistrement de la relance a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!existing) return;
    setBusy(true);
    setError(null);
    try {
      await deleteRelanceClient(existing.id);
      await onSaved();
      onClose();
    } catch {
      setError("L'annulation de la relance a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={existing ? "Modifier la relance programmée" : "Programmer une relance"}
      subtitle={`Envoi automatique à la date choisie · ${client.nom}`}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-red-50 text-red-600 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              <i className="ri-delete-bin-line"></i>
              Annuler la relance
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-calendar-check-line"></i>}
            {existing ? "Enregistrer" : "Programmer"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
            <i className="ri-calendar-line text-foreground-400"></i>
            Date d'envoi
          </span>
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 px-3 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 cursor-pointer"
          />
          <div className="flex flex-wrap gap-1.5 mt-1">
            {RACCOURCIS.map((r) => {
              const value = toISODate(addDays(new Date(), r.jours));
              const actif = date === value;
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setDate(value)}
                  className={`inline-flex items-center h-7 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-secondary-500 border-secondary-500 text-background-50"
                      : "bg-background-100 border-background-200 text-foreground-600 hover:border-secondary-300"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
            <i className="ri-mail-line text-foreground-400"></i>
            Message (optionnel)
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Laissez vide pour utiliser le message par défaut de votre profil."
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
          />
          <span className="text-[11px] text-foreground-400">
            L'objet et le texte par défaut se règlent dans votre profil (onglet « Mon profil » → « Personnalisation des
            emails » → « Relances »).
          </span>
        </div>

        {!client.email && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {client.nom} n'a pas d'adresse email : ajoutez-la dans sa fiche pour pouvoir relancer.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}