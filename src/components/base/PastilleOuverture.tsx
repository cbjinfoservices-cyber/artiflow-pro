import { useStatutOuverture } from "@/hooks/useStatutOuverture";

type Variante = "clair" | "sombre";

/** Couleur du texte selon le fond d'accueil et le statut. */
const TEXTE: Record<Variante, { ouvert: string; ferme: string }> = {
  clair: { ouvert: "text-accent-700", ferme: "text-foreground-500" },
  sombre: { ouvert: "text-accent-300", ferme: "text-background-200/70" },
};

/** Couleur du point de statut : vert d'accent quand l'équipe est joignable, neutre sinon. */
const POINT: Record<Variante, { ouvert: string; ferme: string }> = {
  clair: { ouvert: "bg-accent-500", ferme: "bg-foreground-400" },
  sombre: { ouvert: "bg-accent-500", ferme: "bg-background-50/40" },
};

/**
 * Pastille « Ouvert maintenant / Fermé » calculée en direct sur l'heure courante.
 *
 * Composant unique réutilisé partout pour garantir un rendu identique :
 * - en-tête de la page Contact ;
 * - encart d'aide (variante sombre dans le footer, claire sur les pages) ;
 * - mini-indicateur discret dans la barre d'action mobile.
 */
export default function PastilleOuverture({
  variante = "clair",
  avecDetail = false,
  className = "",
}: {
  /** Fond d'accueil : « clair » sur fond clair, « sombre » sur fond foncé. */
  variante?: Variante;
  /** Ajoute la précision du statut (« Fermeture à 18 h », « Réouvre lundi à 9 h »…). */
  avecDetail?: boolean;
  /** Classes additionnelles (taille, fond, arrondi…) pour adapter le contexte. */
  className?: string;
}) {
  const statut = useStatutOuverture();
  const texte = TEXTE[variante];
  const point = POINT[variante];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap ${
        statut.ouvert ? texte.ouvert : texte.ferme
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 shrink-0 rounded-full ${
          statut.ouvert ? point.ouvert : point.ferme
        } ${statut.ouvert ? "animate-pulse" : ""}`}
      ></span>
      {statut.libelle}
      {avecDetail && <span className="font-normal opacity-80">· {statut.detail}</span>}
    </span>
  );
}