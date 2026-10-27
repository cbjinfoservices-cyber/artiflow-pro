import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { addDays, formatDayName, formatMonth, startOfWeek, toISODate } from "@/lib/dates";
import {
  cloturerSemaine,
  envoyerRecapClotureSemaine,
  estCreneauRecent,
  fetchCreneauxIntervenant,
  fetchIntervenantById,
  majCreneauIntervenant,
  type CreneauPerso,
  type StatutCreneau,
} from "@/lib/planningIntervenant";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { fetchIndisponibilitesIntervenant, resumeAbsencesDuJour, type Indisponibilite } from "@/lib/indisponibilites";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import BandeauChangements from "@/pages/app/mon-planning/components/BandeauChangements";
import RecapSemaine from "@/pages/app/mon-planning/components/RecapSemaine";
import CreneauPersoCard from "@/pages/app/mon-planning/components/CreneauPersoCard";
import DetailChantierModal from "@/pages/app/mon-planning/components/DetailChantierModal";
import CreneauPersoEditModal from "@/pages/app/mon-planning/components/CreneauPersoEditModal";
import ClotureSemaine from "@/pages/app/mon-planning/components/ClotureSemaine";
import AbsencesJourCard from "@/pages/app/planning/components/AbsencesJourCard";
import RecapHeures from "@/pages/app/mon-planning/components/RecapHeures";
import SoldeCongesCard from "@/pages/app/mon-planning/components/SoldeCongesCard";
import PointageModal from "@/pages/app/components/PointageModal";
import PvRecetteModal from "@/pages/app/components/PvRecetteModal";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import RappelAstucePage from "@/components/base/RappelAstucePage";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";
import {
  demarrerPointage,
  fetchPointages,
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

/**
 * Page « Mon planning ».
 * - Un compte intervenant y voit son propre planning (toute la semaine, avec ses statuts et notes).
 * - Un responsable y accède pour consulter le planning d'un intervenant précis (/app/mon-planning?intervenant=ID).
 * Un bandeau « changements récents » signale les interventions modifiées dans les dernières 48 h.
 */
export default function AppMonPlanning() {
  usePageMeta("Mon planning · ArtiFlow-pro", "Vos interventions de la semaine, à jour en temps réel.");
  const { user, isIntervenant, monIntervenant, intervenantLoading, isGestionnaire, profile } = useAuth();
  const [searchParams] = useSearchParams();

  // Cible : son propre planning (intervenant) ou celui d'un intervenant choisi par un responsable.
  const paramId = searchParams.get("intervenant");
  const parsedParam = paramId && Number.isFinite(Number(paramId)) ? Number(paramId) : null;
  const cibleId = isIntervenant ? monIntervenant?.id ?? null : parsedParam;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creneaux, setCreneaux] = useState<CreneauPerso[]>([]);
  // Congés et indisponibilités de la personne : affichés même les jours sans intervention.
  const [absences, setAbsences] = useState<Indisponibilite[]>([]);
  const [info, setInfo] = useState<Intervenant | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState<CreneauPerso | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [surligner, setSurligner] = useState(true);
  const [clotureBusy, setClotureBusy] = useState(false);
  const [clotureError, setClotureError] = useState<string | null>(null);
  const [clotureOk, setClotureOk] = useState<string | null>(null);

  // Pointage et PV de recette de la semaine chargée.
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [pvResumes, setPvResumes] = useState<Record<number, PvStatut>>({});
  const [pointageCreneau, setPointageCreneau] = useState<CreneauPerso | null>(null);
  const [pointageBusy, setPointageBusy] = useState(false);
  const [pointageError, setPointageError] = useState<string | null>(null);
  const [pvCreneau, setPvCreneau] = useState<CreneauPerso | null>(null);
  const [chantierCreneau, setChantierCreneau] = useState<CreneauPerso | null>(null);
  const [pvCharge, setPvCharge] = useState<PvRecette | null>(null);
  const [pvLoading, setPvLoading] = useState(false);
  const [pvBusy, setPvBusy] = useState(false);
  const [pvError, setPvError] = useState<string | null>(null);

  // Guide de première visite : deux versions selon l'usage réel de l'écran.
  // - un intervenant découvre son propre planning (pointage, PV de recette, clôture) ;
  // - un responsable consulte le planning d'un membre de son équipe (pointage et PV de l'équipe).
  // Chaque version garde sa propre mémoire : revoir l'une ne masque pas l'autre.
  // Le guide complète — sans le remplacer — le panneau Aide et ses astuces.
  const cleGuide = isIntervenant ? "mon-planning" : "mon-planning-tiers";
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    // On attend de savoir qui consulte l'écran : sans ça, un intervenant verrait
    // brièvement le guide du responsable pendant le chargement du profil.
    if (intervenantLoading) return;
    setGuideVisible(!guidePremiereVisiteVu(cleGuide));
  }, [cleGuide, intervenantLoading]);
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu(cleGuide);
    setGuideVisible(false);
  };

  // Le planning appartient au compte de l'entreprise : c'est lui qui porte les lignes
  // de pointage et de PV, même quand c'est l'intervenant qui les remplit.
  const proprietaireId = isIntervenant ? monIntervenant?.user_id ?? null : user?.id ?? null;

  const load = useCallback(async () => {
    if (cibleId === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [liste, fiche, points, pvs, absencesChargees] = await Promise.all([
        fetchCreneauxIntervenant(cibleId),
        fetchIntervenantById(cibleId),
        fetchPointages({ intervenantId: cibleId }).catch(() => [] as Pointage[]),
        fetchPvResumes(cibleId).catch((): Record<number, PvStatut> => Object.create(null)),
        fetchIndisponibilitesIntervenant(cibleId).catch(() => [] as Indisponibilite[]),
      ]);
      setCreneaux(liste);
      setInfo(fiche);
      setPointages(points);
      setPvResumes(pvs);
      setAbsences(absencesChargees);
    } catch {
      setError("Impossible de charger ce planning pour l'instant. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }, [cibleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  // Semaine complète, week-end compris : beaucoup d'artisans interviennent le samedi.
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const isoList = useMemo(() => days.map(toISODate), [days]);
  const selectedDate = isoList[selected];
  const labelSemaine = `${
    weekOffset === 0 ? "Cette semaine" : weekOffset < 0 ? `Semaine -${Math.abs(weekOffset)}` : `Semaine +${weekOffset}`
  } · ${formatMonth(weekStart)}`;

  const byDate = useMemo(() => {
    const map: Record<string, CreneauPerso[]> = {};
    creneaux.forEach((c) => {
      map[c.date] = [...(map[c.date] ?? []), c];
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.heure.localeCompare(b.heure)));
    return map;
  }, [creneaux]);

  const daySlots = byDate[selectedDate] ?? [];

  // Jour ouvert par défaut : aujourd'hui pour la semaine en cours, sinon le premier jour qui a
  // une intervention (à défaut, le lundi). Recalculé à chaque changement de semaine.
  const aujourdhuiIso = toISODate(new Date());
  useEffect(() => {
    if (loading) return;
    const indexAujourdhui = isoList.indexOf(aujourdhuiIso);
    if (indexAujourdhui >= 0) {
      setSelected(indexAujourdhui);
      return;
    }
    const premierOccupe = isoList.findIndex((iso) => (byDate[iso] ?? []).length > 0);
    setSelected(premierOccupe >= 0 ? premierOccupe : 0);
    // byDate est volontairement exclu : on ne veut pas déplacer la sélection quand un créneau change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, loading]);

  // Absences de la personne : celles du jour sélectionné, et le total de la semaine affichée.
  const absencesDuJour = useMemo(() => absences.filter((a) => a.date === selectedDate), [absences, selectedDate]);
  const isoSet = useMemo(() => new Set(isoList), [isoList]);
  const absencesSemaine = useMemo(() => absences.filter((a) => isoSet.has(a.date)), [absences, isoSet]);
  const absencesParJour = useMemo(() => {
    const map: Record<string, number> = {};
    absences.forEach((a) => {
      map[a.date] = (map[a.date] ?? 0) + 1;
    });
    return map;
  }, [absences]);

  // Interventions de la semaine affichée et celles encore ouvertes (pour la clôture).
  const semaineCreneaux = useMemo(() => creneaux.filter((c) => isoList.includes(c.date)), [creneaux, isoList]);
  const semaineRestantes = useMemo(() => semaineCreneaux.filter((c) => c.statut !== "faite"), [semaineCreneaux]);
  const recents = useMemo(
    () =>
      creneaux
        .filter((c) => estCreneauRecent(c))
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")),
    [creneaux],
  );

  const toggleFait = async (creneau: CreneauPerso) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      const statut: StatutCreneau = creneau.statut === "faite" ? "confirmee" : "faite";
      await majCreneauIntervenant(creneau.id, { statut }, user.id);
      await load();
    } catch {
      setActionError("La mise à jour a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const enregistrer = async (patch: {
    heure: string;
    libelle: string;
    statut: StatutCreneau;
    note: string | null;
  }) => {
    if (!user || !editing) return;
    setBusy(true);
    setActionError(null);
    try {
      await majCreneauIntervenant(editing.id, patch, user.id);
      setEditing(null);
      await load();
    } catch {
      setActionError("L'enregistrement a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const cloturerMaSemaine = async () => {
    if (!user || cibleId === null) return;
    setClotureBusy(true);
    setClotureError(null);
    setClotureOk(null);
    const ids = semaineRestantes.map((c) => c.id);
    const detail = semaineRestantes.map((c) => ({
      date: c.date,
      heure: c.heure,
      libelle: c.libelle,
      ville: c.ville,
    }));
    const pourSoi = isIntervenant;
    try {
      await cloturerSemaine(ids, user.id);
      await load();
      try {
        await envoyerRecapClotureSemaine({
          intervenantId: cibleId,
          origine: pourSoi ? "intervenant" : "responsable",
          semaineLabel: labelSemaine,
          totalSemaine: semaineCreneaux.length,
          faites: semaineCreneaux.length,
          cloturees: ids.length,
          interventions: detail,
        });
        setClotureOk(
          pourSoi
            ? `${ids.length} intervention${ids.length > 1 ? "s" : ""} clôturée${ids.length > 1 ? "s" : ""} · bilan envoyé au responsable.`
            : `${ids.length} intervention${ids.length > 1 ? "s" : ""} clôturée${ids.length > 1 ? "s" : ""} · bilan récapitulatif envoyé par email.`,
        );
      } catch {
        setClotureOk(
          `${ids.length} intervention${ids.length > 1 ? "s" : ""} clôturée${ids.length > 1 ? "s" : ""}, mais le bilan email n'a pas pu être envoyé.`,
        );
      }
    } catch {
      setClotureError("La clôture de la semaine a échoué. Réessayez.");
    } finally {
      setClotureBusy(false);
    }
  };

  /** Pointage enregistré pour cette intervention, ou null. */
  const pointageDe = (creneauId: number) => pointages.find((p) => p.creneau_id === creneauId) ?? null;

  const demarrer = async () => {
    if (!proprietaireId || !pointageCreneau) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await demarrerPointage({
        proprietaireId,
        creneauId: pointageCreneau.id,
        intervenantId: pointageCreneau.intervenant_id ?? cibleId,
        date: pointageCreneau.date,
      });
      await load();
    } catch {
      setPointageError("Le pointage n'a pas pu être démarré. Réessayez.");
    } finally {
      setPointageBusy(false);
    }
  };

  const terminer = async () => {
    const courant = pointageCreneau ? pointageDe(pointageCreneau.id) : null;
    if (!courant) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await terminerPointage(courant.id);
      await load();
    } catch {
      setPointageError("L'heure de départ n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setPointageBusy(false);
    }
  };

  const rouvrir = async () => {
    const courant = pointageCreneau ? pointageDe(pointageCreneau.id) : null;
    if (!courant) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await rouvrirPointage(courant.id);
      await load();
    } catch {
      setPointageError("Le pointage n'a pas pu être rouvert. Réessayez.");
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
      await load();
    } catch {
      setPointageError("La pause n'a pas pu être enregistrée.");
    } finally {
      setPointageBusy(false);
    }
  };

  const reinitialiser = async () => {
    const courant = pointageCreneau ? pointageDe(pointageCreneau.id) : null;
    if (!courant) return;
    setPointageBusy(true);
    setPointageError(null);
    try {
      await supprimerPointage(courant.id);
      await load();
    } catch {
      setPointageError("Le pointage n'a pas pu être supprimé.");
    } finally {
      setPointageBusy(false);
    }
  };

  const ouvrirPv = async (creneau: CreneauPerso) => {
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
    if (!proprietaireId || !pvCreneau) return;
    setPvBusy(true);
    setPvError(null);
    try {
      await enregistrerPvRecette({ proprietaireId, creneau: pvCreneau, payload });
      setPvCreneau(null);
      setPvCharge(null);
      await load();
    } catch {
      setPvError("L'enregistrement du PV a échoué. Réessayez.");
    } finally {
      setPvBusy(false);
    }
  };

  // Le gérant du back-office n'a pas accès à cette page métier.  if (isGestionnaire) return <Navigate to="/app/back-office" replace />;
  if (!intervenantLoading && !isIntervenant && cibleId === null) {
    return <Navigate to="/app/planning" replace />;
  }
  if (intervenantLoading || cibleId === null) {
    return (
      <DataState loading error={null} onRetry={load}>
        <></>
      </DataState>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={load}>
      <div className="flex flex-col gap-5 animate-fade-in">
        {/* En-tête : qui + navigation de semaine */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!isIntervenant && (
              <Link
                to={`/app/planning?vue=equipe&intervenant=${cibleId}`}
                title="Revenir à sa colonne dans la vue Équipe"
                className="w-10 h-10 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer"
              >
                <i className="ri-arrow-left-line text-foreground-700"></i>
              </Link>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {info && (
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: couleurIntervenant(info.couleur) }}
                  />
                )}
                <h2 className="font-heading font-bold text-lg text-foreground-950 truncate">
                  {isIntervenant ? "Mon planning" : `Planning de ${info?.nom ?? "l'intervenant"}`}
                </h2>
              </div>
              <p className="text-xs text-foreground-500 truncate">
                {isIntervenant
                  ? info?.metier || "Vos interventions de la semaine"
                  : "Vue du responsable · lecture et ajustements"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isIntervenant && (
              <Link
                to={`/app/planning?vue=equipe&intervenant=${cibleId}`}
                title="Revenir à sa colonne dans la vue Équipe"
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-layout-column-line"></i>
                <span className="hidden sm:inline">Sa colonne (vue Équipe)</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="w-10 h-10 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-foreground-700"></i>
            </button>
            <span className="min-w-[150px] text-center font-heading font-semibold text-sm text-foreground-950">
              {labelSemaine}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer"
            >
              <i className="ri-arrow-right-s-line text-foreground-700"></i>
            </button>
          </div>
        </div>

        <BandeauChangements
          recents={recents}
          surligner={surligner}
          onToggleSurligner={() => setSurligner((v) => !v)}
        />

        {guideVisible && isIntervenant && (
          <GuidePremiereVisite
            titre="Bienvenue : votre semaine, et trois gestes utiles"
            sousTitre="Voici comment se déroule une intervention, du pointage au PV signé, jusqu'à la clôture de votre semaine."
            etapes={[
              {
                icone: "ri-calendar-check-line",
                titre: "Repérez votre journée",
                texte:
                  "Choisissez un jour en haut de l'écran : vos interventions, l'adresse et les consignes du responsable s'affichent dessous.",
              },
              {
                icone: "ri-play-circle-line",
                titre: "Pointez arrivée et départ",
                texte:
                  "Le bouton « Pointer » de l'intervention enregistre vos heures réelles. La pause saisie est retirée de la durée.",
              },
              {
                icone: "ri-file-paper-2-line",
                titre: "Remplissez le PV de recette",
                texte:
                  "Photos, points de conformité et signature du client se font sur place : le chantier est clôturé proprement, sans papier.",
              },
              {
                icone: "ri-check-double-line",
                titre: "Clôturez la semaine",
                texte:
                  "Quand tout est fait, « Clôturer ma semaine » envoie un bilan récapitulatif au responsable, avec vos interventions.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Les astuces détaillées de cet écran restent disponibles dans le bouton Aide, en haut à droite."
            onFermer={fermerGuide}
          />
        )}

        {/* Version responsable : le même écran, mais on y suit le travail d'une personne de son équipe. */}
        {guideVisible && !isIntervenant && (
          <GuidePremiereVisite
            titre="Bienvenue : le planning d'un membre de votre équipe"
            sousTitre="Cet écran reprend la semaine d'une personne : ses interventions, ses pointages et ses PV de recette. Vous y contrôlez le travail réellement fait, sans passer par un autre outil."
            etapes={[
              {
                icone: "ri-user-location-line",
                titre: "Vérifiez de qui et de quelle semaine il s'agit",
                texte:
                  "Le nom est en haut de l'écran et les flèches changent de semaine. Pour revenir à la vue d'ensemble, utilisez « Sa colonne (vue Équipe) ».",
              },
              {
                icone: "ri-play-circle-line",
                titre: "Contrôlez les pointages",
                texte:
                  "Ouvrez une intervention pour voir l'heure d'arrivée, de départ et la pause. Les heures nettes du haut se recalculent à partir de ces pointages, pas du planning prévu.",
              },
              {
                icone: "ri-file-paper-2-line",
                titre: "Lisez le PV de recette",
                texte:
                  "Photos, points de conformité et signature du client sont attachés à l'intervention : vous pouvez l'ouvrir pour vérifier, ou le compléter avec la personne.",
              },
              {
                icone: "ri-check-double-line",
                titre: "Clôturez sa semaine si tout est fait",
                texte:
                  "Le bouton de clôture termine les interventions encore ouvertes de la semaine affichée et envoie un bilan récapitulatif par email. À n'utiliser que lorsque le terrain est réellement terminé.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois pour un compte responsable. Les astuces détaillées restent disponibles dans le bouton Aide, en haut à droite."
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
            Revoir le guide de cet écran
          </button>
        )}

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        {/* Solde annuel de congés : visible en permanence, même sans intervention posée. */}
        {info && <SoldeCongesCard indisponibilites={absences} intervenant={info} />}

        {creneaux.length === 0 && absences.length === 0 ? (
          <EmptyState
            icon="ri-calendar-2-line"
            title="Aucune intervention planifiée"
            text="Vos interventions apparaîtront ici dès que le responsable les aura affectées à votre planning."
          />
        ) : (
          <>
            <RecapSemaine creneaux={creneaux} isoList={isoList} labelSemaine={labelSemaine} />

            <RecapHeures pointages={pointages} jours={days} isoList={isoList} labelSemaine={labelSemaine} />

            <ClotureSemaine
              nbTotal={semaineCreneaux.length}
              nbRestantes={semaineRestantes.length}
              busy={clotureBusy}
              error={clotureError}
              okMessage={clotureOk}
              onConfirmer={cloturerMaSemaine}
              mode={isIntervenant ? "soi" : "tiers"}
            />

            {/* Rappel des absences de la semaine : visible même quand il n'y a aucune intervention. */}
            {absencesSemaine.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-accent-100/70 border border-accent-200 px-3.5 py-2.5">
                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                  <i className="ri-suitcase-line text-[13px]"></i>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground-950">
                    {absencesSemaine.length} jour{absencesSemaine.length > 1 ? "s" : ""} d'absence cette semaine
                  </p>
                  <p className="text-[11px] text-foreground-600">
                    {Array.from(new Set(absencesSemaine.map((a) => a.motif))).join(" · ")}
                    {absencesSemaine[0]?.note ? ` — ${absencesSemaine[0].note}` : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Sélecteur de jours */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 md:gap-3">
              {days.map((day, i) => (
                <button
                  key={isoList[i]}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`flex flex-col items-center gap-1.5 sm:gap-2 py-2 px-0.5 sm:p-2 md:p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected === i
                      ? "bg-primary-500 border-primary-500 text-background-50"
                      : "bg-background-100 border-background-200 text-foreground-700 hover:border-primary-300"
                  }`}
                >
                  <span className="text-[11px] md:text-xs font-medium">
                    {isoList[i] === aujourdhuiIso ? "Auj." : formatDayName(day).slice(0, 3)}
                  </span>
                  <span
                    className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-sm font-bold ${
                      selected === i ? "bg-background-50/20" : "bg-background-200"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <span className={`text-[10px] font-medium ${selected === i ? "text-background-50/80" : "text-foreground-400"}`}>
                    {(byDate[isoList[i]] ?? []).length}<span className="hidden sm:inline"> rdv</span>
                  </span>
                  {(absencesParJour[isoList[i]] ?? 0) > 0 && (
                    <span
                      title={`${absencesParJour[isoList[i]]} absence ce jour`}
                      className={`inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                        selected === i ? "bg-background-50/25 text-background-50" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      <i className="ri-suitcase-line"></i>
                      <span className="hidden sm:inline">{absencesParJour[isoList[i]]} abs.</span>
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Détail du jour sélectionné */}
            <div className="p-5 rounded-lg bg-background-100 border border-background-200">
              <h3 className="font-heading font-semibold text-base text-foreground-950 mb-4">
                {formatDayName(days[selected])} {days[selected].getDate()} {formatMonth(days[selected])}
              </h3>

              {/* Congés du jour : affichés en tête, même sans aucune intervention. */}
              <div className="mb-4">
                <AbsencesJourCard
                  absences={absencesDuJour}
                  intervenants={info ? [info] : []}
                  titre="Absence sur votre planning"
                />
              </div>

              {daySlots.length === 0 ? (
                <p className="text-sm text-foreground-500">
                  {absencesDuJour.length > 0
                    ? "Aucune intervention ce jour-là : vous êtes en absence."
                    : "Aucune intervention prévue ce jour-là."}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {daySlots.map((slot) => (
                    <CreneauPersoCard
                      key={slot.id}
                      creneau={slot}
                      recent={surligner && estCreneauRecent(slot)}
                      busy={busy}
                      pointage={pointageDe(slot.id)}
                      pvStatut={pvResumes[slot.id] ?? null}
                      absence={resumeAbsencesDuJour(absences, slot.intervenant_id, slot.date)}
                      onToggleFait={toggleFait}
                      onEdit={setEditing}
                      onPointer={(c) => {
                        setPointageError(null);
                        setPointageCreneau(c);
                      }}
                      onPv={(c) => void ouvrirPv(c)}
                      onChantier={setChantierCreneau}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {editing && (
          <CreneauPersoEditModal
            creneau={editing}
            busy={busy}
            onClose={() => setEditing(null)}
            onSubmit={enregistrer}
          />
        )}

        {pointageCreneau && (
          <PointageModal
            creneau={pointageCreneau}
            pointage={pointageDe(pointageCreneau.id)}
            intervenantNom={info?.nom ?? monIntervenant?.nom ?? "Intervenant"}
            busy={pointageBusy}
            error={pointageError}
            onDemarrer={() => void demarrer()}
            onTerminer={() => void terminer()}
            onRouvrir={() => void rouvrir()}
            onPause={(minutes) => void changerPause(minutes)}
            onReinitialiser={() => void reinitialiser()}
            onClose={() => setPointageCreneau(null)}
          />
        )}

        {chantierCreneau && (
          <DetailChantierModal creneau={chantierCreneau} onClose={() => setChantierCreneau(null)} />
        )}
        {pvCreneau && !pvLoading && (
          <PvRecetteModal
            creneau={pvCreneau}
            pv={pvCharge}
            clientNom={pvCharge?.client_nom ?? null}
            busy={pvBusy}
            error={pvError}
            infosImpression={{
              entreprise: profile?.entreprise ?? "Mon entreprise",
              intervenant: info?.nom ?? monIntervenant?.nom ?? "Intervenant",
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

        {/* Rappel discret en bas d'écran : les astuces de cet écran sont dans le panneau Aide. */}
        <RappelAstucePage />
      </div>
    </DataState>
  );
}