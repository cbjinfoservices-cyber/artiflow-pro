import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { libelleDans, type ExecutionImminente } from "@/lib/envoisAutomatiques";
import { FENETRES_IMMINENTES_MIN, type FenetreImminenteMin } from "@/lib/imminencePrefsMemoire";
import type { ImminencePrefs } from "@/hooks/useImminencePrefs";
import type { NotificationImminente } from "@/hooks/useNotificationImminente";
import { useJournalImminentes } from "@/hooks/useJournalImminentes";
import type { EntreeJournalImminent } from "@/lib/journalImminentesMemoire";
import Modal from "@/pages/app/components/Modal";

/** Horodatage court et lisible d'une ligne du journal (« 12 oct. 14:32 »). */
function formatHorodatage(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Libellé d'une fenêtre d'alerte (« 60 min (1 h) »). */
function libelleFenetre(min: FenetreImminenteMin): string {
  return min === 60 ? "60 min (1 h)" : `${min} min`;
}

/**
 * Cloche de l'en-tête consacrée aux traitements imminents. Un clic ouvre une infobulle qui réunit :
 * le réglage de la fenêtre d'alerte (15 / 30 / 60 min) répercuté sur le bandeau, le badge et la
 * notification ; la bascule de la notification navigateur ; la liste des traitements qui entrent
 * dans la fenêtre, avec un bouton « Ne plus signaler cette automatisation » ; les automatisations
 * exclues (réactivables) ; et le journal local des signalements déjà envoyés.
 */
export default function ClocheImminents({
  executions,
  prefs,
  notif,
}: {
  executions: ExecutionImminente[];
  prefs: ImminencePrefs;
  notif: NotificationImminente;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [journalModal, setJournalModal] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  const { entrees, vider } = useJournalImminentes();

  // Fermeture de l'infobulle au clic extérieur et à la touche Échap.
  useEffect(() => {
    if (!ouvert) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (zoneRef.current && !zoneRef.current.contains(e.target as Node)) setOuvert(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [ouvert]);

  const total = executions.length;
  const apercuJournal = useMemo(() => entrees.slice(0, 3), [entrees]);

  const titreNotif = notif.actif
    ? "Désactiver la notification navigateur des traitements imminents"
    : notif.permission === "denied"
      ? "Notifications bloquées par le navigateur"
      : "Notifier le navigateur quand un traitement devient imminent";

  const rendreLigneJournal = (e: EntreeJournalImminent) => (
    <li key={e.cle} className="flex items-start gap-2 px-2 py-1.5">
      <i className={`${e.icone} text-accent-600 text-sm mt-0.5`}></i>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-foreground-900 truncate">{e.nom}</span>
        <span className="block text-[10px] text-foreground-500">
          {formatHorodatage(e.notifieLe)} · signalé à {e.dansMin} min de l'exécution
        </span>
      </span>
    </li>
  );

  return (
    <div className="relative" ref={zoneRef}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        title={titreNotif}
        aria-label="Signalements imminents"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-md border whitespace-nowrap cursor-pointer transition-colors ${
          notif.actif
            ? "bg-accent-500 border-accent-500 text-background-50 hover:bg-accent-600"
            : "bg-background-100 border-background-200 text-foreground-500 hover:border-primary-300"
        }`}
      >
        <i className={notif.actif ? "ri-notification-3-fill text-base" : "ri-notification-off-line text-base"}></i>
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold ring-2 ring-background-50 tabular-nums">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {ouvert && (
        <div
          role="dialog"
          aria-label="Réglages des signalements imminents"
          className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[75vh] overflow-y-auto rounded-lg bg-background-50 border border-background-200 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="relative w-7 h-7 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
              <i className="ri-timer-flash-line text-sm"></i>
            </span>
            <span className="text-xs font-bold text-foreground-950">Signalements imminents</span>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer"
              className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          </div>

          {/* Fenêtre d'alerte : pilote le bandeau, le badge et la notification. */}
          <div className="mt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Fenêtre d'alerte</span>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {FENETRES_IMMINENTES_MIN.map((m) => {
                const actif = prefs.fenetreMin === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => prefs.setFenetreMin(m)}
                    aria-pressed={actif}
                    title={`Signaler les traitements qui partent dans ${libelleFenetre(m)}`}
                    className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      actif
                        ? "bg-accent-500 border-accent-500 text-background-50"
                        : "bg-background-50 border-background-200 text-foreground-600 hover:border-accent-300"
                    }`}
                  >
                    {libelleFenetre(m)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-foreground-400">
              Un récapitulatif ou une automatisation est signalé s'il part dans cette fenêtre.
            </p>
          </div>

          {/* Bascule de la notification navigateur. */}
          <button
            type="button"
            onClick={notif.toggle}
            aria-pressed={notif.actif}
            title={titreNotif}
            className={`mt-3 w-full inline-flex items-center gap-2 h-9 px-2.5 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              notif.actif
                ? "bg-accent-100 border-accent-200 text-accent-800 hover:bg-accent-200"
                : "bg-background-100 border-background-200 text-foreground-600 hover:border-primary-300"
            }`}
          >
            <i className={notif.actif ? "ri-notification-3-line" : "ri-notification-off-line"}></i>
            {notif.actif
              ? "Notification navigateur activée"
              : notif.permission === "denied"
                ? "Notifications bloquées par le navigateur"
                : "Activer la notification navigateur"}
            {notif.actif && <i className="ri-check-line ml-auto text-accent-700"></i>}
          </button>

          {/* Traitements dans la fenêtre + exclusion unitaire. */}
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                <i className="ri-radar-line"></i>
                Dans la fenêtre · {total}
              </span>
              {total > 0 && (
                <Link
                  to="/app/envois-automatiques"
                  onClick={() => setOuvert(false)}
                  className="text-[10px] font-semibold text-accent-700 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Voir les automatisations
                </Link>
              )}
            </div>
            {total === 0 ? (
              <p className="mt-1.5 rounded-md bg-background-100 px-2.5 py-2 text-[11px] text-foreground-500">
                Aucun traitement ne part dans la fenêtre pour l'instant.
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1">
                {executions.map((e) => (
                  <li
                    key={e.item.id}
                    className="flex items-center gap-2 rounded-md bg-background-100 border border-background-200 px-2 py-1.5"
                  >
                    <i className={`${e.item.icone} text-accent-600 text-sm`}></i>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold text-foreground-900 truncate">{e.item.nom}</span>
                      <span className="block text-[10px] text-foreground-500">{libelleDans(e.dansMs)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => prefs.exclure(e.item.id, e.item.nom)}
                      title="Ne plus signaler cette automatisation"
                      aria-label={`Ne plus signaler ${e.item.nom}`}
                      className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      <i className="ri-eye-off-line"></i>
                      Ne plus signaler
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Automatisations exclues du signalement (réactivables). */}
          {prefs.exclusions.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  <i className="ri-eye-off-line"></i>
                  Exclues · {prefs.exclusions.length}
                </span>
                <button
                  type="button"
                  onClick={prefs.reinclureTout}
                  title="Réactiver le signalement de toutes les automatisations exclues"
                  className="text-[10px] font-semibold text-accent-700 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Tout réactiver
                </button>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {prefs.exclusions.map((x) => (
                  <li
                    key={x.id}
                    className="flex items-center gap-2 rounded-md bg-background-100 border border-background-200 px-2 py-1.5"
                  >
                    <i className="ri-eye-off-line text-foreground-400 text-sm"></i>
                    <span className="min-w-0 flex-1 text-[11px] font-medium text-foreground-600 truncate">{x.nom}</span>
                    <button
                      type="button"
                      onClick={() => prefs.reinclure(x.id)}
                      title="Réactiver le signalement de cette automatisation"
                      aria-label={`Réactiver le signalement de ${x.nom}`}
                      className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-800 transition-colors"
                    >
                      <i className="ri-eye-line"></i>
                      Réactiver
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Journal local des signalements déjà envoyés. */}
          <div className="mt-3 border-t border-background-200 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                <i className="ri-history-line"></i>
                Journal · {entrees.length}
              </span>
              <span className="inline-flex items-center gap-2">
                {entrees.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setJournalModal(true)}
                    title="Voir tout le journal des signalements"
                    className="text-[10px] font-semibold text-accent-700 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Voir tout
                  </button>
                )}
                {entrees.length > 0 && (
                  <button
                    type="button"
                    onClick={vider}
                    title="Vider le journal des signalements"
                    className="text-[10px] font-semibold text-foreground-500 hover:text-red-600 whitespace-nowrap cursor-pointer"
                  >
                    Effacer
                  </button>
                )}
              </span>
            </div>
            {entrees.length === 0 ? (
              <p className="mt-1.5 rounded-md bg-background-100 px-2.5 py-2 text-[11px] text-foreground-500">
                Aucun signalement envoyé pour l'instant. Le journal se remplit dès qu'une notification part.
              </p>
            ) : (
              <ul className="mt-1 flex flex-col">{apercuJournal.map(rendreLigneJournal)}</ul>
            )}
          </div>
        </div>
      )}

      {journalModal && (
        <Modal
          title="Journal des signalements imminents"
          subtitle={`${entrees.length} notification${entrees.length > 1 ? "s" : ""} déjà envoyée${entrees.length > 1 ? "s" : ""}.`}
          onClose={() => setJournalModal(false)}
          footer={
            <>
              {entrees.length > 0 && (
                <button
                  type="button"
                  onClick={vider}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
                >
                  <i className="ri-delete-bin-6-line"></i>
                  Vider le journal
                </button>
              )}
              <button
                type="button"
                onClick={() => setJournalModal(false)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                Fermer
              </button>
            </>
          }
        >
          {entrees.length === 0 ? (
            <p className="text-xs text-foreground-500">Le journal est vide.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-background-200">
              {entrees.map(rendreLigneJournal)}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}