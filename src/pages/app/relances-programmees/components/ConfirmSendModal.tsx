import { useMemo } from "react";
import Modal from "@/pages/app/components/Modal";
import { formatShortDate } from "@/lib/dates";
import type { RelanceClientItem } from "@/lib/relancesClient";

/**
 * Fenêtre de confirmation avant un envoi groupé de relances. Elle récapitule le nombre de
 * relances concernées, les clients touchés (avec ou sans email) et les dates d'envoi, afin
 * d'éviter un envoi massif par erreur. L'envoi ne part qu'après validation.
 */
export default function ConfirmSendModal({
  relances,
  clientNom,
  hasEmail,
  busy,
  progress,
  onClose,
  onConfirm,
}: {
  relances: RelanceClientItem[];
  clientNom: (id: number) => string;
  hasEmail: (id: number) => boolean;
  /** Un envoi est-il déjà en cours (bouton désactivé) ? */
  busy?: boolean;
  /** Avancement de l'envoi en cours ({ done, total }) pour l'affichage en direct. */
  progress?: { done: number; total: number } | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  // Regroupement par client : un client peut avoir plusieurs relances concernées.
  const clients = useMemo(() => {
    const map = new Map<number, { id: number; nom: string; emailOk: boolean; count: number }>();
    relances.forEach((r) => {
      const existing = map.get(r.client_id);
      if (existing) existing.count += 1;
      else map.set(r.client_id, { id: r.client_id, nom: clientNom(r.client_id), emailOk: hasEmail(r.client_id), count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [relances, clientNom, hasEmail]);

  const joignables = relances.filter((r) => hasEmail(r.client_id)).length;
  const sansEmail = relances.length - joignables;
  const enRetard = relances.filter((r) => r.date_prevue < new Date().toISOString().slice(0, 10)).length;

  return (
    <Modal
      title="Confirmer l'envoi groupé"
      subtitle="Vérifiez le récapitulatif avant de lancer l'envoi : cette action est immédiate."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || joignables === 0}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            {progress
              ? `Envoi ${progress.done}/${progress.total}…`
              : `Envoyer ${joignables} relance${joignables > 1 ? "s" : ""}`}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Récap chiffré */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-primary-50 border border-primary-200">
            <p className="text-[11px] font-semibold text-primary-700 uppercase tracking-wide">Relances</p>
            <p className="mt-0.5 font-heading font-bold text-xl text-foreground-950">{relances.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary-50 border border-secondary-200">
            <p className="text-[11px] font-semibold text-secondary-700 uppercase tracking-wide">Clients touchés</p>
            <p className="mt-0.5 font-heading font-bold text-xl text-foreground-950">{clients.length}</p>
          </div>
        </div>

        {enRetard > 0 && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-alarm-warning-line"></i>
            {enRetard} relance{enRetard > 1 ? "s" : ""} en retard {enRetard > 1 ? "sont" : "est"} incluse
            {enRetard > 1 ? "s" : ""} dans cet envoi.
          </p>
        )}
        {sansEmail > 0 && (
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-mail-close-line"></i>
            {sansEmail} relance{sansEmail > 1 ? "s" : ""} sera{sansEmail > 1 ? "ont" : ""} ignorée
            {sansEmail > 1 ? "s" : ""} (client sans email).
          </p>
        )}

        {/* Liste des clients concernés */}
        <div>
          <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
            Clients concernés
          </p>
          <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
            {clients.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-background-100 border border-background-200"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold">
                    {c.nom.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-foreground-900 truncate">{c.nom}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.count > 1 && (
                    <span className="inline-flex items-center h-5 px-2 rounded-full bg-background-200 text-foreground-600 text-[10px] font-semibold whitespace-nowrap">
                      {c.count} relances
                    </span>
                  )}
                  {c.emailOk ? (
                    <i className="ri-mail-check-line text-accent-600" title="Email disponible"></i>
                  ) : (
                    <i className="ri-mail-close-line text-foreground-300" title="Pas d'email"></i>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-foreground-500 leading-relaxed">
          Chaque relance part immédiatement avec le message qui lui est associé (ou le modèle du profil). Les relances
          envoyées passeront en « Envoyée ». Pour la première concernée :{" "}
          {relances[0] ? `${clientNom(relances[0].client_id)} · ${formatShortDate(relances[0].date_prevue)}` : "—"}.
        </p>
      </div>
    </Modal>
  );
}