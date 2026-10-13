import { useMemo, useState } from "react";
import type { ClientItem } from "@/hooks/useArtisanData";
import { sendClientRelanceEmail, updateClient } from "@/lib/artisanApi";
import {
  bulkRescheduleRelancesClient,
  markRelanceClientEchec,
  markRelanceClientEnvoyee,
  type RelanceClientItem,
} from "@/lib/relancesClient";
import { addDays, formatShortDate, toISODate, todayISO } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";

interface Props {
  /** Tous les clients de l'artisan : la fenêtre n'affiche que ceux sans adresse email. */
  clients: ClientItem[];
  /** Relances client (pour proposer de les relancer juste après la correction de l'email). */
  relances?: RelanceClientItem[];
  onClose: () => void;
  /** Recharge la liste des clients après un enregistrement (rafraîchit les filtres en arrière-plan). */
  onSaved?: () => Promise<void> | void;
  /** Recharge la liste des relances après les envois déclenchés depuis la fenêtre. */
  onRelancesChanged?: () => Promise<void> | void;
  /**
   * Périmètre de la re-tentative après complétion :
   * - « all » (défaut) : toutes les relances en attente/échouées de ces clients ;
   * - « sansEmail » : uniquement les échecs causés par une adresse email manquante.
   */
  retryScope?: "all" | "sansEmail";
}

/** Validation rapide d'une adresse email (suffisante pour ce formulaire de saisie assistée). */
function emailValide(valeur: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);
}

/** Une relance est « en échec » quand son statut contient « échec ». */
function estEnEchec(statut: string): boolean {
  return /chec/i.test(statut);
}

/** Le motif correspond-il à un client sans adresse email ? (cause récurrente la plus fréquente) */
function motifSansEmail(motif: string | null | undefined): boolean {
  const m = (motif ?? "").trim();
  return /adresse email/i.test(m) || /sans email/i.test(m);
}

/**
 * Fenêtre « Compléter les emails manquants » : elle rassemble tous les clients qui n'ont
 * pas encore d'adresse email pour les renseigner les uns après les autres (« en série »),
 * sans avoir à ouvrir chaque fiche. Une fois les adresses saisies, elle propose d'enchaîner
 * directement les relances de ces clients (correction → relance en un seul geste).
 */
export default function CompleterEmailsModal({
  clients,
  relances,
  onClose,
  onSaved,
  onRelancesChanged,
  retryScope = "all",
}: Props) {
  // Fiches sans adresse email : c'est la cause récurrente des relances impossibles.
  const sansEmail = useMemo(
    () => clients.filter((c) => !c.email || !c.email.trim()),
    [clients],
  );

  const [values, setValues] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<{ done: number; total: number } | null>(null);
  const [launchResult, setLaunchResult] = useState<{ reussies: string[]; echecs: { nom: string; motif: string }[] } | null>(
    null,
  );
  // Mode d'enchaînement : envoi immédiat, ou programmation automatique à une date choisie.
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState(() => toISODate(addDays(new Date(), 1)));
  const [scheduling, setScheduling] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  const restants = sansEmail.filter((c) => !savedIds.has(c.id)).length;
  const completes = sansEmail.length - restants;

  // Nom d'un client à partir de son identifiant (pour le récap d'envoi).
  const nomClient = (id: number) => clients.find((c) => c.id === id)?.nom ?? "Client";

  // Relances à (re)lancer pour les clients dont on vient de compléter l'email :
  // tout ce qui n'est pas encore parti (programmé) ou qui a échoué est désormais joignable.
  // Le périmètre « sansEmail » ne cible que les échecs dus à une adresse manquante.
  const sansEmailScope = retryScope === "sansEmail";
  const relancesAEnvoyer = useMemo(() => {
    const base = (relances ?? []).filter((r) => savedIds.has(r.client_id) && r.statut !== "Envoyée");
    if (sansEmailScope) return base.filter((r) => estEnEchec(r.statut) && motifSansEmail(r.motif_echec));
    return base;
  }, [relances, savedIds, sansEmailScope]);

  /** Enregistre l'adresse saisie pour un client, en conservant le reste de sa fiche. */
  const enregistrer = async (c: ClientItem) => {
    const email = (values[c.id] ?? "").trim();
    if (!email) {
      setError(`Saisissez une adresse email pour ${c.nom}.`);
      setNotice(null);
      return;
    }
    if (!emailValide(email)) {
      setError("L'adresse email saisie ne semble pas valide.");
      setNotice(null);
      return;
    }
    setSavingId(c.id);
    setError(null);
    setNotice(null);
    setLaunchResult(null);
    try {
      await updateClient(c.id, {
        nom: c.nom,
        telephone: c.telephone ?? "",
        email,
        adresse: c.adresse ?? "",
        type: c.type,
        contact_nom: c.contact_nom ?? "",
        siret: c.siret ?? "",
        secteur: c.secteur ?? "",
        notes: c.notes ?? "",
        note_priorite: c.note_priorite ?? "",
      });
      setSavedIds((prev) => new Set(prev).add(c.id));
      setNotice(`Adresse enregistrée pour ${c.nom}.`);
      await onSaved?.();
    } catch {
      setError(`L'enregistrement de l'adresse pour ${c.nom} a échoué. Réessayez.`);
    } finally {
      setSavingId(null);
    }
  };

  /**
   * Enchaîne les relances des clients dont l'email vient d'être complété : chaque relance
   * programmée ou en échec est envoyée l'une après l'autre, avec l'avancement en direct puis
   * un récapitulatif (réussies / encore en échec) une fois terminé.
   */
  const lancerRelances = async () => {
    if (!relancesAEnvoyer.length || launching) return;
    setLaunching(true);
    setError(null);
    setNotice(null);
    setLaunchResult(null);
    const reussies: string[] = [];
    const echecs: { nom: string; motif: string }[] = [];
    setLaunchProgress({ done: 0, total: relancesAEnvoyer.length });
    for (let i = 0; i < relancesAEnvoyer.length; i += 1) {
      const r = relancesAEnvoyer[i];
      const nom = nomClient(r.client_id);
      try {
        await sendClientRelanceEmail(r.client_id, r.message ?? "");
        await markRelanceClientEnvoyee(r.id);
        reussies.push(nom);
      } catch (e) {
        const motif = e instanceof Error ? e.message : "L'envoi a échoué.";
        try {
          await markRelanceClientEchec(r.id, motif);
        } catch {
          /* on continue la boucle même si le motif n'a pas pu être enregistré */
        }
        echecs.push({ nom, motif });
      }
      setLaunchProgress({ done: i + 1, total: relancesAEnvoyer.length });
    }
    setLaunching(false);
    setLaunchProgress(null);
    setLaunchResult({ reussies, echecs });
    await onRelancesChanged?.();
  };

  /**
   * Programme automatiquement les relances des clients dont l'email vient d'être complété :
   * elles sont replanifiées à la date choisie et repasseront en « Programmée », de sorte que
   * la tâche quotidienne les envoie toute seule le jour venu (plus besoin de lancer à la main).
   */
  const programmerRelances = async () => {
    if (!relancesAEnvoyer.length || scheduling) return;
    setScheduling(true);
    setError(null);
    setNotice(null);
    setScheduleNotice(null);
    setLaunchResult(null);
    try {
      await bulkRescheduleRelancesClient(
        relancesAEnvoyer.map((r) => r.id),
        scheduleDate,
      );
      setScheduleNotice(
        `${relancesAEnvoyer.length} relance${relancesAEnvoyer.length > 1 ? "s" : ""} programmée${
          relancesAEnvoyer.length > 1 ? "s" : ""
        } pour le ${formatShortDate(scheduleDate)}. Elles partiront automatiquement ce jour-là.`,
      );
      await onRelancesChanged?.();
    } catch {
      setError("La programmation des relances a échoué. Réessayez.");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Modal
      title="Compléter les emails manquants"
      subtitle="Renseignez les adresses une par une : ces clients ne peuvent pas être relancés sans email."
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
        >
          Terminer
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {sansEmail.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <i className="ri-checkbox-circle-line text-2xl text-accent-500"></i>
            <p className="text-sm text-foreground-500">
              Tous vos clients ont déjà une adresse email. Rien à compléter.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-xs font-bold">
                <i className="ri-mail-line"></i>
                {sansEmail.length} fiche{sansEmail.length > 1 ? "s" : ""} sans email
              </span>
              {completes > 0 && (
                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-accent-100 text-accent-800 text-xs font-bold">
                  <i className="ri-checkbox-circle-line"></i>
                  {completes} complétée{completes > 1 ? "s" : ""} · {restants} restante{restants > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
            )}
            {notice && (
              <p className="text-xs text-accent-700 flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line"></i>
                {notice}
              </p>
            )}

            <ul className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
              {sansEmail.map((c) => {
                const fait = savedIds.has(c.id);
                const busy = savingId === c.id;
                return (
                  <li
                    key={c.id}
                    className={`flex flex-col gap-2 p-3 rounded-lg border sm:flex-row sm:items-center sm:justify-between ${
                      fait ? "bg-accent-50 border-accent-200" : "bg-background-100 border-background-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 sm:flex-1">
                      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 font-semibold text-xs">
                        {c.nom.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground-950 truncate">{c.nom}</p>
                        <p className="text-[11px] text-foreground-500 truncate">
                          {c.telephone ? `Tél. ${c.telephone}` : c.adresse ?? "Aucune coordonnée"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fait ? (
                        <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-accent-100 text-accent-800 text-xs font-semibold whitespace-nowrap">
                          <i className="ri-check-line"></i>
                          Ajouté
                        </span>
                      ) : (
                        <>
                          <div className="relative flex-1 sm:flex-none">
                            <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
                            <input
                              type="email"
                              value={values[c.id] ?? ""}
                              onChange={(e) => setValues((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void enregistrer(c);
                                }
                              }}
                              placeholder="client@email.fr"
                              aria-label={`Adresse email de ${c.nom}`}
                              className="w-full sm:w-56 h-9 pl-9 pr-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => enregistrer(c)}
                            disabled={busy || savingId !== null}
                            title={`Enregistrer l'adresse de ${c.nom}`}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                            Enregistrer
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Enchaînement correction → relance : une fois les emails saisis, on relance les clients. */}
            {completes > 0 && (
              <div className="mt-1 p-3 rounded-lg bg-background-50 border border-background-200 flex flex-col gap-3">
                {launchResult ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 rounded-md bg-accent-50 border border-accent-200">
                        <p className="text-[10px] font-semibold text-accent-700 uppercase tracking-wide flex items-center gap-1.5">
                          <i className="ri-checkbox-circle-line"></i>
                          Relances envoyées
                        </p>
                        <p className="mt-0.5 font-heading font-bold text-xl text-foreground-950">
                          {launchResult.reussies.length}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-md bg-red-50 border border-red-200">
                        <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                          <i className="ri-error-warning-line"></i>
                          Encore en échec
                        </p>
                        <p className="mt-0.5 font-heading font-bold text-xl text-foreground-950">
                          {launchResult.echecs.length}
                        </p>
                      </div>
                    </div>
                    {launchResult.reussies.length > 0 && (
                      <p className="text-[11px] text-accent-700">
                        Envoyées : {launchResult.reussies.join(", ")}.
                      </p>
                    )}
                    {launchResult.echecs.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {launchResult.echecs.map((e, i) => (
                          <li key={`${e.nom}-${i}`} className="text-[11px] text-red-700 flex items-center gap-1.5">
                            <i className="ri-error-warning-line shrink-0"></i>
                            <span className="font-semibold shrink-0">{e.nom}</span>
                            <span className="truncate" title={e.motif}>
                              · {e.motif}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground-950 flex items-center gap-1.5">
                          <i className={`${sansEmailScope ? "ri-refresh-line" : "ri-send-plane-line"} text-accent-600`}></i>
                          {sansEmailScope ? "Re-tenter les échecs « sans email »" : "Enchaîner les relances"}
                        </p>
                        <p className="text-[11px] text-foreground-500">
                          {relancesAEnvoyer.length > 0
                            ? sansEmailScope
                              ? `${relancesAEnvoyer.length} échec${relancesAEnvoyer.length > 1 ? "s" : ""} « sans email » de ces clients ${
                                  relancesAEnvoyer.length > 1 ? "peuvent" : "peut"
                                } être re-tenté${relancesAEnvoyer.length > 1 ? "s" : ""} maintenant.`
                              : `${relancesAEnvoyer.length} relance${relancesAEnvoyer.length > 1 ? "s" : ""} de ces clients ${
                                  relancesAEnvoyer.length > 1 ? "sont" : "est"
                                } en attente.`
                            : sansEmailScope
                              ? "Aucun échec « sans email » concerné : rien à re-tenter."
                              : "Aucune relance en attente pour ces clients : rien à envoyer."}
                        </p>
                      </div>
                      {/* Choix du mode : envoi immédiat, ou programmation automatique à une date choisie */}
                      <div className="flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                        <button
                          type="button"
                          onClick={() => {
                            setMode("now");
                            setScheduleNotice(null);
                          }}
                          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                            mode === "now"
                              ? "bg-accent-500 text-background-50"
                              : "text-foreground-600 hover:bg-background-200"
                          }`}
                        >
                          <i className="ri-send-plane-line"></i>
                          Maintenant
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMode("schedule");
                            setNotice(null);
                          }}
                          disabled={relancesAEnvoyer.length === 0}
                          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            mode === "schedule"
                              ? "bg-primary-500 text-background-50"
                              : "text-foreground-600 hover:bg-background-200"
                          }`}
                        >
                          <i className="ri-calendar-schedule-line"></i>
                          Programmer
                        </button>
                      </div>
                    </div>

                    {mode === "now" ? (
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={lancerRelances}
                          disabled={launching || relancesAEnvoyer.length === 0}
                          title="Envoyer maintenant les relances des clients dont l'email vient d'être complété"
                          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {launching ? (
                            <i className="ri-loader-4-line animate-spin"></i>
                          ) : (
                            <i className="ri-send-plane-line"></i>
                          )}
                          {launchProgress
                            ? `Envoi ${launchProgress.done}/${launchProgress.total}…`
                            : `Lancer les relances${relancesAEnvoyer.length > 0 ? ` (${relancesAEnvoyer.length})` : ""}`}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-end justify-between gap-3 p-3 rounded-md bg-background-100 border border-background-200">
                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor="relance-auto-date"
                            className="text-[11px] font-semibold text-foreground-600 flex items-center gap-1.5"
                          >
                            <i className="ri-calendar-line"></i>
                            Envoi automatique le
                          </label>
                          <input
                            id="relance-auto-date"
                            type="date"
                            value={scheduleDate}
                            min={todayISO()}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400"
                          />
                          <p className="text-[10px] text-foreground-400 max-w-[300px]">
                            La tâche quotidienne enverra ces relances toute seule le jour choisi — aucune relance à
                            lancer à la main.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={programmerRelances}
                          disabled={scheduling || relancesAEnvoyer.length === 0}
                          title="Programmer l'envoi automatique de ces relances à la date choisie"
                          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {scheduling ? (
                            <i className="ri-loader-4-line animate-spin"></i>
                          ) : (
                            <i className="ri-calendar-check-line"></i>
                          )}
                          Programmer automatiquement{relancesAEnvoyer.length > 0 ? ` (${relancesAEnvoyer.length})` : ""}
                        </button>
                      </div>
                    )}

                    {scheduleNotice && (
                      <p className="text-[11px] text-accent-700 flex items-center gap-1.5">
                        <i className="ri-checkbox-circle-line"></i>
                        {scheduleNotice}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}