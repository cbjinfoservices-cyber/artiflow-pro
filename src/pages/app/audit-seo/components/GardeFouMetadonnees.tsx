import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LIMITES_META,
  resumerMetadonnees,
  valeurCourte,
  verifierMetadonnees,
  type EcartMeta,
} from "@/lib/auditMetadonnees";

/** Libellé lisible de chaque type d'écart. */
const LIBELLE_TYPE: Record<EcartMeta["type"], string> = {
  "doublon-titre": "Titre en double",
  "doublon-description": "Description en double",
  "titre-hors-limite": "Titre trop long",
  "description-hors-plage": "Description hors plage",
};

const ICONE_TYPE: Record<EcartMeta["type"], string> = {
  "doublon-titre": "ri-file-copy-2-line",
  "doublon-description": "ri-file-copy-line",
  "titre-hors-limite": "ri-text-spacing",
  "description-hors-plage": "ri-paragraph",
};

/**
 * Garde-fou des titres et descriptions.
 *
 * Il complète le contrôle des visuels : au lieu de relire chaque ligne à l'œil,
 * il signale les titres trop longs, les descriptions hors de la plage 120–160,
 * et surtout les pages qui partagent le même titre ou la même description —
 * l'erreur la plus fréquente quand on duplique une fiche pour en créer une autre.
 */
export default function GardeFouMetadonnees() {
  const ecarts = useMemo(() => verifierMetadonnees(), []);
  const resume = resumerMetadonnees(ecarts);

  const indicateurs = [
    {
      cle: "doublons-titres",
      icone: "ri-file-copy-2-line",
      valeur: resume.doublonsTitre,
      libelle: "titres partagés par plusieurs pages",
    },
    {
      cle: "doublons-descriptions",
      icone: "ri-file-copy-line",
      valeur: resume.doublonsDescription,
      libelle: "descriptions partagées",
    },
    {
      cle: "hors-limites",
      icone: "ri-text-spacing",
      valeur: resume.horsLimites,
      libelle: "champs hors plage",
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
              Garde-fou des titres et descriptions
            </h3>
            <p className="mt-0.5 text-sm text-foreground-600">
              Compte les caractères de chaque champ et repère les métadonnées recopiées d'une page
              à l'autre. Attendu : titre ≤ {LIMITES_META.titreMax}, description{" "}
              {LIMITES_META.descriptionMin}–{LIMITES_META.descriptionMax}.
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 md:p-5 border-b border-background-200">
        {indicateurs.map((indicateur) => {
          const propre = indicateur.valeur === 0;
          return (
            <div
              key={indicateur.cle}
              className={`flex items-center gap-3 p-3 rounded-md border ${
                propre
                  ? "bg-background-50 border-background-200"
                  : "bg-accent-100/40 border-accent-200"
              }`}
            >
              <span
                className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-sm ${
                  propre ? "bg-secondary-100 text-secondary-700" : "bg-accent-200 text-accent-900"
                }`}
              >
                <i className={propre ? "ri-check-line" : indicateur.icone}></i>
              </span>
              <div className="min-w-0">
                <p className="font-heading font-extrabold text-lg text-foreground-950 tabular-nums leading-none">
                  {indicateur.valeur}
                </p>
                <p className="mt-1 text-[11px] text-foreground-600 leading-snug">
                  {indicateur.libelle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {resume.conforme ? (
        <div className="flex items-center gap-2.5 p-4 md:p-5 bg-secondary-100/50">
          <i className="ri-check-double-line text-secondary-700"></i>
          <p className="text-sm text-secondary-900">
            Tous les titres et descriptions sont dans leur plage, et aucun n'est partagé entre deux
            pages. L'étape 9 de la checklist est vérifiée.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-background-200">
          {ecarts.map((ecart) => (
            <LigneEcartMeta
              key={`${ecart.type}-${ecart.chemins.join("-")}-${ecart.valeur.slice(0, 24)}`}
              ecart={ecart}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Une ligne du garde-fou : nature de l'écart, pages concernées et valeur. */
function LigneEcartMeta({ ecart }: { ecart: EcartMeta }) {
  const bloquant = ecart.gravite === "erreur";
  return (
    <li className="flex flex-col md:flex-row gap-3 p-4 md:px-5">
      <span
        className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-sm ${
          bloquant ? "bg-accent-200 text-accent-900" : "bg-primary-100 text-primary-700"
        }`}
      >
        <i className={ICONE_TYPE[ecart.type]}></i>
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
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
            <i className={ICONE_TYPE[ecart.type]}></i>
            {LIBELLE_TYPE[ecart.type]}
          </span>
        </div>

        <p className="mt-1.5 text-xs text-foreground-600 leading-relaxed">{ecart.message}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {ecart.chemins.map((chemin, index) => (
            <Link
              key={`${chemin}-${index}`}
              to={chemin}
              target="_blank"
              rel="noopener noreferrer"
              title={`Ouvrir ${chemin}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
            >
              <i className="ri-external-link-line"></i>
              <code className="text-[11px]">{chemin}</code>
            </Link>
          ))}
        </div>

        <p className="mt-1.5 text-[11px] text-foreground-500 leading-relaxed">
          <span className="font-semibold text-foreground-700">Valeur :</span>{" "}
          {valeurCourte(ecart.valeur, 130)}
        </p>
      </div>
    </li>
  );
}