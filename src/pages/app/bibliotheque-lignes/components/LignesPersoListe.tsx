import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
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
import { CATEGORIES_LIGNES, type LigneBibliotheque } from "@/lib/bibliothequeLignes";
import { afficherCategorie, construireCategories, type CategoriesLignesPrefs } from "@/lib/categoriesLignesPrefs";
import type { FavoriCle } from "@/lib/lignesFavorisPrefs";
import LigneItem from "@/pages/app/bibliotheque-lignes/components/LigneItem";

/** Une ligne personnelle que l'on peut faire glisser (déplacement et réordonnancement). */
function LigneSortable({
  ligne,
  categorie,
  favori,
  onToggleFavori,
  onEdit,
  onDelete,
}: {
  ligne: LigneBibliotheque;
  categorie: string;
  favori: boolean;
  onToggleFavori: (l: LigneBibliotheque) => void;
  onEdit: (l: LigneBibliotheque) => void;
  onDelete: (l: LigneBibliotheque) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `ligne-${ligne.id}` });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
      <LigneItem
        designation={ligne.designation}
        unite={ligne.unite}
        prix={ligne.prix_unitaire}
        taux={ligne.taux_tva}
        categorie={categorie}
        origine="perso"
        favori={favori}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 cursor-grab active:cursor-grabbing touch-none"
            aria-label={`Déplacer la ligne ${ligne.designation}`}
            title="Glisser pour réordonner ou changer de catégorie"
          >
            <i className="ri-draggable"></i>
          </button>
        }
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavori(ligne)}
              className={`w-9 h-9 flex items-center justify-center rounded-md cursor-pointer ${
                favori ? "text-primary-600 hover:bg-primary-100" : "text-foreground-400 hover:bg-background-200 hover:text-primary-700"
              }`}
              aria-label={favori ? "Retirer des épinglées" : "Épingler en haut de la catégorie"}
              title={favori ? "Retirer des épinglées" : "Épingler en haut de sa catégorie"}
            >
              <i className={favori ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
            </button>
            <button
              type="button"
              onClick={() => onEdit(ligne)}
              className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-primary-700 cursor-pointer"
              aria-label="Modifier la ligne"
              title="Modifier"
            >
              <i className="ri-edit-line"></i>
            </button>
            <button
              type="button"
              onClick={() => onDelete(ligne)}
              className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer"
              aria-label="Supprimer la ligne"
              title="Supprimer"
            >
              <i className="ri-delete-bin-line"></i>
            </button>
          </div>
        }
      />
    </div>
  );
}

/** Un groupe de catégorie : zone de dépôt (reclasser) + zone de tri (réordonner). */
function CategorieZone({
  id,
  affichage,
  count,
  vide,
  itemIds,
  children,
}: {
  id: string;
  affichage: string;
  count: number;
  vide: boolean;
  itemIds: string[];
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg p-1 transition-colors ${isOver ? "bg-primary-50 ring-2 ring-primary-200" : ""}`}
    >
      <header className="flex items-center gap-2 px-1.5 mb-2">
        <span className="w-6 h-6 flex items-center justify-center rounded-md bg-background-200 text-foreground-500">
          <i className="ri-folder-line text-xs"></i>
        </span>
        <span className="text-sm font-semibold text-foreground-900">{affichage}</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-background-200 text-foreground-600 font-semibold">
          {count}
        </span>
      </header>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2.5">
          {children}
          {vide && (
            <p className="rounded-lg border border-dashed border-background-300 py-4 text-center text-xs text-foreground-400">
              Déposez une ligne ici pour la classer dans « {affichage} »
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

/**
 * Liste des lignes personnelles regroupées par catégorie. On peut :
 * - glisser une ligne sur l'en-tête d'une autre catégorie pour la reclasser ;
 * - glisser une ligne à l'intérieur de sa catégorie pour la réordonner.
 * En vue complète (aucun filtre), toutes les catégories apparaissent comme zones
 * de dépôt, même celles encore vides.
 */
export default function LignesPersoListe({
  lignesFiltrees,
  prefs,
  vueComplete,
  favoris,
  onToggleFavori,
  onEdit,
  onDelete,
  onMove,
  onReorder,
}: {
  lignesFiltrees: LigneBibliotheque[];
  prefs: CategoriesLignesPrefs;
  /** Vue « tout » sans recherche : affiche aussi les catégories vides comme zones de dépôt. */
  vueComplete: boolean;
  /** Identifiants des lignes épinglées (favoris). */
  favoris: FavoriCle[];
  onToggleFavori: (l: LigneBibliotheque) => void;
  onEdit: (l: LigneBibliotheque) => void;
  onDelete: (l: LigneBibliotheque) => void;
  onMove: (ligne: LigneBibliotheque, categorie: string) => void;
  /** Réordonne une ligne avant une autre, dans la même catégorie. */
  onReorder: (categorie: string, id: number, avantId: number | null) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groupes = useMemo(() => {
    const parCat = new Map<string, LigneBibliotheque[]>();
    lignesFiltrees.forEach((l) => {
      const arr = parCat.get(l.categorie) ?? [];
      arr.push(l);
      parCat.set(l.categorie, arr);
    });
    const noms = new Set<string>(parCat.keys());
    if (vueComplete) {
      CATEGORIES_LIGNES.forEach((c) => noms.add(c));
      noms.add("Général");
    }
    return construireCategories([...noms], prefs)
      .map((c) => ({ nom: c.nom, affichage: c.affichage, masquee: c.masquee, lignes: parCat.get(c.nom) ?? [] }))
      .filter((g) => g.lignes.length > 0 || (vueComplete && !g.masquee));
  }, [lignesFiltrees, prefs, vueComplete]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const ligne = lignesFiltrees.find((l) => `ligne-${l.id}` === activeId);
    if (!ligne) return;

    // Dépôt sur l'en-tête (ou zone vide) d'une catégorie → reclassement.
    if (overId.startsWith("cat-")) {
      const cat = overId.slice(4);
      if (cat !== ligne.categorie) onMove(ligne, cat);
      return;
    }

    // Dépôt sur une autre ligne → reclassement ou réordonnancement.
    if (overId.startsWith("ligne-")) {
      const cible = lignesFiltrees.find((l) => `ligne-${l.id}` === overId);
      if (!cible) return;
      if (cible.categorie !== ligne.categorie) onMove(ligne, cible.categorie);
      else onReorder(ligne.categorie, ligne.id, cible.id);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4">
        {groupes.map((g) => (
          <CategorieZone
            key={g.nom}
            id={`cat-${g.nom}`}
            affichage={g.affichage}
            count={g.lignes.length}
            vide={g.lignes.length === 0}
            itemIds={g.lignes.map((l) => `ligne-${l.id}`)}
          >
            {g.lignes.map((l) => (
              <LigneSortable
                key={l.id}
                ligne={l}
                categorie={afficherCategorie(l.categorie, prefs)}
                favori={favoris.includes(l.id)}
                onToggleFavori={onToggleFavori}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </CategorieZone>
        ))}
      </div>
    </DndContext>
  );
}