import { useEffect, useRef, useState } from "react";
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
  lireVuesFavorites,
  reordonnerVuesFavorites,
  renommerVueFavorite,
  retirerVueFavorite,
  VUES_FAVORITES_EVENT,
  type VueFavorite,
} from "@/lib/vuesFavoritesMemoire";

/** Date courte d'un épinglage (« 10 oct. »). */
function quandLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Une vue épinglée de la barre latérale : poignée de glissement + libellé renommable au double-clic. */
function LigneVueFavori({
  vue,
  editing,
  draftLabel,
  onDraftChange,
  onStartRename,
  onValidateRename,
  onCancelRename,
  onRemove,
  onOpen,
}: {
  vue: VueFavorite;
  editing: boolean;
  draftLabel: string;
  onDraftChange: (value: string) => void;
  onStartRename: () => void;
  onValidateRename: () => void;
  onCancelRename: () => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: vue.chemin });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={`flex items-center gap-1 ${isDragging ? "opacity-60" : ""}`}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Déplacer « ${vue.label} »`}
        title="Glisser pour réordonner"
        className="shrink-0 w-6 h-9 flex items-center justify-center rounded-md text-foreground-300 hover:text-foreground-600 hover:bg-background-200 cursor-grab active:cursor-grabbing touch-none"
      >
        <i className="ri-draggable text-sm"></i>
      </button>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onDoubleClick={onStartRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpen();
          if (e.key === "Escape") onCancelRename();
        }}
        title={editing ? "Tapez le nouveau nom, Entrée pour valider" : `Double-cliquez pour renommer « ${vue.label} »`}
        className="flex-1 min-w-0 flex items-center gap-2 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-left cursor-pointer hover:border-accent-300 hover:bg-accent-50 transition-colors"
      >
        <i className="ri-arrow-right-s-line text-accent-600 shrink-0"></i>
        {editing ? (
          <input
            type="text"
            autoFocus
            value={draftLabel}
            maxLength={48}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onValidateRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") onValidateRename();
              if (e.key === "Escape") onCancelRename();
            }}
            className="w-full h-7 px-2 rounded-md bg-background-50 border border-accent-300 text-[11px] font-semibold text-foreground-900 outline-none focus:ring-2 focus:ring-accent-200"
          />
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-foreground-800 truncate">{vue.label}</span>
            <span className="block text-[10px] text-foreground-400 truncate">{quandLabel(vue.at)}</span>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Retirer cette vue des favoris"
        title="Retirer cette vue des favoris"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-400 hover:text-red-600 hover:border-red-300 cursor-pointer transition-colors"
      >
        <i className="ri-close-line text-sm"></i>
      </button>
    </li>
  );
}

/**
 * Accès rapide « Vues favorites » de la barre latérale : déplie la liste des vues
 * épinglées (Devis / Factures / Clients) pour les rouvrir en un clic, sans passer
 * par le tableau de bord. Un double-clic sur un libellé permet de le renommer, et
 * chaque vue se réordonne par glisser-déposer (les plus utiles en tête).
 * Se masque tant qu'aucune vue n'est épinglée.
 */
export default function AccesVuesFavorites() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [vues, setVues] = useState<VueFavorite[]>(() => lireVuesFavorites());
  // Libellé en cours de renommage (double-clic) et brouillon de saisie.
  const [editingChemin, setEditingChemin] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  // Minuteur qui retarde l'ouverture d'une vue : si un double-clic survient juste après,
  // on l'annule pour laisser la place au renommage.
  const clicTimer = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Se met à jour à chaud dès qu'une vue est épinglée/renommée/retirée (même onglet) ou depuis un autre onglet.
  useEffect(() => {
    const sync = () => setVues(lireVuesFavorites());
    window.addEventListener(VUES_FAVORITES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(VUES_FAVORITES_EVENT, sync);
      window.removeEventListener("storage", sync);
      if (clicTimer.current !== null) window.clearTimeout(clicTimer.current);
    };
  }, []);

  const annulerClic = () => {
    if (clicTimer.current !== null) {
      window.clearTimeout(clicTimer.current);
      clicTimer.current = null;
    }
  };

  // Ouvre la vue après un court délai, le temps de détecter un éventuel double-clic (renommage).
  const ouvrirVue = (vue: VueFavorite) => {
    if (editingChemin === vue.chemin) return;
    annulerClic();
    clicTimer.current = window.setTimeout(() => {
      setOpen(false);
      navigate(vue.chemin);
    }, 220);
  };

  const commencerRenommage = (vue: VueFavorite) => {
    annulerClic();
    setEditingChemin(vue.chemin);
    setDraftLabel(vue.label);
  };

  const validerRenommage = () => {
    if (editingChemin === null) return;
    renommerVueFavorite(editingChemin, draftLabel);
    setEditingChemin(null);
  };

  // Réordonne les vues par glisser-déposer et mémorise le nouvel ordre (partagé avec le tableau de bord).
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
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Vos vues épinglées, à rouvrir en un clic"
        className={`relative flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
          open
            ? "bg-accent-100 text-accent-800"
            : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
        }`}
      >
        <i className="ri-pushpin-2-line text-lg"></i>
        Vues favorites
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold">
          {vues.length}
        </span>
        <i className={`${open ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} text-foreground-400`}></i>
      </button>

      {open && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={vues.map((v) => v.chemin)} strategy={verticalListSortingStrategy}>
            <ul className="mt-1 flex flex-col gap-1 pl-3">
              {vues.map((vue) => (
                <LigneVueFavori
                  key={vue.id}
                  vue={vue}
                  editing={editingChemin === vue.chemin}
                  draftLabel={draftLabel}
                  onDraftChange={setDraftLabel}
                  onStartRename={() => commencerRenommage(vue)}
                  onValidateRename={validerRenommage}
                  onCancelRename={() => setEditingChemin(null)}
                  onRemove={() => retirerVueFavorite(vue.chemin)}
                  onOpen={() => ouvrirVue(vue)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}