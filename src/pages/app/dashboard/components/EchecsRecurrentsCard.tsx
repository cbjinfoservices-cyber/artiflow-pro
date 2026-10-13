import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ClientItem } from "@/hooks/useArtisanData";
import type { RelanceClientItem } from "@/lib/relancesClient";
import CompleterEmailsModal from "@/pages/app/components/CompleterEmailsModal";
import BoutonPartager from "@/pages/app/components/BoutonPartager";

interface Props {
  /** Relances client (programmées + traitées) : on ne regarde que celles passées en échec. */
  relances: RelanceClientItem[];
  /** Clients de l'artisan, pour proposer le raccourci de complétion des emails manquants. */
  clients: ClientItem[];
  /** Recharge les clients après un enregistrement d'adresse email. */
  onClientsChanged?: () => Promise<void> | void;
  /** Recharge les relances après les envois déclenchés depuis la fenêtre de complétion des emails. */
  onRelancesChanged?: () => Promise<void> | void;
}

/** Une relance est « en échec » quand son statut contient « échec ». */
function estEnEchec(statut: string): boolean {
  return /chec/i.test(statut);
}

/** Le motif correspond-il à un client sans adresse email ? (cause récurrente la plus fréquente) */
function motifSansEmail(motif: string): boolean {
  return /adresse email/i.test(motif) || /sans email/i.test(motif);
}

/**
 * Widget « Échecs récurrents » du tableau de bord : il remonte le motif d'échec de relance
 * le plus fréquent pour repérer les problèmes systémiques (ex. « client sans email »). Un clic
 * ouvre la liste « Déjà traitées » filtrée sur ce motif précis, et le raccourci « Compléter les
 * emails manquants » permet de corriger les fiches incomplètes en série.
 */
export default function EchecsRecurrentsCard({ relances, clients, onClientsChanged, onRelancesChanged }: Props) {
  const [showEmails, setShowEmails] = useState(false);

  // Fréquence de chaque motif d'échec, du plus fréquent au moins fréquent.
  const { motifs, total } = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;
    relances.forEach((r) => {
      if (estEnEchec(r.statut) && r.motif_echec && r.motif_echec.trim()) {
        const key = r.motif_echec.trim();
        map.set(key, (map.get(key) ?? 0) + 1);
        count += 1;
      }
    });
    const list = Array.from(map.entries())
      .map(([motif, occurrences]) => ({ motif, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences);
    return { motifs: list, total: count };
  }, [relances]);

  const clientsSansEmail = useMemo(
    () => clients.filter((c) => !c.email || !c.email.trim()),
    [clients],
  );

  const top = motifs[0] ?? null;

  // Rien à signaler : aucun échec avec motif renseigné, on n'affiche pas le widget.
  if (!top) return null;

  const part = total > 0 ? Math.round((top.occurrences / total) * 100) : 0;
  const recurrent = top.occurrences >= 2;
  const motifEmail = motifSansEmail(top.motif);
  const autres = motifs.slice(1, 4);

  return (
    <div className="p-4 rounded-lg bg-red-50 border border-red-200">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-700 text-lg">
          <i className="ri-repeat-2-line"></i>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-red-800">Échecs récurrents</p>
            {recurrent && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                <i className="ri-alarm-warning-fill"></i>
                récurrent · {top.occurrences}
              </span>
            )}
          </div>
          <p className="text-xs text-red-700 mt-0.5">
            {total} échec{total > 1 ? "s" : ""} de relance avec un motif identifié · {motifs.length} motif
            {motifs.length > 1 ? "s" : ""} distinct{motifs.length > 1 ? "s" : ""}
          </p>

          {/* Motif le plus fréquent, mis en avant */}
          <div className="mt-3 p-3 rounded-lg bg-background-50 border border-red-200">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
              Motif le plus fréquent
            </p>
            <p className="mt-1 text-sm font-bold text-red-800 flex items-center gap-1.5" title={top.motif}>
              <i className={motifEmail ? "ri-mail-close-line" : "ri-error-warning-line"}></i>
              <span className="truncate">{top.motif}</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-background-200 overflow-hidden">
                <div className="h-full rounded-full bg-red-400" style={{ width: `${part}%` }}></div>
              </div>
              <span className="text-[11px] font-bold text-red-700 whitespace-nowrap">
                ×{top.occurrences} · {part}%
              </span>
            </div>
          </div>

          {/* Autres motifs fréquents */}
          {autres.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {autres.map((m) => (
                <li key={m.motif} className="flex items-center justify-between gap-3 text-[11px] text-red-700">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <i className="ri-subtract-line shrink-0 text-red-400"></i>
                    <span className="truncate" title={m.motif}>
                      {m.motif}
                    </span>
                  </span>
                  <span className="font-bold whitespace-nowrap">×{m.occurrences}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Raccourcis : re-tenter le motif, liste filtrée sur le motif, complétion des emails */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to={`/app/relances-programmees?statut=echec&motif=${encodeURIComponent(top.motif)}&retry=1`}
              title="Re-tenter uniquement les échecs portant ce motif précis"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Re-tenter ce motif ({top.occurrences})
            </Link>
            <Link
              to={`/app/relances-programmees?statut=echec&motif=${encodeURIComponent(top.motif)}`}
              title="Ouvrir la liste « Déjà traitées » filtrée sur ce motif précis"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-red-200 text-red-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
            >
              <i className="ri-filter-3-line"></i>
              Filtrer ces relances ({top.occurrences})
            </Link>
            {(motifEmail || clientsSansEmail.length > 0) && (
              <button
                type="button"
                onClick={() => setShowEmails(true)}
                title="Ouvrir la liste des clients sans adresse email pour les renseigner en série"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-red-200 text-red-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
              >
                <i className="ri-mail-add-line"></i>
                Compléter les emails manquants
                {clientsSansEmail.length > 0 ? ` (${clientsSansEmail.length})` : ""}
              </button>
            )}
            <BoutonPartager
              label="Échecs récurrents"
              chemin="/app/relances-programmees?statut=echec"
            />
          </div>
        </div>
      </div>

      {showEmails && (
        <CompleterEmailsModal
          clients={clients}
          relances={relances}
          onClose={() => setShowEmails(false)}
          onSaved={onClientsChanged}
          onRelancesChanged={onRelancesChanged}
        />
      )}
    </div>
  );
}