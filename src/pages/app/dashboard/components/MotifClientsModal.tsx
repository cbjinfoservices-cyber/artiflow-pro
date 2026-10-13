import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatShortDate } from "@/lib/dates";
import { sendClientRelanceEmail } from "@/lib/artisanApi";
import { markRelanceClientEnvoyee, markRelanceClientEchec } from "@/lib/relancesClient";

/** Un client concerné par un motif d'échec (une relance en échec portant ce motif). */
export interface MotifClientItem {
  /** Identifiant de la relance en échec concernée. */
  relanceId: number;
  clientId: number;
  /** Nom du client (ou « Client » si introuvable). */
  nom: string;
  /** Adresse email du client, ou null s'il n'en a pas. */
  email: string | null;
  /** Date d'envoi réel (ISO) si la relance a déjà été tentée, sinon null. */
  envoyeLe: string | null;
  /** Date prévue (ISO), utilisée à défaut de date d'envoi. */
  datePrevue: string;
  /** Message de la relance (aperçu court). */
  message: string | null;
}

interface Props {
  /** Motif d'échec dont on détaille les clients concernés. */
  motif: string;
  /** Relances en échec portant ce motif (déjà filtrées par l'appelant). */
  items: MotifClientItem[];
  onClose: () => void;
  /** Recharge les relances après un envoi groupé, pour rafraîchir le tableau de bord. */
  onRelancesChanged?: () => Promise<void> | void;
}

/** Le motif correspond-il à un client sans adresse email ? (cause récurrente la plus fréquente) */
function motifSansEmail(motif: string): boolean {
  return /adresse email/i.test(motif) || /sans email/i.test(motif);
}

/**
 * Fenêtre d'aperçu détaillé d'un motif d'échec : la liste des clients réellement concernés,
 * avec leur adresse email, la date de la tentative et l'accès direct à leur fiche. Elle est
 * ouverte en cliquant n'importe où sur la ligne d'un motif dans l'indicateur de taux de réussite.
 */
export default function MotifClientsModal({ motif, items, onClose, onRelancesChanged }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sansEmail = motifSansEmail(motif);
  const nbSansEmail = items.filter((i) => !i.email || !i.email.trim()).length;

  // Re-tentative groupée : on relance ici même, une par une, toutes les relances en échec
  // concernées par ce motif, sans quitter le tableau de bord.
  const [retrying, setRetrying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ reussies: string[]; echecs: { nom: string; motif: string }[] } | null>(null);

  const reTenterTout = async () => {
    if (!items.length || retrying) return;
    setRetrying(true);
    setResult(null);
    const reussies: string[] = [];
    const echecs: { nom: string; motif: string }[] = [];
    setProgress({ done: 0, total: items.length });
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      try {
        await sendClientRelanceEmail(it.clientId, it.message ?? "");
        await markRelanceClientEnvoyee(it.relanceId);
        reussies.push(it.nom);
      } catch (e) {
        const m = e instanceof Error ? e.message : "L'envoi a échoué.";
        try {
          await markRelanceClientEchec(it.relanceId, m);
        } catch {
          /* on continue la boucle même si le motif n'a pas pu être enregistré */
        }
        echecs.push({ nom: it.nom, motif: m });
      }
      setProgress({ done: i + 1, total: items.length });
    }
    setRetrying(false);
    setProgress(null);
    setResult({ reussies, echecs });
    await onRelancesChanged?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-foreground-950/40 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Clients concernés par le motif : ${motif}`}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[88vh] flex flex-col rounded-t-lg sm:rounded-lg bg-background-50 border border-background-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-background-200">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-lg ${
                sansEmail ? "bg-red-100 text-red-700" : "bg-background-100 text-foreground-600"
              }`}
            >
              <i className={sansEmail ? "ri-mail-close-line" : "ri-error-warning-line"}></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">Clients concernés par ce motif</p>
              <p className="text-xs text-foreground-500 mt-0.5 truncate" title={motif}>
                {motif}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu des clients concernés"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Résumé */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-background-200 bg-background-100">
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
            <i className="ri-group-line"></i>
            {items.length} client{items.length > 1 ? "s" : ""} concerné{items.length > 1 ? "s" : ""}
          </span>
          {nbSansEmail > 0 && (
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
              <i className="ri-mail-close-line"></i>
              {nbSansEmail} sans adresse email
            </span>
          )}
        </div>

        {/* Liste des clients */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground-500">
              Aucun client concerné par ce motif sur la période.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((it) => {
                const manqueEmail = !it.email || !it.email.trim();
                return (
                  <li
                    key={it.relanceId}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-background-50 border border-background-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold">
                        {it.nom.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground-950 truncate">{it.nom}</p>
                        <p className="text-[11px] text-foreground-500 flex items-center gap-1 truncate">
                          {manqueEmail ? (
                            <span className="text-red-600 flex items-center gap-1">
                              <i className="ri-mail-close-line shrink-0"></i>
                              Adresse email manquante
                            </span>
                          ) : (
                            <>
                              <i className="ri-mail-line shrink-0"></i>
                              <span className="truncate">{it.email}</span>
                            </>
                          )}
                        </p>
                        <p className="text-[10px] text-foreground-400 mt-0.5">
                          Tentative du {formatShortDate(it.envoyeLe ?? it.datePrevue)}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/app/clients?client=${it.clientId}`}
                      title={
                        manqueEmail
                          ? "Ouvrir la fiche de ce client pour ajouter son adresse email"
                          : "Ouvrir la fiche de ce client"
                      }
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        manqueEmail
                          ? "bg-accent-500 text-background-50 hover:bg-accent-600"
                          : "bg-background-100 border border-background-200 text-foreground-700 hover:bg-background-200"
                      }`}
                    >
                      <i className={manqueEmail ? "ri-mail-add-line" : "ri-user-line"}></i>
                      {manqueEmail ? "Ajouter l'email" : "Voir la fiche"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Récapitulatif de la re-tentative groupée (réussies / encore en échec) */}
        {result && (
          <div className="px-4 py-3 border-t border-background-200 bg-background-50 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
                <i className="ri-checkbox-circle-line"></i>
                {result.reussies.length} envoyée{result.reussies.length > 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
                <i className="ri-error-warning-line"></i>
                {result.echecs.length} encore en échec
              </span>
            </div>
            {result.echecs.length > 0 && (
              <ul className="flex flex-col gap-1">
                {result.echecs.map((e, i) => (
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
        )}

        {/* Pied : re-tentative groupée en place + raccourci vers la liste filtrée */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-background-200 bg-background-100">
          <p className="text-[11px] text-foreground-500 flex items-center gap-1.5 min-w-0">
            <i className="ri-information-line shrink-0"></i>
            Re-tentez ces envois sans quitter le tableau de bord.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap transition-colors"
            >
              Fermer
            </button>
            <Link
              to={`/app/relances-programmees?statut=echec&motif=${encodeURIComponent(motif)}`}
              title="Ouvrir la liste « Déjà traitées » filtrée sur ce motif"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold cursor-pointer hover:bg-background-200 whitespace-nowrap transition-colors"
            >
              <i className="ri-filter-3-line"></i>
              Voir la liste
            </Link>
            <button
              type="button"
              onClick={reTenterTout}
              disabled={retrying || items.length === 0}
              title="Re-tenter maintenant tous les clients concernés par ce motif"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retrying ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-refresh-line"></i>}
              {progress
                ? `Envoi ${progress.done}/${progress.total}…`
                : `Re-tenter les ${items.length} clients`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}