import { useMemo } from "react";
import type { AbonnementItem } from "@/lib/abonnementsApi";
import { CLE_NON_RENSEIGNE, repartitionParChamp, type RepartitionLigne } from "@/lib/repartition";

interface RepartitionEntrepriseProps {
  /** Tous les pros inscrits chargés par la page (avant filtrage). */
  items: AbonnementItem[];
}

/** Une part de la barre empilée + sa ligne de légende. */
interface Segment extends RepartitionLigne {
  couleur: string;
}

/** Palettes de couleurs (familles du thème) pour différencier les parts d'une barre. */
const COULEURS_STATUT = ["bg-primary-500", "bg-accent-500", "bg-secondary-500", "bg-primary-300", "bg-accent-300"];
const COULEURS_TAILLE = ["bg-secondary-500", "bg-primary-500", "bg-accent-500", "bg-primary-300"];
const COULEURS_METIER = [
  "bg-accent-500",
  "bg-primary-500",
  "bg-secondary-500",
  "bg-primary-300",
  "bg-accent-300",
  "bg-secondary-300",
  "bg-primary-200",
  "bg-accent-200",
];

/**
 * Associe une couleur à chaque part : les pros « Non renseigné » restent en gris neutre,
 * les autres prennent la couleur suivante de la palette (dans l'ordre de référence).
 */
function versSegments(lignes: RepartitionLigne[], couleurs: string[]): Segment[] {
  let indexCouleur = 0;
  return lignes.map((l) => {
    if (l.key === CLE_NON_RENSEIGNE) return { ...l, couleur: "bg-background-300" };
    const couleur = couleurs[indexCouleur % couleurs.length];
    indexCouleur += 1;
    return { ...l, couleur };
  });
}

/** Un bloc : une barre empilée surmontant sa légende détaillée. */
function BlocRepartition({
  titre,
  icone,
  segments,
  total,
}: {
  titre: string;
  icone: string;
  segments: Segment[];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
          <i className={`${icone} text-accent-600`}></i>
          {titre}
        </span>
        <span className="text-[11px] text-foreground-500">
          <strong className="text-foreground-900">{total}</strong> pro{total > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex h-3 w-full rounded-full overflow-hidden bg-background-200">
        {segments.map((s) => (
          <div key={s.key} className={s.couleur} style={{ width: `${s.pct}%` }} title={`${s.label} · ${s.count} (${s.pct}%)`}></div>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${s.couleur}`}></span>
            <span className="text-[12px] text-foreground-800 flex-1 min-w-0 truncate">{s.label}</span>
            <span className="text-[11px] text-foreground-500 whitespace-nowrap tabular-nums">
              <strong className="text-foreground-900">{s.count}</strong> · {s.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Récap visuel de la répartition des pros inscrits par statut juridique, par taille
 * d'entreprise et par métier : trois barres empilées avec leur légende, affichées en
 * tête de la page.
 */
export default function RepartitionEntreprise({ items }: RepartitionEntrepriseProps) {
  const segmentsStatut = useMemo(
    () => versSegments(repartitionParChamp(items, "statut_juridique"), COULEURS_STATUT),
    [items],
  );
  const segmentsTaille = useMemo(
    () => versSegments(repartitionParChamp(items, "taille_entreprise"), COULEURS_TAILLE),
    [items],
  );
  const segmentsMetier = useMemo(
    () => versSegments(repartitionParChamp(items, "metier"), COULEURS_METIER),
    [items],
  );

  // Aucune information disponible : on n'encombre pas la page pour rien.
  const rienARepartir =
    segmentsStatut.length === 0 && segmentsTaille.length === 0 && segmentsMetier.length === 0;
  if (rienARepartir) return null;

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
          <i className="ri-bar-chart-2-line"></i>
        </span>
        <div>
          <p className="text-[12px] font-semibold text-foreground-900">Répartition des pros inscrits</p>
          <p className="text-[11px] text-foreground-500">
            Par métier, statut juridique et taille d'entreprise
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <BlocRepartition
          titre="Métier"
          icone="ri-tools-line"
          segments={segmentsMetier}
          total={items.length}
        />
        <BlocRepartition
          titre="Statut juridique"
          icone="ri-briefcase-4-line"
          segments={segmentsStatut}
          total={items.length}
        />
        <BlocRepartition
          titre="Taille de l'entreprise"
          icone="ri-group-line"
          segments={segmentsTaille}
          total={items.length}
        />
      </div>
    </div>
  );
}