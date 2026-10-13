import { useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData } from "@/hooks/useArtisanData";
import { createCreneau, deleteCreneau, type CreneauPayload } from "@/lib/artisanApi";
import {
  couleurIntervenant,
  createIntervenant,
  deleteIntervenant,
  reassignerCreneau,
  setIntervenantActif,
  updateIntervenant,
  type Intervenant,
  type IntervenantPayload,
} from "@/lib/intervenants";
import { addDays, formatDayName, formatMonth, startOfWeek, toISODate } from "@/lib/dates";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import Modal from "@/pages/app/components/Modal";
import Infobulle from "@/components/base/Infobulle";
import CreneauFormModal from "@/pages/app/planning/components/CreneauFormModal";
import IntervenantsManagerModal from "@/pages/app/planning/components/IntervenantsManagerModal";
import PlanningEquipeGrid from "@/pages/app/planning/components/PlanningEquipeGrid";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

const toneBg: Record<string, string> = {
  primary: "bg-primary-100 border-primary-200",
  accent: "bg-accent-100 border-accent-200",
  secondary: "bg-secondary-100 border-secondary-200",
};
const tones = ["primary", "accent", "secondary"];

type Vue = "jour" | "equipe";

export default function AppPlanning() {
  usePageMeta("Planning · ArtiFlow-pro", "Organisez vos chantiers et vos équipes, et réduisez vos trajets.");
  const { user } = useAuth();
  const { loading, error, creneaux, chantiers, intervenants, reload } = useArtisanData();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(0);
  const [vue, setVue] = useState<Vue>("jour");
  const [filtreIntervenant, setFiltreIntervenant] = useState<string>("tous");
  const [addForm, setAddForm] = useState<{ date: string; intervenantId: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyInterv, setBusyInterv] = useState(false);
  const [managing, setManaging] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

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

  const intervenantParId = useMemo(() => {
    const map = new Map<number, Intervenant>();
    intervenants.forEach((i) => map.set(i.id, i));
    return map;
  }, [intervenants]);

  const intervenantsActifs = useMemo(() => intervenants.filter((i) => i.actif), [intervenants]);

  // Le filtre par intervenant s'applique à la vue jour comme à la vue équipe.
  const creneauxFiltres = useMemo(() => {
    if (filtreIntervenant === "tous") return creneaux;
    if (filtreIntervenant === "non") return creneaux.filter((c) => c.intervenant_id === null);
    const id = Number(filtreIntervenant);
    return creneaux.filter((c) => c.intervenant_id === id);
  }, [creneaux, filtreIntervenant]);

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

  // Intervenants affichés dans la grille équipe : tous les actifs, ou une seule colonne si filtré.
  const intervenantsGrille = useMemo(() => {
    if (filtreIntervenant === "tous" || filtreIntervenant === "non") return intervenantsActifs;
    const id = Number(filtreIntervenant);
    return intervenantsActifs.filter((i) => i.id === id);
  }, [intervenantsActifs, filtreIntervenant]);

  const ouvrirAjout = (date: string, intervenantId: number | null = null) => {
    setAddForm({ date, intervenantId });
  };

  const handleCreate = async (payload: CreneauPayload) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      await createCreneau(user.id, payload);
      setAddForm(null);
      await reload();
    } catch {
      setActionError("L'ajout du créneau a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const handleReassign = async (creneauId: number, intervenantId: number | null) => {
    setActionError(null);
    try {
      await reassignerCreneau(creneauId, intervenantId);
      await reload();
    } catch {
      setActionError("La réaffectation a échoué. Réessayez.");
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
            <button
              type="button"
              onClick={() => setManaging(true)}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
            >
              <i className="ri-team-line"></i> Ajouter des intervenants
            </button>
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
          />
        )}
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
              onClick={() => setWeekOffset((w) => w - 1)}
              className="w-10 h-10 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-foreground-700"></i>
            </button>
            <span className="min-w-[150px] text-center font-heading font-semibold text-sm text-foreground-950">
              {weekOffset === 0 ? "Cette semaine" : weekOffset < 0 ? `Semaine -${Math.abs(weekOffset)}` : `Semaine +${weekOffset}`} · {formatMonth(weekStart)}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-md bg-background-100 border border-background-200 hover:bg-background-200 cursor-pointer"
            >
              <i className="ri-arrow-right-s-line text-foreground-700"></i>
            </button>
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
            </div>

            <button
              type="button"
              onClick={() => setManaging(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-team-line"></i>
              <span className="hidden md:inline">Intervenants</span>
            </button>
            <button
              type="button"
              onClick={() => ouvrirAjout(selectedDate)}
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
          </div>
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 h-10 rounded-md bg-accent-100 text-accent-700 text-xs font-semibold whitespace-nowrap">
            <i className="ri-route-line"></i>
            {totalSlots} interventions
          </span>
        </div>

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

        {vue === "equipe" ? (
          <PlanningEquipeGrid
            days={days}
            isoList={isoList}
            intervenants={intervenantsGrille}
            intervenantsChoix={intervenantsActifs}
            creneaux={creneauxFiltres.filter((c) => isoList.includes(c.date))}
            onAddFor={(intervenantId, iso) => ouvrirAjout(iso, intervenantId)}
            onDelete={(id) => setPendingDelete(id)}
            onReassign={handleReassign}
            inclureNonAffecte={filtreIntervenant === "tous" || filtreIntervenant === "non"}
          />
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2 md:gap-3">
              {days.map((day, i) => (
                <button
                  key={isoList[i]}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`flex flex-col items-center gap-2 p-2 md:p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected === i ? "bg-primary-500 border-primary-500 text-background-50" : "bg-background-100 border-background-200 text-foreground-700 hover:border-primary-300"
                  }`}
                >
                  <span className="text-[11px] md:text-xs font-medium">{formatDayName(day).slice(0, 3)}</span>
                  <span className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold ${selected === i ? "bg-background-50/20" : "bg-background-200"}`}>
                    {day.getDate()}
                  </span>
                  <span className={`text-[10px] font-medium ${selected === i ? "text-background-50/80" : "text-foreground-400"}`}>
                    {(byDate[isoList[i]] ?? []).length} rdv
                  </span>
                </button>
              ))}
            </div>

            <div className="p-5 rounded-lg bg-background-100 border border-background-200">
              <h2 className="font-heading font-semibold text-base text-foreground-950 mb-4">
                {formatDayName(days[selected])} {days[selected].getDate()} {formatMonth(days[selected])}
              </h2>
              {daySlots.length === 0 ? (
                <p className="text-sm text-foreground-500">Aucune intervention prévue. Ajoutez un créneau pour bloquer du temps.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {daySlots.map((slot, idx) => {
                    const interv = slot.intervenant_id !== null ? intervenantParId.get(slot.intervenant_id) : undefined;
                    return (
                      <div key={slot.id} className={`flex items-center gap-4 p-3.5 rounded-md border ${toneBg[tones[idx % 3]]}`}>
                        <span className="w-14 text-sm font-bold text-foreground-800">{slot.heure}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground-900 truncate">{slot.libelle}</p>
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
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(slot.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-red-600 cursor-pointer"
                          aria-label="Supprimer le créneau"
                        >
                          <i className="ri-delete-bin-line text-foreground-500"></i>
                        </button>
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
      </div>
    </DataState>
  );
}