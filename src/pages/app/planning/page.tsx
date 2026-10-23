import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData, type CreneauItem } from "@/hooks/useArtisanData";
import { createCreneau, deleteCreneau, type CreneauPayload } from "@/lib/artisanApi";
import {
  couleurIntervenant,
  createIntervenant,
  deleteIntervenant,
  deplacerCreneau,
  inviterIntervenant,
  majCreneauPlanning,
  reassignerCreneau,
  regenererCodeInvitation,
  reassignerCreneauxEnLot,
  setIntervenantActif,
  updateIntervenant,
  type Intervenant,
  type IntervenantPayload,
} from "@/lib/intervenants";
import { addDays, formatDayName, formatMonth, formatShortDate, startOfWeek, toISODate } from "@/lib/dates";
import { estCreneauRecent, normaliseStatutCreneau, statutCreneauMeta, type StatutCreneau } from "@/lib/planningIntervenant";
import {
  creerIndisponibilite,
  resumeAbsencesDuJour,
  supprimerIndisponibilite,
  suffixePeriode,
  type AbsenceJourResume,
  type Indisponibilite,
} from "@/lib/indisponibilites";
import { idsConflits, listerConflitsConges, type ConflitConge } from "@/lib/conflitsConges";
import {
  fetchHistoriqueAlertesConflit,
  indexerAlertesConflit,
  prevenirConflitConge,
  fetchConflitsTraites,
  indexerConflitsTraites,
  marquerConflitTraite,
  marquerConflitsTraitesEnLot,
  demarquerConflitTraite,
  envoyerConflitsCongeEmail,
  cleAlerteConflit,
  fetchEnvoisListeConflits,
  annulerMarquagesDuJour,
  fetchRappelConflitsConfig,
  enregistrerRappelConflitsConfig,
  RAPPEL_CONFLITS_DEFAUT,
  type AlerteConflitHistorique,
  type ConflitTraite,
  type EnvoiListeConflits,
  type RappelConflitsConfig,
} from "@/lib/conflitsCongesApi";
import { buildConflitsCongesCsv, telechargerConflitsCongesCsv } from "@/lib/conflitsCongesCsv";
import { buildPlanningMoisPdf } from "@/lib/planningMoisPdf";
import { savePdf } from "@/lib/pdf";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import Modal from "@/pages/app/components/Modal";
import Infobulle from "@/components/base/Infobulle";
import BadgeAbsenceIntervention from "@/components/feature/BadgeAbsenceIntervention";
import CreneauFormModal from "@/pages/app/planning/components/CreneauFormModal";
import IntervenantsManagerModal from "@/pages/app/planning/components/IntervenantsManagerModal";
import PlanningEquipeGrid from "@/pages/app/planning/components/PlanningEquipeGrid";
import PlanningMoisGrid from "@/pages/app/planning/components/PlanningMoisGrid";
import CongeFormModal, { type CongePayload, type CongeInitial } from "@/pages/app/planning/components/CongeFormModal";
import AbsencesMoisCard, { type PeriodeAbsenceGroupee } from "@/pages/app/planning/components/AbsencesMoisCard";
import AbsencesJourCard from "@/pages/app/planning/components/AbsencesJourCard";
import CongesAnnuelsCard from "@/pages/app/planning/components/CongesAnnuelsCard";
import RappelCongesCard from "@/pages/app/planning/components/RappelCongesCard";
import ConflitsCongesCard from "@/pages/app/planning/components/ConflitsCongesCard";
import HistoriqueEnvoisConflits from "@/pages/app/planning/components/HistoriqueEnvoisConflits";
import ReaffectationGroupeeModal from "@/pages/app/planning/components/ReaffectationGroupeeModal";
import RemplacementCongeModal from "@/pages/app/planning/components/RemplacementCongeModal";
import { prevenirIntervenantConge } from "@/lib/congesEmail";
import RecapHeuresEquipe from "@/pages/app/planning/components/RecapHeuresEquipe";
import CreneauQuickEditModal, { type CreneauEditionPatch } from "@/pages/app/planning/components/CreneauQuickEditModal";
import PointageModal from "@/pages/app/components/PointageModal";
import PvRecetteModal from "@/pages/app/components/PvRecetteModal";
import {
  demarrerPointage,
  dureeMinutes,
  etatPointage,
  fetchPointages,
  formatDuree,
  formatHeurePointage,
  majPausePointage,
  rouvrirPointage,
  supprimerPointage,
  terminerPointage,
  type Pointage,
} from "@/lib/pointage";
import {
  enregistrerPvRecette,
  fetchPvRecetteParCreneau,
  fetchPvResumes,
  type PvPayload,
  type PvRecette,
  type PvStatut,
} from "@/lib/pvRecette";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import RappelAstucePage from "@/components/base/RappelAstucePage";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

const toneBg: Record<string, string> = {
  primary: "bg-primary-100 border-primary-200",
  accent: "bg-accent-100 border-accent-200",
  secondary: "bg-secondary-100 border-secondary-200",
};
const tones = ["primary", "accent", "secondary"];

type Vue = "jour" | "equipe" | "mois";

/** Sous-affichage de la vue mensuelle : calendrier classique, ou grille par intervenant. */
type VueMois = "calendrier" | "equipe";

export default function AppPlanning() {
  usePageMeta("Planning · ArtiFlow-pro", "Organisez vos chantiers et vos équipes, et réduisez vos trajets.");
  const { user, profile } = useAuth();
  const { loading, error, creneaux, chantiers, intervenants, indisponibilites, reload } = useArtisanData();

  const [searchParams] = useSearchParams();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(0);
  // Décalage du mois affiché (0 = mois en cours), pour la vue mensuelle.
  const [moisOffset, setMoisOffset] = useState(0);
  const [vueMois, setVueMois] = useState<VueMois>("calendrier");
  // On peut ouvrir la page directement en vue Équipe sur un intervenant précis via l'URL
  // (utilisé par le raccourci « revenir à sa colonne » depuis le planning individuel).
  const [vue, setVue] = useState<Vue>(() => {
    const param = searchParams.get("vue");
    if (param === "equipe") return "equipe";
    if (param === "mois") return "mois";
    return "jour";
  });
  const [surligner, setSurligner] = useState(true);
  const [filtreIntervenant, setFiltreIntervenant] = useState<string>(() => {
    const param = searchParams.get("intervenant");
    return param && Number.isFinite(Number(param)) ? param : "tous";
  });
  const [filtreStatut, setFiltreStatut] = useState<StatutCreneau | "tous">("tous");
  // Filtre « interventions en conflit de congé » : liste tout ce qui reste à réaffecter.
  const [filtreConflit, setFiltreConflit] = useState(false);
  // Fenêtre « proposer un remplaçant » ouverte depuis un badge de congé.
  const [remplacement, setRemplacement] = useState<{
    creneau: CreneauItem;
    absence: AbsenceJourResume;
    nom: string | null;
  } | null>(null);
  // Intervention en cours de réaffectation (indicateur sur la ligne concernée).
  const [reaffectationId, setReaffectationId] = useState<number | null>(null);
  // Réaffectation en lot d'une journée entière (personne absente qui cumule des missions).
  const [remplacementGroupe, setRemplacementGroupe] = useState<ConflitConge[] | null>(null);
  const [groupeBusy, setGroupeBusy] = useState(false);
  // Historique des alertes email déjà envoyées au responsable (date + destinataire).
  const [alertesConflit, setAlertesConflit] = useState<AlerteConflitHistorique[]>([]);
  // Conflits déjà marqués comme traités (vus en réunion d'équipe).
  const [conflitsTraites, setConflitsTraites] = useState<ConflitTraite[]>([]);
  // Marquage en lot de tous les conflits restants (« vider » la liste après la réunion).
  const [toutMarquerBusy, setToutMarquerBusy] = useState(false);
  // Envoi de la liste CSV des conflits par email au responsable.
  const [envoiConflitsBusy, setEnvoiConflitsBusy] = useState(false);
  // Journal des envois de la liste au responsable (date, destinataire, nombre d'interventions).
  const [envoisConflits, setEnvoisConflits] = useState<EnvoiListeConflits[]>([]);
  // Réglage du rappel automatique de la veille de la réunion d'équipe.
  const [rappelConflits, setRappelConflits] = useState<RappelConflitsConfig>(RAPPEL_CONFLITS_DEFAUT);
  const [configRappelBusy, setConfigRappelBusy] = useState(false);
  // Envoi de l'historique en cours de renvoi (indicateur sur la ligne concernée).
  const [renvoiEnvoiId, setRenvoiEnvoiId] = useState<number | null>(null);
  // Annulation des marquages « traité » effectués aujourd'hui (retour arrière).
  const [annulationMarquageBusy, setAnnulationMarquageBusy] = useState(false);
  // Message de confirmation après une réaffectation (ou alerte de conflit).
  const [planningInfo, setPlanningInfo] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<{ date: string; intervenantId: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyInterv, setBusyInterv] = useState(false);
  const [managing, setManaging] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  // Congés et indisponibilités : formulaire ouvert sur une date, et export PDF du mois.
  const [congeForm, setCongeForm] = useState<{ date: string; intervenantId: number | null } | null>(null);
  // Modification d'une absence : les journées d'origine à remplacer + valeurs pré-remplies.
  const [editionAbsence, setEditionAbsence] = useState<{ ids: number[]; initial: CongeInitial } | null>(null);
  const [congeBusy, setCongeBusy] = useState(false);
  // Message de confirmation après un congé posé (et état de la prévenance email).
  const [congeInfo, setCongeInfo] = useState<string | null>(null);
  // Année affichée dans le récapitulatif annuel des congés.
  const [anneeConges, setAnneeConges] = useState(() => new Date().getFullYear());
  const [pdfBusy, setPdfBusy] = useState(false);

  // Suivi terrain : pointages et PV de recette des interventions de la semaine.
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [pvResumes, setPvResumes] = useState<Record<number, PvStatut>>({});
  const [pointageCreneau, setPointageCreneau] = useState<CreneauItem | null>(null);
  const [pointageBusy, setPointageBusy] = useState(false);
  const [pointageError, setPointageError] = useState<string | null>(null);
  const [pvCreneau, setPvCreneau] = useState<CreneauItem | null>(null);
  const [pvCharge, setPvCharge] = useState<PvRecette | null>(null);
  const [pvLoading, setPvLoading] = useState(false);
  const [pvBusy, setPvBusy] = useState(false);
  const [pvError, setPvError] = useState<string | null>(null);
  const [editionCreneau, setEditionCreneau] = useState<CreneauItem | null>(null);
  const [editionBusy, setEditionBusy] = useState(false);

  // Charge les pointages et les statuts de PV en parallèle des données du planning.
  const chargerSuivi = useCallback(async () => {
    try {
      const [pts, pvs] = await Promise.all([fetchPointages(), fetchPvResumes()]);
      setPointages(pts);
      setPvResumes(pvs);
    } catch {
      /* silencieux : le planning reste utilisable sans le suivi */
    }
  }, []);

  useEffect(() => {
    void chargerSuivi();
  }, [chargerSuivi]);

  // Journal des alertes de conflit envoyées au responsable : relu à chaque modification
  // pour afficher « alerte envoyée le … à … » sur la liste des conflits.
  const chargerHistoriqueAlertes = useCallback(async () => {
    setAlertesConflit(await fetchHistoriqueAlertesConflit());
  }, []);

  useEffect(() => {
    void chargerHistoriqueAlertes();
  }, [chargerHistoriqueAlertes]);

  // Suivi de traitement des conflits : relu à chaque marquage pour garder la liste à jour.
  const chargerConflitsTraites = useCallback(async () => {
    setConflitsTraites(await fetchConflitsTraites());
  }, []);

  useEffect(() => {
    void chargerConflitsTraites();
  }, [chargerConflitsTraites]);

  // Journal des envois de la liste des conflits : relu à l'ouverture et après chaque envoi.
  const chargerEnvoisConflits = useCallback(async () => {
    setEnvoisConflits(await fetchEnvoisListeConflits());
  }, []);

  useEffect(() => {
    void chargerEnvoisConflits();
  }, [chargerEnvoisConflits]);

  // Réglage du rappel de la veille : lu à l'ouverture de la liste des conflits. La première
  // fois, on enregistre les valeurs par défaut pour que la tâche planifiée quotidienne sache
  // quel jour prévenir le responsable.
  useEffect(() => {
    if (!user || !filtreConflit) return;
    let annule = false;
    const charger = async () => {
      const config = await fetchRappelConflitsConfig(user.id);
      if (annule) return;
      const retenue = config ?? RAPPEL_CONFLITS_DEFAUT;
      setRappelConflits(retenue);
      if (!config) {
        try {
          await enregistrerRappelConflitsConfig({ userId: user.id, config: retenue });
        } catch {
          /* silencieux : le réglage sera réessayé au prochain changement */
        }
      }
    };
    void charger();
    return () => {
      annule = true;
    };
  }, [user, filtreConflit]);

  // Guide de première visite : ouvert au premier passage sur la page Planning, puis
  // mémorisé une fois fermé par l'artisan. Réouvrable à tout moment via « Revoir le guide ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("planning"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("planning");
    setGuideVisible(false);
  };

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const isoList = days.map(toISODate);
  const selectedDate = isoList[selected];

  // Vue mensuelle : le 1er du mois affiché, puis toutes les cases du calendrier (semaines
  // complètes du lundi au dimanche) et la liste des jours réellement dans le mois.
  const moisBase = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + moisOffset, 1);
  }, [moisOffset]);
  const joursMoisAffiches = useMemo(() => {
    const debut = startOfWeek(moisBase);
    const dernier = new Date(moisBase.getFullYear(), moisBase.getMonth() + 1, 0);
    const indexFin = (dernier.getDay() + 6) % 7;
    const fin = addDays(dernier, 6 - indexFin);
    const liste: Date[] = [];
    for (let d = debut; d.getTime() <= fin.getTime(); d = addDays(d, 1)) liste.push(d);
    return liste;
  }, [moisBase]);
  const isoMois = useMemo(() => joursMoisAffiches.map(toISODate), [joursMoisAffiches]);
  const joursDuMois = useMemo(
    () => joursMoisAffiches.filter((d) => d.getMonth() === moisBase.getMonth() && d.getFullYear() === moisBase.getFullYear()),
    [joursMoisAffiches, moisBase],
  );
  const isoJoursDuMois = useMemo(() => joursDuMois.map(toISODate), [joursDuMois]);

  // Date proposée par défaut dans la fenêtre « Poser un congé » : aujourd'hui si on regarde
  // le mois en cours, sinon le 1er du mois affiché.
  const dateCongeDefaut = moisOffset === 0 ? toISODate(new Date()) : toISODate(moisBase);

  const intervenantParId = useMemo(() => {
    const map = new Map<number, Intervenant>();
    intervenants.forEach((i) => map.set(i.id, i));
    return map;
  }, [intervenants]);

  const intervenantsActifs = useMemo(() => intervenants.filter((i) => i.actif), [intervenants]);

  // Interventions à venir qui tombent un jour d'absence de la personne affectée : ce sont
  // exactement celles qu'il reste à réaffecter. Le compteur du filtre s'appuie dessus.
  const conflits = useMemo(
    () => listerConflitsConges(creneaux, indisponibilites, intervenants),
    [creneaux, indisponibilites, intervenants],
  );
  const conflitIds = useMemo(() => idsConflits(conflits), [conflits]);
  const alertesParConflit = useMemo(() => indexerAlertesConflit(alertesConflit), [alertesConflit]);
  const traitesParConflit = useMemo(() => indexerConflitsTraites(conflitsTraites), [conflitsTraites]);

  // Conflits encore à réaffecter, et conflits déjà vus en réunion : les deux compteurs
  // alimentent la pastille du filtre en tête de planning.
  const conflitsRestants = useMemo(
    () =>
      conflits.filter(
        (c) => !traitesParConflit.has(cleAlerteConflit(c.creneau.id, c.creneau.intervenant_id)),
      ),
    [conflits, traitesParConflit],
  );
  const nbConflitsTraites = conflits.length - conflitsRestants.length;

  // Alerte de la pastille « Conflits congé » : le dernier envoi réussi de la liste au
  // responsable date de plus de 7 jours (ou n'a jamais eu lieu alors qu'il reste des conflits).
  const alerteEnvoiConflits = useMemo(() => {
    if (conflits.length === 0) return null;
    const dernierReussi =
      envoisConflits.find((e) => e.statut.toLowerCase() === "envoye") ?? null;
    if (!dernierReussi) return { jours: null as number | null };
    const date = new Date(dernierReussi.createdAt);
    if (Number.isNaN(date.getTime())) return null;
    const jours = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    return jours > 7 ? { jours } : null;
  }, [conflits.length, envoisConflits]);

  // Marquages encore annulables : ceux effectués aujourd'hui (mauvais clic sur « Tout
  // marquer comme traité »). On compare la date locale du marquage à la date du jour.
  const marquagesAujourdhui = useMemo(() => {
    const aujourdHui = toISODate(new Date());
    return conflitsTraites.filter((t) => {
      if (!t.traiteLe) return false;
      const d = new Date(t.traiteLe);
      return !Number.isNaN(d.getTime()) && toISODate(d) === aujourdHui;
    }).length;
  }, [conflitsTraites]);

  // Le filtre par intervenant s'applique à la vue jour comme à la vue équipe.
  const creneauxParIntervenant = useMemo(() => {
    const base = filtreConflit ? creneaux.filter((c) => conflitIds.has(c.id)) : creneaux;
    if (filtreIntervenant === "tous") return base;
    if (filtreIntervenant === "non") return base.filter((c) => c.intervenant_id === null);
    const id = Number(filtreIntervenant);
    return base.filter((c) => c.intervenant_id === id);
  }, [creneaux, filtreIntervenant, filtreConflit, conflitIds]);

  // Repartition par statut (sur le perimetre « intervenant » choisi) pour les compteurs des filtres.
  const comptesStatut = useMemo(() => {
    const acc: Record<StatutCreneau | "tous", number> = {
      tous: creneauxParIntervenant.length,
      confirmee: 0,
      provisoire: 0,
      faite: 0,
    };
    creneauxParIntervenant.forEach((c) => {
      acc[normaliseStatutCreneau(c.statut)] += 1;
    });
    return acc;
  }, [creneauxParIntervenant]);

  // Filtre par statut : reperer d'un coup d'oeil les interventions non encore validees.
  const creneauxFiltres = useMemo(() => {
    if (filtreStatut === "tous") return creneauxParIntervenant;
    return creneauxParIntervenant.filter((c) => normaliseStatutCreneau(c.statut) === filtreStatut);
  }, [creneauxParIntervenant, filtreStatut]);

  // Interventions du mois affiché (toutes les cases du calendrier, mois voisins inclus).
  const creneauxMois = useMemo(
    () => creneauxFiltres.filter((c) => isoMois.includes(c.date)),
    [creneauxFiltres, isoMois],
  );

  // La vue mensuelle pilote les flèches de navigation sur le mois plutôt que sur la semaine.
  const enMois = vue === "mois";
  const libellePeriode = enMois
    ? formatMonth(moisBase)
    : `${weekOffset === 0 ? "Cette semaine" : weekOffset < 0 ? `Semaine -${Math.abs(weekOffset)}` : `Semaine +${weekOffset}`} · ${formatMonth(weekStart)}`;
  const allerPrecedent = () => {
    if (enMois) setMoisOffset((m) => m - 1);
    else setWeekOffset((w) => w - 1);
  };
  const allerSuivant = () => {
    if (enMois) setMoisOffset((m) => m + 1);
    else setWeekOffset((w) => w + 1);
  };

  const byDate = useMemo(() => {
    const map: Record<string, typeof creneaux> = {};
    creneauxFiltres.forEach((c) => {
      map[c.date] = [...(map[c.date] ?? []), c];
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.heure.localeCompare(b.heure)));
    return map;
  }, [creneauxFiltres]);

  const daySlots = byDate[selectedDate] ?? [];
  const totalSlots = creneauxFiltres.length;

  // Nombre de créneaux « à confirmer » par jour : affiché sur chaque vignette de jour de la
  // vue Jour, pour repérer d'un coup d'œil où sont les interventions en attente sans filtrer.
  const provisoiresParJour = useMemo(() => {
    const map: Record<string, number> = {};
    creneauxParIntervenant.forEach((c) => {
      if (normaliseStatutCreneau(c.statut) === "provisoire") {
        map[c.date] = (map[c.date] ?? 0) + 1;
      }
    });
    return map;
  }, [creneauxParIntervenant]);

  // Absences (congés, formations…) filtrées comme les interventions : le filtre intervenant
  // s'applique aussi à elles, pour ne pas afficher un congé quand on isole une autre personne.
  const absencesFiltrees = useMemo(() => {
    if (filtreIntervenant === "tous") return indisponibilites;
    if (filtreIntervenant === "non") return indisponibilites.filter((i) => i.intervenant_id === null);
    const id = Number(filtreIntervenant);
    return indisponibilites.filter((i) => i.intervenant_id === id);
  }, [indisponibilites, filtreIntervenant]);

  // Absences du jour sélectionné dans la vue Jour.
  const absencesDuJour = useMemo(
    () => absencesFiltrees.filter((i) => i.date === selectedDate),
    [absencesFiltrees, selectedDate],
  );

  // Nombre d'absences par jour, pour signaler les congés directement sur les vignettes.
  const absencesParJour = useMemo(() => {
    const map: Record<string, number> = {};
    absencesFiltrees.forEach((i) => {
      map[i.date] = (map[i.date] ?? 0) + 1;
    });
    return map;
  }, [absencesFiltrees]);

  // Interventions modifiées récemment (48 h) : signalées par un bandeau et surlignées.
  const recents = useMemo(
    () =>
      creneauxFiltres
        .filter((c) => estCreneauRecent(c))
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")),
    [creneauxFiltres],
  );

  // Intervenants affichés dans la grille équipe : tous les actifs, ou une seule colonne si filtré.
  const intervenantsGrille = useMemo(() => {
    if (filtreIntervenant === "tous" || filtreIntervenant === "non") return intervenantsActifs;
    const id = Number(filtreIntervenant);
    return intervenantsActifs.filter((i) => i.id === id);
  }, [intervenantsActifs, filtreIntervenant]);

  const ouvrirAjout = (date: string, intervenantId: number | null = null) => {
    setAddForm({ date, intervenantId });
  };

  // Prévient le responsable par email quand l'intervention tombe un jour où la personne
  // affectée est absente. L'intervention reste enregistrée même si l'email échoue.
  const signalerConflit = async (
    creneauId: number,
    intervenantId: number | null,
    dateISO: string,
  ) => {
    if (intervenantId === null) return;
    if (!resumeAbsencesDuJour(indisponibilites, intervenantId, dateISO)) return;
    const nom = intervenants.find((i) => i.id === intervenantId)?.nom ?? "l'intervenant";
    const resultat = await prevenirConflitConge({ creneauId, intervenantId });
    if (resultat.envoye) {
      setPlanningInfo(
        `Conflit de congé : ${nom} est absent ce jour-là. Le responsable a été prévenu par email.`,
      );
    } else {
      setPlanningInfo(
        `Conflit de congé avec ${nom} : pensez à réaffecter cette intervention${
          resultat.raison ? ` (alerte email non envoyée : ${resultat.raison})` : ""
        }.`,
      );
    }
    void chargerHistoriqueAlertes();
  };

  const handleCreate = async (payload: CreneauPayload) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      const nouveau = await createCreneau(user.id, payload);
      setAddForm(null);
      await reload();
      // Alerte email en arrière-plan : elle ne bloque ni la fermeture ni le rechargement.
      void signalerConflit(nouveau, payload.intervenant_id ?? null, payload.date);
    } catch {
      setActionError("L'ajout du créneau a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const handleReassign = async (creneauId: number, intervenantId: number | null) => {
    setActionError(null);
    const creneau = creneaux.find((c) => c.id === creneauId);
    try {
      await reassignerCreneau(creneauId, intervenantId);
      await reload();
      if (creneau) void signalerConflit(creneauId, intervenantId, creneau.date);
    } catch {
      setActionError("La réaffectation a échoué. Réessayez.");
    }
  };

  // Réaffecte en lot toutes les interventions d'une personne absente un jour donné, ouvert
  // directement depuis le badge de congé d'une intervention (sans passer par le filtre).
  const ouvrirReaffectationLotDepuisBadge = (creneau: CreneauItem) => {
    if (creneau.intervenant_id === null) return;
    const lot = conflits.filter(
      (c) => c.creneau.intervenant_id === creneau.intervenant_id && c.creneau.date === creneau.date,
    );
    if (lot.length > 1) {
      setRemplacementGroupe(lot);
      return;
    }
    // Une seule mission (ou intervention passée) : on ouvre la fenêtre de remplacement simple.
    const absence = resumeAbsencesDuJour(indisponibilites, creneau.intervenant_id, creneau.date);
    if (!absence) return;
    setRemplacement({
      creneau,
      absence,
      nom: intervenantParId.get(creneau.intervenant_id)?.nom ?? null,
    });
  };

  // Marque un conflit comme traité (déjà vu en réunion), ou retire le marquage.
  const basculerConflitTraite = async (conflit: ConflitConge, traite: boolean) => {
    if (!user || conflit.creneau.intervenant_id === null) return;
    setActionError(null);
    const nom = conflit.intervenant?.nom ?? "l'intervenant";
    try {
      if (traite) {
        await marquerConflitTraite({
          userId: user.id,
          creneauId: conflit.creneau.id,
          intervenantId: conflit.creneau.intervenant_id,
          date: conflit.creneau.date,
        });
      } else {
        await demarquerConflitTraite({
          userId: user.id,
          creneauId: conflit.creneau.id,
          intervenantId: conflit.creneau.intervenant_id,
        });
      }
      await chargerConflitsTraites();
      setPlanningInfo(
        traite
          ? `Conflit du ${formatShortDate(conflit.creneau.date)} avec ${nom} marqué comme traité.`
          : `Marquage retiré : le conflit du ${formatShortDate(conflit.creneau.date)} avec ${nom} est de nouveau à traiter.`,
      );
    } catch {
      setActionError("Le marquage du conflit a échoué. Réessayez.");
    }
  };

  // Liste des conflits exportée en CSV, à imprimer ou partager avant la réunion d'équipe.
  const exporterConflitsCsv = () => {
    if (conflits.length === 0) {
      setPlanningInfo("Aucun conflit de congé à exporter pour le moment.");
      return;
    }
    telechargerConflitsCongesCsv(conflits, alertesParConflit, traitesParConflit);
    const restants = conflits.filter(
      (c) => !traitesParConflit.has(cleAlerteConflit(c.creneau.id, c.creneau.intervenant_id)),
    ).length;
    setPlanningInfo(
      `Liste des ${conflits.length} conflits exportée en CSV (${restants} encore à réaffecter).`,
    );
  };

  // Marque d'un seul geste tous les conflits encore à traiter, pour vider la liste
  // juste après la réunion d'équipe. Un seul enregistrement côté Backend.
  const toutMarquerConflitsTraites = async () => {
    if (!user) return;
    const aMarquer = conflitsRestants
      .filter((c) => c.creneau.intervenant_id !== null)
      .map((c) => ({
        creneauId: c.creneau.id,
        intervenantId: c.creneau.intervenant_id as number,
        date: c.creneau.date,
      }));
    if (aMarquer.length === 0) {
      setPlanningInfo("Tous les conflits sont déjà marqués comme traités.");
      return;
    }
    setToutMarquerBusy(true);
    setActionError(null);
    try {
      await marquerConflitsTraitesEnLot({ userId: user.id, conflits: aMarquer });
      await chargerConflitsTraites();
      setPlanningInfo(
        `${aMarquer.length} conflit${aMarquer.length > 1 ? "s" : ""} marqué${
          aMarquer.length > 1 ? "s" : ""
        } comme traité${aMarquer.length > 1 ? "s" : ""} : la liste est à jour pour la prochaine réunion.`,
      );
    } catch {
      setActionError("Le marquage groupé des conflits a échoué. Réessayez.");
    } finally {
      setToutMarquerBusy(false);
    }
  };

  // Filet de sécurité : annule d'un geste tous les marquages faits aujourd'hui, après un
  // « Tout marquer comme traité » cliqué par erreur. Les interventions redeviennent à traiter.
  const annulerMarquageDuJour = async () => {
    if (!user) return;
    setAnnulationMarquageBusy(true);
    setActionError(null);
    setPlanningInfo(null);
    try {
      const nb = await annulerMarquagesDuJour({ userId: user.id });
      await chargerConflitsTraites();
      setPlanningInfo(
        nb > 0
          ? `${nb} marquage${nb > 1 ? "s" : ""} annulé${nb > 1 ? "s" : ""} : les interventions concernées sont de nouveau à traiter.`
          : "Aucun marquage effectué aujourd'hui : rien à annuler.",
      );
    } catch {
      setActionError("L'annulation des marquages du jour a échoué. Réessayez.");
    } finally {
      setAnnulationMarquageBusy(false);
    }
  };

  // Change le réglage du rappel de la veille (jour de réunion ou activation).
  const changerRappelConflits = async (config: RappelConflitsConfig) => {
    if (!user) return;
    const precedent = rappelConflits;
    setRappelConflits(config);
    setConfigRappelBusy(true);
    setActionError(null);
    try {
      await enregistrerRappelConflitsConfig({ userId: user.id, config });
      setPlanningInfo(
        config.actif
          ? `Rappel enregistré : la liste partira par email avec le CSV joint, la veille de la réunion d'équipe à ${config.heureRappel} h.`
          : "Rappel automatique de la veille coupé : seuls les envois manuels partiront désormais.",
      );
    } catch {
      setRappelConflits(precedent);
      setActionError("Le réglage du rappel n'a pas pu être enregistré. Réessayez.");
    } finally {
      setConfigRappelBusy(false);
    }
  };

  // Envoie la liste CSV des conflits par email au responsable avant la réunion d'équipe.
  const envoyerConflitsParEmail = async () => {
    if (conflits.length === 0) {
      setPlanningInfo("Aucun conflit de congé à envoyer pour le moment.");
      return;
    }
    setEnvoiConflitsBusy(true);
    setActionError(null);
    setPlanningInfo(null);
    try {
      const csv = buildConflitsCongesCsv(conflits, alertesParConflit, traitesParConflit);
      const resultat = await envoyerConflitsCongeEmail({
        csv,
        filename: `conflits-conges-${toISODate(new Date())}.csv`,
        total: conflits.length,
        restants: conflitsRestants.length,
      });
      if (resultat.envoye) {
        setPlanningInfo(
          `Liste des ${conflits.length} conflits envoyée par email à ${
            resultat.destinataire ?? "votre adresse de responsable"
          }, avec le fichier CSV en pièce jointe.`,
        );
      } else {
        setActionError(
          `La liste n'a pas pu être envoyée par email${
            resultat.raison ? ` (${resultat.raison})` : ""
          }. Vous pouvez toujours la télécharger en CSV.`,
        );
      }
    } finally {
      setEnvoiConflitsBusy(false);
      // L'envoi (réussi ou en échec) est journalisé côté Backend : on rafraîchit l'historique.
      void chargerEnvoisConflits();
    }
  };

  // Réexpédie la liste au responsable depuis une ligne de l'historique, sans repasser par
  // la carte des conflits. Le nom du fichier d'origine est conservé quand il est connu.
  const renvoyerListeConflits = async (envoi: EnvoiListeConflits) => {
    if (conflits.length === 0) {
      setPlanningInfo("Aucun conflit de congé à renvoyer pour le moment.");
      return;
    }
    setRenvoiEnvoiId(envoi.id);
    setActionError(null);
    setPlanningInfo(null);
    try {
      const csv = buildConflitsCongesCsv(conflits, alertesParConflit, traitesParConflit);
      const resultat = await envoyerConflitsCongeEmail({
        csv,
        filename: envoi.fichier ?? `conflits-conges-${toISODate(new Date())}.csv`,
        total: conflits.length,
        restants: conflitsRestants.length,
        mode: "relance",
      });
      if (resultat.envoye) {
        setPlanningInfo(
          `Liste renvoyée par email à ${
            resultat.destinataire ?? "votre adresse de responsable"
          }, avec le CSV en pièce jointe.`,
        );
      } else {
        setActionError(
          `La liste n'a pas pu être renvoyée${resultat.raison ? ` (${resultat.raison})` : ""}. Vous pouvez toujours la télécharger en CSV.`,
        );
      }
    } finally {
      setRenvoiEnvoiId(null);
      // Chaque renvoi est journalisé côté Backend : l'historique est rafraîchi aussitôt.
      void chargerEnvoisConflits();
    }
  };

  // Réaffecte en une fois toutes les interventions d'une personne absente le même jour.
  const reaffecterGroupe = async (
    creneauxGroupe: ConflitConge[],
    intervenantId: number,
    nom: string,
  ) => {
    if (creneauxGroupe.length === 0) return;
    setGroupeBusy(true);
    setActionError(null);
    setPlanningInfo(null);
    try {
      await reassignerCreneauxEnLot(
        creneauxGroupe.map((c) => c.creneau.id),
        intervenantId,
      );
      await reload();
      setRemplacementGroupe(null);
      setPlanningInfo(
        `${creneauxGroupe.length} intervention${creneauxGroupe.length > 1 ? "s" : ""} du ${formatShortDate(
          creneauxGroupe[0].creneau.date,
        )} réaffectée${creneauxGroupe.length > 1 ? "s" : ""} à ${nom}.`,
      );
    } catch {
      setActionError("La réaffectation groupée a échoué. Réessayez.");
    } finally {
      setGroupeBusy(false);
    }
  };

  // Réaffecte une intervention en conflit à un remplaçant suggéré (un seul geste).
  const reaffecterDepuisConflit = async (
    creneau: CreneauItem,
    intervenantId: number,
    nomRemplacant: string,
  ) => {
    setReaffectationId(creneau.id);
    setActionError(null);
    setPlanningInfo(null);
    try {
      await reassignerCreneau(creneau.id, intervenantId);
      await reload();
      setRemplacement(null);
      setPlanningInfo(
        `Intervention du ${formatShortDate(creneau.date)} (${creneau.heure.slice(0, 5)}) réaffectée à ${nomRemplacant}.`,
      );
    } catch {
      setActionError("La réaffectation a échoué. Réessayez.");
    } finally {
      setReaffectationId(null);
    }
  };

  // Réaffectation en lot : déplace plusieurs interventions vers une même personne d'un seul geste.
  const handleReassignMany = async (creneauIds: number[], intervenantId: number | null) => {
    if (creneauIds.length === 0) return;
    setActionError(null);
    try {
      await reassignerCreneauxEnLot(creneauIds, intervenantId);
      await reload();
    } catch {
      setActionError("La réaffectation en lot a échoué. Réessayez.");
    }
  };

  const confirmDelete = async () => {
    if (pendingDelete === null) return;
    setActionError(null);
    try {
      await deleteCreneau(pendingDelete);
      setPendingDelete(null);
      await reload();
    } catch {
      setActionError("La suppression a échoué.");
    }
  };

  // Enregistre un congé sur une période : une ligne par jour côté base, pour l'affichage direct.
  // Une fois l'absence enregistrée, la personne concernée est prévenue par email.
  const poserConge = async (payload: CongePayload) => {
    if (!user) return;
    setCongeBusy(true);
    setActionError(null);
    setCongeInfo(null);
    try {
      await creerIndisponibilite(user.id, {
        intervenantId: payload.intervenantId,
        dateDebut: payload.dateDebut,
        dateFin: payload.dateFin,
        motif: payload.motif,
        note: payload.note,
        periode: payload.periode,
      });
      setCongeForm(null);
      await reload();

      // Prévenance email : le congé reste enregistré même si l'envoi échoue.
      const concerne = intervenants.find((i) => i.id === payload.intervenantId);
      const resultat = await prevenirIntervenantConge({
        intervenantId: payload.intervenantId,
        dateDebut: payload.dateDebut,
        dateFin: payload.dateFin,
        motif: payload.motif,
        note: payload.note,
        periode: payload.periode,
      });
      const motifComplet = `${payload.motif}${suffixePeriode(payload.periode)}`;
      if (resultat.envoye) {
        setCongeInfo(
          `${motifComplet} posé pour ${concerne?.nom ?? "l'intervenant"}. Prévenance envoyée par email à ${resultat.destinataire ?? "l'intervenant"}.`,
        );
      } else {
        setCongeInfo(
          `${motifComplet} posé pour ${concerne?.nom ?? "l'intervenant"}, mais l'email de prévenance n'a pas pu être envoyé${resultat.raison ? ` (${resultat.raison})` : ""}.`,
        );
      }
    } catch {
      setActionError("L'absence n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setCongeBusy(false);
    }
  };

  // Modifie une absence existante : on remplace toutes ses journées par la nouvelle version
  // (motif, période, demi-journée), sans avoir à la supprimer puis la reposer à la main.
  const modifierAbsence = async (payload: CongePayload) => {
    if (!user || !editionAbsence) return;
    setCongeBusy(true);
    setActionError(null);
    setCongeInfo(null);
    try {
      await Promise.all(editionAbsence.ids.map((id) => supprimerIndisponibilite(id)));
      await creerIndisponibilite(user.id, {
        intervenantId: payload.intervenantId,
        dateDebut: payload.dateDebut,
        dateFin: payload.dateFin,
        motif: payload.motif,
        note: payload.note,
        periode: payload.periode,
      });
      setEditionAbsence(null);
      await reload();
      const concerne = intervenants.find((i) => i.id === payload.intervenantId);
      setCongeInfo(
        `Absence modifiée pour ${concerne?.nom ?? "l'intervenant"} : ${payload.motif}${suffixePeriode(payload.periode)}.`,
      );
    } catch {
      setActionError("L'absence n'a pas pu être modifiée. Réessayez.");
    } finally {
      setCongeBusy(false);
    }
  };

  // Ouvre la fenêtre d'édition pré-remplie depuis une période fusionnée du mois.
  const ouvrirEditionPeriode = (periode: PeriodeAbsenceGroupee) => {
    if (periode.intervenantId === null) return;
    setEditionAbsence({
      ids: periode.ids,
      initial: {
        intervenantId: periode.intervenantId,
        dateDebut: periode.debut,
        dateFin: periode.fin,
        motif: periode.motif,
        note: periode.note,
        periode: periode.periode,
      },
    });
  };

  // Ouvre l'édition d'une absence d'une seule journée (vue Jour).
  const ouvrirEditionJour = (absence: Indisponibilite) => {
    if (absence.intervenant_id === null) return;
    setEditionAbsence({
      ids: [absence.id],
      initial: {
        intervenantId: absence.intervenant_id,
        dateDebut: absence.date,
        dateFin: absence.date,
        motif: absence.motif,
        note: absence.note,
        periode: absence.periode,
      },
    });
  };

  // Retire une absence (toutes les journées de la période affichée dans le récapitulatif).
  const leverAbsences = async (ids: number[]) => {    if (ids.length === 0) return;
    setActionError(null);
    try {
      await Promise.all(ids.map((id) => supprimerIndisponibilite(id)));
      await reload();
    } catch {
      setActionError("L'absence n'a pas pu être retirée. Réessayez.");
    }
  };

  // Génère le planning du mois en PDF paysage, prêt à imprimer pour le mur de l'atelier.
  const imprimerPlanningMois = () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setActionError(null);
    try {
      const doc = buildPlanningMoisPdf({
        entreprise: profile?.entreprise ?? "Mon entreprise",
        mois: moisBase,
        creneaux,
        indisponibilites,
        intervenants: intervenantsActifs,
      });
      savePdf(doc, `planning-${toISODate(moisBase).slice(0, 7)}.pdf`);
    } catch {
      setActionError("Le PDF du planning n'a pas pu être généré.");
    } finally {
      setPdfBusy(false);
    }
  };

  /** Pointage enregistré pour cette intervention, ou null. */
  const pointageDe = (creneauId: number) => pointages.find((p) => p.creneau_id === creneauId) ?? null;

  const pointerArrivee = async () => {
    if (!user || !pointageCreneau) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await demarrerPointage({
        proprietaireId: user.id,
        creneauId: pointageCreneau.id,
        intervenantId: pointageCreneau.intervenant_id,
        date: pointageCreneau.date,
      });
      await reload();
      await chargerSuivi();
    } catch {
      setPointageError("Le pointage n'a pas pu être démarré. Réessayez.");
    } finally {
      setPointageBusy(false);
    }
  };

  const pointerDepart = async () => {
    const courant = pointageCreneau ? pointageDe(pointageCreneau.id) : null;
    if (!courant) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await terminerPointage(courant.id);
      await chargerSuivi();
    } catch {
      setPointageError("L'heure de départ n'a pas pu être enregistrée.");
    } finally {
      setPointageBusy(false);
    }
  };

  const rouvrirPointageCreneau = async () => {
    const courant = pointageCreneau ? pointageDe(pointageCreneau.id) : null;
    if (!courant) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await rouvrirPointage(courant.id);
      await chargerSuivi();
    } catch {
      setPointageError("Le pointage n'a pas pu être rouvert.");
    } finally {
      setPointageBusy(false);
    }
  };

  const changerPause = async (minutes: number) => {
    const courant = pointageCreneau ? pointageDe(pointageCreneau.id) : null;
    if (!courant) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await majPausePointage(courant.id, minutes);
      await chargerSuivi();
    } catch {
      setPointageError("La pause n'a pas pu être enregistrée.");
    } finally {
      setPointageBusy(false);
    }
  };

  const reinitialiserPointage = async () => {
    const courant = pointageCreneau ? pointageDe(pointageCreneau.id) : null;
    if (!courant) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await supprimerPointage(courant.id);
      await chargerSuivi();
    } catch {
      setPointageError("Le pointage n'a pas pu être supprimé.");
    } finally {
      setPointageBusy(false);
    }
  };

  const ouvrirPv = async (creneau: CreneauItem) => {
    setPvCreneau(creneau);
    setPvCharge(null);
    setPvError(null);
    setPvLoading(true);
    try {
      setPvCharge(await fetchPvRecetteParCreneau(creneau.id));
    } catch {
      setPvError("Le PV de recette n'a pas pu être chargé. Réessayez.");
    } finally {
      setPvLoading(false);
    }
  };

  const enregistrerPv = async (payload: PvPayload) => {
    if (!user || !pvCreneau) return;
    setPvBusy(true);
    setPvError(null);
    try {
      await enregistrerPvRecette({ proprietaireId: user.id, creneau: pvCreneau, payload });
      setPvCreneau(null);
      setPvCharge(null);
      await chargerSuivi();
    } catch {
      setPvError("L'enregistrement du PV a échoué. Réessayez.");
    } finally {
      setPvBusy(false);
    }
  };

  // Glisser-déposer dans la vue Équipe : change le jour et/ou l'intervenant.
  const handleMove = async (creneauId: number, date: string, intervenantId: number | null) => {
    if (!user) return;
    setActionError(null);
    try {
      await deplacerCreneau(creneauId, date, intervenantId, user.id);
      await reload();
    } catch {
      setActionError("Le déplacement de l'intervention a échoué. Réessayez.");
    }
  };

  // Glisser-déposer dans le calendrier du mois : change uniquement le jour (l'intervenant est conservé).
  const handleMoveMois = async (creneauId: number, date: string) => {
    if (!user) return;
    const creneau = creneaux.find((c) => c.id === creneauId);
    if (creneau && creneau.date === date) return;
    setActionError(null);
    try {
      await deplacerCreneau(creneauId, date, creneau?.intervenant_id ?? null, user.id);
      await reload();
    } catch {
      setActionError("Le déplacement de l'intervention a échoué. Réessayez.");
    }
  };

  // Édition rapide (crayon) : date, heure, intervenant, statut, lieu et note.
  const handleEditionRapide = async (patch: CreneauEditionPatch) => {
    if (!user || !editionCreneau) return;
    setEditionBusy(true);
    setActionError(null);
    try {
      await majCreneauPlanning(
        editionCreneau.id,
        {
          date: patch.date,
          heure: patch.heure,
          libelle: patch.libelle,
          ville: patch.ville,
          statut: patch.statut,
          intervenant_id: patch.intervenant_id,
          note: patch.note,
        },
        user.id,
      );
      setEditionCreneau(null);
      await reload();
    } catch {
      setActionError("La modification de l'intervention a échoué.");
    } finally {
      setEditionBusy(false);
    }
  };

  // Régénère le code d'invitation d'une fiche (l'ancien est invalidé) puis recharge la liste.
  const regenererCodeIntervenant = async (
    id: number,
  ): Promise<{ code: string | null; error: string | null }> => {
    try {
      const code = await regenererCodeInvitation(id);
      await reload();
      return { code, error: null };
    } catch (e) {
      return { code: null, error: e instanceof Error ? e.message : "La régénération du code a échoué." };
    }
  };

  const handleSaveIntervenant = async (payload: IntervenantPayload, id: number | null) => {
    if (!user) return;
    setBusyInterv(true);
    setActionError(null);
    try {
      if (id === null) await createIntervenant(user.id, payload);
      else await updateIntervenant(id, payload);
      await reload();
    } catch {
      setActionError("L'enregistrement de l'intervenant a échoué.");
    } finally {
      setBusyInterv(false);
    }
  };

  const envoyerInvitation = async (
    email: string,
    nom: string,
  ): Promise<{ error: string | null; code?: string | null; expire?: string | null }> => {
    try {
      const res = await inviterIntervenant({ email, nom });
      // On recharge pour rafraîchir la date du dernier envoi et le code affichés sur la fiche et la liste.
      await reload();
      return { error: null, code: res.code, expire: res.expire };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "L'envoi de l'invitation a échoué.", code: null, expire: null };
    }
  };

  const handleToggleIntervenant = async (id: number, actif: boolean) => {
    setBusyInterv(true);
    setActionError(null);
    try {
      await setIntervenantActif(id, actif);
      if (!actif && filtreIntervenant === String(id)) setFiltreIntervenant("tous");
      await reload();
    } catch {
      setActionError("La mise à jour de l'intervenant a échoué.");
    } finally {
      setBusyInterv(false);
    }
  };

  const handleDeleteIntervenant = async (id: number) => {
    setBusyInterv(true);
    setActionError(null);
    try {
      await deleteIntervenant(id);
      if (filtreIntervenant === String(id)) setFiltreIntervenant("tous");
      await reload();
    } catch {
      setActionError("La suppression de l'intervenant a échoué.");
    } finally {
      setBusyInterv(false);
    }
  };

  // Repères de filtre par statut : libellé, icône et clé de statut.
  const filtreStatutChips: { cle: StatutCreneau | "tous"; label: string; icon: string }[] = [
    { cle: "tous", label: "Toutes", icon: "ri-list-check" },
    { cle: "confirmee", label: "Confirmées", icon: "ri-checkbox-circle-line" },
    { cle: "provisoire", label: "À confirmer", icon: "ri-question-line" },
    { cle: "faite", label: "Faites", icon: "ri-check-double-line" },
  ];

  const etapesGuide = [
    {
      icone: "ri-calendar-2-line",
      titre: "Choisissez la semaine",
      texte:
        "Naviguez de semaine en semaine avec les flèches : « Cette semaine », puis la suivante ou la précédente.",
    },
    {
      icone: "ri-add-line",
      titre: "Ajoutez un créneau",
      texte:
        "Bouton « Ajouter un créneau » : indiquez l'heure, l'intervention, la ville, et à quel intervenant vous l'affectez.",
    },
    {
      icone: "ri-team-line",
      titre: "Répartissez l'équipe",
      texte:
        "Vous travaillez à plusieurs ? Ajoutez vos intervenants, puis basculez en vue « Équipe » : une colonne par personne.",
    },
    {
      icone: "ri-route-line",
      titre: "Suivez la journée",
      texte:
        "Cliquez sur un jour : le détail s'affiche en dessous. Filtrez par intervenant pour ne voir que le planning d'une personne.",
    },
  ];

  if (!loading && !error && creneaux.length === 0) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : organisez votre semaine"
            sousTitre="Voici, en 4 étapes, comment remplir votre planning d'interventions pour réduire vos trajets et ne plus rien oublier."
            etapes={etapesGuide}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide du planning »."
            onFermer={fermerGuide}
          />
        )}
        <EmptyState
          icon="ri-calendar-2-line"
          title="Votre planning est libre"
          text="Ajoutez vos interventions pour organiser votre semaine et réduire vos trajets, ou chargez un jeu de données d'exemple."
        >
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => ouvrirAjout(selectedDate)}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i> Ajouter un créneau
            </button>
            <Link
              to="/app/intervenants"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
            >
              <i className="ri-team-line"></i> Gérer les intervenants
            </Link>
            <SampleDataButton onSeeded={reload} />
          </div>
        </EmptyState>
        {addForm && (
          <CreneauFormModal
            defaultDate={addForm.date}
            defaultIntervenantId={addForm.intervenantId}
            chantiers={chantiers}
            intervenants={intervenantsActifs}
            busy={busy}
            onClose={() => setAddForm(null)}
            onSubmit={handleCreate}
          />
        )}
        {managing && (
          <IntervenantsManagerModal
            intervenants={intervenants}
            busy={busyInterv}
            onClose={() => setManaging(false)}
            onSave={handleSaveIntervenant}
            onToggle={handleToggleIntervenant}
            onDelete={handleDeleteIntervenant}
            onInviter={envoyerInvitation}
            onRegenererCode={regenererCodeIntervenant}
          />
        )}
        <RappelAstucePage />
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        {/* Barre supérieure : navigation de semaine + bascule de vue */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allerPrecedent}
              aria-label={enMois ? "Mois précédent" : "Semaine précédente"}
              className="w-10 h-10 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-foreground-700"></i>
            </button>
            <span className="min-w-[150px] text-center font-heading font-semibold text-sm text-foreground-950">
              {libellePeriode}
            </span>
            <button
              type="button"
              onClick={allerSuivant}
              aria-label={enMois ? "Mois suivant" : "Semaine suivante"}
              className="w-10 h-10 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer"
            >
              <i className="ri-arrow-right-s-line text-foreground-700"></i>
            </button>
            {(enMois ? moisOffset !== 0 : weekOffset !== 0) && (
              <button
                type="button"
                onClick={() => {
                  setWeekOffset(0);
                  setMoisOffset(0);
                }}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md bg-secondary-100 text-secondary-900 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              >
                <i className="ri-focus-3-line"></i>
                {enMois ? "Ce mois" : "Aujourd'hui"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200">
              <button
                type="button"
                onClick={() => setVue("jour")}
                className={`inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  vue === "jour" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-calendar-event-line"></i> Jour
              </button>
              <button
                type="button"
                onClick={() => setVue("equipe")}
                className={`inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  vue === "equipe" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-team-line"></i> Équipe
              </button>
              <button
                type="button"
                onClick={() => setVue("mois")}
                className={`inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  vue === "mois" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-calendar-line"></i> Mois
              </button>
            </div>

            <Link
              to="/app/intervenants"
              title="Ouvrir la page de gestion des intervenants"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-team-line"></i>
              <span className="hidden md:inline">Intervenants</span>
            </Link>
            <button
              type="button"
              onClick={() => setCongeForm({ date: dateCongeDefaut, intervenantId: null })}
              title="Poser un congé ou une indisponibilité pour un intervenant"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-suitcase-line"></i>
              <span className="hidden md:inline">Poser un congé</span>
            </button>
            <button
              type="button"
              onClick={() => ouvrirAjout(enMois ? toISODate(moisBase) : selectedDate)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i>
              Ajouter un créneau
            </button>
          </div>
        </div>

        {/* Filtre par intervenant + compteur */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Infobulle
              contenu="Filtrez le planning sur une seule personne de votre équipe, ou sur les interventions encore sans intervenant. Utile pour vérifier la charge de chacun."
              position="bas"
            >
              <span className="text-xs font-semibold text-foreground-500 inline-flex items-center gap-1 cursor-help">
                <i className="ri-filter-3-line"></i> Intervenant
              </span>
            </Infobulle>
            <button
              type="button"
              onClick={() => setFiltreIntervenant("tous")}
              className={`inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtreIntervenant === "tous" ? "bg-primary-500 text-background-50" : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
              }`}
            >
              Tous
            </button>
            {intervenantsActifs.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setFiltreIntervenant(String(i.id))}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filtreIntervenant === String(i.id) ? "bg-foreground-900 text-background-50" : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: couleurIntervenant(i.couleur) }} />
                {i.nom}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFiltreIntervenant("non")}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtreIntervenant === "non" ? "bg-foreground-900 text-background-50" : "bg-background-100 border border-background-200 text-foreground-500 hover:bg-background-200"
              }`}
            >
              <i className="ri-user-unfollow-line"></i> Non affecté
            </button>
            <button
              type="button"
              onClick={() => setFiltreConflit((v) => !v)}
              aria-pressed={filtreConflit}
              title="Afficher uniquement les interventions qui tombent un jour de congé (ou d'absence) de la personne affectée : tout ce qui reste à réaffecter"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtreConflit
                  ? "bg-accent-500 text-background-50 hover:bg-accent-600"
                  : "bg-accent-100 border border-accent-200 text-accent-900 hover:bg-accent-200"
              }`}
            >
              <i className="ri-user-shared-line"></i>
              Conflits congé
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${
                  filtreConflit ? "bg-background-50/25" : "bg-background-50 text-accent-800"
                }`}
              >
                {conflits.length}
              </span>
              {nbConflitsTraites > 0 && (
                <span
                  title={`${nbConflitsTraites} conflit${nbConflitsTraites > 1 ? "s" : ""} déjà marqué${
                    nbConflitsTraites > 1 ? "s" : ""
                  } comme traité${nbConflitsTraites > 1 ? "s" : ""} (vus en réunion)`}
                  className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                    filtreConflit
                      ? "bg-background-50/25"
                      : "bg-secondary-500 text-background-50"
                  }`}
                >
                  <i className="ri-checkbox-circle-fill text-[9px]"></i>
                  {nbConflitsTraites} traités
                </span>
              )}
              {alerteEnvoiConflits && (
                <span
                  title={
                    alerteEnvoiConflits.jours === null
                      ? "La liste des conflits n'a encore jamais été envoyée au responsable : pensez à l'envoyer avant la réunion d'équipe."
                      : `La liste a été envoyée au responsable il y a ${alerteEnvoiConflits.jours} jours : pensez à la renvoyer avant la réunion d'équipe.`
                  }
                  className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                    filtreConflit ? "bg-background-50 text-accent-800" : "bg-accent-500 text-background-50"
                  }`}
                >
                  <i className="ri-alarm-warning-line text-[9px]"></i>
                  {alerteEnvoiConflits.jours === null ? "Jamais envoyé" : `${alerteEnvoiConflits.jours} j`}
                </span>
              )}
            </button>
            {filtreIntervenant !== "tous" && filtreIntervenant !== "non" && (
              <Link
                to={`/app/mon-planning?intervenant=${filtreIntervenant}`}
                title="Ouvrir le planning personnel de cette personne"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-200 transition-colors"
              >
                <i className="ri-external-link-line"></i> Voir son planning
              </Link>
            )}
          </div>
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 h-10 rounded-md bg-accent-100 text-accent-700 text-xs font-semibold whitespace-nowrap">
            <i className="ri-route-line"></i>
            {totalSlots} interventions
          </span>
        </div>

        {/* Filtre par statut : repérer les interventions non encore validées */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-filter-3-line"></i> Statut
          </span>
          {filtreStatutChips.map((s) => {
            const actif = filtreStatut === s.cle;
            const provisoire = s.cle === "provisoire";
            return (
              <button
                key={s.cle}
                type="button"
                onClick={() => setFiltreStatut(s.cle)}
                aria-pressed={actif}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  actif
                    ? provisoire
                      ? "bg-accent-500 text-background-50"
                      : "bg-foreground-900 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className={s.icon}></i>
                {s.label}
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${
                    actif ? "bg-background-50/25" : "bg-background-200 text-foreground-500"
                  }`}
                >
                  {comptesStatut[s.cle]}
                </span>
              </button>
            );
          })}
        </div>

        {filtreConflit && (
          <>
            <ConflitsCongesCard
              conflits={conflits}
              creneaux={creneaux}
              indisponibilites={indisponibilites}
              intervenants={intervenantsActifs}
              historiqueAlertes={alertesParConflit}
              conflitsTraites={traitesParConflit}
              busyCreneauId={reaffectationId}
              onReaffecter={(creneau, remplacant) =>
                void reaffecterDepuisConflit(creneau, remplacant.id, remplacant.nom)
              }
              onOuvrirReaffectationGroupe={(groupe) => setRemplacementGroupe(groupe)}
              onBasculerTraite={(conflit, traite) => void basculerConflitTraite(conflit, traite)}
              onExporterCsv={exporterConflitsCsv}
              onToutMarquerTraite={() => void toutMarquerConflitsTraites()}
              onEnvoyerParEmail={() => void envoyerConflitsParEmail()}
              onAnnulerMarquageJour={() => void annulerMarquageDuJour()}
              toutMarquerEnCours={toutMarquerBusy}
              envoiEmailEnCours={envoiConflitsBusy}
              marquagesAujourdhui={marquagesAujourdhui}
              annulationEnCours={annulationMarquageBusy}
            />
            {/* Journal des envois + réglage du rappel automatique de la veille */}
            <HistoriqueEnvoisConflits
              envois={envoisConflits}
              config={rappelConflits}
              configBusy={configRappelBusy}
              onChangerConfig={(config) => void changerRappelConflits(config)}
              onRenvoyer={(envoi) => void renvoyerListeConflits(envoi)}
              renvoiId={renvoiEnvoiId}
            />
          </>
        )}

        {!enMois && (
          <RecapHeuresEquipe
            pointages={pointages}
            intervenants={intervenants}
            isoList={isoList}
            labelSemaine={`${
              weekOffset === 0 ? "Cette semaine" : weekOffset < 0 ? `Semaine -${Math.abs(weekOffset)}` : `Semaine +${weekOffset}`
            } · ${formatMonth(weekStart)}`}
            creneaux={creneaux}
            filtreIntervenant={filtreIntervenant}
            onFiltrer={setFiltreIntervenant}
          />
        )}

        {recents.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-accent-100 border border-accent-200 p-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                <i className="ri-flashlight-line text-lg"></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground-950">
                  {recents.length} intervention{recents.length > 1 ? "s" : ""} modifiée{recents.length > 1 ? "s" : ""} depuis 48 h
                </p>
                <p className="text-[11px] text-foreground-600 truncate">
                  {recents.slice(0, 3).map((c) => `${c.date} · ${c.heure} · ${c.libelle}`).join("   |   ")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSurligner((v) => !v)}
              aria-pressed={surligner}
              className={`self-start sm:self-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                surligner ? "bg-accent-500 text-background-50 hover:bg-accent-600" : "bg-background-50 border border-accent-300 text-accent-800 hover:bg-accent-50"
              }`}
            >
              <i className={surligner ? "ri-focus-3-line" : "ri-focus-2-line"}></i>
              {surligner ? "Surlignage activé" : "Surligner"}
            </button>
          </div>
        )}

        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : organisez votre semaine"
            sousTitre="Voici, en 4 étapes, comment remplir votre planning d'interventions pour réduire vos trajets et ne plus rien oublier."
            etapes={etapesGuide}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide du planning »."
            onFermer={fermerGuide}
          />
        )}

        {!guideVisible && (
          <button
            type="button"
            onClick={() => setGuideVisible(true)}
            className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-accent-700 transition-colors"
          >
            <i className="ri-question-line"></i>
            Revoir le guide du planning
          </button>
        )}

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        {planningInfo && (
          <div className="flex items-start gap-2 rounded-md bg-primary-100 border border-primary-200 px-3 py-2">
            <i className="ri-user-shared-line text-primary-700 mt-0.5"></i>
            <p className="flex-1 text-xs text-primary-900">{planningInfo}</p>
            <button
              type="button"
              onClick={() => setPlanningInfo(null)}
              aria-label="Fermer le message"
              className="w-6 h-6 shrink-0 flex items-center justify-center rounded hover:bg-primary-200 cursor-pointer"
            >
              <i className="ri-close-line text-primary-700 text-[13px]"></i>
            </button>
          </div>
        )}

        {congeInfo && (
          <div className="flex items-start gap-2 rounded-md bg-secondary-100 border border-secondary-200 px-3 py-2">
            <i className="ri-mail-check-line text-secondary-700 mt-0.5"></i>
            <p className="flex-1 text-xs text-secondary-900">{congeInfo}</p>
            <button
              type="button"
              onClick={() => setCongeInfo(null)}
              aria-label="Fermer le message"
              className="w-6 h-6 shrink-0 flex items-center justify-center rounded hover:bg-secondary-200 cursor-pointer"
            >
              <i className="ri-close-line text-secondary-700 text-[13px]"></i>
            </button>
          </div>
        )}

        {vue === "equipe" ? (
          <PlanningEquipeGrid
            days={days}
            isoList={isoList}
            intervenants={intervenantsGrille}
            intervenantsChoix={intervenantsActifs}
            creneaux={creneauxFiltres.filter((c) => isoList.includes(c.date))}
            creneauxSemaine={creneauxParIntervenant.filter((c) => isoList.includes(c.date))}
            onAddFor={(intervenantId, iso) => ouvrirAjout(iso, intervenantId)}
            onDelete={(id) => setPendingDelete(id)}
            onReassign={handleReassign}
            onReassignMany={handleReassignMany}
            onMove={(id, iso, intervenantId) => void handleMove(id, iso, intervenantId)}
            onEdit={(c) => setEditionCreneau(c)}
            inclureNonAffecte={filtreIntervenant === "tous" || filtreIntervenant === "non"}
            aConfirmerParJour={provisoiresParJour}
            indisponibilites={indisponibilites}
            onProposerRemplacant={(creneau, absence, nom) => setRemplacement({ creneau, absence, nom })}
            onReaffecterLotIntervenant={ouvrirReaffectationLotDepuisBadge}
          />
        ) : vue === "mois" ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 self-start">
                <button
                  type="button"
                  onClick={() => setVueMois("calendrier")}
                  className={`inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    vueMois === "calendrier"
                      ? "bg-foreground-900 text-background-50"
                      : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  <i className="ri-calendar-2-line"></i> Calendrier du mois
                </button>
                <button
                  type="button"
                  onClick={() => setVueMois("equipe")}
                  className={`inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    vueMois === "equipe"
                      ? "bg-foreground-900 text-background-50"
                      : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  <i className="ri-team-line"></i> Par intervenant
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                <button
                  type="button"
                  onClick={imprimerPlanningMois}
                  disabled={pdfBusy}
                  title="Imprimer ou enregistrer le planning du mois en PDF, à afficher au mur de l'atelier"
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
                >
                  <i className={pdfBusy ? "ri-loader-4-line animate-spin" : "ri-printer-line"}></i>
                  Imprimer / PDF du mois
                </button>
                <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
                  <i className="ri-information-line"></i>
                  {creneauxMois.length === 0
                    ? "Aucune intervention sur ce mois : cliquez sur un jour pour en ajouter une."
                    : `${creneauxMois.length} intervention${creneauxMois.length > 1 ? "s" : ""} affichée${creneauxMois.length > 1 ? "s" : ""} sur ${formatMonth(moisBase)}`}
                </span>
              </div>
            </div>

            {vueMois === "calendrier" ? (
              <PlanningMoisGrid
                weeks={joursMoisAffiches}
                isoList={isoMois}
                mois={moisBase}
                creneaux={creneauxMois}
                intervenants={intervenantsActifs}
                indisponibilites={indisponibilites}
                aConfirmerParJour={provisoiresParJour}
                onAddFor={(iso) => ouvrirAjout(iso)}
                onEdit={(c) => setEditionCreneau(c)}
                onMove={(id, iso) => void handleMoveMois(id, iso)}
                onDelete={(id) => setPendingDelete(id)}
                onProposerRemplacant={(creneau, absence, nom) => setRemplacement({ creneau, absence, nom })}
              />
            ) : (
              <PlanningEquipeGrid
                days={joursDuMois}
                isoList={isoJoursDuMois}
                intervenants={intervenantsGrille}
                intervenantsChoix={intervenantsActifs}
                creneaux={creneauxMois.filter((c) => isoJoursDuMois.includes(c.date))}
                creneauxSemaine={creneauxParIntervenant.filter((c) => isoJoursDuMois.includes(c.date))}
                onAddFor={(intervenantId, iso) => ouvrirAjout(iso, intervenantId)}
                onDelete={(id) => setPendingDelete(id)}
                onReassign={handleReassign}
                onReassignMany={handleReassignMany}
                onMove={(id, iso, intervenantId) => void handleMove(id, iso, intervenantId)}
                onEdit={(c) => setEditionCreneau(c)}
                inclureNonAffecte={filtreIntervenant === "tous" || filtreIntervenant === "non"}
                aConfirmerParJour={provisoiresParJour}
                periodeLabel="ce mois"
                indisponibilites={indisponibilites}
                accordionsSemaines
                onProposerRemplacant={(creneau, absence, nom) => setRemplacement({ creneau, absence, nom })}
                onReaffecterLotIntervenant={ouvrirReaffectationLotDepuisBadge}
              />
            )}

            {/* Absences du mois : visibles d'un coup d'œil, et levables d'un clic. */}
            <AbsencesMoisCard
              indisponibilites={indisponibilites.filter((i) => isoJoursDuMois.includes(i.date))}
              intervenants={intervenants}
              onAjouter={() => setCongeForm({ date: dateCongeDefaut, intervenantId: null })}
              onSupprimer={(ids) => void leverAbsences(ids)}
              onModifier={ouvrirEditionPeriode}
            />

            {/* Récapitulatif annuel : jours posés et jours restants par intervenant. */}
            <CongesAnnuelsCard
              indisponibilites={indisponibilites}
              intervenants={intervenantsActifs}
              annee={anneeConges}
              onChangerAnnee={setAnneeConges}
            />

            {/* Rappel hebdomadaire : aperçu de l'email et envoi de test immédiat. */}
            <RappelCongesCard userId={user?.id ?? ""} indisponibilites={indisponibilites} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2 md:gap-3">
              {days.map((day, i) => {
                const nbAConfirmer = provisoiresParJour[isoList[i]] ?? 0;
                return (
                <button
                  key={isoList[i]}
                  type="button"
                  onClick={() => setSelected(i)}
                  title={
                    nbAConfirmer > 0
                      ? `${nbAConfirmer} intervention${nbAConfirmer > 1 ? "s" : ""} à confirmer ce jour`
                      : undefined
                  }
                  className={`relative flex flex-col items-center gap-2 p-2 md:p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected === i ? "bg-primary-500 border-primary-500 text-background-50" : "bg-background-100 border-background-200 text-foreground-700 hover:border-primary-300"
                  }`}
                >
                  {nbAConfirmer > 0 && (
                    <span
                      className={`absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                        selected === i ? "bg-background-50 text-accent-700" : "bg-accent-500 text-background-50"
                      }`}
                    >
                      <i className="ri-question-line"></i>
                      {nbAConfirmer}
                    </span>
                  )}
                  <span className="text-[11px] md:text-xs font-medium">{formatDayName(day).slice(0, 3)}</span>
                  <span className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold ${selected === i ? "bg-background-50/20" : "bg-background-200"}`}>
                    {day.getDate()}
                  </span>
                  <span className={`text-[10px] font-medium ${selected === i ? "text-background-50/80" : "text-foreground-400"}`}>
                    {(byDate[isoList[i]] ?? []).length} rdv
                  </span>
                  {(absencesParJour[isoList[i]] ?? 0) > 0 && (
                    <span
                      title={`${absencesParJour[isoList[i]]} absence${(absencesParJour[isoList[i]] ?? 0) > 1 ? "s" : ""} ce jour`}
                      className={`inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                        selected === i ? "bg-background-50/25 text-background-50" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      <i className="ri-suitcase-line"></i>
                      {absencesParJour[isoList[i]]} abs.
                    </span>
                  )}
                </button>
                );
              })}
            </div>

            <div className="p-5 rounded-lg bg-background-100 border border-background-200">
              <h2 className="font-heading font-semibold text-base text-foreground-950 mb-4">
                {formatDayName(days[selected])} {days[selected].getDate()} {formatMonth(days[selected])}
              </h2>

              {/* Congés et indisponibilités du jour : visibles sans changer de vue. */}
              <div className="mb-4">
                <AbsencesJourCard
                  absences={absencesDuJour}
                  intervenants={intervenants}
                  onSupprimer={(id) => void leverAbsences([id])}
                  onAjouter={() => setCongeForm({ date: selectedDate, intervenantId: null })}
                  onModifier={ouvrirEditionJour}
                />
              </div>

              {daySlots.length === 0 ? (
                <p className="text-sm text-foreground-500">
                  {absencesDuJour.length > 0
                    ? "Aucune intervention prévue : la personne concernée est en absence ce jour-là."
                    : "Aucune intervention prévue. Ajoutez un créneau pour bloquer du temps."}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {daySlots.map((slot, idx) => {
                    const interv = slot.intervenant_id !== null ? intervenantParId.get(slot.intervenant_id) : undefined;
                    const recent = surligner && estCreneauRecent(slot);
                    const statutMeta = statutCreneauMeta(normaliseStatutCreneau(slot.statut));
                    const pt = pointageDe(slot.id);
                    const etatPt = etatPointage(pt);
                    const pvStatut = pvResumes[slot.id] ?? null;
                    const absenceSlot = resumeAbsencesDuJour(indisponibilites, slot.intervenant_id, slot.date);
                    return (
                      <div key={slot.id} className={`flex items-center gap-4 p-3.5 rounded-md border ${toneBg[tones[idx % 3]]} ${recent ? "ring-2 ring-accent-300" : ""}`}>
                        <span className="w-14 text-sm font-bold text-foreground-800">{slot.heure}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground-900 truncate">{slot.libelle}</p>
                            <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${statutMeta.tone}`}>
                              <i className={statutMeta.icon}></i>
                              {statutMeta.label}
                            </span>
                            {recent && (
                              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                                <i className="ri-flashlight-line"></i> Modifié
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                              <i className="ri-map-pin-line"></i>
                              {slot.ville || "Lieu à définir"}
                            </span>
                            {interv ? (
                              <span className="text-[11px] font-medium text-foreground-700 inline-flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: couleurIntervenant(interv.couleur) }} />
                                {interv.nom}
                              </span>
                            ) : (
                              <span className="text-[11px] text-foreground-400 inline-flex items-center gap-1">
                                <i className="ri-user-unfollow-line"></i>
                                Non affecté
                              </span>
                            )}
                            <BadgeAbsenceIntervention
                              absence={absenceSlot}
                              nom={interv?.nom ?? null}
                              dateISO={slot.date}
                              onProposerRemplacant={
                                absenceSlot
                                  ? () =>
                                      setRemplacement({
                                        creneau: slot,
                                        absence: absenceSlot,
                                        nom: interv?.nom ?? null,
                                      })
                                  : undefined
                              }
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setPointageError(null);
                                setPointageCreneau(slot);
                              }}
                              title="Pointage de l'intervention (arrivée / départ)"
                              className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                                etatPt === "en-cours"
                                  ? "bg-accent-500 text-background-50"
                                  : etatPt === "termine"
                                    ? "bg-secondary-100 text-secondary-900"
                                    : "bg-background-100 border border-dashed border-background-300 text-foreground-500 hover:border-primary-300 hover:text-primary-700"
                              }`}
                            >
                              <i
                                className={
                                  etatPt === "en-cours"
                                    ? "ri-timer-flash-line"
                                    : etatPt === "termine"
                                      ? "ri-checkbox-circle-line"
                                      : "ri-login-box-line"
                                }
                              ></i>
                              {etatPt === "absent"
                                ? "Pointer"
                                : etatPt === "en-cours"
                                  ? `En cours · ${formatDuree(dureeMinutes(pt))}`
                                  : `${formatHeurePointage(pt?.arrivee_le)} → ${formatHeurePointage(pt?.depart_le)} · ${formatDuree(dureeMinutes(pt))}`}
                            </button>
                            {pvStatut && (
                              <span
                                className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                  pvStatut === "valide"
                                    ? "bg-primary-100 text-primary-800"
                                    : "bg-accent-100 text-accent-800"
                                }`}
                              >
                                <i className={pvStatut === "valide" ? "ri-shield-check-line" : "ri-draft-line"}></i>
                                {pvStatut === "valide" ? "PV signé" : "PV brouillon"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void ouvrirPv(slot)}
                            title="PV de recette (photos, conformité, signature)"
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-primary-700 cursor-pointer"
                            aria-label="Ouvrir le PV de recette"
                          >
                            <i className="ri-file-shield-2-line text-foreground-500"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditionCreneau(slot)}
                            title="Modifier la date, l'heure ou l'intervenant"
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-primary-700 cursor-pointer"
                            aria-label="Modifier le créneau"
                          >
                            <i className="ri-pencil-line text-foreground-500"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(slot.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-red-600 cursor-pointer"
                            aria-label="Supprimer le créneau"
                          >
                            <i className="ri-delete-bin-line text-foreground-500"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {addForm && (
          <CreneauFormModal
            defaultDate={addForm.date}
            defaultIntervenantId={addForm.intervenantId}
            chantiers={chantiers}
            intervenants={intervenantsActifs}
            busy={busy}
            onClose={() => setAddForm(null)}
            onSubmit={handleCreate}
          />
        )}

        {managing && (
          <IntervenantsManagerModal
            intervenants={intervenants}
            busy={busyInterv}
            onClose={() => setManaging(false)}
            onSave={handleSaveIntervenant}
            onToggle={handleToggleIntervenant}
            onDelete={handleDeleteIntervenant}
            onInviter={envoyerInvitation}
            onRegenererCode={regenererCodeIntervenant}
          />
        )}

        {pendingDelete !== null && (
          <Modal title="Supprimer ce créneau ?" onClose={() => setPendingDelete(null)}>
            <p className="text-sm text-foreground-600">Cette intervention sera retirée de votre planning.</p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
              >
                Supprimer
              </button>
            </div>
          </Modal>
        )}

        {congeForm && (
          <CongeFormModal
            intervenants={intervenantsActifs}
            defaultDate={congeForm.date}
            defaultIntervenantId={congeForm.intervenantId}
            busy={congeBusy}
            onClose={() => setCongeForm(null)}
            onSubmit={(payload) => void poserConge(payload)}
          />
        )}

        {editionAbsence && (
          <CongeFormModal
            intervenants={intervenantsActifs}
            defaultDate={editionAbsence.initial.dateDebut}
            defaultIntervenantId={editionAbsence.initial.intervenantId}
            initial={editionAbsence.initial}
            busy={congeBusy}
            onClose={() => setEditionAbsence(null)}
            onSubmit={(payload) => void modifierAbsence(payload)}
          />
        )}

        {editionCreneau && (
          <CreneauQuickEditModal
            creneau={editionCreneau}
            intervenants={intervenantsActifs}
            busy={editionBusy}
            onClose={() => setEditionCreneau(null)}
            onSubmit={(patch) => void handleEditionRapide(patch)}
          />
        )}

        {remplacement && (
          <RemplacementCongeModal
            creneau={remplacement.creneau}
            absence={remplacement.absence}
            intervenantNom={remplacement.nom}
            intervenantMetier={
              remplacement.creneau.intervenant_id !== null
                ? intervenantParId.get(remplacement.creneau.intervenant_id)?.metier ?? null
                : null
            }
            intervenants={intervenantsActifs}
            creneaux={creneaux}
            indisponibilites={indisponibilites}
            busy={reaffectationId === remplacement.creneau.id}
            onChoisir={(intervenantId) => {
              const nom = intervenants.find((i) => i.id === intervenantId)?.nom ?? "ce remplaçant";
              void reaffecterDepuisConflit(remplacement.creneau, intervenantId, nom);
            }}
            onClose={() => setRemplacement(null)}
          />
        )}

        {remplacementGroupe && (
          <ReaffectationGroupeeModal
            conflits={remplacementGroupe}
            intervenants={intervenantsActifs}
            creneaux={creneaux}
            indisponibilites={indisponibilites}
            busy={groupeBusy}
            onChoisir={(intervenantId, nom) =>
              void reaffecterGroupe(remplacementGroupe, intervenantId, nom)
            }
            onClose={() => setRemplacementGroupe(null)}
          />
        )}

        {pointageCreneau && (
          <PointageModal
            creneau={pointageCreneau}
            pointage={pointageDe(pointageCreneau.id)}
            intervenantNom={
              pointageCreneau.intervenant_id !== null
                ? intervenantParId.get(pointageCreneau.intervenant_id)?.nom ?? "Non affecté"
                : "Non affecté"
            }
            busy={pointageBusy}
            error={pointageError}
            onDemarrer={() => void pointerArrivee()}
            onTerminer={() => void pointerDepart()}
            onRouvrir={() => void rouvrirPointageCreneau()}
            onPause={(minutes) => void changerPause(minutes)}
            onReinitialiser={() => void reinitialiserPointage()}
            onClose={() => setPointageCreneau(null)}
          />
        )}

        {pvCreneau && !pvLoading && (
          <PvRecetteModal
            creneau={pvCreneau}
            pv={pvCharge}
            clientNom={
              pvCharge?.client_nom ??
              (pvCreneau.chantier_id !== null
                ? chantiers.find((c) => c.id === pvCreneau.chantier_id)?.clientNom ?? null
                : null)
            }
            busy={pvBusy}
            error={pvError}
            infosImpression={{
              entreprise: profile?.entreprise ?? "Mon entreprise",
              intervenant:
                pvCreneau.intervenant_id !== null
                  ? intervenantParId.get(pvCreneau.intervenant_id)?.nom ?? "Non affecté"
                  : "Non affecté",
              creneauLibelle: pvCreneau.libelle,
              creneauDate: pvCreneau.date,
              ville: pvCreneau.ville,
              clientNom: pvCharge?.client_nom ?? null,
            }}
            onSave={(payload) => void enregistrerPv(payload)}
            onClose={() => {
              setPvCreneau(null);
              setPvCharge(null);
            }}
          />
        )}

        {/* Rappel discret en bas d'écran : les astuces de la page sont dans le panneau Aide. */}
        <RappelAstucePage />
      </div>
    </DataState>
  );
}