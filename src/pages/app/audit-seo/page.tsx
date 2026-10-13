import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  GROUPES_AUDIT,
  LIBELLE_SOURCE,
  estGenerique,
  sansVisuelDedie,
  pagesPubliques,
  type EntreeAudit,
  type GroupeAudit,
  type SourceVisuel,
} from "@/lib/auditSeo";
import ApercuPartageCard, {
  RESEAUX_APERCU,
  type ReseauApercu,
} from "@/pages/app/audit-seo/components/ApercuPartageCard";

type FiltreGroupe = "tous" | GroupeAudit;

/** Style de la pastille indiquant l'origine du visuel de partage. */
const STYLE_SOURCE: Record<SourceVisuel, string> = {
  dedie: "bg-secondary-100 text-secondary-800",
  generique: "bg-accent-100 text-accent-900",
  photo: "bg-primary-100 text-primary-700",
  heros: "bg-background-100 text-foreground-700 border border-background-200",
};

const ICONE_SOURCE: Record<SourceVisuel, string> = {
  dedie: "ri-image-2-line",
  generique: "ri-error-warning-line",
  photo: "ri-user-line",
  heros: "ri-landscape-line",
};

/**
 * Panneau interne d'audit SEO : liste, pour chaque page publique, son titre, sa
 * description et son visuel de partage, afin de repérer d'un coup d'œil les pages
 * qui retombent sur l'image générique du site. Réservé aux gestionnaires.
 */
export default function AppAuditSeo() {
  usePageMeta(
    "Audit SEO · ArtiFlow-pro",
    "Audit interne des métadonnées SEO des pages publiques : titre, description et visuel de partage, pour repérer les pages à compléter.",
  );

  const [groupe, setGroupe] = useState<FiltreGroupe>("tous");
  const [manquesSeulement, setManquesSeulement] = useState(false);
  const [reseau, setReseau] = useState<ReseauApercu>("linkedin");

  const totalGeneriques = useMemo(() => pagesPubliques.filter(estGenerique).length, []);
  const totalDedies = useMemo(
    () => pagesPubliques.filter((p) => p.source === "dedie").length,
    []
  );

  const comptesParGroupe = useMemo(() => {
    const map = new Map<GroupeAudit, number>();
    pagesPubliques.forEach((p) => map.set(p.group, (map.get(p.group) ?? 0) + 1));
    return map;
  }, []);

  const liste = useMemo(
    () =>
      pagesPubliques.filter((p) => {
        if (groupe !== "tous" && p.group !== groupe) return false;
        if (manquesSeulement && !sansVisuelDedie(p)) return false;
        return true;
      }),
    [groupe, manquesSeulement]
  );

  const totalManquesAffiches = liste.filter(sansVisuelDedie).length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
            <i className="ri-search-eye-line text-2xl"></i>
          </span>
          <div>
            <h2 className="font-heading font-bold text-xl text-foreground-950">Audit SEO des pages publiques</h2>
            <p className="text-sm text-foreground-500">
              Titre, description et visuel de partage de chaque page — repérez les visuels manquants d'un coup d'œil.
            </p>
          </div>
        </div>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="p-4 md:p-5 rounded-lg bg-background-100 border border-background-200">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-lg">
            <i className="ri-pages-line"></i>
          </span>
          <p className="mt-3 font-heading font-extrabold text-2xl text-foreground-950 tabular-nums">
            {pagesPubliques.length}
          </p>
          <p className="text-xs text-foreground-600">pages publiques auditées</p>
        </div>
        <div className="p-4 md:p-5 rounded-lg bg-background-100 border border-background-200">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-lg">
            <i className="ri-image-2-line"></i>
          </span>
          <p className="mt-3 font-heading font-extrabold text-2xl text-foreground-950 tabular-nums">
            {totalDedies}
          </p>
          <p className="text-xs text-foreground-600">avec un visuel de partage dédié</p>
        </div>
        <div className="p-4 md:p-5 rounded-lg bg-background-100 border border-background-200">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-accent-100 text-accent-800 text-lg">
            <i className="ri-error-warning-line"></i>
          </span>
          <p className="mt-3 font-heading font-extrabold text-2xl text-foreground-950 tabular-nums">
            {totalGeneriques}
          </p>
          <p className="text-xs text-foreground-600">sur l'image générique (à compléter)</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mr-1">Groupe</span>
          <button
            type="button"
            onClick={() => setGroupe("tous")}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
              groupe === "tous"
                ? "bg-foreground-950 text-background-50 border-foreground-950"
                : "bg-background-50 text-foreground-700 border-background-200 hover:border-primary-300"
            }`}
          >
            Tous
            <span className={groupe === "tous" ? "text-background-200" : "text-foreground-400"}>
              {pagesPubliques.length}
            </span>
          </button>
          {GROUPES_AUDIT.map((g) => {
            const actif = groupe === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGroupe(g)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                  actif
                    ? "bg-foreground-950 text-background-50 border-foreground-950"
                    : "bg-background-50 text-foreground-700 border-background-200 hover:border-primary-300"
                }`}
              >
                {g}
                <span className={actif ? "text-background-200" : "text-foreground-400"}>
                  {comptesParGroupe.get(g) ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={manquesSeulement}
              onChange={(e) => setManquesSeulement(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-accent-600"
            />
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-700">
              <i className="ri-error-warning-line text-accent-700"></i>
              Afficher uniquement les pages sans visuel dédié
            </span>
          </label>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-600 whitespace-nowrap">
            <i className="ri-list-check-2"></i>
            {liste.length} page{liste.length > 1 ? "s" : ""}
            {totalManquesAffiches > 0 && ` · ${totalManquesAffiches} manque${totalManquesAffiches > 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-background-200">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 uppercase tracking-wide mr-1">
            <i className="ri-share-line"></i>
            Aperçu du partage
          </span>
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200">
            {RESEAUX_APERCU.map((r) => {
              const actif = reseau === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setReseau(r.key)}
                  aria-pressed={actif}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-foreground-950 text-background-50"
                      : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  <i className={r.icon}></i>
                  {r.label}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-foreground-500">
            Chaque carte simule le lien tel qu'il apparaîtrait sur {RESEAUX_APERCU.find((r) => r.key === reseau)?.label}.
          </span>
        </div>
      </div>

      {/* Liste */}
      {liste.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 rounded-lg border border-dashed border-background-300 bg-background-50">
          <span className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-2xl">
            <i className="ri-check-double-line"></i>
          </span>
          <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
            Aucun manque à signaler ici
          </h3>
          <p className="mt-2 text-sm text-foreground-600 max-w-md">
            Toutes les pages de ce filtre disposent d'un visuel de partage dédié.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {liste.map((entree) => (
            <LigneAudit key={entree.path} entree={entree} reseau={reseau} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Une ligne d'audit : métadonnées de la page et aperçu de son partage social. */
function LigneAudit({ entree, reseau }: { entree: EntreeAudit; reseau: ReseauApercu }) {
  const manque = entree.source === "generique";
  return (
    <article
      className={`flex flex-col md:flex-row gap-4 p-4 rounded-lg border ${
        manque ? "bg-accent-100/40 border-accent-200" : "bg-background-100 border-background-200"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${STYLE_SOURCE[entree.source]}`}
          >
            <i className={ICONE_SOURCE[entree.source]}></i>
            {LIBELLE_SOURCE[entree.source]}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
            <i className="ri-folder-line"></i>
            {entree.group}
          </span>
          <Link
            to={entree.path}
            target="_blank"
            rel="noopener noreferrer"
            title={`Ouvrir ${entree.path}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
          >
            <i className="ri-external-link-line"></i>
            <code className="text-[11px]">{entree.path}</code>
          </Link>
        </div>

        <h3 className="mt-2.5 font-heading font-semibold text-sm md:text-base text-foreground-950">
          {entree.title}
        </h3>
        <p className="mt-1.5 text-xs md:text-sm text-foreground-600 leading-relaxed">
          {entree.description}
        </p>
        <p className="mt-2 text-[11px] text-foreground-400">
          <i className="ri-price-tag-3-line mr-1"></i>
          {entree.label}
        </p>
      </div>

      <div className="w-full md:w-[320px] shrink-0">
        <ApercuPartageCard entree={entree} reseau={reseau} />
        <p className="mt-1.5 text-[11px] text-center text-foreground-500">
          <i className="ri-image-2-line mr-1"></i>
          {entree.source === "generique" ? "Image générique du site" : LIBELLE_SOURCE[entree.source]}
        </p>
      </div>
    </article>
  );
}