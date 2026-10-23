import { formatEuros } from "@/lib/format";
import type { TypeClientFiltre } from "@/pages/app/clients/components/ClientsFiltreType";

/** Chiffres d'un type de fiche : volume, devis émis et chiffre d'affaires généré. */
export interface ChiffresType {
  nombre: number;
  devis: number;
  ca: number;
}

/** Chiffre d'affaires d'un mois, pour le mini-historique des cartes. */
export interface MoisCa {
  /** Libellé court du mois (« août », « sept. »…). */
  label: string;
  /** CA généré sur ce mois (HT). */
  ca: number;
}

interface Props {
  particuliers: ChiffresType;
  entreprises: ChiffresType;
  /** CA des 3 derniers mois, du plus ancien au plus récent, pour chaque type de fiche. */
  historiqueParticuliers: MoisCa[];
  historiqueEntreprises: MoisCa[];
  /** Type actuellement affiché dans le carnet (sert à mettre la carte correspondante en avant). */
  actif: TypeClientFiltre;
  /** Clic sur une carte : filtre le carnet sur ce type. */
  onChoisir: (type: Exclude<TypeClientFiltre, "Tous">) => void;
}

interface CarteProps {
  titre: string;
  sousTitre: string;
  icone: string;
  chiffres: ChiffresType;
  historique: MoisCa[];
  actif: boolean;
  ton: "particuliers" | "entreprises";
  onClick: () => void;
}

/**
 * Mini-historique du CA sur les 3 derniers mois : trois barres proportionnelles, le mois le plus
 * récent à droite. Une variation entre les deux derniers mois donne la tendance (hausse / recul).
 */
function MiniHistorique({
  historique,
  ton,
}: {
  historique: MoisCa[];
  ton: "particuliers" | "entreprises";
}) {
  if (historique.length === 0) return null;
  const max = Math.max(...historique.map((m) => m.ca), 1);
  const barre = ton === "entreprises" ? "bg-accent-500" : "bg-secondary-500";
  const barreVide = "bg-background-300";
  const total = historique.reduce((sum, m) => sum + m.ca, 0);

  const dernier = historique[historique.length - 1]?.ca ?? 0;
  const precedent = historique[historique.length - 2]?.ca ?? 0;
  const variation = precedent > 0 ? Math.round(((dernier - precedent) / precedent) * 100) : null;

  return (
    <span className="mt-2.5 flex items-end justify-between gap-3">
      <span className="flex items-end gap-1.5 h-8" aria-hidden="true">
        {historique.map((m) => {
          const hauteur = m.ca > 0 ? Math.max(5, Math.round((m.ca / max) * 30)) : 3;
          return (
            <span key={m.label} className="flex flex-col items-center justify-end gap-1 w-6">
              <span
                className={`w-2.5 rounded-sm ${m.ca > 0 ? barre : barreVide}`}
                style={{ height: `${hauteur}px` }}
              ></span>
              <span className="text-[9px] font-medium text-foreground-400 whitespace-nowrap">{m.label}</span>
            </span>
          );
        })}
      </span>

      <span className="flex flex-col items-end gap-0.5 min-w-0">
        <span
          className="text-[10px] font-semibold text-foreground-500 whitespace-nowrap"
          title="Chiffre d'affaires généré sur les 3 derniers mois"
        >
          {formatEuros(total)} sur 3 mois
        </span>
        {total === 0 ? (
          <span className="text-[10px] text-foreground-400 whitespace-nowrap">Pas encore de CA</span>
        ) : variation === null ? (
          <span className="text-[10px] text-foreground-400 whitespace-nowrap">Premier mois d'activité</span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold whitespace-nowrap ${
              variation >= 0 ? "text-primary-700" : "text-secondary-800"
            }`}
            title={
              variation >= 0
                ? "Le CA progresse par rapport au mois précédent"
                : "Le CA décroche par rapport au mois précédent"
            }
          >
            <i className={variation >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"}></i>
            {variation >= 0 ? "+" : ""}
            {variation}% ce mois
          </span>
        )}
      </span>
    </span>
  );
}

/** Une carte cliquable : volume, nombre de devis, CA généré et tendance des 3 derniers mois. */
function CarteRepartition({
  titre,
  sousTitre,
  icone,
  chiffres,
  historique,
  actif,
  ton,
  onClick,
}: CarteProps) {
  const rond =
    ton === "entreprises"
      ? "bg-accent-100 text-accent-800"
      : "bg-secondary-100 text-secondary-800";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      title={`Afficher le carnet filtré sur : ${titre.toLowerCase()}`}
      className={`group flex items-start gap-4 p-4 rounded-lg border text-left cursor-pointer transition-colors ${
        actif
          ? "bg-primary-50 border-primary-300"
          : "bg-background-100 border-background-200 hover:border-primary-200 hover:bg-background-50"
      }`}
    >
      <span className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-full ${rond}`}>
        <i className={`${icone} text-xl`}></i>
      </span>

      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500 truncate">
            {titre}
          </span>
          {actif && (
            <span className="shrink-0 inline-flex items-center gap-1 h-4 px-1.5 rounded-full bg-primary-500 text-background-50 text-[9px] font-bold uppercase whitespace-nowrap">
              Affiché
            </span>
          )}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-heading font-bold text-2xl text-foreground-950 tabular-nums">
            {chiffres.nombre}
          </span>
          <span className="text-[11px] text-foreground-500 truncate">{sousTitre}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-foreground-600">
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <i className="ri-file-text-line text-foreground-400"></i>
            {chiffres.devis} devis
          </span>
          <span className="text-foreground-300" aria-hidden="true">
            ·
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-foreground-800">
            <i className="ri-money-euro-circle-line text-foreground-400"></i>
            {formatEuros(chiffres.ca)}
          </span>
        </span>

        <MiniHistorique historique={historique} ton={ton} />
      </span>

      <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-foreground-400 group-hover:text-primary-700 group-hover:bg-background-200 transition-colors">
        <i className="ri-arrow-right-s-line"></i>
      </span>
    </button>
  );
}

/**
 * Répartition complète du carnet, en tête de la page Clients : deux cartes cliquables qui donnent
 * le volume, le nombre de devis, le chiffre d'affaires généré et la tendance des 3 derniers mois
 * de chaque type de fiche. Un clic filtre le carnet sur le type choisi — c'est un raccourci, pas
 * un second carnet.
 */
export default function RepartitionCarnet({
  particuliers,
  entreprises,
  historiqueParticuliers,
  historiqueEntreprises,
  actif,
  onChoisir,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <CarteRepartition
        titre="Particuliers"
        sousTitre="fiches au carnet"
        icone="ri-user-line"
        chiffres={particuliers}
        historique={historiqueParticuliers}
        actif={actif === "Particuliers"}
        ton="particuliers"
        onClick={() => onChoisir("Particuliers")}
      />
      <CarteRepartition
        titre="Entreprises"
        sousTitre="fiches au carnet"
        icone="ri-building-2-line"
        chiffres={entreprises}
        historique={historiqueEntreprises}
        actif={actif === "Professionnels"}
        ton="entreprises"
        onClick={() => onChoisir("Professionnels")}
      />
    </div>
  );
}