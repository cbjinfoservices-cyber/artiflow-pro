import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  effacerVuesFavorites,
  lireVuesFavorites,
  renommerVueFavorite,
  reordonnerVuesFavorites,
  retirerVueFavorite,
  VUES_FAVORITES_EVENT,
  type VueFavorite,
} from "@/lib/vuesFavoritesMemoire";

/** Horodatage court d'un épinglage (« 10 oct. »). */
function quandLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Une vue épinglée déplaçable : poignée de glissement + libellé renommable au double-clic. */
function VueSortable({
  vue,
  editing,
  draftLabel,
  onDraftChange,
  onStartRename,
  onValidateRename,
  onCancelRename,
  onRemove,
  onNavigate,
}: {
  vue: VueFavorite;
  editing: boolean;
  draftLabel: string;
  onDraftChange: (value: string) => void;
  onStartRename: () => void;
  onValidateRename: () => void;
  onCancelRename: () => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: vue.chemin });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Déplacer la vue ${vue.label}`}
        title="Glisser pour réordonner"
      >
        <i className="ri-draggable"></i>
      </button>
      <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <i className="ri-pushpin-2-line text-sm"></i>
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            type="text"
            autoFocus
            value={draftLabel}
            maxLength={48}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onValidateRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onValidateRename();
              if (e.key === "Escape") onCancelRename();
            }}
            className="w-full h-7 px-2 rounded-md bg-background-50 border border-accent-300 text-xs font-semibold text-foreground-900 outline-none focus:ring-2 focus:ring-accent-200"
          />
        ) : (
          <p
            onDoubleClick={onStartRename}
            title="Double-cliquez pour renommer cette vue"
            className="text-xs font-semibold text-foreground-900 truncate cursor-text"
          >
            {vue.label}
          </p>
        )}
        <p className="text-[11px] text-foreground-400 truncate">{vue.chemin}</p>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-foreground-400 whitespace-nowrap">
        <i className="ri-time-line"></i>
        {quandLabel(vue.at)}
      </span>
      <button
        type="button"
        onClick={onNavigate}
        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
        title="Rejouer cette vue"
      >
        <i className="ri-arrow-right-line"></i>
        Ouvrir
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md bg-background-50 border border-background-200 text-foreground-400 hover:text-red-600 hover:border-red-300 cursor-pointer transition-colors"
        aria-label="Retirer des favoris"
        title="Retirer cette vue des favoris"
      >
        <i className="ri-pushpin-line"></i>
      </button>
    </li>
  );
}

/**
 * Carte « Vues favorites épinglées » du tableau de bord : liste les vues reçues ou préparées
 * puis épinglées depuis Devis / Factures / Clients, pour les rejouer en un clic. Les vues se
 * réordonnent par glisser-déposer (les plus utiles en tête) et leur libellé se renomme au
 * double-clic. Se masque tant qu'aucune vue n'a été épinglée.
 */
export default function VuesFavoritesCard() {
  const navigate = useNavigate();
  const [vues, setVues] = useState<VueFavorite[]>(() => lireVuesFavorites());
  // Libellé en cours de renommage (double-clic) et brouillon de saisie.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Se met à jour à chaud dès qu'une vue est épinglée/retirée (même onglet) ou depuis un autre onglet.
  useEffect(() => {
    const sync = () => setVues(lireVuesFavorites());
    window.addEventListener(VUES_FAVORITES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(VUES_FAVORITES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Renomme une vue épinglée : double-clic sur son libellé pour la retrouver plus vite.
  const commencerRenommage = (vue: VueFavorite) => {
    setEditingId(vue.chemin);
    setDraftLabel(vue.label);
  };

  const validerRenommage = () => {
    if (editingId === null) return;
    renommerVueFavorite(editingId, draftLabel);
    setEditingId(null);
  };

  // Réordonne les vues par glisser-déposer et mémorise le nouvel ordre (partagé avec la barre latérale).
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ancienIndex = vues.findIndex((v) => v.chemin === active.id);
    const nouveauIndex = vues.findIndex((v) => v.chemin === over.id);
    if (ancienIndex < 0 || nouveauIndex < 0) return;
    const copie = [...vues];
    const [deplacee] = copie.splice(ancienIndex, 1);
    copie.splice(nouveauIndex, 0, deplacee);
    setVues(copie);
    reordonnerVuesFavorites(copie.map((v) => v.chemin));
  };

  if (vues.length === 0) return null;

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-pushpin-2-line"></i>
          </span>
          <div className="min-w-0">
            <h2 className="font-heading font-semibold text-base text-foreground-950">Vues favorites épinglées</h2>
            <p className="text-xs text-foreground-500 mt-0.5">
              Vos vues mises de côté, à rejouer en un clic. Glissez pour réordonner, double-cliquez un libellé pour le
              renommer.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-pushpin-fill"></i>
            {vues.length} vue{vues.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              effacerVuesFavorites();
              setVues([]);
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            title="Retirer toutes les vues favorites"
          >
            <i className="ri-delete-bin-6-line"></i>
            Tout retirer
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={vues.map((v) => v.chemin)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {vues.map((vue) => (
              <VueSortable
                key={vue.id}
                vue={vue}
                editing={editingId === vue.chemin}
                draftLabel={draftLabel}
                onDraftChange={setDraftLabel}
                onStartRename={() => commencerRenommage(vue)}
                onValidateRename={validerRenommage}
                onCancelRename={() => setEditingId(null)}
                onRemove={() => retirerVueFavorite(vue.chemin)}
                onNavigate={() => navigate(vue.chemin)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}