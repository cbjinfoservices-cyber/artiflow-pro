import { useMemo } from "react";
import { IMAGE_PARTAGE_SITE } from "@/hooks/usePageMeta";
import {
  IMAGE_HEAD_INDEX,
  IMAGE_SITEMAP_ACCUEIL,
  resumerEcarts,
  urlCourte,
  verifierImagesPartage,
  type EcartImage,
} from "@/lib/auditImagesPartage";

/** Une déclaration de l'image du site, comparée à l'image réellement servie. */
type Declaration = {
  cle: string;
  emplacement: string;
  url: string;
  gravite: "erreur" | "alerte";
};

/**
 * Garde-fou des visuels de partage.
 *
 * Il signale toute page — et toute déclaration du site — dont l'image diffère
 * de celle réellement servie aux robots sociaux. L'objectif est d'attraper un
 * désalignement silencieux avant publication, pas de refaire l'audit page par
 * page affiché juste en dessous.
 */
export default function GardeFouVisuels() {
  const ecarts = useMemo(() => verifierImagesPartage(), []);
  const resume = resumerEcarts(ecarts);

  const declarations: Declaration[] = [
    {
      cle: "entete",
      emplacement: "index.html · og:image",
      url: IMAGE_HEAD_INDEX,
      gravite: "erreur",
    },
    {
      cle: "routeur",
      emplacement: "usePageMeta · image de repli",
      url: IMAGE_PARTAGE_SITE,
      gravite: "erreur",
    },
    {
      cle: "sitemap",
      emplacement: "sitemap.xml · accueil",
      url: IMAGE_SITEMAP_ACCUEIL,
      gravite: "alerte",
    },
  ];

  return (
    <section className="rounded-lg border border-background-200 bg-background-100 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 md:p-5 border-b border-background-200">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-lg ${
              resume.conforme
                ? "bg-secondary-100 text-secondary-700"
                : "bg-accent-100 text-accent-900"
            }`}
          >
            <i className={resume.conforme ? "ri-shield-check-line" : "ri-shield-cross-line"}></i>
          </span>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Garde-fou des visuels de partage
            </h3>
            <p className="mt-0.5 text-sm text-foreground-600">
              Compare l'image déclarée par chaque page à celle réellement servie aux robots
              sociaux.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
            resume.conforme
              ? "bg-secondary-100 text-secondary-800"
              : "bg-accent-100 text-accent-900"
          }`}
        >
          <i className={resume.conforme ? "ri-check-line" : "ri-alert-line"}></i>
          {resume.conforme
            ? "Aucun écart"
            : `${resume.total} écart${resume.total > 1 ? "s" : ""} · ${resume.erreurs} bloquant${
                resume.erreurs > 1 ? "s" : ""
              }`}
        </span>
      </div>

      <div className="p-4 md:p-5 border-b border-background-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">
          Image servie · celle des Réglages SEO
        </p>
        <div className="mt-3 flex flex-col lg:flex-row gap-3">
          <div className="w-full lg:w-[220px] shrink-0 aspect-[1.91/1] rounded-md overflow-hidden border border-background-200 bg-background-50">
            <img
              src={IMAGE_PARTAGE_SITE}
              alt="Image de partage réellement servie par le site"
              title="Image de partage servie par le site"
              className="w-full h-full object-cover object-top"
            />
          </div>
          <ul className="flex-1 min-w-0 flex flex-col gap-2">
            {declarations.map((declaration) => {
              const alignee = declaration.url === IMAGE_PARTAGE_SITE;
              return (
                <li
                  key={declaration.cle}
                  className={`flex items-start gap-2.5 p-2.5 rounded-md border ${
                    alignee
                      ? "bg-background-50 border-background-200"
                      : "bg-accent-100/40 border-accent-200"
                  }`}
                >
                  <span
                    className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-xs ${
                      alignee
                        ? "bg-secondary-100 text-secondary-700"
                        : "bg-accent-200 text-accent-900"
                    }`}
                  >
                    <i className={alignee ? "ri-check-line" : "ri-close-line"}></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground-900">
                      {declaration.emplacement}
                    </p>
                    <p className="mt-0.5 text-[11px] text-foreground-500 break-all">
                      {alignee ? "aligné sur l'image servie" : urlCourte(declaration.url, 64)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {resume.conforme ? (
        <div className="flex items-center gap-2.5 p-4 md:p-5 bg-secondary-100/50">
          <i className="ri-check-double-line text-secondary-700"></i>
          <p className="text-sm text-secondary-900">
            Toutes les pages annoncent l'image réellement servie : aucun aperçu ne peut
            diverger du code.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-background-200">
          {ecarts.map((ecart) => (
            <LigneEcart key={`${ecart.motif}-${ecart.chemin}-${ecart.declaree}`} ecart={ecart} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Une ligne du garde-fou : où, quoi, et ce qui était attendu. */
function LigneEcart({ ecart }: { ecart: EcartImage }) {
  const bloquant = ecart.gravite === "erreur";
  return (
    <li className="flex flex-col md:flex-row gap-3 p-4 md:px-5">
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
            {bloquant ? "Bloquant" : "À vérifier"}
          </span>
          <code className="text-[11px] font-semibold text-foreground-800 break-all">
            {ecart.chemin}
          </code>
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground-950">{ecart.libelle}</p>
        <p className="mt-1 text-xs text-foreground-600 leading-relaxed">{ecart.message}</p>
        <p className="mt-1.5 text-[11px] text-foreground-500 break-all">
          <span className="font-semibold text-foreground-700">Déclarée :</span>{" "}
          {urlCourte(ecart.declaree, 72)}
        </p>
        <p className="text-[11px] text-foreground-500 break-all">
          <span className="font-semibold text-foreground-700">Attendue :</span>{" "}
          {urlCourte(ecart.attendue, 72)}
        </p>
      </div>
    </li>
  );
}