import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ajouterVueFavorite,
  estVueFavorite,
  retirerVueFavorite,
  VUES_FAVORITES_EVENT,
} from "@/lib/vuesFavoritesMemoire";

/**
 * Bouton « Épingler comme vue favorite » : à placer à côté de l'indicateur « vue partagée ».
 * Un clic mémorise la vue affichée (adresse + filtres) pour la rejouer en un clic depuis le tableau de bord.
 * Un second clic la retire des favoris.
 */
export default function BoutonEpinglerVue({ label }: { label: string }) {
  const location = useLocation();
  const chemin = `${location.pathname}${location.search}`;
  const [epinglee, setEpinglee] = useState(() => estVueFavorite(chemin));
  const [notice, setNotice] = useState(false);

  // La vue change (filtres différents) : on recale l'état du bouton sur le chemin courant.
  useEffect(() => {
    setEpinglee(estVueFavorite(chemin));
  }, [chemin]);

  // Se synchronise à chaud quand une vue est épinglée/retirée ailleurs (carte du tableau de bord, autre onglet).
  useEffect(() => {
    const sync = () => setEpinglee(estVueFavorite(chemin));
    window.addEventListener(VUES_FAVORITES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(VUES_FAVORITES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [chemin]);

  const basculer = () => {
    if (epinglee) {
      retirerVueFavorite(chemin);
      setEpinglee(false);
    } else {
      ajouterVueFavorite(label, chemin);
      setEpinglee(true);
    }
    setNotice(true);
    window.setTimeout(() => setNotice(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={basculer}
      aria-pressed={epinglee}
      title={
        epinglee
          ? "Retirer cette vue des favoris"
          : "Épingler cette vue comme favorite pour la rejouer en un clic depuis le tableau de bord"
      }
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
        epinglee
          ? "bg-accent-500 text-background-50 hover:bg-accent-600"
          : "bg-accent-100 text-accent-800 hover:bg-accent-200"
      }`}
    >
      <i className={epinglee ? "ri-pushpin-fill" : "ri-pushpin-line"}></i>
      {epinglee ? (notice ? "Épinglée !" : "Épinglée") : "Épingler"}
    </button>
  );
}