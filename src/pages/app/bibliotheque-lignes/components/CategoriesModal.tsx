import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { construireCategories, type CategoriesLignesPrefs } from "@/lib/categoriesLignesPrefs";
import Modal from "@/pages/app/components/Modal";

/** Une ligne de catégorie réorganisable : poignée, libellé, renommage et masquage. */
function CategorieRow({
  nom,
  affichage,
  masquee,
  estCatalogue,
  onRenommer,
  onBasculer,
}: {
  nom: string;
  affichage: string;
  masquee: boolean;
  estCatalogue: boolean;
  onRenommer: (nom: string, valeur: string) => void;
  onBasculer: (nom: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: nom });
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(affichage);

  useEffect(() => {
    setValeur(affichage);
  }, [affichage]);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  const valider = () => {
    onRenommer(nom, valeur);
    setEdition(false);
  };

  const annuler = () => {
    setValeur(affichage);
    setEdition(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2.5 p-2.5 rounded-lg border bg-background-50 ${
        isDragging ? "border-primary-300 shadow-sm" : "border-background-200"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Réorganiser la catégorie ${affichage}`}
        title="Glisser pour réorganiser"
      >
        <i className="ri-draggable"></i>
      </button>

      {edition ? (
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <input
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") valider();
              else if (e.key === "Escape") annuler();
            }}
            autoFocus
            className="min-w-0 flex-1 h-9 px-2.5 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
            aria-label="Nom de la catégorie"
          />
          <button
            type="button"
            onClick={valider}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-primary-500 text-background-50 cursor-pointer hover:bg-primary-600"
            aria-label="Valider le renommage"
            title="Valider"
          >
            <i className="ri-check-line"></i>
          </button>
          <button
            type="button"
            onClick={annuler}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-foreground-500 hover:bg-background-200 cursor-pointer"
            aria-label="Annuler le renommage"
            title="Annuler"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      ) : (
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${
              masquee ? "text-foreground-400 line-through" : "text-foreground-950"
            }`}
          >
            {affichage}
          </span>
          {affichage !== nom && (
            <span className="shrink-0 text-[10px] text-foreground-400 truncate" title={`Nom d'origine : ${nom}`}>
              ({nom})
            </span>
          )}
          {estCatalogue && (
            <span className="shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
              <i className="ri-book-2-line"></i> Catalogue
            </span>
          )}
        </div>
      )}

      {!edition && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEdition(true)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-primary-700 cursor-pointer"
            aria-label={`Renommer la catégorie ${affichage}`}
            title="Renommer"
          >
            <i className="ri-edit-line"></i>
          </button>
          <button
            type="button"
            onClick={() => onBasculer(nom)}
            className={`w-8 h-8 flex items-center justify-center rounded-md cursor-pointer hover:bg-background-200 ${
              masquee ? "text-foreground-400" : "text-accent-700"
            }`}
            aria-label={masquee ? `Réafficher ${affichage}` : `Masquer ${affichage}`}
            title={
              masquee
                ? "Masquée des filtres et sélecteurs — cliquer pour réafficher"
                : "Visible dans les filtres — cliquer pour masquer"
            }
          >
            <i className={masquee ? "ri-eye-off-line" : "ri-eye-line"}></i>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Fenêtre de gestion des catégories de la bibliothèque de lignes : réorganiser
 * par glisser-déposer, renommer (perso et catalogue) et masquer des filtres et
 * sélecteurs. Une catégorie masquée reste visible dans l'onglet « Catalogue métier ».
 */
export default function CategoriesModal({
  prefs,
  nomsCanoniques,
  catalogue,
  onChange,
  onClose,
}: {
  prefs: CategoriesLignesPrefs;
  /** Tous les noms de catégories (perso + catalogue) dans l'ordre par défaut. */
  nomsCanoniques: string[];
  /** Noms des catégories issues du catalogue métier. */
  catalogue: string[];
  onChange: (next: CategoriesLignesPrefs) => void;
  onClose: () => void;
}) {
  const items = useMemo(() => construireCategories(nomsCanoniques, prefs), [nomsCanoniques, prefs]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.nom === active.id);
    const newIndex = items.findIndex((i) => i.nom === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordre = arrayMove(items, oldIndex, newIndex).map((i) => i.nom);
    onChange({ ...prefs, ordre });
  };

  const renommer = (nom: string, valeur: string) => {
    const v = valeur.trim();
    const renommages = { ...prefs.renommages };
    if (!v || v === nom) delete renommages[nom];
    else renommages[nom] = v;
    onChange({ ...prefs, renommages });
  };

  const basculer = (nom: string) => {
    const masquees = prefs.masquees.includes(nom)
      ? prefs.masquees.filter((n) => n !== nom)
      : [...prefs.masquees, nom];
    onChange({ ...prefs, masquees });
  };

  const reinitialiser = () => onChange({ ordre: [], masquees: [], renommages: {} });

  const aDesReglages =
    prefs.ordre.length > 0 || prefs.masquees.length > 0 || Object.keys(prefs.renommages).length > 0;

  return (
    <Modal
      title="Gérer les catégories"
      subtitle="Glissez pour réorganiser, renommez ou masquez. Le masquage ne retire la catégorie que des filtres et des menus de sélection."
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={reinitialiser}
            disabled={!aDesReglages}
            className="mr-auto inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-restart-line"></i> Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
          >
            Terminé
          </button>
        </>
      }
    >
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground-500">
          Aucune catégorie pour l'instant. Créez une première ligne pour en voir apparaître.
        </p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.nom)} strategy={verticalListSortingStrategy}>
              {items.map((c) => (
                <CategorieRow
                  key={c.nom}
                  nom={c.nom}
                  affichage={c.affichage}
                  masquee={c.masquee}
                  estCatalogue={catalogue.includes(c.nom)}
                  onRenommer={renommer}
                  onBasculer={basculer}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      <p className="mt-3 text-[11px] text-foreground-400 flex items-center gap-1.5">
        <i className="ri-information-line"></i>
        L'ordre s'applique aux filtres et aux menus de catégorie. Une catégorie masquée reste visible dans l'onglet
        « Catalogue métier ».
      </p>
    </Modal>
  );
}