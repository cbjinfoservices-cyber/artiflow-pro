import Modal from "@/pages/app/components/Modal";
import { formatEuros } from "@/lib/format";
import { OFFRES_DETAILS, type OffreDetail } from "@/lib/monAbonnement";
import { useActiviteOffresAbonnement } from "@/hooks/useActiviteOffresAbonnement";
import SparklineActiviteOffres from "@/components/feature/SparklineActiviteOffres";

function detail(nom: string): OffreDetail {
  return (
    OFFRES_DETAILS.find((o) => o.nom === nom) ?? {
      nom,
      prix: 0,
      accroche: "Détail de cette offre non disponible.",
      inclus: [],
    }
  );
}

function ColonneOffre({
  offre,
  highlight = false,
  badge,
  badgeTone = "secondary",
}: {
  offre: OffreDetail;
  highlight?: boolean;
  badge?: string;
  badgeTone?: "primary" | "secondary";
}) {
  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-lg border ${
        highlight ? "bg-primary-50 border-primary-300" : "bg-background-100 border-background-200"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-heading font-bold text-base text-foreground-950">{offre.nom}</h4>
        {badge && (
          <span
            className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${
              badgeTone === "primary"
                ? "bg-primary-500 text-background-50"
                : "bg-secondary-100 text-secondary-800"
            }`}
          >
            {badgeTone === "primary" && <i className="ri-user-star-line"></i>}
            {badge}
          </span>
        )}
      </div>
      <p className="font-heading font-bold text-xl text-foreground-950">
        {formatEuros(offre.prix)}
        <span className="text-xs font-medium text-foreground-500"> /mois</span>
      </p>
      <p className="text-xs text-foreground-500">{offre.accroche}</p>
      <ul className="flex flex-col gap-2 flex-1 pt-1">
        {offre.inclus.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-foreground-700">
            <i className="ri-check-line text-accent-600 mt-0.5"></i>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Comparaison de deux offres côte à côte, ouverte depuis l'historique d'un changement.
 * Si `abonnementId` est fourni, un mini-graphe de volatilité (changements d'offre + montant)
 * rappelle l'activité du compte concerné sur 12 mois.
 */
export default function ComparerOffresModal({
  offreA,
  offreB,
  abonnementId,
  offreActuelle,
  onClose,
}: {
  offreA: string;
  offreB: string;
  abonnementId?: number | null;
  /** Nom de l'offre actuelle de l'artisan : la colonne correspondante est marquée « Votre offre actuelle ». */
  offreActuelle?: string | null;
  onClose: () => void;
}) {
  const a = detail(offreA);
  const b = detail(offreB);
  const aEstActuelle = Boolean(offreActuelle) && offreActuelle === a.nom;
  const bEstActuelle = Boolean(offreActuelle) && offreActuelle === b.nom;
  const delta = b.prix - a.prix;
  const monteEnGamme = delta > 0;
  const { points, loading: activiteLoading, error: activiteError } = useActiviteOffresAbonnement(abonnementId);
  const aActivite = Boolean(abonnementId) && points.some((p) => p.changements > 0 || (p.montant ?? 0) > 0);

  return (
    <Modal title="Comparer les offres" subtitle={`${a.nom} → ${b.nom}`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 p-3 rounded-lg border ${
            monteEnGamme ? "bg-accent-100 border-accent-300" : "bg-secondary-100 border-secondary-200"
          }`}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-900">
            <i className={monteEnGamme ? "ri-arrow-up-circle-line text-accent-700" : "ri-arrow-down-circle-line text-secondary-700"}></i>
            {delta === 0
              ? "Tarif identique"
              : `${monteEnGamme ? "Montée en gamme" : "Baisse d'offre"} : ${delta > 0 ? "+" : ""}${formatEuros(delta)} /mois`}
          </span>
          <span className="text-xs text-foreground-600">
            {formatEuros(a.prix)} → {formatEuros(b.prix)} par mois
          </span>
        </div>

        {abonnementId ? (
          <div className="flex flex-col gap-2 p-4 rounded-lg bg-background-100 border border-background-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
                <i className="ri-line-chart-line text-accent-600"></i>
                Activité d'offres du compte (12 mois)
              </p>
              <span className="text-[11px] text-foreground-400">Volatilité du compte</span>
            </div>
            {activiteLoading ? (
              <div className="flex items-center gap-2 py-6 text-xs text-foreground-500">
                <i className="ri-loader-4-line animate-spin"></i>
                Chargement de l'activité…
              </div>
            ) : activiteError ? (
              <p className="py-4 text-xs text-foreground-500 inline-flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {activiteError}
              </p>
            ) : aActivite ? (
              <SparklineActiviteOffres points={points} />
            ) : (
              <p className="py-4 text-xs text-foreground-500 inline-flex items-center gap-1.5">
                <i className="ri-information-line"></i>
                Aucun changement d'offre enregistré sur les 12 derniers mois pour ce compte.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ColonneOffre
            offre={a}
            badge={aEstActuelle ? "Votre offre actuelle" : undefined}
            badgeTone="primary"
          />
          <ColonneOffre
            offre={b}
            highlight
            badge={bEstActuelle ? "Votre offre actuelle" : "Nouvelle offre"}
            badgeTone={bEstActuelle ? "primary" : "secondary"}
          />
        </div>

        <p className="text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
          <i className="ri-information-line mt-px"></i>
          Comparaison indicative des caractéristiques de chaque offre. Le changement d'offre en ligne sera
          disponible très bientôt.
        </p>
      </div>
    </Modal>
  );
}