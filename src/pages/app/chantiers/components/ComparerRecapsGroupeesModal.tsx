import { useMemo, useState } from "react";
import type { ChantierItem } from "@/hooks/useArtisanData";
import Modal from "@/pages/app/components/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useRecapsGroupeesHistorique } from "@/hooks/useRecapsGroupeesHistorique";
import { buildComparaisonRecapEnvoisGroupeesPdf } from "@/lib/recapEnvoisGroupeesPdf";
import { savePdf } from "@/lib/pdf";
import { libelleMoisRecap, libelleMoisCourt } from "@/lib/recapEnvoisGroupeesStats";

/** Écart signé, formaté à la française. */
function ecart(avant: number, apres: number, suffixe = ""): string {
  const delta = Math.round((apres - avant) * 10) / 10;
  if (delta === 0) return "stable";
  const abs = Math.abs(delta);
  const texte = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(".", ",");
  return `${delta > 0 ? "+" : "−"}${texte}${suffixe ? ` ${suffixe}` : ""}`;
}

/** Teinte d'un écart : progression en vert, recul en rouge, stabilité en neutre. */
function tonEcart(valeur: number, inverse = false): string {
  const utile = inverse ? -valeur : valeur;
  if (Math.round(valeur * 10) === 0) return "text-foreground-500";
  return utile > 0 ? "text-emerald-700" : "text-red-600";
}

/**
 * Compare deux mois de récap des envois groupés : mêmes chiffres que la carte de suivi,
 * côte à côte, avec l'évolution et un PDF de comparaison à joindre aux archives.
 */
export default function ComparerRecapsGroupeesModal({
  chantiers,
  onClose,
}: {
  chantiers: ChantierItem[];
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const { mois, loading, error } = useRecapsGroupeesHistorique();
  const [cleA, setCleA] = useState<string>("");
  const [cleB, setCleB] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Par défaut : le mois précédent face au mois en cours.
  const a = cleA || mois[1]?.cle || mois[0]?.cle || "";
  const b = cleB || mois[0]?.cle || "";

  const recapA = useMemo(() => mois.find((m) => m.cle === a) ?? null, [mois, a]);
  const recapB = useMemo(() => mois.find((m) => m.cle === b) ?? null, [mois, b]);

  const clientsDistincts = (ids: number[]): number => {
    const cles = new Set<number>();
    ids.forEach((chantierId) => {
      const chantier = chantiers.find((c) => c.id === chantierId);
      cles.add(chantier?.client_id ?? -chantierId);
    });
    return cles.size;
  };

  const clientsA = recapA ? clientsDistincts(recapA.stats.chantiersRelances) : 0;
  const clientsB = recapB ? clientsDistincts(recapB.stats.chantiersRelances) : 0;

  // Les 12 derniers mois, du plus ancien au plus récent, pour la courbe de tendance du PDF.
  const serie = useMemo(() => {
    const distincts = (ids: number[]): number => {
      const cles = new Set<number>();
      ids.forEach((chantierId) => {
        const chantier = chantiers.find((c) => c.id === chantierId);
        cles.add(chantier?.client_id ?? -chantierId);
      });
      return cles.size;
    };
    return [...mois].reverse().map((m) => ({
      moisLabel: libelleMoisCourt(m.cle),
      emailsGroupees: m.stats.emailsGroupees,
      clientsRelances: distincts(m.stats.chantiersRelances),
    }));
  }, [mois, chantiers]);

  const exporter = async () => {
    if (!recapA || !recapB || busy) return;
    setBusy(true);
    setErreur(null);
    try {
      const doc = await buildComparaisonRecapEnvoisGroupeesPdf({
        emetteur: {
          entreprise: profile?.entreprise?.trim() || "Mon entreprise",
          email: profile?.email ?? user?.email ?? null,
        },
        a: {
          moisLabel: libelleMoisRecap(recapA.cle),
          stats: {
            clientsRelances: clientsA,
            emailsGroupees: recapA.stats.emailsGroupees,
            chantiersRelances: recapA.stats.chantiersRelances.length,
            delaiMoyenJours: recapA.stats.delaiMoyenJours,
            enAttente: recapA.stats.enAttente,
            attenteMoyenneJours: recapA.stats.attenteMoyenneJours,
          },
        },
        b: {
          moisLabel: libelleMoisRecap(recapB.cle),
          stats: {
            clientsRelances: clientsB,
            emailsGroupees: recapB.stats.emailsGroupees,
            chantiersRelances: recapB.stats.chantiersRelances.length,
            delaiMoyenJours: recapB.stats.delaiMoyenJours,
            enAttente: recapB.stats.enAttente,
            attenteMoyenneJours: recapB.stats.attenteMoyenneJours,
          },
        },
        serie,
      });
      savePdf(doc, `comparaison-recaps-${recapA.cle}-${recapB.cle}.pdf`);
    } catch {
      setErreur("La comparaison PDF n'a pas pu être générée. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const lignes = recapA && recapB
    ? [
        {
          label: "Clients relancés",
          avant: clientsA,
          apres: clientsB,
          unite: "",
          inverse: false,
        },
        {
          label: "Emails groupés",
          avant: recapA.stats.emailsGroupees,
          apres: recapB.stats.emailsGroupees,
          unite: "",
          inverse: false,
        },
        {
          label: "Chantiers concernés",
          avant: recapA.stats.chantiersRelances.length,
          apres: recapB.stats.chantiersRelances.length,
          unite: "",
          inverse: false,
        },
        {
          label: "En attente de suite",
          avant: recapA.stats.enAttente,
          apres: recapB.stats.enAttente,
          unite: "",
          inverse: true,
        },
      ]
    : [];

  const delaiDelta =
    recapA && recapB && recapA.stats.delaiMoyenJours !== null && recapB.stats.delaiMoyenJours !== null
      ? Math.round((recapB.stats.delaiMoyenJours - recapA.stats.delaiMoyenJours) * 10) / 10
      : null;

  const selection = (valeur: string, onChange: (v: string) => void, label: string) => (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">{label}</span>
      <div className="relative">
        <select
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || mois.length === 0}
          className="h-10 w-full pl-3 pr-8 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer appearance-none disabled:opacity-60"
        >
          {mois.map((m) => (
            <option key={m.cle} value={m.cle}>
              {m.label}
            </option>
          ))}
        </select>
        <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
      </div>
    </div>
  );

  return (
    <Modal
      title="Comparer deux mois d'envois groupés"
      subtitle="Même périmètre que le récap mensuel : clients relancés, emails groupés et délai avant le prochain email."
      onClose={onClose}
      taille="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md bg-background-100 border border-background-200 text-sm font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => void exporter()}
            disabled={!recapA || !recapB || busy}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
            Télécharger la comparaison PDF
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selection(a, setCleA, "Mois de référence")}
          {selection(b, setCleB, "Mois comparé")}
        </div>

        {error && (
          <p className="text-xs text-red-600 inline-flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5 py-4">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement des mois…
          </p>
        ) : !recapA || !recapB ? (
          <p className="text-xs text-foreground-500 py-2">Aucun récap disponible pour ces deux mois.</p>
        ) : (
          <>
            <div className="rounded-lg border border-background-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 bg-background-100 text-[10px] font-semibold uppercase tracking-wide text-foreground-500">
                <span>Indicateur</span>
                <span className="text-right w-20">{libelleMoisRecap(recapA.cle)}</span>
                <span className="text-right w-20">{libelleMoisRecap(recapB.cle)}</span>
                <span className="text-right w-20">Écart</span>
              </div>
              <ul className="divide-y divide-background-200">
                {lignes.map((l) => {
                  const delta = l.apres - l.avant;
                  return (
                    <li key={l.label} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2.5 bg-background-50">
                      <span className="text-xs font-medium text-foreground-800 truncate">{l.label}</span>
                      <span className="text-xs text-foreground-600 tabular-nums text-right w-20">{l.avant}</span>
                      <span className="text-xs font-semibold text-foreground-950 tabular-nums text-right w-20">{l.apres}</span>
                      <span className={`text-xs font-bold tabular-nums text-right w-20 ${tonEcart(delta, l.inverse)}`}>
                        {ecart(l.avant, l.apres)}
                      </span>
                    </li>
                  );
                })}
                <li className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2.5 bg-background-50">
                  <span className="text-xs font-medium text-foreground-800 truncate">Délai avant le prochain email</span>
                  <span className="text-xs text-foreground-600 tabular-nums text-right w-20">
                    {recapA.stats.delaiMoyenJours !== null ? `${recapA.stats.delaiMoyenJours} j` : "—"}
                  </span>
                  <span className="text-xs font-semibold text-foreground-950 tabular-nums text-right w-20">
                    {recapB.stats.delaiMoyenJours !== null ? `${recapB.stats.delaiMoyenJours} j` : "—"}
                  </span>
                  <span className={`text-xs font-bold tabular-nums text-right w-20 ${delaiDelta === null ? "text-foreground-500" : tonEcart(delaiDelta, true)}`}>
                    {delaiDelta === null ? "—" : ecart(recapA.stats.delaiMoyenJours ?? 0, recapB.stats.delaiMoyenJours ?? 0, "j")}
                  </span>
                </li>
              </ul>
            </div>

            <p className="text-[11px] text-foreground-500 leading-relaxed">
              Un client n&apos;est compté qu&apos;une fois par mois, même si plusieurs de ses chantiers ont été relancés. Le
              délai mesure le temps écoulé entre un envoi groupé et l&apos;email suivant sur le même chantier.
              Le PDF inclut aussi la <strong className="font-semibold text-foreground-700">courbe des 12 derniers mois</strong>{" "}
              pour lire la tendance de fond.
            </p>

            {erreur && (
              <p className="text-xs text-red-600 inline-flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {erreur}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}