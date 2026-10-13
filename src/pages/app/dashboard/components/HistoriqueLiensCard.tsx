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
  effacerLiensCopies,
  lireLiensCopies,
  LIENS_COPIES_EVENT,
  reordonnerLiensCopies,
  type LienCopie,
} from "@/lib/liensCopiesMemoire";

/** Horodatage court d'une copie (« 10 oct. »). */
function quandLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/** Horodatage complet d'une copie (« 10 oct. 2026 »). */
function quandCompletLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Convertit l'URL complète d'un lien mémorisé en chemin interne (sans origine ni préfixe
 * de publication), directement utilisable par la navigation de l'application.
 */
function cheminInterne(url: string): string {
  let path = url;
  if (path.startsWith(window.location.origin)) path = path.slice(window.location.origin.length);
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  if (base && path.startsWith(base)) path = path.slice(base.length);
  return path.startsWith("/") ? path : `/${path}`;
}

/** Une ligne de l'historique, déplaçable : poignée de glissement + ouvrir/recopier. */
function LienSortable({
  lien,
  copie,
  onOuvrir,
  onRecopier,
}: {
  lien: LienCopie;
  copie: boolean;
  onOuvrir: () => void;
  onRecopier: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lien.id });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-3 rounded-md bg-background-50 border border-background-200 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Déplacer le lien ${lien.label}`}
        title="Glisser pour réordonner"
        className="shrink-0 w-7 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-grab active:cursor-grabbing touch-none"
      >
        <i className="ri-draggable"></i>
      </button>
      <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <i className="ri-filter-3-line text-sm"></i>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground-900 truncate">{lien.label}</p>
        <p className="text-[11px] text-foreground-400 truncate">{lien.url}</p>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-foreground-400 whitespace-nowrap">
        <i className="ri-time-line"></i>
        {quandLabel(lien.at)}
      </span>
      <button
        type="button"
        onClick={onOuvrir}
        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
        title="Ouvrir directement cette vue partagée"
      >
        <i className="ri-arrow-right-line"></i>
        Ouvrir
      </button>
      <button
        type="button"
        onClick={onRecopier}
        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
        title="Recopier ce lien dans le presse-papiers"
      >
        <i className={copie ? "ri-check-line" : "ri-file-copy-line"}></i>
        {copie ? "Copié" : "Recopier"}
      </button>
    </li>
  );
}

/**
 * Petite carte « Liens copiés récemment » du tableau de bord : conserve les dernières vues
 * partagées pour les retrouver sans avoir à recopier. Les liens se réordonnent par
 * glisser-déposer (les plus utiles en tête). Se masque tant qu'aucun lien n'a été copié.
 */
export default function HistoriqueLiensCard() {
  const navigate = useNavigate();
  const [liens, setLiens] = useState<LienCopie[]>(() => lireLiensCopies());
  const [copieId, setCopieId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Se met à jour à chaud dès qu'un lien est copié (même onglet) ou depuis un autre onglet.
  useEffect(() => {
    const sync = () => setLiens(lireLiensCopies());
    window.addEventListener(LIENS_COPIES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LIENS_COPIES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (liens.length === 0) return null;

  const recopier = async (lien: LienCopie) => {
    try {
      await navigator.clipboard.writeText(lien.url);
      setCopieId(lien.id);
      window.setTimeout(() => setCopieId((prev) => (prev === lien.id ? null : prev)), 2000);
    } catch {
      setCopieId(null);
    }
  };

  // Rouvre directement la vue partagée, sans passer par le copier-coller du lien.
  const ouvrir = (lien: LienCopie) => {
    navigate(cheminInterne(lien.url));
  };

  // Réordonne les liens par glisser-déposer et mémorise le nouvel ordre.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ancienIndex = liens.findIndex((l) => l.id === active.id);
    const nouveauIndex = liens.findIndex((l) => l.id === over.id);
    if (ancienIndex < 0 || nouveauIndex < 0) return;
    const copie = [...liens];
    const [deplace] = copie.splice(ancienIndex, 1);
    copie.splice(nouveauIndex, 0, deplace);
    setLiens(copie);
    reordonnerLiensCopies(copie.map((l) => l.id));
  };

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
            <i className="ri-links-line"></i>
          </span>
          <div className="min-w-0">
            <h2 className="font-heading font-semibold text-base text-foreground-950">Liens copiés récemment</h2>
            <p className="text-xs text-foreground-500 mt-0.5">
              Vos dernières vues partagées, à rouvrir ou recopier d'un clic. Glissez pour réordonner. Dernière le{" "}
              <span className="font-semibold text-foreground-700">{quandCompletLabel(liens[0].at)}</span>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap"
            title={`${liens.length} vue${liens.length > 1 ? "s" : ""} partagée${liens.length > 1 ? "s" : ""} · dernière le ${quandCompletLabel(liens[0].at)}`}
          >
            <i className="ri-share-forward-line"></i>
            {liens.length} vue{liens.length > 1 ? "s" : ""} partagée{liens.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              effacerLiensCopies();
              setLiens([]);
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            title="Vider l'historique des liens copiés"
          >
            <i className="ri-delete-bin-6-line"></i>
            Vider
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={liens.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {liens.map((lien) => (
              <LienSortable
                key={lien.id}
                lien={lien}
                copie={copieId === lien.id}
                onOuvrir={() => ouvrir(lien)}
                onRecopier={() => recopier(lien)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}