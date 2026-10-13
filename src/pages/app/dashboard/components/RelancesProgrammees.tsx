import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientItem } from "@/hooks/useArtisanData";
import type { RelanceClientItem } from "@/lib/relancesClient";
import { formatShortDate } from "@/lib/dates";
import BoutonPartager from "@/pages/app/components/BoutonPartager";

/**
 * Bandeau du tableau de bord : donne un coup d'œil immédiat sur les relances client
 * programmées à une date choisie (envoi automatique le jour venu).
 * - Affiche le compteur total et la prochaine relance prévue.
 * - Liste les prochaines relances (client + date) ; un clic ouvre la fiche du client.
 */
export default function RelancesProgrammees({
  relances,
  clients,
}: {
  relances: RelanceClientItem[];
  clients: ClientItem[];
}) {
  const navigate = useNavigate();

  const programmees = useMemo(
    () =>
      relances
        .filter((r) => r.statut === "Programmée")
        .slice()
        .sort((a, b) => a.date_prevue.localeCompare(b.date_prevue)),
    [relances],
  );

  const nomParClient = useMemo(() => {
    const map = new Map<number, string>();
    clients.forEach((c) => map.set(c.id, c.nom));
    return map;
  }, [clients]);

  const prochaine = programmees[0] ?? null;
  const prochains = programmees.slice(0, 4);

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg bg-background-100 border border-background-200 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 shrink-0">
        <span className="w-10 h-10 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className="ri-calendar-schedule-line text-lg"></i>
        </span>
        <div>
          <h3 className="font-heading font-semibold text-sm text-foreground-950">Relances programmées</h3>
          <p className="text-[11px] text-foreground-500">Envoi automatique à la date choisie</p>
        </div>
        <span className="ml-1 inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-secondary-100 text-secondary-800 text-sm font-bold">
          {programmees.length}
        </span>
      </div>

      <div className="hidden sm:block w-px self-stretch bg-background-200"></div>

      {programmees.length === 0 ? (
        <p className="flex-1 text-sm text-foreground-500">
          Aucune relance programmée. Programmez-en une depuis la fiche d'un client ou le widget « Clients à suivre ».
        </p>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <p className="text-xs text-foreground-600 inline-flex items-center gap-1.5">
            <i className="ri-time-line text-accent-600"></i>
            Prochaine : <strong className="text-foreground-900">
              {nomParClient.get(prochaine!.client_id) ?? "Client"}
            </strong>{" "}
            le <strong className="text-foreground-900">{formatShortDate(prochaine!.date_prevue)}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            {prochains.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/app/clients?client=${r.client_id}`)}
                title={`Ouvrir la fiche de ${nomParClient.get(r.client_id) ?? "ce client"}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-accent-200 bg-accent-50 text-accent-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors"
              >
                <i className="ri-user-line"></i>
                <span className="max-w-[10rem] truncate">{nomParClient.get(r.client_id) ?? "Client"}</span>
                <span className="text-accent-600">·</span>
                <span className="text-accent-700">{formatShortDate(r.date_prevue)}</span>
              </button>
            ))}
            {programmees.length > prochains.length && (
              <span className="inline-flex items-center h-8 px-3 text-[11px] font-semibold text-foreground-500">
                +{programmees.length - prochains.length} autre{programmees.length - prochains.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        <BoutonPartager
          label="Relances programmées"
          chemin="/app/relances-programmees"
          title="Partager la vue des relances programmées"
        />
        <button
          type="button"
          onClick={() => navigate("/app/relances-programmees")}
          title="Ouvrir la page dédiée pour tout voir et reprogrammer en lot"
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 hover:border-accent-300 hover:text-accent-700 cursor-pointer whitespace-nowrap transition-colors"
        >
          Voir tout
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
}