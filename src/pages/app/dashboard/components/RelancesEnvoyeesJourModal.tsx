import Modal from "@/pages/app/components/Modal";
import type { RelanceClientItem } from "@/lib/relancesClient";

interface Props {
  /** Relances client envoyées aujourd'hui (les plus récentes d'abord). */
  items: RelanceClientItem[];
  /** Nom d'un client à partir de son identifiant. */
  clientNom: (id: number) => string;
  onClose: () => void;
}

/** Heure d'envoi d'une relance (HH:MM), ou « — » si l'horodatage est absent. */
function heureEnvoi(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Détail « effet du jour J » : liste des relances client réellement envoyées aujourd'hui,
 * avec l'heure d'envoi et le client concerné. Ouvert depuis le compteur du tableau de bord.
 */
export default function RelancesEnvoyeesJourModal({ items, clientNom, onClose }: Props) {
  return (
    <Modal
      title="Relances envoyées aujourd'hui"
      subtitle={`${items.length} relance${items.length > 1 ? "s" : ""} partie${items.length > 1 ? "s" : ""} aujourd'hui`}
      onClose={onClose}
      wide
    >
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground-500">
          Aucune relance n'a encore été envoyée aujourd'hui. Les envois automatiques et manuels apparaîtront ici.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background-100 border border-background-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <i className="ri-send-plane-line"></i>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground-950 truncate">{clientNom(r.client_id)}</p>
                  <p className="text-[11px] text-foreground-500 truncate">
                    {r.message ? r.message : "Message par défaut du profil"}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-100 text-accent-800 text-xs font-semibold whitespace-nowrap shrink-0">
                <i className="ri-time-line"></i>
                {heureEnvoi(r.envoye_le)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}