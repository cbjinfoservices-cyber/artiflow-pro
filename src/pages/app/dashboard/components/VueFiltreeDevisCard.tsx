import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { effacerFiltresDevis, lireFiltresDevis } from "@/lib/devisFiltresMemoire";
import { triLabel } from "@/lib/devisTri";
import { ajouterLienCopie } from "@/lib/liensCopiesMemoire";
import { originePublique } from "@/lib/site";

/** Sous-ensemble d'un devis utile pour retrouver le nom d'un modèle filtré. */
interface DevisLite {
  modeleCle: string | null;
  modeleNom: string | null;
}

/** Libellé lisible d'un mois au format « YYYY-MM » (ex. « septembre 2026 »). */
function moisLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Bannière « Vue filtrée » du tableau de bord : reprend la dernière vue mémorisée de la liste
 * des devis (modèle, mois, statut, période, tri) avec un lien direct pour la rouvrir telle quelle.
 * Cohérente avec les puces de la bannière équivalente de la page Devis. Se masque si aucune
 * vue n'a été mémorisée.
 */
export default function VueFiltreeDevisCard({ devis }: { devis: DevisLite[] }) {
  const navigate = useNavigate();
  const [filtres, setFiltres] = useState(() => lireFiltresDevis());
  const [copie, setCopie] = useState(false);

  // La mémoire peut évoluer entre deux visites du tableau de bord : on la relit au montage.
  useEffect(() => {
    setFiltres(lireFiltresDevis());
  }, []);

  const statut = filtres.statut ?? "Tous";
  const modele = filtres.modele ?? "";
  const mois = filtres.mois ?? "";
  const periode = filtres.periode ?? "Tout";
  const tri = filtres.tri ?? "";

  // Nom lisible du/des modèle(s) filtré(s), résolu à partir des devis déjà chargés par le tableau de bord.
  const modeleLabel = useMemo(() => {
    if (!modele || modele === "__any__") return null;
    const keys = modele.split(",").map((k) => k.trim()).filter(Boolean);
    if (keys.length > 1) return `${keys.length} modèles`;
    const map = new Map<string, string>();
    devis.forEach((d) => {
      if (d.modeleCle && d.modeleNom) map.set(d.modeleCle, d.modeleNom);
    });
    return map.get(keys[0]) ?? "1 modèle";
  }, [modele, devis]);

  const aVueFiltree =
    Boolean(modele) || Boolean(mois) || (statut !== "Tous") || (periode !== "Tout") || Boolean(tri);
  if (!aVueFiltree) return null;

  // « Oublier cette vue » : efface la dernière vue mémorisée et masque la bannière aussitôt.
  const oublierVue = () => {
    effacerFiltresDevis();
    setFiltres({});
  };

  const params = new URLSearchParams();
  if (modele) params.set("modele", modele);
  if (mois) params.set("mois", mois);
  if (statut !== "Tous") params.set("statut", statut);
  if (periode !== "Tout") params.set("periode", periode);
  if (tri) params.set("tri", tri);
  const qs = params.toString();
  const lien = `/app/devis${qs ? `?${qs}` : ""}`;

  // Copie le lien complet de la vue filtrée pour l'envoyer / le partager tel quel.
  const copierLien = async () => {
    const url = `${originePublique()}${lien}`;
    try {
      await navigator.clipboard.writeText(url);
      ajouterLienCopie("Vue filtrée · devis", url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      setCopie(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-800 whitespace-nowrap">
        <i className="ri-filter-3-line"></i>
        Vue filtrée · dernière liste de devis
      </span>
      <span className="hidden sm:block w-px h-4 bg-accent-200" aria-hidden="true"></span>

      {modeleLabel && (
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
          <i className="ri-bookmark-3-line text-accent-600"></i>
          {modeleLabel}
        </span>
      )}
      {mois && (
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
          <i className="ri-calendar-line text-accent-600"></i>
          <span className="capitalize">{moisLabel(mois)}</span>
        </span>
      )}
      {statut !== "Tous" && (
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
          <i className="ri-filter-3-line text-accent-600"></i>
          {statut}
        </span>
      )}
      {periode !== "Tout" && (
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
          <i className="ri-calendar-2-line text-accent-600"></i>
          {periode}
        </span>
      )}
      {tri && (
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
          <i className="ri-sort-asc text-accent-600"></i>
          <span className="capitalize">{triLabel(tri)}</span>
        </span>
      )}

      <div className="flex items-center gap-2 sm:ml-auto">
        <button
          type="button"
          onClick={copierLien}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
          title="Copier un lien partageable qui ouvre exactement cette vue filtrée des devis"
        >
          <i className={copie ? "ri-check-line" : "ri-link"}></i>
          {copie ? "Lien copié" : "Copier le lien"}
        </button>
        <button
          type="button"
          onClick={() => navigate(lien)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
          title="Rouvrir la liste des devis avec cette vue filtrée"
        >
          <i className="ri-arrow-right-line"></i>
          Ouvrir la vue
        </button>
        <button
          type="button"
          onClick={oublierVue}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          title="Effacer la dernière vue mémorisée des devis (elle ne sera plus proposée au retour)"
        >
          <i className="ri-eraser-line"></i>
          Oublier cette vue
        </button>
      </div>
    </div>
  );
}