import { Link, useLocation } from "react-router-dom";
import { metiers, metiersSeo } from "@/mocks/metiers";
import { parcours } from "@/mocks/parcours";
import { sujets } from "@/mocks/sujets";
import { articlesRecents, articleDateIso, compterGuidesNouveaux, formatLecture } from "@/mocks/ressources";
import BadgeNouveau from "@/components/base/BadgeNouveau";
import ThemesFavorisBande from "@/components/feature/ThemesFavorisBande";

/** Icône associée à chaque corps de métier, réutilisée dans le déroulant « Métiers ». */
export const metierIcons: Record<string, string> = {
  "plombier-chauffagiste": "ri-water-flash-line",
  electricien: "ri-flashlight-line",
  macon: "ri-building-2-line",
  "peintre-finitions": "ri-paint-brush-line",
  menuisier: "ri-hammer-line",
  carreleur: "ri-layout-grid-line",
  couvreur: "ri-home-4-line",
  platrier: "ri-layout-2-line",
  "installateur-climatisation": "ri-temp-cold-line",
  "installateur-photovoltaique": "ri-sun-line",
};

const metierShortBySlug = new Map(metiers.map((m) => [m.slug, m.shortName]));

/** Nombre de guides récemment publiés, affiché en tête de la colonne « Guides récents ». */
const nbNouveauxGuides = compterGuidesNouveaux();

/** Métier actuellement affiché, déduit de l'URL (« /metiers/:slug »). */
function metierCourant(pathname: string): string {
  const prefixe = "/metiers/";
  return pathname.startsWith(prefixe) ? pathname.slice(prefixe.length).split("/")[0] : "";
}

/**
 * Contenu du déroulant « Métiers » (desktop) : les corps de métier en deux
 * colonnes, avec le métier courant mis en évidence (pastille remplie + coche).
 */
export function MetiersMenuContent({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const courant = metierCourant(pathname);

  return (
    <>
      <div className="grid grid-cols-2 gap-1">
        {metiers.map((m) => {
          const actif = courant === m.slug;
          return (
            <Link
              key={m.slug}
              to={`/metiers/${m.slug}`}
              onClick={onNavigate}
              aria-current={actif ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                actif ? "bg-primary-100 ring-1 ring-primary-200" : "hover:bg-background-100"
              }`}
            >
              <span
                className={`w-9 h-9 flex items-center justify-center rounded-lg shrink-0 ${
                  actif ? "bg-primary-500 text-background-50" : "bg-primary-100 text-primary-700"
                }`}
              >
                <i className={`${metierIcons[m.slug] ?? "ri-tools-line"} text-lg`}></i>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground-950 truncate">{m.name}</span>
                <span className="block text-[11px] text-foreground-500 truncate">
                  {metiersSeo[m.slug as keyof typeof metiersSeo]}
                </span>
              </span>
              {actif && <i className="ri-check-line ml-auto text-primary-600 text-base"></i>}
            </Link>
          );
        })}
      </div>
      <div className="mt-1 pt-1 border-t border-background-200 flex flex-col gap-1">
        <Link
          to="/metiers"
          onClick={onNavigate}
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-background-100/70 hover:bg-background-200 text-sm font-semibold text-foreground-900 cursor-pointer"
        >
          <span>Voir tous les métiers</span>
          <i className="ri-arrow-right-line"></i>
        </Link>
        <Link
          to="/zones-intervention"
          onClick={onNavigate}
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-background-100/70 hover:bg-background-200 text-sm font-semibold text-foreground-900 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <i className="ri-map-2-line text-secondary-600"></i>
            Zones d'intervention
          </span>
          <i className="ri-arrow-right-line"></i>
        </Link>
      </div>
    </>
  );
}

/**
 * Contenu du déroulant « Ressources » (desktop) : guides récents, parcours
 * guidés et thèmes, sur le même modèle que le déroulant « Métiers ».
 */
export function RessourcesMenuContent({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      {/* Thèmes épinglés + plus consultés, mis en favori en tête du déroulant */}
      <ThemesFavorisBande onNavigate={onNavigate} themesSupplementaires={["securite-du-compte"]} />

      <div className="grid grid-cols-3 gap-1">
        {/* Guides récents */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 px-2 pt-1 pb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
              Guides récents
            </span>
            {nbNouveauxGuides > 0 && (
              <span
                className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums"
                title={`${nbNouveauxGuides} nouvelles ressources publiées récemment`}
                aria-label={`${nbNouveauxGuides} nouvelles ressources`}
              >
                <i className="ri-sparkling-2-line text-[10px]"></i>
                {nbNouveauxGuides}
              </span>
            )}
          </div>
          {articlesRecents.map((a) => (
            <Link
              key={a.slug}
              to={`/ressources/${a.slug}`}
              onClick={onNavigate}
              className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-background-100 cursor-pointer"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 shrink-0">
                <i className="ri-article-line text-base"></i>
              </span>
              <span className="min-w-0">
                <span className="flex items-start gap-1.5">
                  <span className="block text-sm font-medium text-foreground-950 leading-snug line-clamp-2">
                    {a.title}
                  </span>
                  <BadgeNouveau dateISO={articleDateIso(a)} compact className="mt-0.5 shrink-0" />
                </span>
                <span className="mt-0.5 block text-[11px] text-foreground-500">
                  {metierShortBySlug.get(a.category) ?? a.category} · {formatLecture(a)}
                </span>
              </span>
            </Link>
          ))}
          <Link
            to="/ressources"
            onClick={onNavigate}
            className="mt-0.5 flex items-center gap-1.5 px-2 py-2 rounded-xl text-sm font-semibold text-primary-700 hover:bg-background-100 cursor-pointer"
          >
            Tous les guides
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>

        {/* Parcours guidés */}
        <div className="flex flex-col gap-0.5">
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
            Parcours guidés
          </p>
          {parcours.map((p) => (
            <Link
              key={p.slug}
              to={`/ressources/parcours/${p.slug}`}
              onClick={onNavigate}
              className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-background-100 cursor-pointer"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 shrink-0">
                <i className={`${p.icon} text-base`}></i>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground-950 leading-snug">{p.name}</span>
                <span className="mt-0.5 block text-[11px] text-foreground-500">
                  {p.niveau} · {p.articleSlugs.length} guides
                </span>
              </span>
            </Link>
          ))}
        </div>

        {/* Thèmes / sujets */}
        <div className="flex flex-col gap-0.5">
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
            Explorer par thème
          </p>
          {sujets.map((s) => (
            <Link
              key={s.slug}
              to={`/ressources/sujets#sujet-${s.slug}`}
              onClick={onNavigate}
              className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-background-100 cursor-pointer"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 shrink-0">
                <i className={`${s.icon} text-base`}></i>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground-950 leading-snug">{s.name}</span>
                <span className="mt-0.5 block text-[11px] text-foreground-500">
                  {s.articleSlugs.length} guides
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-1 pt-1 border-t border-background-200">
        <Link
          to="/ressources"
          onClick={onNavigate}
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-background-100/70 hover:bg-background-200 text-sm font-semibold text-foreground-900 cursor-pointer"
        >
          <span>Centre de ressources</span>
          <i className="ri-arrow-right-line"></i>
        </Link>
      </div>
    </>
  );
}

/** Liste dépliable « Métiers » du menu mobile, avec le métier courant mis en évidence. */
export function MetiersMobileLinks({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const courant = metierCourant(pathname);

  return (
    <>
      {metiers.map((m) => {
        const actif = courant === m.slug;
        return (
          <Link
            key={m.slug}
            to={`/metiers/${m.slug}`}
            onClick={onNavigate}
            aria-current={actif ? "page" : undefined}
            className={`flex items-center gap-3 h-10 px-3 rounded-full text-sm cursor-pointer ${
              actif
                ? "bg-primary-100 text-primary-800 font-semibold"
                : "text-foreground-600 hover:bg-background-50 hover:text-foreground-950"
            }`}
          >
            <span
              className={`w-7 h-7 flex items-center justify-center rounded-full shrink-0 ${
                actif ? "bg-primary-500 text-background-50" : "bg-primary-100 text-primary-700"
              }`}
            >
              <i className={`${metierIcons[m.slug] ?? "ri-tools-line"} text-sm`}></i>
            </span>
            <span className="flex-1 truncate">{m.name}</span>
            {actif && <i className="ri-check-line text-primary-600"></i>}
          </Link>
        );
      })}
      <Link
        to="/metiers"
        onClick={onNavigate}
        className="flex items-center gap-2 h-10 px-3 rounded-full text-sm font-semibold text-primary-700 hover:bg-background-50 cursor-pointer"
      >
        Voir tous les métiers
        <i className="ri-arrow-right-line"></i>
      </Link>
      <Link
        to="/zones-intervention"
        onClick={onNavigate}
        className="flex items-center gap-2 h-10 px-3 rounded-full text-sm font-semibold text-primary-700 hover:bg-background-50 cursor-pointer"
      >
        <i className="ri-map-2-line"></i>
        Zones d'intervention
      </Link>
    </>
  );
}

/** Liste dépliable « Ressources » du menu mobile. */
export function RessourcesMobileLinks({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      {/* Thèmes épinglés + plus consultés, mis en favori en tête de la liste */}
      <ThemesFavorisBande onNavigate={onNavigate} themesSupplementaires={["securite-du-compte"]} />

      {parcours.map((p) => (
        <Link
          key={p.slug}
          to={`/ressources/parcours/${p.slug}`}
          onClick={onNavigate}
          className="flex items-center gap-3 h-10 px-3 rounded-full text-sm text-foreground-600 hover:bg-background-50 hover:text-foreground-950 cursor-pointer"
        >
          <span className="w-7 h-7 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 shrink-0">
            <i className={`${p.icon} text-sm`}></i>
          </span>
          <span className="flex-1 truncate">{p.name}</span>
        </Link>
      ))}
      {sujets.map((s) => (
        <Link
          key={s.slug}
          to={`/ressources/sujets#sujet-${s.slug}`}
          onClick={onNavigate}
          className="flex items-center gap-3 h-10 px-3 rounded-full text-sm text-foreground-600 hover:bg-background-50 hover:text-foreground-950 cursor-pointer"
        >
          <span className="w-7 h-7 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 shrink-0">
            <i className={`${s.icon} text-sm`}></i>
          </span>
          <span className="flex-1 truncate">{s.name}</span>
        </Link>
      ))}
      <Link
        to="/ressources"
        onClick={onNavigate}
        className="flex items-center gap-2 h-10 px-3 rounded-full text-sm font-semibold text-primary-700 hover:bg-background-50 cursor-pointer"
      >
        Tous les guides
        <i className="ri-arrow-right-line"></i>
      </Link>
    </>
  );
}