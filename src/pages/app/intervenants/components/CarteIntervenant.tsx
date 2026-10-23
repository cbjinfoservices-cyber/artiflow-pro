import {
  couleurIntervenant,
  metaInvitation,
  type Intervenant,
} from "@/lib/intervenants";
import type { StatsIntervenant } from "@/lib/intervenantsStats";
import { formatDuree } from "@/lib/pointage";
import { formatShortDate } from "@/lib/dates";

/**
 * Carte d'une personne de l'équipe : identité, état du compte, trois chiffres utiles
 * (heures du mois, interventions à venir, congés restants) et les actions courantes.
 * Cliquer sur la carte (ou sur « Voir la fiche ») ouvre le panneau de détail.
 */
export default function CarteIntervenant({
  intervenant,
  stats,
  invitant,
  onOuvrir,
  onInviter,
  onModifier,
}: {
  intervenant: Intervenant;
  stats: StatsIntervenant | undefined;
  /** Envoi d'invitation en cours sur cette fiche. */
  invitant: boolean;
  onOuvrir: () => void;
  onInviter: () => void;
  onModifier: () => void;
}) {
  const meta = intervenant.compte_rattache
    ? {
        label: "Compte relié",
        icon: "ri-user-follow-line",
        tone: "bg-secondary-100 text-secondary-800",
      }
    : metaInvitation(intervenant);

  const couleur = couleurIntervenant(intervenant.couleur);

  const tuiles = [
    {
      cle: "heures",
      icon: "ri-timer-line",
      valeur: formatDuree(stats?.minutesMois ?? 0),
      label: "ce mois",
    },
    {
      cle: "avenir",
      icon: "ri-calendar-check-line",
      valeur: String(stats?.interventionsAVenir ?? 0),
      label: stats?.interventionsAVenir === 1 ? "à venir" : "à venir",
    },
    {
      cle: "conges",
      icon: "ri-suitcase-line",
      valeur: String(Math.round((stats?.congesRestants ?? 0) * 10) / 10),
      label: "jours restants",
    },
  ];

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-lg border bg-background-100 ${
        intervenant.actif ? "border-background-200" : "border-background-200 opacity-75"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-background-50 font-heading font-bold text-base"
          style={{ backgroundColor: couleur }}
        >
          {intervenant.nom.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOuvrir}
              className="text-sm font-semibold text-foreground-950 truncate text-left cursor-pointer hover:text-primary-700 transition-colors"
              title="Ouvrir la fiche détaillée"
            >
              {intervenant.nom}
            </button>
            {!intervenant.actif && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-background-200 text-foreground-500 text-[10px] font-semibold whitespace-nowrap">
                <i className="ri-pause-circle-line"></i> Inactif
              </span>
            )}
          </div>
          <p className="text-[11px] text-foreground-500 truncate">
            {intervenant.metier || "Métier non précisé"}
            {intervenant.telephone ? ` · ${intervenant.telephone}` : ""}
          </p>
          <span
            className={`mt-1 inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${meta.tone}`}
          >
            <i className={meta.icon}></i>
            {meta.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tuiles.map((t) => (
          <div key={t.cle} className="flex flex-col gap-0.5 px-2 py-2 rounded-md bg-background-50 border border-background-200">
            <span className="text-[10px] text-foreground-500 inline-flex items-center gap-1">
              <i className={`${t.icon} text-[10px]`}></i>
              {t.label}
            </span>
            <span className="text-xs font-bold text-foreground-900 whitespace-nowrap">{t.valeur}</span>
          </div>
        ))}
      </div>

      {stats?.absentAujourdhui && (
        <p className="text-[11px] text-accent-800 bg-accent-100 border border-accent-200 rounded-md px-2 py-1.5 inline-flex items-center gap-1.5">
          <i className="ri-suitcase-line"></i>
          Absent aujourd'hui · {stats.motifAbsenceJour ?? "indisponible"}
        </p>
      )}

      {!stats?.absentAujourdhui && stats?.prochaine && (
        <p className="text-[11px] text-foreground-600 inline-flex items-center gap-1.5 truncate">
          <i className="ri-calendar-event-line text-foreground-400"></i>
          Prochaine : {formatShortDate(stats.prochaine.date)} · {stats.prochaine.heure.slice(0, 5)} ·{" "}
          {stats.prochaine.libelle}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-auto">
        <button
          type="button"
          onClick={onOuvrir}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-contacts-line"></i>
          Voir la fiche
        </button>
        {!intervenant.compte_rattache && (
          <button
            type="button"
            onClick={onInviter}
            disabled={!intervenant.compte_email || invitant}
            title={
              intervenant.compte_email
                ? intervenant.invitation_envoyee_le
                  ? `Renvoyer l'invitation à ${intervenant.compte_email}`
                  : `Envoyer l'invitation à ${intervenant.compte_email}`
                : "Renseignez d'abord un email de compte sur sa fiche"
            }
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <i
              className={
                invitant
                  ? "ri-loader-4-line animate-spin"
                  : intervenant.invitation_envoyee_le
                    ? "ri-refresh-line"
                    : "ri-mail-send-line"
              }
            ></i>
            {intervenant.invitation_envoyee_le ? "Relancer" : "Inviter"}
          </button>
        )}
        <button
          type="button"
          onClick={onModifier}
          title="Modifier la fiche"
          aria-label="Modifier la fiche"
          className="ml-auto w-8 h-8 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 hover:text-foreground-900 hover:bg-background-200 cursor-pointer transition-colors"
        >
          <i className="ri-pencil-line"></i>
        </button>
      </div>
    </div>
  );
}