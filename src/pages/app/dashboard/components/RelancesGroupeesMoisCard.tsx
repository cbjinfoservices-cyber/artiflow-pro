import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ChantierItem } from "@/hooks/useArtisanData";
import { useRelancesGroupeesMois } from "@/hooks/useRelancesGroupeesMois";

/**
 * Part des clients relancés ce mois-ci grâce aux nouvelles groupées (envoi groupé à la demande
 * ou envoi automatique), par rapport à tous les clients relancés dans le mois.
 * Un client compte une seule fois, même s'il a reçu plusieurs emails.
 */
export default function RelancesGroupeesMoisCard({ chantiers }: { chantiers: ChantierItem[] }) {
  const { envois, loading, error } = useRelancesGroupeesMois();

  // Un chantier inconnu (supprimé) reste compté à part : on ne le fond pas dans un autre client.
  const clientDeChantier = useMemo(() => {
    const map = new Map<number, string>();
    chantiers.forEach((c) => {
      map.set(c.id, c.client_id !== null ? `client-${c.client_id}` : `chantier-${c.id}`);
    });
    return map;
  }, [chantiers]);

  const stats = useMemo(() => {
    const tous = new Set<string>();
    const groupes = new Set<string>();
    let emailsGroupes = 0;
    envois.forEach((e) => {
      const cle = clientDeChantier.get(e.chantierId) ?? `chantier-${e.chantierId}`;
      tous.add(cle);
      if (e.origine === "groupe" || e.origine === "auto") {
        groupes.add(cle);
        emailsGroupes += 1;
      }
    });
    const total = tous.size;
    const part = total === 0 ? 0 : Math.round((groupes.size / total) * 100);
    return { total, groupes: groupes.size, part, emailsGroupes };
  }, [envois, clientDeChantier]);

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800">
          <i className="ri-send-plane-2-line text-lg"></i>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-sm font-semibold text-foreground-950">
              Relancés ce mois-ci grâce aux nouvelles groupées
            </h2>
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-secondary-100 text-secondary-900 text-[10px] font-bold whitespace-nowrap">
              Ce mois-ci
            </span>
          </div>

          {loading ? (
            <p className="mt-2 text-xs text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-loader-4-line animate-spin"></i>
              Calcul en cours…
            </p>
          ) : error ? (
            <p className="mt-2 text-xs text-red-600 inline-flex items-start gap-1.5">
              <i className="ri-error-warning-line mt-px"></i>
              {error}
            </p>
          ) : stats.total === 0 ? (
            <p className="mt-2 text-xs text-foreground-600">
              Aucun client relancé ce mois-ci pour l&apos;instant. Dès qu&apos;un email part (à la main ou en groupe),
              la part s&apos;affiche ici.
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-2xl font-heading font-bold text-foreground-950 tabular-nums">{stats.part} %</span>
                <span className="text-xs text-foreground-600 pb-1">
                  <strong className="text-foreground-900">{stats.groupes}</strong> client
                  {stats.groupes > 1 ? "s" : ""} sur{" "}
                  <strong className="text-foreground-900">{stats.total}</strong> relancé
                  {stats.total > 1 ? "s" : ""} ce mois-ci
                </span>
              </div>

              <div
                className="mt-2 h-2 rounded-full bg-background-200 overflow-hidden"
                role="progressbar"
                aria-valuenow={stats.part}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Part des clients relancés grâce aux nouvelles groupées"
              >
                <div
                  className="h-full rounded-full bg-secondary-500 transition-all"
                  style={{ width: `${stats.part}%` }}
                ></div>
              </div>

              <p className="mt-2 text-[11px] text-foreground-500">
                {stats.emailsGroupes} email{stats.emailsGroupes > 1 ? "s" : ""} groupé
                {stats.emailsGroupes > 1 ? "s" : ""} envoyé{stats.emailsGroupes > 1 ? "s" : ""} (bouton « Nouvelles
                groupées » et envoi automatique). Le reste a été relancé à la main.
              </p>
            </>
          )}

          <Link
            to="/app/chantiers?sans-nouvelles=1"
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap hover:border-secondary-300 hover:text-secondary-900 transition-colors"
          >
            <i className="ri-filter-3-line"></i>
            Voir les clients à relancer
          </Link>
        </div>
      </div>
    </section>
  );
}