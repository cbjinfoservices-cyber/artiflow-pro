import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CreneauItem } from "@/hooks/useArtisanData";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { normaliseStatutCreneau, statutCreneauMeta } from "@/lib/planningIntervenant";
import { formatDayName, startOfWeek, toISODate } from "@/lib/dates";
import {
  iconeMotif,
  poidsPeriode,
  resumeAbsencesDuJour,
  suffixePeriode,
  type AbsenceJourResume,
  type Indisponibilite,
} from "@/lib/indisponibilites";
import BadgeAbsenceIntervention from "@/components/feature/BadgeAbsenceIntervention";
import { usePersistedState } from "@/hooks/usePersistedState";
import { cleArtiflow, type Validateur } from "@/lib/stockageLocal";

/**
 * Clé de mémorisation des semaines dépliées de la grille mensuelle : les accordéons ouverts
 * sont retrouvés tels quels à la prochaine visite, sans avoir à recliquer chaque semaine.
 */
const CLE_SEMAINES_DEPLIEES = cleArtiflow("planning", "semainesDepliees");

/** Ne conserve que les clés dont la valeur est un vrai booléen (une donnée corrompue est ignorée). */
const validerSemainesDepliees: Validateur<Record<string, boolean>> = (brut) => {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const sortie: Record<string, boolean> = {};
  Object.entries(brut as Record<string, unknown>).forEach(([cle, valeur]) => {
    if (typeof valeur === "boolean") sortie[cle] = valeur;
  });
  return sortie;
};

interface Colonne {
  /** Identifiant de l'intervenant, ou null pour la colonne « non affecté ». */
  id: number | null;
  nom: string;
  metier: string | null;
  hex: string;
}

/** Un bloc de jours regroupés en semaine (utilisé par les accordéons de la vue mensuelle). */
interface GroupeSemaine {
  cle: string;
  debut: string;
  fin: string;
  days: Date[];
  isoList: string[];
}

/** Formate une date ISO en « 5 oct. », pour les en-têtes de semaine des accordéons. */
function formatJourCourt(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Vue semaine « équipe » : une colonne par intervenant (plus une colonne « non affecté »),
 * une ligne par jour. Chaque case rassemble les interventions de la personne ce jour-là,
 * pour voir d'un coup d'œil qui fait quoi toute la semaine.
 *
 * En haut de chaque colonne, un indicateur de charge affiche le nombre d'interventions de la
 * semaine pour la personne : pratique pour repérer d'un regard qui est surchargé ou disponible.
 * Chaque intervention porte aussi un petit sélecteur qui permet de la réaffecter à quelqu'un
 * d'autre (ou de la désaffecter) en un clic, sans quitter la vue Équipe.
 *
 * Un mode « réaffectation en lot » permet enfin de cocher plusieurs interventions (dans une
 * ou plusieurs colonnes) et de les déplacer d'un seul geste vers une autre personne.
 *
 * Un filtre « Disponibles » masque enfin les personnes ayant déjà des interventions, pour
 * repérer d'un coup d'œil qui n'a encore rien cette semaine (qui est donc libre).
 */
export default function PlanningEquipeGrid({
  days,
  isoList,
  intervenants,
  intervenantsChoix,
  creneaux,
  creneauxSemaine,
  onAddFor,
  onDelete,
  onReassign,
  onReassignMany,
  onMove,
  onEdit,
  inclureNonAffecte = true,
  aConfirmerParJour = {},
  periodeLabel = "cette semaine",
  indisponibilites = [],
  accordionsSemaines = false,
  onProposerRemplacant,
  onReaffecterLotIntervenant,
}: {
  days: Date[];
  isoList: string[];
  intervenants: Intervenant[];
  /** Toutes les personnes actives proposées au moment de réaffecter une intervention. */
  intervenantsChoix: Intervenant[];
  creneaux: CreneauItem[];
  /**
   * Toutes les interventions de la semaine (indépendamment du filtre de statut). Sert au
   * calcul de la charge et à la détection des personnes sans aucune intervention.
   */
  creneauxSemaine?: CreneauItem[];
  onAddFor: (intervenantId: number | null, dateISO: string) => void;
  onDelete: (id: number) => void;
  onReassign: (creneauId: number, intervenantId: number | null) => void;
  /** Réaffecte plusieurs créneaux d'un coup à une même personne (ou les désaffecte). */
  onReassignMany: (creneauIds: number[], intervenantId: number | null) => void;
  /** Déplace une intervention vers un autre jour / une autre personne (glisser-déposer). */
  onMove: (creneauId: number, dateISO: string, intervenantId: number | null) => void;
  /** Ouvre l'édition rapide d'une intervention (bouton crayon). */
  onEdit: (creneau: CreneauItem) => void;
  /** Afficher la colonne « non affecté » (masquée quand on filtre sur une personne précise). */
  inclureNonAffecte?: boolean;
  /** Nombre d'interventions « à confirmer » par jour (clé = date ISO), pour la pastille d'en-tête. */
  aConfirmerParJour?: Record<string, number>;
  /** Période couverte, reprise dans les libellés (« cette semaine », « ce mois »…). */
  periodeLabel?: string;
  /** Congés et indisponibilités à signaler dans les cases (une ligne par jour). */
  indisponibilites?: Indisponibilite[];
  /**
   * Vue mensuelle : regroupe les jours par semaine dans des accordéons repliables,
   * pour éviter de faire défiler trente lignes de jours d'affilée.
   */
  accordionsSemaines?: boolean;
  /** Ouvre la fenêtre « proposer un remplaçant » depuis le badge de congé d'une intervention. */
  onProposerRemplacant?: (creneau: CreneauItem, absence: AbsenceJourResume, nom: string | null) => void;
  /**
   * Ouvre la réaffectation en lot de toutes les interventions d'une personne absente sur une
   * journée, directement depuis le badge de congé (sans passer par le filtre).
   */
  onReaffecterLotIntervenant?: (creneau: CreneauItem) => void;
}) {
  // Mode sélection multiple : cocher des interventions pour les déplacer en une fois.
  const [modeLot, setModeLot] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);
  const [cibleLot, setCibleLot] = useState<string>("");
  const [lotBusy, setLotBusy] = useState(false);
  // Filtrer sur les personnes sans aucune intervention de la semaine (qui sont disponibles).
  const [sansIntervention, setSansIntervention] = useState(false);
  // Glisser-déposer : intervention en cours de déplacement + case survolée.
  const [enDeplacement, setEnDeplacement] = useState<number | null>(null);
  const [caseSurvolee, setCaseSurvolee] = useState<string | null>(null);

  const colonnes: Colonne[] = [
    ...intervenants.map((i) => ({ id: i.id, nom: i.nom, metier: i.metier, hex: couleurIntervenant(i.couleur) })),
  ];
  if (inclureNonAffecte) {
    colonnes.push({ id: null, nom: "Non affecté", metier: null, hex: "#a8a29e" });
  }

  // Regroupe les créneaux par couple (intervenant, date) pour remplir les cases.
  const parCase = useMemo(() => {
    const map = new Map<string, CreneauItem[]>();
    creneaux.forEach((c) => {
      const key = `${c.intervenant_id ?? "none"}|${c.date}`;
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    map.forEach((list) => list.sort((a, b) => a.heure.localeCompare(b.heure)));
    return map;
  }, [creneaux]);

  const joursSemaine = useMemo(() => new Set(isoList), [isoList]);

  // Nombre total d'interventions par couple (intervenant, jour) : sert à n'afficher l'action
  // « réaffecter en lot » du badge que lorsque la personne cumule vraiment plusieurs missions.
  const nbParCase = useMemo(() => {
    const source = creneauxSemaine ?? creneaux;
    const map = new Map<string, number>();
    source.forEach((c) => {
      const cle = `${c.intervenant_id ?? "none"}|${c.date}`;
      map.set(cle, (map.get(cle) ?? 0) + 1);
    });
    return map;
  }, [creneauxSemaine, creneaux]);

  // Absences par couple (intervenant, jour), affichées en tête de case avec la couleur du motif.
  const absencesParCase = useMemo(() => {
    const map = new Map<string, Indisponibilite[]>();
    indisponibilites.forEach((i) => {
      const cle = `${i.intervenant_id ?? "none"}|${i.date}`;
      map.set(cle, [...(map.get(cle) ?? []), i]);
    });
    return map;
  }, [indisponibilites]);

  // Jours d'absence par intervenant sur la période affichée (une demi-journée compte 0,5).
  const absencesParIntervenant = useMemo(() => {
    const map = new Map<string, number>();
    indisponibilites
      .filter((i) => joursSemaine.has(i.date))
      .forEach((i) => {
        const cle = String(i.intervenant_id ?? "none");
        map.set(cle, Math.round(((map.get(cle) ?? 0) + poidsPeriode(i.periode)) * 10) / 10);
      });
    return map;
  }, [indisponibilites, joursSemaine]);

  // Absence résumée par couple (intervenant, jour) : sert au badge « congé à venir » posé
  // directement sur les interventions concernées.
  const absenceResumeeParCase = useMemo(() => {
    const map = new Map<string, AbsenceJourResume>();
    absencesParCase.forEach((liste, cle) => {
      const premiere = liste[0];
      const resume = resumeAbsencesDuJour(liste, premiere.intervenant_id, premiere.date);
      if (resume) map.set(cle, resume);
    });
    return map;
  }, [absencesParCase]);

  // Charge de la semaine par intervenant, pour l'indicateur en haut de colonne et le filtre
  // « Disponibles ». On se base sur toutes les interventions de la semaine (sans filtre de statut).
  const charge = useMemo(() => {
    const source = creneauxSemaine ?? creneaux;
    const map = new Map<string, number>();
    source
      .filter((c) => joursSemaine.has(c.date))
      .forEach((c) => {
        const cle = String(c.intervenant_id ?? "none");
        map.set(cle, (map.get(cle) ?? 0) + 1);
      });
    return map;
  }, [creneauxSemaine, creneaux, joursSemaine]);

  // Nombre de personnes actives sans aucune intervention cette semaine.
  const nbDisponibles = useMemo(
    () => intervenants.filter((i) => (charge.get(String(i.id)) ?? 0) === 0).length,
    [intervenants, charge],
  );

  // Colonnes réellement affichées : toutes, ou seulement les personnes disponibles quand le
  // filtre est actif (la colonne « non affecté » n'est pas une personne, donc masquée).
  const colonnesAffichees = useMemo(
    () =>
      sansIntervention
        ? colonnes.filter((c) => c.id !== null && (charge.get(String(c.id)) ?? 0) === 0)
        : colonnes,
    [sansIntervention, colonnes, charge],
  );

  const selectionSet = useMemo(() => new Set(selection), [selection]);

  // Regroupement des jours par semaine : un accordéon par semaine en vue mensuelle,
  // un seul bloc (sans en-tête) en vue hebdomadaire.
  const groupes = useMemo<GroupeSemaine[]>(() => {
    if (!accordionsSemaines) {
      return [
        {
          cle: "periode",
          debut: isoList[0] ?? "",
          fin: isoList[isoList.length - 1] ?? "",
          days,
          isoList,
        },
      ];
    }
    const map = new Map<string, GroupeSemaine>();
    days.forEach((day, i) => {
      const iso = isoList[i];
      const cle = toISODate(startOfWeek(day));
      const existant = map.get(cle);
      if (existant) {
        existant.fin = iso;
        existant.days.push(day);
        existant.isoList.push(iso);
      } else {
        map.set(cle, { cle, debut: iso, fin: iso, days: [day], isoList: [iso] });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.cle.localeCompare(b.cle));
  }, [accordionsSemaines, days, isoList]);

  const aujourdHuiIso = toISODate(new Date());
  const cleSemaineCourante =
    groupes.find((g) => aujourdHuiIso >= g.debut && aujourdHuiIso <= g.fin)?.cle ?? groupes[0]?.cle ?? "";
  // Seules les semaines explicitement basculées changent d'état : par défaut, la semaine en
  // cours (ou la première) est ouverte et les autres sont repliées. Les bascules sont
  // mémorisées localement pour être retrouvées à la prochaine visite.
  const [basculeSemaines, setBasculeSemaines] = usePersistedState<Record<string, boolean>>(
    CLE_SEMAINES_DEPLIEES,
    validerSemainesDepliees,
  );
  const semaineOuverte = (cle: string) => basculeSemaines[cle] ?? cle === cleSemaineCourante;
  const basculerSemaine = (cle: string) =>
    setBasculeSemaines({ ...basculeSemaines, [cle]: !semaineOuverte(cle) });
  const toutDeplier = () =>
    setBasculeSemaines({ ...basculeSemaines, ...Object.fromEntries(groupes.map((g) => [g.cle, true])) });
  const toutReplier = () =>
    setBasculeSemaines({ ...basculeSemaines, ...Object.fromEntries(groupes.map((g) => [g.cle, false])) });

  const compterSemaine = (groupe: GroupeSemaine) => {
    const set = new Set(groupe.isoList);
    return {
      interventions: creneaux.filter((c) => set.has(c.date)).length,
      absences: indisponibilites.filter((i) => set.has(i.date)).length,
    };
  };

  const rendreEnteteSemaine = (groupe: GroupeSemaine) => {
    const comptes = compterSemaine(groupe);
    const ouvert = semaineOuverte(groupe.cle);
    const estCourante = aujourdHuiIso >= groupe.debut && aujourdHuiIso <= groupe.fin;
    return (
      <button
        key={`semaine-${groupe.cle}`}
        type="button"
        onClick={() => basculerSemaine(groupe.cle)}
        aria-expanded={ouvert}
        style={{ gridColumn: "1 / -1" }}
        className="flex items-center gap-2 h-10 px-3 rounded-md bg-background-100 border border-background-200 text-left cursor-pointer hover:border-primary-300 transition-colors"
      >
        <i className={`${ouvert ? "ri-subtract-line" : "ri-add-line"} text-foreground-500 shrink-0`}></i>
        <span className="text-xs font-bold text-foreground-900 whitespace-nowrap">
          Semaine du {formatJourCourt(groupe.debut)} au {formatJourCourt(groupe.fin)}
        </span>
        {estCourante && (
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold whitespace-nowrap">
            en cours
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap">
            <i className="ri-route-line"></i> {comptes.interventions} intervention{comptes.interventions > 1 ? "s" : ""}
          </span>
          {comptes.absences > 0 && (
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap">
              <i className="ri-suitcase-line"></i> {comptes.absences} abs.
            </span>
          )}
          <i className={`${ouvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} text-foreground-400`}></i>
        </span>
      </button>
    );
  };

  const basculerSelection = (id: number) => {
    setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toutSelectionner = () => setSelection(creneaux.map((c) => c.id));
  const viderSelection = () => setSelection([]);
  const quitterModeLot = () => {
    setModeLot(false);
    setSelection([]);
    setCibleLot("");
  };

  const appliquerLot = () => {
    if (selection.length === 0 || cibleLot === "") return;
    const cible = cibleLot === "none" ? null : Number(cibleLot);
    setLotBusy(true);
    onReassignMany(selection, cible);
    // On referme le mode après l'action : le planning se recharge côté page.
    setLotBusy(false);
    quitterModeLot();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Barre d'outils : filtre « Disponibles » + mode « réaffectation en lot » */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <button
          type="button"
          onClick={() => setSansIntervention((v) => !v)}
          aria-pressed={sansIntervention}
          title={`N'afficher que les personnes sans aucune intervention ${periodeLabel} (donc disponibles)`}
          className={`self-start inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            sansIntervention
              ? "bg-accent-500 text-background-50 hover:bg-accent-600"
              : "bg-background-100 border border-background-200 text-foreground-700 hover:bg-background-200"
          }`}
        >
          <i className={sansIntervention ? "ri-user-follow-line" : "ri-user-search-line"}></i>
          Disponibles (sans intervention)
          <span
            className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${
              sansIntervention ? "bg-background-50/25" : "bg-background-200 text-foreground-500"
            }`}
          >
            {nbDisponibles}
          </span>
        </button>

        {accordionsSemaines && groupes.length > 1 && (
          <div className="flex items-center gap-1.5 self-start">
            <span
              className="text-[11px] text-foreground-500 whitespace-nowrap"
              title="Les semaines que vous dépliez sont mémorisées pour votre prochaine visite"
            >
              {groupes.length} semaines
            </span>
            <button
              type="button"
              onClick={toutDeplier}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-expand-vertical-line"></i> Tout déplier
            </button>
            <button
              type="button"
              onClick={toutReplier}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-collapse-vertical-line"></i> Tout replier
            </button>
          </div>
        )}

        {creneaux.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {!modeLot ? (
              <button
                type="button"
                onClick={() => setModeLot(true)}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-checkbox-multiple-line"></i>
                Réaffecter en lot
              </button>
            ) : (
              <>
                <span className="text-xs font-semibold text-foreground-700 inline-flex items-center gap-1.5">
                  <i className="ri-checkbox-multiple-line text-secondary-600"></i>
                  {selection.length} intervention{selection.length > 1 ? "s" : ""} sélectionnée{selection.length > 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={selection.length === creneaux.length ? viderSelection : toutSelectionner}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                >
                  <i className={selection.length === creneaux.length ? "ri-close-line" : "ri-check-double-line"}></i>
                  {selection.length === creneaux.length ? "Aucune" : "Tout sélectionner"}
                </button>
                <div className="relative flex items-center gap-1.5 h-9 px-2 rounded-md bg-background-50 border border-background-200">
                  <i className="ri-shuffle-line text-sm text-secondary-600"></i>
                  <select
                    value={cibleLot}
                    onChange={(e) => setCibleLot(e.target.value)}
                    aria-label="Déplacer les interventions vers"
                    className="h-9 bg-transparent text-xs text-foreground-700 outline-none cursor-pointer pr-1"
                  >
                    <option value="">Déplacer vers…</option>
                    <option value="none">Non affecté</option>
                    {intervenantsChoix.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={appliquerLot}
                  disabled={selection.length === 0 || cibleLot === "" || lotBusy}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className={lotBusy ? "ri-loader-4-line animate-spin" : "ri-arrow-right-line"}></i>
                  Déplacer
                </button>
                <button
                  type="button"
                  onClick={quitterModeLot}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-foreground-500 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                >
                  <i className="ri-close-line"></i>
                  Annuler
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!modeLot && creneaux.length > 0 && (
        <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-drag-move-2-line"></i>
          Glissez une intervention vers un autre jour ou une autre personne pour la déplacer. Le crayon ouvre
          l'édition rapide (heure, statut, lieu).
        </p>
      )}

      {sansIntervention && colonnesAffichees.length === 0 ? (
        <div className="flex flex-col items-center text-center px-6 py-10 rounded-lg bg-background-100 border border-background-200">
          <span className="w-12 h-12 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-xl">
            <i className="ri-user-follow-line"></i>
          </span>
          <p className="mt-3 text-sm text-foreground-600 max-w-sm">
            Sur cette période, tout le monde a déjà au moins une intervention. Désactivez le filtre « Disponibles »
            pour revoir toutes les personnes.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <div
            className="grid gap-2 min-w-[680px]"
            style={{ gridTemplateColumns: `112px repeat(${colonnesAffichees.length}, minmax(190px, 1fr))` }}
          >
            {/* En-tête : nom des intervenants + charge de la semaine */}
            <div />
            {colonnesAffichees.map((col) => {
              const nb = charge.get(String(col.id ?? "none")) ?? 0;
              return (
                <div key={col.id ?? "none"} className="flex flex-col gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: col.hex }} />
                    <span className="text-sm font-semibold text-foreground-900 truncate">{col.nom}</span>
                  </div>
                  {col.metier && <span className="text-[11px] text-foreground-500 truncate">{col.metier}</span>}
                  <span
                    className={`inline-flex items-center gap-1.5 self-start h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                      nb === 0
                        ? "bg-background-200/70 text-foreground-400"
                        : nb >= 5
                          ? "bg-accent-100 text-accent-700"
                          : "bg-secondary-100 text-secondary-800"
                    }`}
                    title={nb === 0 ? `Aucune intervention ${periodeLabel}` : `${nb} intervention${nb > 1 ? "s" : ""} ${periodeLabel}`}
                  >
                    <i className={nb === 0 ? "ri-moon-line" : "ri-route-line"}></i>
                    {nb} intervention{nb > 1 ? "s" : ""}
                  </span>
                  {(absencesParIntervenant.get(String(col.id ?? "none")) ?? 0) > 0 && (
                    <span
                      className="inline-flex items-center gap-1.5 self-start h-6 px-2.5 rounded-full bg-accent-100 text-accent-900 text-[11px] font-semibold whitespace-nowrap"
                      title={`${absencesParIntervenant.get(String(col.id ?? "none"))} jour(s) d'absence ${periodeLabel}`}
                    >
                      <i className="ri-suitcase-line"></i>
                      {(absencesParIntervenant.get(String(col.id ?? "none")) ?? 0).toLocaleString("fr-FR", {
                        maximumFractionDigits: 1,
                      })}{" "}j d'absence
                    </span>
                  )}
                  {col.id !== null && (
                    <Link
                      to={`/app/mon-planning?intervenant=${col.id}`}
                      title={`Ouvrir le planning individuel de ${col.nom}`}
                      className="inline-flex items-center justify-center gap-1.5 h-7 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-medium whitespace-nowrap hover:border-primary-300 hover:text-primary-600 cursor-pointer transition-colors"
                    >
                      <i className="ri-calendar-event-line"></i> Voir son planning
                    </Link>
                  )}
                </div>
              );
            })}

            {/* Une ligne par jour — regroupée en accordéon par semaine en vue mensuelle */}
            {groupes.map((groupe) => (
              <Fragment key={groupe.cle}>
                {accordionsSemaines && rendreEnteteSemaine(groupe)}
                {(!accordionsSemaines || semaineOuverte(groupe.cle)) &&
                  groupe.isoList.map((iso, i) => {
                    const day = groupe.days[i];
                    return (
                      <Fragment key={iso}>
                  <div className="flex flex-col justify-center gap-1 pr-1">
                    <span className="text-xs font-semibold text-foreground-700 capitalize">{formatDayName(day).slice(0, 3)}</span>
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-background-200 text-sm font-bold text-foreground-800">
                      {day.getDate()}
                    </span>
                    {(aConfirmerParJour[iso] ?? 0) > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 self-start h-5 min-w-[20px] px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap"
                        title={`${aConfirmerParJour[iso]} intervention${(aConfirmerParJour[iso] ?? 0) > 1 ? "s" : ""} à confirmer ce jour`}
                      >
                        <i className="ri-question-line"></i>
                        {aConfirmerParJour[iso]}
                      </span>
                    )}
                  </div>

                  {colonnesAffichees.map((col) => {
                    const slots = parCase.get(`${col.id ?? "none"}|${iso}`) ?? [];
                    const cleCase = `${iso}-${col.id ?? "none"}`;
                    const cibleSurvolee = caseSurvolee === cleCase && enDeplacement !== null;
                    return (
                      <div
                        key={cleCase}
                        onDragOver={(e) => {
                          if (modeLot) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setCaseSurvolee(cleCase);
                        }}
                        onDragLeave={() => setCaseSurvolee((v) => (v === cleCase ? null : v))}
                        onDrop={(e) => {
                          if (modeLot) return;
                          e.preventDefault();
                          const brut = e.dataTransfer.getData("text/plain");
                          const id = Number(brut || enDeplacement);
                          setCaseSurvolee(null);
                          setEnDeplacement(null);
                          if (Number.isFinite(id) && id > 0) onMove(id, iso, col.id);
                        }}
                        className={`group flex flex-col gap-1.5 p-2 rounded-lg bg-background-50 border min-h-[64px] transition-colors ${
                          cibleSurvolee
                            ? "border-primary-400 ring-2 ring-primary-200 bg-primary-50"
                            : "border-background-200"
                        }`}
                      >
                        {(absencesParCase.get(`${col.id ?? "none"}|${iso}`) ?? []).map((abs) => (
                          <span
                            key={abs.id}
                            title={abs.note ?? `${abs.motif}${suffixePeriode(abs.periode)} — ne pas affecter cette personne`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-100 border border-accent-200 text-[10px] font-bold text-accent-900 truncate"
                          >
                            <i className={`${iconeMotif(abs.motif)} text-[10px] shrink-0`}></i>
                            <span className="truncate">{abs.motif}{suffixePeriode(abs.periode)}</span>
                          </span>
                        ))}
                        {slots.map((slot) => {
                          const selectionne = selectionSet.has(slot.id);
                          const absenceSlot =
                            absenceResumeeParCase.get(`${slot.intervenant_id ?? "none"}|${slot.date}`) ?? null;
                          return (
                            <div
                              key={slot.id}
                              onClick={modeLot ? () => basculerSelection(slot.id) : undefined}
                              draggable={!modeLot}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", String(slot.id));
                                e.dataTransfer.effectAllowed = "move";
                                setEnDeplacement(slot.id);
                              }}
                              onDragEnd={() => {
                                setEnDeplacement(null);
                                setCaseSurvolee(null);
                              }}
                              className={`flex flex-col gap-1.5 p-2 rounded-md bg-background-100 border transition-colors ${
                                selectionne ? "border-primary-400 ring-2 ring-primary-200" : "border-background-200"
                              } ${
                                modeLot
                                  ? "cursor-pointer hover:border-primary-300"
                                  : "cursor-grab active:cursor-grabbing"
                              } ${enDeplacement === slot.id ? "opacity-50" : ""}`}
                              style={{ borderLeftWidth: 3, borderLeftColor: col.hex }}
                            >
                              <div className="flex items-start gap-2">
                                {modeLot && (
                                  <span
                                    className={`w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center rounded border ${
                                      selectionne ? "bg-primary-500 border-primary-500 text-background-50" : "border-background-300 bg-background-50"
                                    }`}
                                  >
                                    {selectionne && <i className="ri-check-line text-[11px]"></i>}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-foreground-800 shrink-0">{slot.heure}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-medium text-foreground-900 truncate">{slot.libelle}</p>
                                  <span className={`mt-0.5 inline-flex items-center gap-1 h-4 px-1.5 rounded-full text-[9px] font-semibold whitespace-nowrap ${statutCreneauMeta(normaliseStatutCreneau(slot.statut)).tone}`}>
                                    <i className={`${statutCreneauMeta(normaliseStatutCreneau(slot.statut)).icon} text-[9px]`}></i>
                                    {statutCreneauMeta(normaliseStatutCreneau(slot.statut)).label}
                                  </span>
                                  {absenceSlot && (
                                    <span className="mt-0.5 block">
                                      <BadgeAbsenceIntervention
                                        absence={absenceSlot}
                                        nom={col.nom}
                                        dateISO={slot.date}
                                        onProposerRemplacant={
                                          onProposerRemplacant
                                            ? () => onProposerRemplacant(slot, absenceSlot, col.nom)
                                            : undefined
                                        }
                                        onReaffecterLot={
                                          onReaffecterLotIntervenant &&
                                          (nbParCase.get(`${slot.intervenant_id ?? "none"}|${slot.date}`) ?? 0) > 1
                                            ? () => onReaffecterLotIntervenant(slot)
                                            : undefined
                                        }
                                      />
                                    </span>
                                  )}
                                  {slot.ville && (
                                    <p className="text-[10px] text-foreground-500 truncate inline-flex items-center gap-1">
                                      <i className="ri-map-pin-line"></i>
                                      {slot.ville}
                                    </p>
                                  )}
                                </div>
                                {!modeLot && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onEdit(slot)}
                                      title="Modifier cette intervention"
                                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded hover:bg-background-200 hover:text-primary-700 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                    >
                                      <i className="ri-pencil-line text-foreground-400"></i>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDelete(slot.id)}
                                      title="Supprimer"
                                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded hover:bg-background-200 hover:text-red-600 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                    >
                                      <i className="ri-close-line text-foreground-400"></i>
                                    </button>
                                  </>
                                )}
                              </div>

                              {/* Réaffectation en un clic : choisir une autre personne, ou désaffecter.
                                  Masquée pendant le mode lot pour éviter les clics parasites. */}
                              {!modeLot && (
                                <div className="relative flex items-center gap-1.5 rounded-md bg-background-50 border border-background-200 px-1.5">
                                  <i className="ri-shuffle-line text-[11px] text-secondary-600 shrink-0" aria-hidden></i>
                                  <select
                                    value={slot.intervenant_id === null ? "" : String(slot.intervenant_id)}
                                    onChange={(e) => onReassign(slot.id, e.target.value ? Number(e.target.value) : null)}
                                    title="Réaffecter cette intervention à une autre personne"
                                    aria-label="Réaffecter cette intervention"
                                    className="flex-1 h-6 bg-transparent text-[10px] text-foreground-600 outline-none cursor-pointer py-0 truncate"
                                  >
                                    <option value="">Non affecté</option>
                                    {intervenantsChoix.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.nom}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!modeLot && (
                          <button
                            type="button"
                            onClick={() => onAddFor(col.id, iso)}
                            className="inline-flex items-center justify-center gap-1 h-7 rounded-md border border-dashed border-background-300 text-foreground-400 text-[11px] font-medium hover:border-primary-300 hover:text-primary-600 cursor-pointer transition-colors"
                          >
                            <i className="ri-add-line"></i> Ajouter
                          </button>
                        )}
                      </div>
                    );
                  })}
                      </Fragment>
                    );
                  })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {modeLot && (
        <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          Cochez les interventions à déplacer (plusieurs colonnes possibles), choisissez la personne cible puis validez avec « Déplacer ».
        </p>
      )}
    </div>
  );
}