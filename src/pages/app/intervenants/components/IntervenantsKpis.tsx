import { formatDuree } from "@/lib/pointage";

/**
 * Bandeau de chiffres clés de l'équipe : effectif, comptes reliés, invitations en
 * attente et heures pointées sur le mois. Quatre repères, une seule lecture.
 */
export default function IntervenantsKpis({
  actifs,
  inactifs,
  rattaches,
  invitations,
  minutesMois,
  absentsAujourdhui,
}: {
  actifs: number;
  inactifs: number;
  /** Fiches dont le compte personnel a réellement été créé. */
  rattaches: number;
  /** Fiches jamais invitées (email renseigné) ou à relancer. */
  invitations: number;
  /** Total des heures pointées par l'équipe sur le mois en cours. */
  minutesMois: number;
  /** Personnes absentes aujourd'hui (congé, formation, maladie…). */
  absentsAujourdhui: number;
}) {
  const tuiles = [
    {
      cle: "effectif",
      icon: "ri-team-line",
      tone: "bg-primary-100 text-primary-700",
      valeur: String(actifs),
      label: "intervenants actifs",
      detail: inactifs > 0 ? `${inactifs} inactif${inactifs > 1 ? "s" : ""} archivé${inactifs > 1 ? "s" : ""}` : "Aucun inactif",
    },
    {
      cle: "comptes",
      icon: "ri-user-follow-line",
      tone: "bg-secondary-100 text-secondary-800",
      valeur: String(rattaches),
      label: "comptes reliés",
      detail: `${Math.max(0, actifs - rattaches)} fiche${actifs - rattaches > 1 ? "s" : ""} sans compte`,
    },
    {
      cle: "invitations",
      icon: "ri-mail-send-line",
      tone: invitations > 0 ? "bg-accent-100 text-accent-800" : "bg-background-200 text-foreground-500",
      valeur: String(invitations),
      label: "invitations en attente",
      detail: invitations > 0 ? "À relancer avant la prise de poste" : "Tout le monde est invité",
    },
    {
      cle: "heures",
      icon: "ri-timer-line",
      tone: "bg-background-200 text-foreground-700",
      valeur: formatDuree(minutesMois),
      label: "pointées ce mois",
      detail:
        absentsAujourdhui > 0
          ? `${absentsAujourdhui} absent${absentsAujourdhui > 1 ? "s" : ""} aujourd'hui`
          : "Personne d'absent aujourd'hui",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {tuiles.map((t) => (
        <div key={t.cle} className="flex items-start gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
          <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-base ${t.tone}`}>
            <i className={t.icon}></i>
          </span>
          <div className="min-w-0">
            <p className="font-heading font-bold text-lg text-foreground-950 leading-tight whitespace-nowrap">
              {t.valeur}
            </p>
            <p className="text-[11px] font-semibold text-foreground-600">{t.label}</p>
            <p className="text-[11px] text-foreground-500 mt-0.5">{t.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}