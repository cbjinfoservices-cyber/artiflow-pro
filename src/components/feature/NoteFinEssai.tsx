import { formatShortDate } from "@/lib/dates";
import { finPeriodeEssai, finPeriodeEssaiProchaine, joursAvant } from "@/lib/monAbonnement";
import { useDureeEssai } from "@/hooks/useDureeEssai";

type NoteFinEssaiTone = "accent" | "secondary";

type NoteFinEssaiProps = {
  /** Date de début de l'abonnement (ISO). Absente = l'essai démarrerait aujourd'hui. */
  dateDebut?: string | null;
  /** Ton visuel de l'encart. */
  tone?: NoteFinEssaiTone;
  /** Masque l'encart une fois l'essai terminé (par défaut, oui). */
  masquerSiTerminee?: boolean;
  /**
   * Message adapté au contexte :
   *  • « souscription » : avant de payer — met en avant l'absence de débit pendant l'essai ;
   *  • « suivi » (défaut) : abonnement existant — indique la date de fin d'essai.
   */
  variant?: "souscription" | "suivi";
  className?: string;
};

const TONES: Record<NoteFinEssaiTone, string> = {
  accent: "bg-accent-100/70 border-accent-300/60 text-accent-900",
  secondary: "bg-secondary-100/70 border-secondary-200 text-secondary-900",
};

/**
 * Information sur la période d'essai offerte à la prise d'abonnement. La durée est le
 * réglage global (modifiable depuis le back-office). Purement informative : elle ne
 * modifie pas le tunnel de paiement par elle-même (c'est le Backend qui configure
 * l'essai Stripe réel à la création de la session). Rien ne s'affiche si l'essai est
 * désactivé (durée à 0).
 */
export default function NoteFinEssai({
  dateDebut,
  tone = "secondary",
  masquerSiTerminee = true,
  variant = "suivi",
  className = "",
}: NoteFinEssaiProps) {
  const { jours: dureeJours } = useDureeEssai();
  if (dureeJours <= 0) return null;

  const fin = finPeriodeEssai(dateDebut, dureeJours) ?? finPeriodeEssaiProchaine(new Date(), dureeJours);
  const jours = joursAvant(fin);
  const terminee = jours !== null && jours < 0;
  if (terminee && masquerSiTerminee) return null;

  const message =
    variant === "souscription"
      ? `aucun débit pendant l'essai — premier prélèvement le ${formatShortDate(fin)}.`
      : terminee
        ? `votre période d'essai s'est terminée le ${formatShortDate(fin)}.`
        : `votre période d'essai se termine le ${formatShortDate(fin)}.`;

  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${TONES[tone]} ${className}`}>
      <i className="ri-timer-line mt-0.5"></i>
      <p className="text-xs leading-relaxed">
        <strong className="font-semibold">Essai de {dureeJours} jours :</strong> {message}
      </p>
    </div>
  );
}