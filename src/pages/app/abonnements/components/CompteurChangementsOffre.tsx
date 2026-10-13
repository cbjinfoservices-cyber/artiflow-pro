import { useRef, useState } from "react";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { useActiviteOffresAbonnement } from "@/hooks/useActiviteOffresAbonnement";
import SparklineActiviteOffres from "@/components/feature/SparklineActiviteOffres";
import type { AbonnementHistoriqueResume, AbonnementHistoriqueItem } from "@/lib/abonnementsApi";

interface Props {
  resume: AbonnementHistoriqueResume | undefined;
  onComparer: (ancienne: string, nouvelle: string, abonnementId: number) => void;
}

function ligneMini(item: AbonnementHistoriqueItem): { titre: string; date: string; montant: string | null } {
  const date = formatShortDate(item.created_at);
  if (!item.ancienne_valeur) {
    return {
      titre: `Activation · ${item.nouvelle_valeur ?? "—"}`,
      date,
      montant: item.nouveau_montant ? `${formatEuros(item.nouveau_montant)}/mois` : null,
    };
  }
  return {
    titre: `${item.ancienne_valeur} → ${item.nouvelle_valeur ?? "—"}`,
    date,
    montant: item.nouveau_montant ? `${formatEuros(item.nouveau_montant)}/mois` : null,
  };
}

/**
 * Panneau du mini-historique, monté uniquement au survol : la sparkline de volatilité
 * (même grammaire visuelle que la comparaison d'offres) ne se charge donc qu'à l'affichage.
 */
function PanneauMiniHistorique({
  resume,
  x,
  top,
  largeur,
  onComparer,
  onEnter,
  onLeave,
}: {
  resume: AbonnementHistoriqueResume;
  x: number;
  top: number;
  largeur: number;
  onComparer: (ancienne: string, nouvelle: string, abonnementId: number) => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { points, loading, error } = useActiviteOffresAbonnement(resume.abonnement_id);
  const aActivite = points.some((p) => p.changements > 0 || (p.montant ?? 0) > 0);
  const recentes = resume.recentes;
  const derniereAvecChangement = recentes.find((r) => r.ancienne_valeur && r.nouvelle_valeur);

  return (
    <div
      className="fixed z-40 rounded-lg bg-background-50 border border-background-200 p-3"
      style={{ left: x, top, width: largeur }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide mb-2 inline-flex items-center gap-1.5">
        <i className="ri-history-line text-accent-600"></i>
        Derniers changements d'offre
      </p>
      <ul className="flex flex-col gap-2">
        {recentes.map((item) => {
          const l = ligneMini(item);
          return (
            <li key={item.id} className="flex items-start justify-between gap-2">
              <span className="text-xs text-foreground-800 min-w-0">
                <span className="font-semibold">{l.titre}</span>
                <span className="block text-[10px] text-foreground-400 mt-0.5">{l.date}</span>
              </span>
              {l.montant && (
                <span className="shrink-0 text-[10px] font-semibold text-foreground-600 bg-background-200 px-1.5 rounded-full">
                  {l.montant}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 pt-2.5 border-t border-background-200">
        <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide mb-1 inline-flex items-center gap-1.5">
          <i className="ri-line-chart-line text-accent-600"></i>
          Activité d'offres (12 mois)
        </p>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-[11px] text-foreground-500">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement de l'activité…
          </div>
        ) : error ? (
          <p className="py-3 text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        ) : aActivite ? (
          <SparklineActiviteOffres points={points} />
        ) : (
          <p className="py-3 text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
            <i className="ri-information-line"></i>
            Aucune activité d'offre sur les 12 derniers mois.
          </p>
        )}
      </div>

      {derniereAvecChangement && (
        <button
          type="button"
          onClick={() => {
            onComparer(
              derniereAvecChangement.ancienne_valeur ?? "",
              derniereAvecChangement.nouvelle_valeur ?? "",
              resume.abonnement_id,
            );
          }}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-secondary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
        >
          <i className="ri-arrow-left-right-line"></i>
          Comparer ces offres
        </button>
      )}
    </div>
  );
}

/**
 * Compteur de changements d'offre d'un artisan, avec mini-historique au survol.
 * Le panneau est positionné en `fixed` pour ne jamais être rogné par le conteneur de liste,
 * et reste ouvert tant que la souris est dessus (délai de fermeture court à la sortie).
 */
export default function CompteurChangementsOffre({ resume, onComparer }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const offres = resume?.offres ?? 0;
  const recentes = resume?.recentes ?? [];

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const open = () => {
    cancelClose();
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left, y: r.bottom + 6 });
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setPos(null), 160);
  };

  if (offres === 0 || !resume) {
    return (
      <span className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] text-foreground-400">
        <i className="ri-swap-box-line"></i>
        Aucun changement d'offre
      </span>
    );
  }

  const largeur = 300;
  const maxX = (typeof window !== "undefined" ? window.innerWidth : 1200) - largeur - 12;
  const x = pos ? Math.max(12, Math.min(pos.x, maxX)) : 0;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={scheduleClose}
        className="inline-flex items-center gap-1.5 mt-1.5 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap cursor-help"
        title="Voir le mini-historique des changements d'offre"
      >
        <i className="ri-swap-box-line"></i>
        {offres} changement{offres > 1 ? "s" : ""} d'offre
      </button>

      {pos && recentes.length > 0 && (
        <PanneauMiniHistorique
          resume={resume}
          x={x}
          top={pos.y}
          largeur={largeur}
          onComparer={(ancienne, nouvelle, abonnementId) => {
            onComparer(ancienne, nouvelle, abonnementId);
            cancelClose();
            setPos(null);
          }}
          onEnter={cancelClose}
          onLeave={scheduleClose}
        />
      )}
    </>
  );
}