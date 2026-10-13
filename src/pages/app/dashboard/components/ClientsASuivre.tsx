import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientItem } from "@/hooks/useArtisanData";
import { notePrioriteInfo, notePrioriteRank, NOTE_PRIORITES } from "@/lib/notePriorites";
import { sendClientRelanceEmail } from "@/lib/artisanApi";
import { RELANCE_CLIENT_DELAI_ALERTE, joursDepuisDerniereRelance, type RelanceClientItem } from "@/lib/relancesClient";
import { formatShortDate } from "@/lib/dates";
import ScheduleRelanceModal from "@/pages/app/dashboard/components/ScheduleRelanceModal";
import BoutonPartager from "@/pages/app/components/BoutonPartager";

/**
 * Widget du tableau de bord : remonte les fiches clients qui portent une note interne,
 * classées par priorité (urgent, sensible, à relancer, info).
 * - Un clic sur une puce de priorité filtre la page Clients sur cette priorité.
 * - Un clic sur une fiche ouvre son détail.
 * - Les fiches « À relancer » disposent d'un envoi de relance email en un clic,
 *   et d'une programmation à une date choisie (envoi automatique le jour venu).
 * - La date de la dernière relance est rappelée pour éviter les doubles envois rapprochés.
 */
export default function ClientsASuivre({
  clients,
  onClientsChanged,
  relances,
  onRelancesChanged,
}: {
  clients: ClientItem[];
  onClientsChanged?: () => Promise<void> | void;
  /** Relances client programmées (chargées par le tableau de bord, partagées avec le bandeau). */
  relances: RelanceClientItem[];
  /** Recharge les relances programmées (après programmation/modification/annulation). */
  onRelancesChanged?: () => Promise<void> | void;
}) {
  const navigate = useNavigate();

  const [sendingId, setSendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<ClientItem | null>(null);

  const aSuivre = useMemo(() => {
    return clients
      .filter((c) => Boolean(c.notes && c.notes.trim()))
      .sort((a, b) => {
        const r = notePrioriteRank(a.note_priorite) - notePrioriteRank(b.note_priorite);
        if (r !== 0) return r;
        return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
      });
  }, [clients]);

  // Relance programmée la plus proche par client (pour afficher « Prévue le … »).
  const scheduledByClient = useMemo(() => {
    const map = new Map<number, RelanceClientItem>();
    relances
      .filter((r) => r.statut === "Programmée")
      .forEach((r) => {
        const prev = map.get(r.client_id);
        if (!prev || r.date_prevue < prev.date_prevue) map.set(r.client_id, r);
      });
    return map;
  }, [relances]);

  // Compteur par priorité : sert aux puces cliquables de filtrage.
  const parPriorite = useMemo(() => {
    const map: Record<string, number> = {};
    aSuivre.forEach((c) => {
      if (c.note_priorite) map[c.note_priorite] = (map[c.note_priorite] ?? 0) + 1;
    });
    return map;
  }, [aSuivre]);

  const nbUrgent = (parPriorite.urgent ?? 0) + (parPriorite.sensible ?? 0);

  const openFiche = (id: number) => navigate(`/app/clients?client=${id}`);
  const filtrer = (key: string) => navigate(`/app/clients?priorite=${key}`);

  const envoyerRelance = async (c: ClientItem) => {
    setNotice(null);
    setSendError(null);
    if (!c.email) {
      setSendError(`${c.nom} n'a pas d'adresse email. Ajoutez-la dans sa fiche pour pouvoir relancer.`);
      return;
    }
    setSendingId(c.id);
    try {
      await sendClientRelanceEmail(c.id);
      setNotice(`Relance email envoyée à ${c.nom}.`);
      await onClientsChanged?.();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "L'envoi de la relance a échoué.");
    } finally {
      setSendingId(null);
    }
  };

  const handleScheduled = async () => {
    setNotice(null);
    setSendError(null);
    await onRelancesChanged?.();
    await onClientsChanged?.();
    setNotice("Relance programmée. Elle partira automatiquement à la date choisie.");
  };

  return (
    <div className="flex flex-col p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <i className="ri-bookmark-3-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-sm text-foreground-950">Clients à suivre</h3>
            <p className="text-[11px] text-foreground-500">Cliquez une priorité pour filtrer la page Clients</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BoutonPartager label="Clients · à suivre" chemin="/app/clients?notes=1" />
          <span className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-xs font-bold">
            {aSuivre.length}
          </span>
        </div>
      </div>

      {nbUrgent > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 self-start h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
          <i className="ri-alert-line"></i>
          {nbUrgent} fiche{nbUrgent > 1 ? "s" : ""} prioritaire{nbUrgent > 1 ? "s" : ""}
        </p>
      )}

      {aSuivre.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {NOTE_PRIORITES.filter((p) => (parPriorite[p.key] ?? 0) > 0).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => filtrer(p.key)}
              title={`Filtrer la page Clients sur « ${p.label} »`}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${p.badge} hover:opacity-90`}
            >
              <i className={p.icon}></i>
              {p.label}
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold bg-background-50/25">
                {parPriorite[p.key]}
              </span>
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p className="mt-3 text-xs text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {notice}
        </p>
      )}
      {sendError && (
        <p className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {sendError}
        </p>
      )}

      {aSuivre.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-8">
          <i className="ri-checkbox-circle-line text-2xl text-accent-500"></i>
          <p className="text-sm text-foreground-500">
            Aucune fiche annotée. Ajoutez une note depuis la page Clients pour suivre vos points de vigilance.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          {aSuivre.map((c) => {
            const pr = notePrioriteInfo(c.note_priorite);
            const aRelancer = c.note_priorite === "a_relancer";
            const scheduled = scheduledByClient.get(c.id);
            const joursDepuis = joursDepuisDerniereRelance(c.derniere_relance_at);
            const recent = joursDepuis !== null && joursDepuis < RELANCE_CLIENT_DELAI_ALERTE;
            return (
              <li
                key={c.id}
                className="flex items-stretch gap-2 p-2 rounded-lg bg-background-50 border border-background-200 hover:border-accent-300 hover:bg-accent-50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => openFiche(c.id)}
                  className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 font-semibold text-xs">
                    {c.nom.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground-950 truncate">{c.nom}</p>
                      {pr && (
                        <span className={`shrink-0 inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] font-bold ${pr.badge}`}>
                          <i className={pr.icon}></i>
                          {pr.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground-500 line-clamp-2 mt-0.5">{c.notes?.trim()}</p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      {scheduled && (
                        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold">
                          <i className="ri-calendar-check-line"></i>
                          Prévue le {formatShortDate(scheduled.date_prevue)}
                        </span>
                      )}
                      {c.derniere_relance_at && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                            recent ? "text-red-600" : "text-foreground-400"
                          }`}
                          title={
                            recent
                              ? "Relance récente : évitez un nouvel envoi trop rapproché"
                              : "Date de la dernière relance envoyée"
                          }
                        >
                          <i className={recent ? "ri-alarm-warning-line" : "ri-history-line"}></i>
                          Dernière relance le {formatShortDate(c.derniere_relance_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {aRelancer && (
                    <button
                      type="button"
                      onClick={() => envoyerRelance(c)}
                      disabled={sendingId === c.id}
                      title={`Envoyer une relance email à ${c.nom}`}
                      aria-label={`Envoyer une relance email à ${c.nom}`}
                      className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {sendingId === c.id ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-mail-send-line"></i>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setSendError(null);
                      setScheduleFor(c);
                    }}
                    title={scheduled ? `Relance prévue le ${formatShortDate(scheduled.date_prevue)} · modifier` : "Programmer une relance à une date choisie"}
                    aria-label="Programmer une relance"
                    className={`w-9 h-9 flex items-center justify-center rounded-md border cursor-pointer transition-colors ${
                      scheduled
                        ? "bg-accent-100 border-accent-200 text-accent-700 hover:bg-accent-200"
                        : "bg-background-100 border-background-200 text-foreground-500 hover:text-accent-700 hover:border-accent-300"
                    }`}
                  >
                    <i className="ri-calendar-schedule-line"></i>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {scheduleFor && (
        <ScheduleRelanceModal
          client={scheduleFor}
          existing={scheduledByClient.get(scheduleFor.id) ?? null}
          onClose={() => setScheduleFor(null)}
          onSaved={handleScheduled}
        />
      )}
    </div>
  );
}