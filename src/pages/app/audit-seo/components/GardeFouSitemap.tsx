import { useEffect, useMemo, useState } from "react";
import {
  entreesSitemap,
  genererSitemapXml,
  verifierSitemap,
  type EcartSitemap,
} from "@/lib/sitemap";

/** Contenu du sitemap publié, chargé depuis le site. */
type EtatSitemap =
  | { statut: "chargement" }
  | { statut: "pret"; locs: string[] }
  | { statut: "erreur"; message: string };

/** Extrait les <loc> de premier niveau (les <image:loc> ne matchent pas). */
function extraireLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1].trim());
}

/** Adresse du fichier servi, en tenant compte du chemin de base du projet. */
function urlSitemapPublie(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base.replace(/\/$/, "")}/sitemap.xml`;
}

/**
 * Garde-fou du sitemap.
 *
 * Le fichier `public/sitemap.xml` est statique : il ne se met pas à jour tout
 * seul. Ce contrôle compare son contenu réel à la liste dérivée des données
 * (métiers, villes, guides, parcours, auteurs) et signale toute page présente
 * dans le code mais absente du fichier — le cas qui fait qu'une nouvelle page
 * n'est jamais explorée. Le XML attendu est affiché et copiable, pour aligner
 * le fichier sans le reconstruire à la main.
 */
export default function GardeFouSitemap() {
  const [etat, setEtat] = useState<EtatSitemap>({ statut: "chargement" });
  const [copie, setCopie] = useState(false);

  const xmlAttendu = useMemo(() => genererSitemapXml(), []);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      try {
        const reponse = await fetch(urlSitemapPublie(), {
          headers: { Accept: "application/xml, text/xml, */*" },
        });
        if (!reponse.ok) {
          throw new Error(`le serveur a répondu ${reponse.status}`);
        }
        const texte = await reponse.text();
        if (annule) return;
        const locs = extraireLocs(texte);
        if (locs.length === 0) {
          setEtat({
            statut: "erreur",
            message: "le fichier a été lu mais ne contient aucune URL (<loc>)",
          });
          return;
        }
        setEtat({ statut: "pret", locs });
      } catch (erreur) {
        if (annule) return;
        setEtat({
          statut: "erreur",
          message: erreur instanceof Error ? erreur.message : "lecture impossible",
        });
      }
    };

    charger();
    return () => {
      annule = true;
    };
  }, []);

  const ecarts = useMemo<EcartSitemap[]>(
    () => (etat.statut === "pret" ? verifierSitemap(etat.locs) : []),
    [etat]
  );

  const bloquants = ecarts.filter((ecart) => ecart.gravite === "erreur").length;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(xmlAttendu);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2200);
    } catch {
      setCopie(false);
    }
  };

  return (
    <section className="rounded-lg border border-background-200 bg-background-100 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 md:p-5 border-b border-background-200">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-lg ${
              etat.statut === "erreur" || bloquants > 0
                ? "bg-accent-100 text-accent-900"
                : "bg-secondary-100 text-secondary-700"
            }`}
          >
            <i
              className={
                etat.statut === "erreur" || bloquants > 0
                  ? "ri-shield-cross-line"
                  : "ri-route-line"
              }
            ></i>
          </span>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Garde-fou du sitemap
            </h3>
            <p className="mt-0.5 text-sm text-foreground-600">
              Compare le sitemap réellement servi à la liste construite depuis les données : une
              nouvelle page ne peut plus être oubliée.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
            etat.statut === "erreur" || bloquants > 0
              ? "bg-accent-100 text-accent-900"
              : "bg-secondary-100 text-secondary-800"
          }`}
        >
          <i
            className={
              etat.statut === "erreur" || bloquants > 0 ? "ri-alert-line" : "ri-check-line"
            }
          ></i>
          {etat.statut === "chargement"
            ? "Lecture du fichier…"
            : etat.statut === "erreur"
              ? "Contrôle indisponible"
              : ecarts.length === 0
                ? "Aucun écart"
                : `${ecarts.length} écart${ecarts.length > 1 ? "s" : ""} · ${bloquants} bloquant${
                    bloquants > 1 ? "s" : ""
                  }`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 md:p-5 border-b border-background-200">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap">
          <i className="ri-file-list-3-line"></i>
          {entreesSitemap.length} URL attendues d'après les données
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap">
          <i className="ri-global-line"></i>
          {etat.statut === "pret" ? `${etat.locs.length} URL dans le fichier servi` : "fichier en cours de lecture"}
        </div>
        <a
          href={urlSitemapPublie()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-external-link-line"></i>
          Ouvrir /sitemap.xml
        </a>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={copier}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
          >
            <i className={copie ? "ri-check-line" : "ri-file-copy-2-line"}></i>
            {copie ? "Sitemap copié" : "Copier le sitemap généré"}
          </button>
        </div>
      </div>

      {etat.statut === "chargement" && (
        <div className="flex items-center gap-2.5 p-4 md:p-5">
          <i className="ri-loader-4-line animate-spin text-foreground-500"></i>
          <p className="text-sm text-foreground-600">Lecture du sitemap publié…</p>
        </div>
      )}

      {etat.statut === "erreur" && (
        <div className="flex flex-col gap-1 p-4 md:p-5 bg-accent-100/40">
          <div className="flex items-center gap-2.5">
            <i className="ri-error-warning-line text-accent-900"></i>
            <p className="text-sm font-semibold text-accent-900">
              Impossible de lire le sitemap publié
            </p>
          </div>
          <p className="text-xs text-foreground-600 leading-relaxed pl-6">
            {etat.message}. Le contrôle compare un fichier servi à la liste attendue : sans lecture,
            il ne peut pas trancher. Le XML généré reste disponible via le bouton de copie.
          </p>
        </div>
      )}

      {etat.statut === "pret" &&
        (ecarts.length === 0 ? (
          <div className="flex items-center gap-2.5 p-4 md:p-5 bg-secondary-100/50">
            <i className="ri-check-double-line text-secondary-700"></i>
            <p className="text-sm text-secondary-900">
              Le sitemap servi contient exactement les {entreesSitemap.length} URL attendues, sans
              doublon ni entrée orpheline.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-background-200">
            {ecarts.map((ecart) => (
              <LigneEcartSitemap key={`${ecart.motif}-${ecart.chemin}`} ecart={ecart} />
            ))}
          </ul>
        ))}
    </section>
  );
}

/** Libellé lisible du motif d'écart. */
const LIBELLE_MOTIF: Record<EcartSitemap["motif"], string> = {
  "page-absente": "Page absente du sitemap",
  doublon: "URL en double",
  "entree-inconnue": "Entrée orpheline",
  "page-non-generée": "Page non générée",
};

/** Une ligne du garde-fou : l'URL concernée et ce qu'il faut corriger. */
function LigneEcartSitemap({ ecart }: { ecart: EcartSitemap }) {
  const bloquant = ecart.gravite === "erreur";
  return (
    <li className="flex gap-3 p-4 md:px-5">
      <span
        className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-sm ${
          bloquant ? "bg-accent-200 text-accent-900" : "bg-primary-100 text-primary-700"
        }`}
      >
        <i className={bloquant ? "ri-close-line" : "ri-error-warning-line"}></i>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
              bloquant ? "bg-accent-200 text-accent-900" : "bg-primary-100 text-primary-700"
            }`}
          >
            {LIBELLE_MOTIF[ecart.motif]}
          </span>
          <code className="text-[11px] font-semibold text-foreground-800 break-all">
            {ecart.chemin}
          </code>
        </div>
        <p className="mt-1 text-xs text-foreground-600 leading-relaxed">{ecart.message}</p>
      </div>
    </li>
  );
}