import { useState } from "react";
import {
  couleurIntervenant,
  metaInvitation,
  validiteCodeInvitation,
  type Intervenant,
} from "@/lib/intervenants";
import type { CreneauStats, StatsIntervenant } from "@/lib/intervenantsStats";
import type { Indisponibilite } from "@/lib/indisponibilites";
import { dureeMinutes, formatDuree, formatHeurePointage, type Pointage } from "@/lib/pointage";
import { formatDateHeureCourte, formatShortDate, toISODate } from "@/lib/dates";
import BoutonCopierCode from "@/components/base/BoutonCopierCode";
import Modal from "@/pages/app/components/Modal";

type Onglet = "avenir" | "absences" | "historique";

/**
 * Panneau de détail d'un intervenant : sa fiche, ses chiffres du mois, son planning
 * à venir, ses absences et son historique d'interventions pointées. Les actions
 * (modifier, inviter, régénérer le code, désactiver, supprimer) sont regroupées ici
 * pour éviter d'avoir à revenir à la liste.
 */
export default function FicheIntervenantPanel({
  intervenant,
  stats,
  creneaux,
  pointages,
  indisponibilites,
  invitant,
  regenerant,
  onChangerOnglet,
  onClose,
  onModifier,
  onInviter,
  onRegenerer,
  onBasculerActif,
  onSupprimer,
}: {
  intervenant: Intervenant;
  stats: StatsIntervenant | undefined;
  creneaux: CreneauStats[];
  pointages: Pointage[];
  indisponibilites: Indisponibilite[];
  invitant: boolean;
  regenerant: boolean;
  onChangerOnglet?: (onglet: Onglet) => void;
  onClose: () => void;
  onModifier: () => void;
  onInviter: () => void;
  onRegenerer: () => void;
  onBasculerActif: () => void;
  onSupprimer: () => void;
}) {
  const [onglet, setOnglet] = useState<Onglet>("avenir");
  const aujourdHui = toISODate(new Date());
  const couleur = couleurIntervenant(intervenant.couleur);
  const validite = validiteCodeInvitation(intervenant);
  const meta = intervenant.compte_rattache ? null : metaInvitation(intervenant);

  const changerOnglet = (valeur: Onglet) => {
    setOnglet(valeur);
    onChangerOnglet?.(valeur);
  };

  const aVenir = creneaux
    .filter((c) => c.intervenant_id === intervenant.id && c.date >= aujourdHui)
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));

  const passees = creneaux
    .filter((c) => c.intervenant_id === intervenant.id && c.date < aujourdHui)
    .sort((a, b) => b.date.localeCompare(a.date) || b.heure.localeCompare(a.heure))
    .slice(0, 20);

  const absences = indisponibilites
    .filter((i) => i.intervenant_id === intervenant.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);

  const pointagesPerso = pointages
    .filter((p) => p.intervenant_id === intervenant.id && Boolean(p.arrivee_le))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  const libelleCreneau = (creneauId: number) =>
    creneaux.find((c) => c.id === creneauId)?.libelle ?? "Intervention";

  const tuiles = [
    { cle: "heures", icon: "ri-timer-line", valeur: formatDuree(stats?.minutesMois ?? 0), label: "pointées ce mois" },
    { cle: "jours", icon: "ri-calendar-check-line", valeur: String(stats?.joursPointesMois ?? 0), label: "jours travaillés" },
    { cle: "avenir", icon: "ri-calendar-schedule-line", valeur: String(stats?.interventionsAVenir ?? 0), label: "interventions à venir" },
    { cle: "conges", icon: "ri-suitcase-line", valeur: `${Math.round((stats?.congesRestants ?? 0) * 10) / 10} j`, label: "congés restants" },
  ];

  const onglets: { cle: Onglet; label: string; icon: string; compte: number }[] = [
    { cle: "avenir", label: "À venir", icon: "ri-calendar-schedule-line", compte: aVenir.length },
    { cle: "absences", label: "Absences", icon: "ri-suitcase-line", compte: absences.length },
    { cle: "historique", label: "Historique", icon: "ri-history-line", compte: pointagesPerso.length },
  ];

  return (
    <Modal
      title={intervenant.nom}
      subtitle={intervenant.metier || "Intervenant de l'entreprise"}
      onClose={onClose}
      taille="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onSupprimer}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-sm font-medium whitespace-nowrap cursor-pointer hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <i className="ri-delete-bin-line"></i>
            Supprimer
          </button>
          <button
            type="button"
            onClick={onBasculerActif}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className={intervenant.actif ? "ri-pause-circle-line" : "ri-play-circle-line"}></i>
            {intervenant.actif ? "Désactiver" : "Réactiver"}
          </button>
          <button
            type="button"
            onClick={onModifier}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-pencil-line"></i>
            Modifier la fiche
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Identité + état du compte */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg bg-background-100 border border-background-200 p-3">
          <span
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full text-background-50 font-heading font-bold text-lg"
            style={{ backgroundColor: couleur }}
          >
            {intervenant.nom.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                  intervenant.actif ? "bg-secondary-100 text-secondary-800" : "bg-background-200 text-foreground-500"
                }`}
              >
                <i className={intervenant.actif ? "ri-checkbox-circle-line" : "ri-pause-circle-line"}></i>
                {intervenant.actif ? "Actif" : "Inactif"}
              </span>
              <span
                className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                  intervenant.compte_rattache
                    ? "bg-secondary-100 text-secondary-800"
                    : meta?.tone ?? "bg-background-200 text-foreground-500"
                }`}
              >
                <i className={intervenant.compte_rattache ? "ri-user-follow-line" : meta?.icon ?? "ri-mail-line"}></i>
                {intervenant.compte_rattache ? "Compte relié" : meta?.label ?? "Email manquant"}
              </span>
              {stats?.absentAujourdhui && (
                <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap">
                  <i className="ri-suitcase-line"></i>
                  Absent aujourd'hui
                </span>
              )}
            </div>
            <p className="text-[11px] text-foreground-500 mt-1 truncate">
              {intervenant.telephone || "Téléphone non renseigné"}
              {intervenant.compte_email ? ` · ${intervenant.compte_email}` : " · Aucun email de compte"}
            </p>
          </div>
        </div>

        {/* Chiffres du mois */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tuiles.map((t) => (
            <div key={t.cle} className="flex flex-col gap-0.5 p-2.5 rounded-md bg-background-50 border border-background-200">
              <span className="text-[10px] text-foreground-500 inline-flex items-center gap-1">
                <i className={`${t.icon} text-[10px]`}></i>
                {t.label}
              </span>
              <span className="text-sm font-bold text-foreground-950 whitespace-nowrap">{t.valeur}</span>
            </div>
          ))}
        </div>

        {/* Invitation : code et renvoi */}
        {!intervenant.compte_rattache && (
          <div className="flex flex-col gap-2 rounded-lg bg-secondary-100/70 border border-secondary-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground-900 inline-flex items-center gap-1.5">
                <i className="ri-key-2-line"></i>
                Rattachement du compte
              </p>
              <div className="flex items-center gap-2">
                {intervenant.code_invitation && <BoutonCopierCode code={intervenant.code_invitation} />}
                <button
                  type="button"
                  onClick={onInviter}
                  disabled={!intervenant.compte_email || invitant}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-secondary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <i className={invitant ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
                  {intervenant.invitation_envoyee_le ? "Renvoyer" : "Inviter"}
                </button>
                <button
                  type="button"
                  onClick={onRegenerer}
                  disabled={regenerant}
                  title="Générer un nouveau code (l'ancien est invalidé)"
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-50 border border-secondary-300 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-50"
                >
                  <i className={regenerant ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
                  Nouveau code
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {intervenant.code_invitation ? (
                <span className="px-2 py-1 rounded bg-background-50 border border-secondary-300 text-xs font-bold tracking-[0.2em] text-foreground-900">
                  {intervenant.code_invitation}
                </span>
              ) : (
                <span className="text-[11px] text-foreground-500">Aucun code généré pour l'instant.</span>
              )}
              {validite.joursRestants !== null && (
                <span
                  className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                    validite.expire
                      ? "bg-red-100 text-red-700"
                      : validite.expireBientot
                        ? "bg-accent-100 text-accent-800"
                        : "bg-background-50 text-foreground-600"
                  }`}
                >
                  <i className={validite.expire ? "ri-error-warning-line" : "ri-timer-line"}></i>
                  {validite.expire
                    ? "Code expiré"
                    : validite.expireBientot
                      ? `Expire dans ${validite.joursRestants} j`
                      : `Valide ${validite.joursRestants} j`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-foreground-500">
              {intervenant.invitation_envoyee_le
                ? `Dernière invitation : ${formatDateHeureCourte(intervenant.invitation_envoyee_le)}.`
                : "Aucune invitation envoyée. Renseignez l'email du compte sur la fiche, puis invitez."}
            </p>
          </div>
        )}

        {/* Onglets */}
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 self-start">
          {onglets.map((o) => (
            <button
              key={o.cle}
              type="button"
              onClick={() => changerOnglet(o.cle)}
              aria-pressed={onglet === o.cle}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                onglet === o.cle ? "bg-foreground-900 text-background-50" : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              <i className={o.icon}></i>
              {o.label}
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${
                  onglet === o.cle ? "bg-background-50/25" : "bg-background-200 text-foreground-500"
                }`}
              >
                {o.compte}
              </span>
            </button>
          ))}
        </div>

        {onglet === "avenir" && (
          <div className="flex flex-col gap-2">
            {aVenir.length === 0 ? (
              <p className="text-sm text-foreground-500 px-1 py-3 inline-flex items-center gap-2">
                <i className="ri-calendar-line text-foreground-400"></i>
                Aucune intervention planifiée pour cette personne.
              </p>
            ) : (
              aVenir.slice(0, 12).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 rounded-md bg-background-100 border border-background-200"
                >
                  <span className="w-12 text-[11px] font-bold text-foreground-700 whitespace-nowrap">
                    {c.heure.slice(0, 5)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground-900 truncate">{c.libelle}</p>
                    <p className="text-[11px] text-foreground-500 truncate inline-flex items-center gap-1">
                      <i className="ri-map-pin-line"></i>
                      {c.ville || "Lieu à définir"}
                    </p>
                  </div>
                  <span className="text-[11px] text-foreground-500 whitespace-nowrap">{formatShortDate(c.date)}</span>
                </div>
              ))
            )}
            {aVenir.length > 12 && (
              <p className="text-[11px] text-foreground-500">
                + {aVenir.length - 12} autre{aVenir.length - 12 > 1 ? "s" : ""} intervention
                {aVenir.length - 12 > 1 ? "s" : ""} à venir.
              </p>
            )}
          </div>
        )}

        {onglet === "absences" && (
          <div className="flex flex-col gap-2">
            {absences.length === 0 ? (
              <p className="text-sm text-foreground-500 px-1 py-3 inline-flex items-center gap-2">
                <i className="ri-checkbox-circle-line text-secondary-600"></i>
                Aucune absence enregistrée sur l'année.
              </p>
            ) : (
              absences.slice(0, 16).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-2.5 rounded-md bg-background-100 border border-background-200"
                >
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-800">
                    <i className="ri-suitcase-line text-xs"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground-900 truncate">
                      {a.motif}
                      {a.periode !== "journee" ? ` (${a.periode === "matin" ? "matin" : "après-midi"})` : ""}
                    </p>
                    {a.note && <p className="text-[11px] text-foreground-500 truncate">{a.note}</p>}
                  </div>
                  <span className="text-[11px] text-foreground-500 whitespace-nowrap">{formatShortDate(a.date)}</span>
                </div>
              ))
            )}
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-foreground-600">
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-secondary-100 text-secondary-800 font-semibold">
                <i className="ri-suitcase-line"></i>
                {stats?.congesPoses ?? 0} j de congé posés
              </span>
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-100 border border-background-200 font-semibold">
                <i className="ri-graduation-cap-line"></i>
                {stats?.autresAbsences ?? 0} j d'autres absences
              </span>
            </div>
          </div>
        )}

        {onglet === "historique" && (
          <div className="flex flex-col gap-2">
            {pointagesPerso.length === 0 ? (
              <p className="text-sm text-foreground-500 px-1 py-3 inline-flex items-center gap-2">
                <i className="ri-history-line text-foreground-400"></i>
                Aucune intervention pointée pour l'instant.
              </p>
            ) : (
              pointagesPerso.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-2.5 rounded-md bg-background-100 border border-background-200"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground-900 truncate">{libelleCreneau(p.creneau_id)}</p>
                    <p className="text-[11px] text-foreground-500">
                      {formatHeurePointage(p.arrivee_le)} → {formatHeurePointage(p.depart_le)}
                      {p.pause_minutes > 0 ? ` · pause ${p.pause_minutes} min` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-foreground-900 whitespace-nowrap">{formatDuree(dureeMinutes(p))}</p>
                    <p className="text-[11px] text-foreground-500 whitespace-nowrap">{formatShortDate(p.date)}</p>
                  </div>
                </div>
              ))
            )}
            {passees.length > 0 && (
              <p className="text-[11px] text-foreground-500">
                {passees.length} intervention{passees.length > 1 ? "s" : ""} passée
                {passees.length > 1 ? "s" : ""} dans le planning. Le détail des heures se règle depuis la page
                Pointages.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}