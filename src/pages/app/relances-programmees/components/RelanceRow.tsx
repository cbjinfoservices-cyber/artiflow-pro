import { formatShortDate, todayISO } from "@/lib/dates";
import type { RelanceClientItem } from "@/lib/relancesClient";

interface Props {
  relance: RelanceClientItem;
  clientNom: string;
  /** Le client possède-t-il une adresse email (sinon la relance ne partira pas). */
  hasEmail: boolean;
  selected: boolean;
  /** La relance est la « relance en cours » (focus clavier) de la liste : on la surligne. */
  focused?: boolean;
  /** Envoi immédiat de cette relance en cours. */
  sending?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onPreview: () => void;
  /** Envoie la relance tout de suite, sans passer par l'aperçu. */
  onSendNow: () => void;
  onOpenClient: () => void;
  /** Appelé quand la ligne devient la relance en cours (clic ou navigation clavier). */
  onFocus?: () => void;
}

/**
 * Ligne d'une relance client programmée sur la page « Relances programmées » :
 * case de sélection, client (clic → fiche), aperçu du message, date, et actions
 * envoyer maintenant / aperçu / modifier / annuler. Réutilisée par la vue liste et la vue par client.
 */
export default function RelanceRow({
  relance,
  clientNom,
  hasEmail,
  selected,
  focused = false,
  sending = false,
  onToggle,
  onEdit,
  onCancel,
  onPreview,
  onSendNow,
  onOpenClient,
  onFocus,
}: Props) {
  const retard = relance.date_prevue < todayISO();

  return (
    <li
      onClick={onFocus}
      className={`flex flex-col gap-3 p-4 rounded-lg border transition-colors md:flex-row md:items-center ${
        selected ? "bg-primary-50 border-primary-300" : "bg-background-100 border-background-200"
      } ${focused ? "ring-2 ring-primary-300 border-primary-300" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={selected ? "Désélectionner cette relance" : "Sélectionner cette relance"}
        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md cursor-pointer text-lg"
      >
        <i className={selected ? "ri-checkbox-line text-primary-600" : "ri-checkbox-blank-line text-foreground-300"}></i>
      </button>

      <div className="flex items-center gap-3 min-w-0 md:flex-1">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 font-semibold">
          {clientNom.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <button
            type="button"
            onClick={onOpenClient}
            className="font-heading font-semibold text-sm text-foreground-950 hover:text-primary-700 cursor-pointer truncate text-left"
            title="Ouvrir la fiche du client"
          >
            {clientNom}
          </button>
          <p className="text-[11px] text-foreground-500 truncate">
            {relance.message ? relance.message : "Message par défaut du profil"}
            {!hasEmail ? " · pas d'email" : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap ${
            retard ? "bg-red-100 text-red-700" : "bg-accent-100 text-accent-800"
          }`}
        >
          <i className={retard ? "ri-alarm-warning-line" : "ri-calendar-line"}></i>
          {formatShortDate(relance.date_prevue)}
        </span>
        <button
          type="button"
          onClick={onSendNow}
          disabled={!hasEmail || sending}
          title={!hasEmail ? "Ce client n'a pas d'adresse email" : "Envoyer cette relance tout de suite, sans attendre la date"}
          aria-label="Envoyer maintenant"
          className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-500 text-background-50 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {sending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
        </button>
        <button
          type="button"
          onClick={onPreview}
          title="Aperçu de l'email avant envoi"
          className="w-9 h-9 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-600 hover:border-accent-300 hover:text-accent-700 cursor-pointer transition-colors"
        >
          <i className="ri-eye-line"></i>
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Modifier la date ou le message"
          className="w-9 h-9 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-600 hover:border-primary-300 hover:text-primary-700 cursor-pointer transition-colors"
        >
          <i className="ri-edit-line"></i>
        </button>
        <button
          type="button"
          onClick={onCancel}
          title="Annuler cette relance"
          className="w-9 h-9 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-400 hover:text-red-600 hover:border-red-300 cursor-pointer transition-colors"
        >
          <i className="ri-delete-bin-line"></i>
        </button>
      </div>
    </li>
  );
}