import { estNouveau } from "@/lib/dates";

type BadgeNouveauProps = {
  /** Date de la mention au format ISO (YYYY-MM-DD). */
  dateISO: string;
  /** Seuil de fraîcheur en jours (30 par défaut). */
  jours?: number;
  /** Version compacte (sans icône), adaptée aux barres de navigation. */
  compact?: boolean;
  className?: string;
};

/**
 * Badge « Nouveau » affiché uniquement pour les contenus récents
 * (moins de 30 jours par défaut). Ne rend rien si la date est plus ancienne.
 */
export default function BadgeNouveau({ dateISO, jours = 30, compact = false, className = "" }: BadgeNouveauProps) {
  if (!estNouveau(dateISO, jours)) return null;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-px rounded-full bg-accent-500 text-background-50 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${className}`}
      >
        Nouveau
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${className}`}
    >
      <i className="ri-sparkling-2-line"></i>
      Nouveau
    </span>
  );
}