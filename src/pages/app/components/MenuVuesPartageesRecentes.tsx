import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cheminInterneDepuisUrl,
  LIENS_COPIES_EVENT,
  lireLiensCopies,
  type LienCopie,
} from "@/lib/liensCopiesMemoire";
import {
  ajouterVueFavorite,
  lireVuesFavorites,
  retirerVueFavorite,
  VUES_FAVORITES_EVENT,
} from "@/lib/vuesFavoritesMemoire";

/** Horodatage court d'une copie (« 10 oct. »). */
function quandLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/**
 * Petit menu « Vues partagées récemment » : liste les derniers liens copiés qui concernent
 * la page courante (basePath) et permet de rouvrir la vue en un clic. Un champ de recherche
 * filtre les liens quand la liste s'allonge, chaque lien peut être épinglé en favori à
 * l'unité, et un bouton « Tout épingler » met tous les liens affichés de côté d'un coup.
 * Se masque tant qu'aucun lien de cette page n'a été copié.
 */
export default function MenuVuesPartageesRecentes({
  basePath,
  titre = "Vues partagées récemment",
}: {
  /** Préfixe de chemin de la page (ex. « /app/devis ») pour ne garder que ses liens. */
  basePath: string;
  /** Titre affiché en tête du menu. */
  titre?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [liens, setLiens] = useState<LienCopie[]>(() => lireLiensCopies());
  // Texte de recherche pour filtrer les liens quand la liste s'allonge.
  const [recherche, setRecherche] = useState("");
  // Chemins déjà épinglés en favori : recalculés à chaud pour refléter l'état de l'épingle.
  const [pinnedChemins, setPinnedChemins] = useState<string[]>(() =>
    lireVuesFavorites().map((v) => v.chemin),
  );
  const boxRef = useRef<HTMLDivElement>(null);

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

  // Se met à jour à chaud quand une vue est épinglée/retirée (menu, barre latérale, tableau de bord…).
  useEffect(() => {
    const sync = () => setPinnedChemins(lireVuesFavorites().map((v) => v.chemin));
    window.addEventListener(VUES_FAVORITES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(VUES_FAVORITES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Ferme le menu au clic extérieur ou avec la touche Échap.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const basculerMenu = () => {
    setOpen((v) => {
      if (v) setRecherche("");
      return !v;
    });
  };

  // On borne le préfixe au segment de chemin exact, sinon « /app/relances » capterait
  // aussi « /app/relances-programmees ».
  const duDomaine = liens.filter((l) => {
    const chemin = cheminInterneDepuisUrl(l.url);
    return chemin === basePath || chemin.startsWith(`${basePath}/`) || chemin.startsWith(`${basePath}?`);
  });
  if (duDomaine.length === 0) return null;

  // Filtre de recherche : cherche dans le libellé et l'adresse, insensible à la casse.
  const q = recherche.trim().toLowerCase();
  const resultats = q
    ? duDomaine.filter((l) => l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
    : duDomaine;

  // Liens affichés qui ne sont pas encore épinglés (pour le bouton « Tout épingler »).
  const aEpingler = resultats.filter((l) => !pinnedChemins.includes(cheminInterneDepuisUrl(l.url)));

  const toutEpingler = () => {
    aEpingler.forEach((l) => ajouterVueFavorite(l.label, cheminInterneDepuisUrl(l.url)));
  };

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={basculerMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        title={titre}
        className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
      >
        <i className="ri-history-line"></i>
        <span className="hidden sm:inline">Vues partagées</span>
        <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-background-50/70 text-[10px] font-bold">
          {duDomaine.length}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-30 mt-2 left-0 w-80 p-1 rounded-md bg-background-50 border border-background-200"
        >
          <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1.5">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">{titre}</p>
            <button
              type="button"
              onClick={toutEpingler}
              disabled={aEpingler.length === 0}
              title={
                aEpingler.length === 0
                  ? "Tous les liens affichés sont déjà épinglés"
                  : "Épingler tous les liens affichés dans vos vues favorites"
              }
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default bg-accent-100 text-accent-800 hover:bg-accent-200"
            >
              <i className="ri-pushpin-fill"></i>
              Tout épingler
              {aEpingler.length > 0 && <span className="font-bold">· {aEpingler.length}</span>}
            </button>
          </div>

          <div className="px-2 pb-1.5">
            <div className="relative">
              <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm leading-none"></i>
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Filtrer les liens…"
                aria-label="Filtrer les liens partagés"
                className="w-full h-8 pl-8 pr-7 rounded-md bg-background-100 border border-background-200 text-xs text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-200"
              />
              {recherche && (
                <button
                  type="button"
                  onClick={() => setRecherche("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer transition-colors"
                >
                  <i className="ri-close-line text-sm"></i>
                </button>
              )}
            </div>
          </div>

          {resultats.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-foreground-400">
              Aucun lien ne correspond à « {recherche.trim()} ».
            </p>
          ) : (
            resultats.map((lien) => {
              const chemin = cheminInterneDepuisUrl(lien.url);
              const epinglee = pinnedChemins.includes(chemin);
              return (
                <div
                  key={lien.id}
                  role="menuitem"
                  className="flex items-center gap-1 rounded-md hover:bg-background-100 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setRecherche("");
                      navigate(chemin);
                    }}
                    className="flex-1 min-w-0 flex items-start gap-2 px-3 py-2 rounded-md text-left cursor-pointer"
                  >
                    <i className="ri-share-forward-line text-accent-600 mt-0.5"></i>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-foreground-900 truncate">{lien.label}</span>
                      <span className="block text-[11px] text-foreground-400 truncate">{lien.url}</span>
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-foreground-400 whitespace-nowrap">
                      <i className="ri-time-line"></i>
                      {quandLabel(lien.at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (epinglee) retirerVueFavorite(chemin);
                      else ajouterVueFavorite(lien.label, chemin);
                    }}
                    aria-pressed={epinglee}
                    aria-label={epinglee ? "Retirer cette vue des favoris" : "Épingler cette vue comme favorite"}
                    title={
                      epinglee
                        ? "Retirer cette vue des favoris"
                        : "Épingler cette vue comme favorite pour la rejouer en un clic"
                    }
                    className={`shrink-0 w-8 h-8 mr-1 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
                      epinglee
                        ? "bg-accent-500 text-background-50 hover:bg-accent-600"
                        : "text-foreground-400 hover:bg-background-200 hover:text-accent-700"
                    }`}
                  >
                    <i className={epinglee ? "ri-pushpin-fill text-sm" : "ri-pushpin-line text-sm"}></i>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}