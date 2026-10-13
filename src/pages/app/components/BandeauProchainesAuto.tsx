import { useState } from "react";
import { Link } from "react-router-dom";
import { libelleDans, type CategorieAuto, type ExecutionImminente } from "@/lib/envoisAutomatiques";
import { jouerSonEpingle } from "@/lib/sonInterface";
import {
  ecrireFiltreMemorise,
  ecrireLibelleFiltre,
  ecrireOptionFiltreActive,
  enregistrerConsultation,
  enregistrerSurvol,
  LIBELLE_FILTRE_DEFAUT,
  lireConsultations,
  lireFiltreMemorise,
  lireFiltrePlusConsulte,
  lireLibelleFiltre,
  lireOptionFiltreActive,
  reinitialiserConsultations,
  type FiltreBandeau,
} from "@/lib/bandeauFiltreMemoire";
import Modal from "@/pages/app/components/Modal";

/** Métadonnées d'affichage pour chaque type de traitement. */
const TYPES: Record<CategorieAuto, { titre: string; icone: string }> = {
  recap: { titre: "Récaps", icone: "ri-mail-line" },
  automatisation: { titre: "Automatisations", icone: "ri-flashlight-line" },
};

/**
 * Bandeau de rappel chronologique affiché dans le menu : il n'apparaît que lorsqu'une
 * automatisation ou un récap va s'exécuter dans la fenêtre d'alerte réglée (15 / 30 / 60 min). Il met en avant chaque exécution
 * (nom + compte à rebours), résume le nombre de traitements groupés dans l'heure et, dès qu'il
 * y en a plusieurs, les range en deux blocs « Récaps » et « Automatisations ». Chaque ligne
 * ouvre directement la carte de l'automatisation concernée (via son ancre). Trois raccourcis :
 * un bouton « Copier » pour la liste complète, un bouton « Copier seulement les récaps » qui
 * réutilise le filtre actif, un filtre « Tout / Récaps / Automatisations » et une option pour
 * mémoriser le filtre choisi entre deux connexions.
 */
export default function BandeauProchainesAuto({
  executions,
  fenetreMin = 60,
}: {
  executions: ExecutionImminente[];
  /** Fenêtre d'alerte réglée (15 / 30 / 60 min) : ajuste les libellés « dans l'heure ». */
  fenetreMin?: number;
}) {
  // Le filtre d'affichage et l'option « mémoriser » sont restaurés au chargement si l'utilisateur
  // les a activés lors d'une visite précédente.
  const [memoire, setMemoire] = useState<boolean>(() => lireOptionFiltreActive());
  const [filtre, setFiltre] = useState<FiltreBandeau>(() => {
    if (!lireOptionFiltreActive()) return "tout";
    // On rouvre sur le filtre le plus consulté (celui choisi le plus souvent), sinon sur le
    // dernier filtre mémorisé.
    return lireFiltrePlusConsulte() ?? lireFiltreMemorise();
  });
  // Libellé personnalisé de la pastille « filtre mémorisé », pour le retrouver plus vite.
  const [libelle, setLibelle] = useState<string>(() => lireLibelleFiltre());
  const [renommage, setRenommage] = useState(false);
  const [libelleDraft, setLibelleDraft] = useState("");
  const [copie, setCopie] = useState(false);
  const [copieRecaps, setCopieRecaps] = useState(false);
  // Récap des consultations par filtre (nombre de fois où chaque filtre a été choisi).
  const [consultations, setConsultations] = useState<Record<FiltreBandeau, number>>(() => lireConsultations());

  if (executions.length === 0) return null;

  // Libellés de la fenêtre d'alerte, pour rester raccord avec le réglage de la cloche.
  const fenetreTxt = fenetreMin >= 60 ? "dans l'heure" : `dans les ${fenetreMin} min`;
  const fenetreCourt = fenetreMin >= 60 ? "moins d'une heure" : `moins de ${fenetreMin} min`;

  const nbRecap = executions.filter((e) => e.item.categorie === "recap").length;
  const nbAuto = executions.filter((e) => e.item.categorie === "automatisation").length;
  const plusieurs = executions.length > 1;
  // Le filtre n'a de sens que si les deux familles sont représentées dans l'heure.
  const filtrable = nbRecap > 0 && nbAuto > 0;
  // Le type filtré peut disparaître entre deux rafraîchissements : on retombe alors sur « tout ».
  const filtreActif: FiltreBandeau =
    filtre !== "tout" && !(filtre === "recap" ? nbRecap > 0 : nbAuto > 0) ? "tout" : filtre;

  const liste = filtreActif === "tout" ? executions : executions.filter((e) => e.item.categorie === filtreActif);
  // Récaps présents dans la vue active : sert au bouton « Copier seulement les récaps ».
  const recapsAffiches = liste.filter((e) => e.item.categorie === "recap");
  // Regroupement par type uniquement quand plusieurs traitements tombent dans l'heure (vue « tout »).
  const groupe = filtreActif === "tout" && liste.length > 1;

  const detail = executions.map((e) => `${e.item.nom} — ${libelleDans(e.dansMs)}`).join("\n");

  /** Construit le texte prêt à coller pour une liste d'exécutions donnée. */
  const construireTexte = (items: ExecutionImminente[]) =>
    [
      `ArtiFlow-pro — prochaines exécutions automatiques (${fenetreCourt}) :`,
      ...items.map((e) => `• ${e.item.nom} — ${libelleDans(e.dansMs)}`),
    ].join("\n");

  const textePartage = construireTexte(executions);

  /** Copie un texte dans le presse-papier avec le petit son et la confirmation visuelle. */
  const copierTexte = async (texte: string, setEtat: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(texte);
      jouerSonEpingle();
      setEtat(true);
      window.setTimeout(() => setEtat(false), 1800);
    } catch {
      setEtat(false);
    }
  };

  const handleCopier = () => copierTexte(textePartage, setCopie);

  // Bouton « Copier seulement les récaps » : il part de la vue active (filtre) et n'en garde
  // que les récapitulatifs, pour envoyer à l'équipe une liste ciblée en un clic.
  const handleCopierRecaps = () => copierTexte(construireTexte(recapsAffiches), setCopieRecaps);

  /** Change le filtre et, si l'option est active, mémorise le choix pour la prochaine visite. */
  const choisirFiltre = (valeur: FiltreBandeau) => {
    setFiltre(valeur);
    // Chaque choix alimente le compteur : c'est lui qui définit le « filtre le plus consulté ».
    enregistrerConsultation(valeur);
    setConsultations(lireConsultations());
    if (memoire) ecrireFiltreMemorise(valeur);
  };

  /** Remet à zéro les compteurs de consultation (le filtre le plus consulté repart de zéro). */
  const reinitialiserCompteurs = () => {
    reinitialiserConsultations();
    setConsultations(lireConsultations());
  };

  /** Active ou coupe la mémorisation du filtre (et enregistre le choix courant à l'activation). */
  const basculerMemoire = () => {
    const suivant = !memoire;
    setMemoire(suivant);
    ecrireOptionFiltreActive(suivant);
    if (suivant) ecrireFiltreMemorise(filtreActif);
    else setLibelle("");
  };

  /** Ouvre la petite fenêtre de renommage du filtre mémorisé. */
  const ouvrirRenommage = () => {
    setLibelleDraft(libelle);
    setRenommage(true);
  };

  /** Enregistre le nouveau libellé du filtre mémorisé (vide = libellé par défaut). */
  const validerRenommage = () => {
    ecrireLibelleFiltre(libelleDraft);
    setLibelle(libelleDraft.trim().slice(0, 24));
    setRenommage(false);
  };

  const groupes: { type: CategorieAuto; items: ExecutionImminente[] }[] = [
    { type: "recap", items: liste.filter((e) => e.item.categorie === "recap") },
    { type: "automatisation", items: liste.filter((e) => e.item.categorie === "automatisation") },
  ].filter((g) => g.items.length > 0);

  const options: { valeur: FiltreBandeau; label: string }[] = [
    { valeur: "tout", label: `Tout · ${executions.length}` },
    { valeur: "recap", label: `Récaps · ${nbRecap}` },
    { valeur: "automatisation", label: `Autos · ${nbAuto}` },
  ];

  // Récap des consultations : on met en avant le ou les filtres les plus consultés (étoile).
  const maxConsult = Math.max(consultations.tout, consultations.recap, consultations.automatisation);
  const totauxConsult = consultations.tout + consultations.recap + consultations.automatisation;
  const recapConsult: { valeur: FiltreBandeau; label: string; n: number }[] = [
    { valeur: "tout", label: "Tout", n: consultations.tout },
    { valeur: "recap", label: "Récaps", n: consultations.recap },
    { valeur: "automatisation", label: "Autos", n: consultations.automatisation },
  ];

  const rendreLigne = (e: ExecutionImminente) => (
    <li key={e.item.id}>
      <Link
        to={`/app/envois-automatiques#auto-${e.item.id}`}
        title={`Ouvrir la carte « ${e.item.nom} »`}
        className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent-200 cursor-pointer transition-colors"
      >
        <span className="w-5 h-5 shrink-0 flex items-center justify-center text-accent-700 text-sm">
          <i className={e.item.icone}></i>
        </span>
        <span className="min-w-0 flex-1 text-[11px] font-semibold text-foreground-900 truncate">
          {e.item.nom}
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-foreground-600 whitespace-nowrap">
          {libelleDans(e.dansMs)}
        </span>
        <i className="ri-arrow-right-s-line text-foreground-400 text-sm shrink-0 group-hover:text-accent-700 transition-colors"></i>
      </Link>
    </li>
  );

  return (
    <div
      className="mx-3 mt-3 rounded-lg bg-accent-100 border border-accent-200 overflow-hidden"
      title={`Exécutions prévues ${fenetreTxt} :\n${detail}`}
    >
      <div className="flex items-start gap-2.5 px-3 pt-2.5 pb-1.5">
        <span className="relative w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-accent-500 text-background-50">
          <i className="ri-timer-flash-line"></i>
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary-500 ring-2 ring-accent-100 animate-pulse"
            aria-hidden="true"
          ></span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent-800">
            Prochaines exécutions
          </span>
          {plusieurs && (
            <span
              className="mt-1 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap"
              title={`${executions.length} traitements programmés ${fenetreTxt}`}
            >
              <i className="ri-stack-line text-[11px]"></i>
              {executions.length} traitements {fenetreTxt}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleCopier}
          title="Copier la liste des exécutions à venir pour l'envoyer à votre équipe"
          aria-label="Copier la liste des prochaines exécutions"
          className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-md bg-background-50 border border-accent-200 text-accent-800 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
        >
          <i className={copie ? "ri-check-line" : "ri-file-copy-line"}></i>
          {copie ? "Copié !" : "Copier"}
        </button>
      </div>

      {filtrable && (
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
          {options.map((opt) => {
            const actif = filtreActif === opt.valeur;
            return (
              <button
                key={opt.valeur}
                type="button"
                onClick={() => choisirFiltre(opt.valeur)}
                onMouseEnter={() => enregistrerSurvol(opt.valeur)}
                aria-pressed={actif}
                title={`Afficher : ${opt.label}`}
                className={`inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  actif
                    ? "bg-accent-500 border-accent-500 text-background-50"
                    : "bg-background-50 border-accent-200 text-accent-800 hover:bg-accent-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          <span className="ml-auto inline-flex items-center gap-1">
            <button
              type="button"
              onClick={basculerMemoire}
              aria-pressed={memoire}
              title={
                memoire
                  ? "Filtre mémorisé entre deux connexions — cliquer pour ne plus le retenir"
                  : "Mémoriser le dernier filtre choisi entre deux connexions"
              }
              aria-label="Mémoriser le dernier filtre choisi"
              className={`inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                memoire
                  ? "bg-secondary-500 border-secondary-500 text-background-50"
                  : "bg-background-50 border-accent-200 text-accent-800 hover:bg-accent-200"
              }`}
            >
              <i className={memoire ? "ri-bookmark-fill text-[10px]" : "ri-bookmark-line text-[10px]"}></i>
              {memoire ? libelle || LIBELLE_FILTRE_DEFAUT : "Mémoriser le filtre"}
            </button>
            {memoire && (
              <button
                type="button"
                onClick={ouvrirRenommage}
                title="Renommer le filtre mémorisé pour le retrouver plus vite"
                aria-label="Renommer le filtre mémorisé"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-secondary-200 bg-background-50 text-secondary-700 cursor-pointer hover:bg-secondary-100 transition-colors"
              >
                <i className="ri-edit-line text-[10px]"></i>
              </button>
            )}
          </span>
        </div>
      )}

      {filtrable && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-accent-800">
            <i className="ri-bar-chart-2-line"></i>
            Consultations
          </span>
          <span className="flex flex-wrap items-center gap-2 text-[10px] text-accent-700">
            {recapConsult.map((c) => {
              const plus = maxConsult > 0 && c.n === maxConsult;
              return (
                <span key={c.valeur} className="inline-flex items-center gap-0.5 whitespace-nowrap">
                  {c.label}
                  <strong className="tabular-nums text-accent-900">{c.n}</strong>
                  {plus && (
                    <i
                      className="ri-star-fill text-[8px] text-secondary-500"
                      title="Filtre le plus consulté"
                    ></i>
                  )}
                </span>
              );
            })}
          </span>
          {totauxConsult > 0 && (
            <button
              type="button"
              onClick={reinitialiserCompteurs}
              title="Réinitialiser les compteurs de consultation (le filtre le plus consulté repart de zéro)"
              aria-label="Réinitialiser les compteurs de consultation"
              className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full border border-accent-200 bg-background-50 text-accent-700 cursor-pointer hover:bg-accent-200 transition-colors"
            >
              <i className="ri-refresh-line text-[10px]"></i>
            </button>
          )}
        </div>
      )}

      {filtrable && recapsAffiches.length > 1 && (
        <div className="flex items-center justify-end px-3 pb-2">
          <button
            type="button"
            onClick={handleCopierRecaps}
            title={`Copier seulement les récaps (${recapsAffiches.length}) de la vue active, pour l'envoyer à votre équipe`}
            aria-label="Copier seulement les récaps"
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-accent-200 text-accent-800 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
          >
            <i className={copieRecaps ? "ri-check-line" : "ri-file-copy-2-line"}></i>
            {copieRecaps ? "Récaps copiés !" : `Copier seulement les récaps · ${recapsAffiches.length}`}
          </button>
        </div>
      )}

      {groupe ? (
        <div className="flex flex-col gap-1 px-1.5 pb-1.5">
          {groupes.map((g) => (
            <div key={g.type} className="rounded-md bg-accent-50/70 border border-accent-200/70 pb-1">
              <span className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wide text-accent-800">
                <i className={TYPES[g.type].icone}></i>
                {TYPES[g.type].titre}
                <span className="text-accent-600">· {g.items.length}</span>
              </span>
              <ul className="flex flex-col">{g.items.map(rendreLigne)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col px-1.5 pb-1.5">{liste.map(rendreLigne)}</ul>
      )}

      {renommage && (
        <Modal
          title="Renommer le filtre mémorisé"
          subtitle="Donnez un nom court au filtre conservé pour le retrouver d'un coup d'œil."
          onClose={() => setRenommage(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setRenommage(false)}
                className="inline-flex items-center h-9 px-3.5 rounded-md text-xs font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  ecrireLibelleFiltre("");
                  setLibelle("");
                  setRenommage(false);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
              >
                <i className="ri-restart-line"></i>
                Nom par défaut
              </button>
              <button
                type="button"
                onClick={validerRenommage}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-check-line"></i>
                Enregistrer
              </button>
            </>
          }
        >
          <label className="block text-xs font-semibold text-foreground-700 mb-1.5" htmlFor="libelle-filtre">
            Nom du filtre mémorisé
          </label>
          <input
            id="libelle-filtre"
            type="text"
            value={libelleDraft}
            maxLength={24}
            onChange={(e) => setLibelleDraft(e.target.value)}
            placeholder={LIBELLE_FILTRE_DEFAUT}
            autoFocus
            className="w-full h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <p className="mt-1.5 text-[11px] text-foreground-400">
            {libelleDraft.trim().length}/24 caractères · laissez vide pour revenir à « {LIBELLE_FILTRE_DEFAUT} ».
          </p>
        </Modal>
      )}
    </div>
  );
}