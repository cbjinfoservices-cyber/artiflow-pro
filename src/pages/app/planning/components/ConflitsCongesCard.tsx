import { useMemo } from "react";
import type { CreneauItem } from "@/hooks/useArtisanData";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import {
  libelleDisponibilite,
  suggererRemplacants,
  type ConflitConge,
} from "@/lib/conflitsConges";
import { cleAlerteConflit, type AlerteConflitHistorique } from "@/lib/conflitsCongesApi";
import { iconeMotif, libellePeriode, type Indisponibilite } from "@/lib/indisponibilites";
import { formatDateHeureCourte, formatShortDate } from "@/lib/dates";

/** Groupe d'interventions d'une même personne absente, le même jour. */
interface GroupeConflit {
  cle: string;
  intervenantId: number | null;
  date: string;
  conflits: ConflitConge[];
}

/**
 * Liste de réaffectation des interventions en conflit avec un congé.
 *
 * Chaque ligne rappelle l'intervention, la personne absente et le motif, indique si le
 * responsable a déjà été prévenu par email, puis propose directement les remplaçants les
 * plus pertinents. Quand une personne absente cumule plusieurs missions le même jour, un
 * bouton permet de tout réaffecter d'un seul geste.
 */
export default function ConflitsCongesCard({
  conflits,
  creneaux,
  indisponibilites,
  intervenants,
  historiqueAlertes,
  conflitsTraites,
  busyCreneauId,
  onReaffecter,
  onOuvrirReaffectationGroupe,
  onBasculerTraite,
  onExporterCsv,
  onToutMarquerTraite,
  onEnvoyerParEmail,
  onAnnulerMarquageJour,
  toutMarquerEnCours,
  envoiEmailEnCours,
  marquagesAujourdhui,
  annulationEnCours,
}: {
  conflits: ConflitConge[];
  /** Toutes les interventions : sert à calculer la charge du jour pour chaque remplaçant. */
  creneaux: CreneauItem[];
  indisponibilites: Indisponibilite[];
  intervenants: Intervenant[];
  /** Dernière alerte connue par intervention + personne absente. */
  historiqueAlertes: Map<string, AlerteConflitHistorique>;
  /** Date de traitement connue par intervention + personne absente (déjà vue en réunion). */
  conflitsTraites: Map<string, string>;
  /** Intervention en cours de réaffectation (affiche un indicateur sur sa ligne). */
  busyCreneauId: number | null;
  onReaffecter: (creneau: CreneauItem, remplacant: Intervenant) => void;
  /** Ouvre la fenêtre de réaffectation en lot pour une journée complète. */
  onOuvrirReaffectationGroupe: (conflits: ConflitConge[]) => void;
  /** Marque (ou démarque) un conflit comme traité pendant la réunion d'équipe. */
  onBasculerTraite: (conflit: ConflitConge, traite: boolean) => void;
  /** Télécharge la liste des conflits au format CSV avant la réunion. */
  onExporterCsv: () => void;
  /** Marque d'un coup tous les conflits restants comme traités (après la réunion). */
  onToutMarquerTraite: () => void;
  /** Envoie la liste CSV des conflits par email au responsable. */
  onEnvoyerParEmail: () => void;
  /** Annule tous les marquages « traité » effectués aujourd'hui (retour arrière). */
  onAnnulerMarquageJour: () => void;
  /** Marquage en lot en cours. */
  toutMarquerEnCours: boolean;
  /** Envoi de l'email en cours. */
  envoiEmailEnCours: boolean;
  /** Nombre de marquages effectués aujourd'hui (base du bouton d'annulation). */
  marquagesAujourdhui: number;
  /** Annulation des marquages du jour en cours. */
  annulationEnCours: boolean;
}) {
  // Suggestions calculées une seule fois pour toute la liste.
  const suggestions = useMemo(() => {
    const map = new Map<number, ReturnType<typeof suggererRemplacants>>();
    conflits.forEach((conflit) => {
      map.set(
        conflit.creneau.id,
        suggererRemplacants({
          date: conflit.creneau.date,
          intervenantId: conflit.creneau.intervenant_id,
          metier: conflit.intervenant?.metier ?? null,
          intervenants,
          creneaux,
          indisponibilites,
          limite: 2,
        }),
      );
    });
    return map;
  }, [conflits, intervenants, creneaux, indisponibilites]);

  // Regroupement par personne et par jour : la clé permet de savoir si la ligne courante
  // ouvre un nouveau groupe, et donc d'afficher le bandeau « réaffecter toutes ».
  const groupes = useMemo(() => {
    const map = new Map<string, GroupeConflit>();
    conflits.forEach((conflit) => {
      const cle = `${conflit.creneau.intervenant_id ?? "null"}|${conflit.creneau.date}`;
      const existant = map.get(cle);
      if (existant) existant.conflits.push(conflit);
      else
        map.set(cle, {
          cle,
          intervenantId: conflit.creneau.intervenant_id,
          date: conflit.creneau.date,
          conflits: [conflit],
        });
    });
    return map;
  }, [conflits]);

  // Ne compter que les conflits encore affichés : un marquage peut concerner une intervention
  // déjà réaffectée et donc sortie de la liste.
  const restants = conflits.filter(
    (conflit) =>
      !conflitsTraites.has(cleAlerteConflit(conflit.creneau.id, conflit.creneau.intervenant_id)),
  ).length;
  const nbTraites = conflits.length - restants;

  return (
    <div className="rounded-lg bg-background-100 border border-accent-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
            <i className="ri-user-shared-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">
              {conflits.length} intervention{conflits.length > 1 ? "s" : ""} en conflit de congé
              <span className="ml-2 inline-flex items-center h-5 px-2 rounded-full bg-accent-100 text-accent-900 text-[10px] font-bold whitespace-nowrap">
                {restants} à traiter
              </span>
              {nbTraites > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-secondary-100 text-secondary-900 text-[10px] font-bold whitespace-nowrap">
                  <i className="ri-checkbox-circle-fill text-[9px]"></i>
                  {nbTraites} traitée{nbTraites > 1 ? "s" : ""}
                </span>
              )}
            </p>
            <p className="text-[11px] text-foreground-600">
              Ces missions tombent un jour où la personne affectée est absente : réaffectez-les d'un clic.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={onExporterCsv}
            title="Télécharger la liste des conflits (CSV) pour préparer la réunion d'équipe"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className="ri-file-download-line"></i>
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={onEnvoyerParEmail}
            disabled={envoiEmailEnCours || conflits.length === 0}
            title="Envoyer la liste des conflits en CSV au responsable avant la réunion d'équipe"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={envoiEmailEnCours ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}></i>
            {envoiEmailEnCours ? "Envoi…" : "Envoyer au responsable"}
          </button>
          {restants > 0 && (
            <button
              type="button"
              onClick={onToutMarquerTraite}
              disabled={toutMarquerEnCours}
              title="Marquer d'un coup toutes les interventions restantes comme traitées, pour vider la liste après la réunion"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-secondary-300 text-secondary-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={toutMarquerEnCours ? "ri-loader-4-line animate-spin" : "ri-check-double-line"}></i>
              {toutMarquerEnCours ? "Marquage…" : "Tout marquer comme traité"}
            </button>
          )}
          {marquagesAujourdhui > 0 && (
            <button
              type="button"
              onClick={onAnnulerMarquageJour}
              disabled={annulationEnCours}
              title={`Annuler les ${marquagesAujourdhui} marquage${
                marquagesAujourdhui > 1 ? "s" : ""
              } effectué${marquagesAujourdhui > 1 ? "s" : ""} aujourd'hui : les interventions redeviennent à traiter`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-300 text-accent-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={annulationEnCours ? "ri-loader-4-line animate-spin" : "ri-arrow-go-back-line"}></i>
              {annulationEnCours ? "Annulation…" : `Annuler le marquage du jour (${marquagesAujourdhui})`}
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-100 border border-accent-300 text-accent-900 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-error-warning-line"></i>
            À réaffecter en priorité
          </span>
        </div>
      </div>

      {conflits.length === 0 ? (
        <div className="flex items-center gap-2 mt-3 rounded-md bg-background-50 border border-background-200 px-3 py-2.5">
          <i className="ri-checkbox-circle-line text-secondary-600"></i>
          <p className="text-xs text-foreground-600">
            Aucune intervention en conflit : tout est correctement affecté sur les jours à venir.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-3 max-h-[440px] overflow-y-auto pr-1">
          {conflits.map((conflit) => {
            const propositions = suggestions.get(conflit.creneau.id) ?? [];
            const enCours = busyCreneauId === conflit.creneau.id;
            const hex = intervenantHex(conflit.intervenant);
            const cleGroupe = `${conflit.creneau.intervenant_id ?? "null"}|${conflit.creneau.date}`;
            const groupe = groupes.get(cleGroupe);
            const ouvreGroupe = groupe?.conflits[0]?.creneau.id === conflit.creneau.id;
            const alerte = historiqueAlertes.get(
              cleAlerteConflit(conflit.creneau.id, conflit.creneau.intervenant_id),
            );
            const cleConflit = cleAlerteConflit(conflit.creneau.id, conflit.creneau.intervenant_id);
            const traiteLe = conflitsTraites.get(cleConflit);
            return (
              <div key={conflit.creneau.id} className="flex flex-col gap-1.5">
                {ouvreGroupe && groupe && groupe.conflits.length > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md bg-accent-100/70 border border-accent-200 px-3 py-2">
                    <p className="text-[11px] font-semibold text-accent-900">
                      <i className="ri-stack-line mr-1"></i>
                      {conflit.intervenant?.nom ?? "Cette personne"} cumule {groupe.conflits.length} interventions le{" "}
                      {formatShortDate(groupe.date)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onOuvrirReaffectationGroupe(groupe.conflits)}
                      className="self-start sm:self-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                    >
                      <i className="ri-user-shared-2-line"></i>
                      Réaffecter toutes ses interventions
                    </button>
                  </div>
                )}

                <div
                  className={`rounded-md bg-background-50 border p-3 ${
                    traiteLe ? "border-secondary-200" : "border-background-200"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="flex flex-col items-center justify-center w-12 shrink-0 rounded-md bg-accent-100 border border-accent-200 py-1">
                        <span className="text-[10px] font-bold text-accent-900 whitespace-nowrap">
                          {formatShortDate(conflit.creneau.date)}
                        </span>
                        <span className="text-[11px] font-bold text-foreground-800 tabular-nums">
                          {conflit.creneau.heure.slice(0, 5)}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground-900 truncate">
                          {conflit.creneau.libelle}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="text-[10px] text-foreground-500 inline-flex items-center gap-1">
                            <i className="ri-map-pin-line"></i>
                            {conflit.creneau.ville || "Lieu à définir"}
                          </span>
                          <span className="text-[10px] font-semibold text-foreground-700 inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
                            {conflit.intervenant?.nom ?? "Intervenant"}
                          </span>
                          <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-accent-100 text-accent-900 text-[10px] font-bold whitespace-nowrap">
                            <i className={`${iconeMotif(conflit.absence.motif)} text-[9px]`}></i>
                            {conflit.absence.motif} ({libellePeriode(conflit.absence.periode)})
                          </span>
                        </div>
                        <HistoriqueAlerte alerte={alerte} />
                        <div className="flex items-center gap-2 flex-wrap mt-1.5">
                          <button
                            type="button"
                            onClick={() => onBasculerTraite(conflit, !traiteLe)}
                            aria-pressed={Boolean(traiteLe)}
                            title={
                              traiteLe
                                ? "Retirer le marquage « traitée » et remettre cette intervention à traiter"
                                : "Marquer comme traitée : cette intervention a déjà été vue en réunion"
                            }
                            className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                              traiteLe
                                ? "bg-secondary-500 text-background-50 hover:bg-secondary-600"
                                : "bg-background-100 border border-dashed border-background-300 text-foreground-600 hover:border-secondary-400 hover:text-secondary-800"
                            }`}
                          >
                            <i className={traiteLe ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"}></i>
                            {traiteLe ? `Traitée le ${formatShortDate(traiteLe.slice(0, 10))}` : "Marquer comme traitée"}
                          </button>
                          {traiteLe && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-secondary-800">
                              <i className="ri-calendar-check-line"></i>
                              vue en réunion
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      {enCours ? (
                        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-900 text-[11px] font-semibold whitespace-nowrap">
                          <i className="ri-loader-4-line animate-spin"></i>
                          Réaffectation…
                        </span>
                      ) : propositions.length === 0 ? (
                        <span
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-500 text-[11px] font-semibold whitespace-nowrap"
                          title="Personne n'est libre ce jour-là : pensez à déplacer l'intervention ou à lever l'absence."
                        >
                          <i className="ri-user-unfollow-line"></i>
                          Aucun remplaçant libre ce jour
                        </span>
                      ) : (
                        propositions.map((p, index) => (
                          <button
                            key={p.intervenant.id}
                            type="button"
                            onClick={() => onReaffecter(conflit.creneau, p.intervenant)}
                            title={`Réaffecter à ${p.intervenant.nom} (${libelleDisponibilite(p)})`}
                            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                              index === 0
                                ? "bg-primary-500 text-background-50 hover:bg-primary-600"
                                : "bg-secondary-100 text-secondary-900 hover:bg-secondary-200"
                            }`}
                          >
                            <i className={index === 0 ? "ri-user-shared-line" : "ri-user-add-line"}></i>
                            <span className="max-w-[120px] truncate">{p.intervenant.nom}</span>
                            <span className="text-[9px] opacity-70 whitespace-nowrap">
                              {p.chargeJour === 0 ? "libre" : `${p.chargeJour} ce jour`}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Rappel de l'alerte email déjà partie pour cette intervention : « Alerte envoyée le
 * 21 oct. à 14:02 à responsable@… ». Permet de vérifier que le responsable a bien été prévenu.
 */
function HistoriqueAlerte({ alerte }: { alerte: AlerteConflitHistorique | undefined }) {
  if (!alerte) {
    return (
      <p className="mt-1 text-[10px] text-foreground-400 inline-flex items-center gap-1">
        <i className="ri-mail-forbid-line"></i>
        Aucune alerte email envoyée pour le moment
      </p>
    );
  }
  const echec = alerte.statut.toLowerCase() !== "envoye";
  return (
    <p
      className={`mt-1 text-[10px] inline-flex items-center gap-1 ${
        echec ? "text-accent-800" : "text-secondary-800"
      }`}
      title={
        echec
          ? "La dernière alerte n'a pas pu être délivrée : vérifiez la configuration email."
          : "Le responsable a bien été prévenu par email."
      }
    >
      <i className={echec ? "ri-mail-close-line" : "ri-mail-check-line"}></i>
      {echec ? "Alerte en échec le" : "Alerte envoyée le"} {formatDateHeureCourte(alerte.createdAt)}
      {alerte.destinataire ? ` à ${alerte.destinataire}` : ""}
    </p>
  );
}

/** Couleur d'identification d'un intervenant, avec un repli neutre. */
function intervenantHex(intervenant: Intervenant | null): string {
  return intervenant ? couleurIntervenant(intervenant.couleur) : "#a8a29e";
}