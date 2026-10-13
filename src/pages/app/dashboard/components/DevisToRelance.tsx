import { Link } from "react-router-dom";
import { formatEuros } from "@/lib/format";
import BoutonPartager from "@/pages/app/components/BoutonPartager";

export interface DevisRelanceRow {
  id: number;
  numero: string;
  clientNom: string | null;
  total_ht: number;
}

function DevisRow({ d }: { d: DevisRelanceRow }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground-900 truncate">{d.clientNom ?? "Client"}</p>
        <p className="text-[11px] text-foreground-500 truncate">{d.numero}</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-foreground-950">{formatEuros(Number(d.total_ht))}</span>
    </div>
  );
}

function Group({
  title,
  hint,
  icon,
  count,
  tone,
  items,
  emptyText,
}: {
  title: string;
  hint: string;
  icon: string;
  count: number;
  tone: string;
  items: DevisRelanceRow[];
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md text-xs ${tone}`}>
          <i className={icon}></i>
        </span>
        <span className="text-xs font-semibold text-foreground-800">{title}</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-background-200 text-foreground-600 font-semibold">
          {count}
        </span>
      </div>
      <p className="text-[11px] text-foreground-500 -mt-0.5">{hint}</p>
      {items.length === 0 ? (
        <p className="text-xs text-foreground-500 py-1.5">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((d) => (
            <DevisRow key={d.id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DevisToRelance({
  aRelancer,
  jamaisContactes,
  title = "Devis à suivre",
  hideLink = false,
  onSeeAll,
  partager,
}: {
  aRelancer: DevisRelanceRow[];
  jamaisContactes: DevisRelanceRow[];
  title?: string;
  hideLink?: boolean;
  onSeeAll?: () => void;
  /** Chemin de la vue « devis à suivre » à proposer au partage (bouton « Partager »). */
  partager?: string;
}) {
  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="font-heading font-semibold text-base text-foreground-950">{title}</h2>
        <div className="flex items-center gap-2">
          {partager && (
            <BoutonPartager
              label="Devis à suivre"
              chemin={partager}
              title="Partager la vue des devis à suivre"
            />
          )}
          {!hideLink && (
            onSeeAll ? (
              <button
                type="button"
                onClick={onSeeAll}
                className="text-xs font-medium text-primary-700 hover:underline cursor-pointer"
              >
                Voir tout
              </button>
            ) : (
              <Link to="/app/devis" className="text-xs font-medium text-primary-700 hover:underline cursor-pointer">
                Voir tout
              </Link>
            )
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Group
          title="Déjà contactés · à relancer"
          hint="Le client a reçu le devis (envoi ou relance tracé), une relance est pertinente."
          icon="ri-notification-3-line"
          tone="bg-secondary-100 text-secondary-700"
          count={aRelancer.length}
          items={aRelancer}
          emptyText="Aucun devis contacté en attente de relance."
        />

        <div className="h-px bg-background-200"></div>

        <Group
          title="Jamais contactés"
          hint="Aucun envoi ni relance tracé : le client n'a pas encore été contacté."
          icon="ri-mail-add-line"
          tone="bg-primary-100 text-primary-700"
          count={jamaisContactes.length}
          items={jamaisContactes}
          emptyText="Tous vos devis en attente ont déjà été contactés."
        />
      </div>
    </div>
  );
}