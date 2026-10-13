import type { RefObject } from "react";
import type { ComptableRemplacement } from "@/lib/artisanApi";
import {
  TRIS,
  dateHeureLabel,
  exerciceLabel,
  moisCleLabel,
  natureLabel,
  type GroupeRemplacement,
  type TriKey,
} from "./remplacementsUi";

interface RemplacementsListeProps {
  /** Nombre total de remplacements (pour afficher ou non les filtres). */
  remplacementsCount: number;
  /** Remplacements après application des filtres. */
  remplacementsFiltres: ComptableRemplacement[];
  loading: boolean;
  error: string | null;
  /** Groupes d'adresses triés. */
  groupesTries: GroupeRemplacement[];
  /** Clé de l'adresse la plus utilisée (le « remplaçant habituel »). */
  clePlusUtilisee: string | null;
  /** Filtres. */
  filtreAdresse: string;
  onFiltreAdresse: (value: string) => void;
  adressesDispo: { value: string; label: string }[];
  filtreExercice: string;
  onFiltreExercice: (value: string) => void;
  exercicesDispo: { value: string; label: string }[];
  filtreMois: string;
  onFiltreMois: (value: string) => void;
  recordUniquement: boolean;
  onRecordUniquement: () => void;
  recordGlobalLabel: string;
  filtreEpingle: boolean;
  onFiltreEpingle: () => void;
  moisEpingles: string[];
  filtreSousSeuil: boolean;
  onFiltreSousSeuil: () => void;
  nbSousSeuil: number;
  seuilRemp: number;
  filtreActif: boolean;
  onEffacerFiltres: () => void;
  tri: TriKey;
  onTri: (key: TriKey) => void;
  /** Groupe actuellement déplié (clé d'adresse), ou null. */
  ouvert: string | null;
  onToggleGroupe: (cle: string) => void;
  /** Un renvoi en un clic est possible. */
  canRenvoyer: boolean;
  renvoyerCle: string | null;
  renvoyerMsg: { cle: string; ok: boolean; text: string } | null;
  onRenvoyerDerniere: (r: ComptableRemplacement, cle: string) => void;
  /** Ancre de défilement vers la liste filtrée. */
  listeRef: RefObject<HTMLDivElement | null>;
}

/** Clé de suivi d'un renvoi : une par ligne de pièce, une par pied d'adresse. */
const ligneCle = (id: number | string) => `ligne-${id}`;
const piedCle = (cle: string) => `pied-${cle}`;

/**
 * Section « liste » de la vue Remplacements : barre de filtres (adresse, exercice, mois, mois
 * record / épinglé / sous le seuil) et de tri, ancre de défilement, et liste regroupée par
 * adresse ponctuelle (chaque adresse dépliable, renvoi en un clic de la dernière pièce).
 */
export default function RemplacementsListe({
  remplacementsCount,
  remplacementsFiltres,
  loading,
  error,
  groupesTries,
  clePlusUtilisee,
  filtreAdresse,
  onFiltreAdresse,
  adressesDispo,
  filtreExercice,
  onFiltreExercice,
  exercicesDispo,
  filtreMois,
  onFiltreMois,
  recordUniquement,
  onRecordUniquement,
  recordGlobalLabel,
  filtreEpingle,
  onFiltreEpingle,
  moisEpingles,
  filtreSousSeuil,
  onFiltreSousSeuil,
  nbSousSeuil,
  seuilRemp,
  filtreActif,
  onEffacerFiltres,
  tri,
  onTri,
  ouvert,
  onToggleGroupe,
  canRenvoyer,
  renvoyerCle,
  renvoyerMsg,
  onRenvoyerDerniere,
  listeRef,
}: RemplacementsListeProps) {
  return (
    <>
      {/* Filtres par adresse ponctuelle ou par exercice concerné, et tri de la liste */}
      {remplacementsCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-filter-3-line"></i>
            Filtrer
          </span>
          <div className="relative">
            <i className="ri-user-shared-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
            <select
              value={filtreAdresse}
              onChange={(e) => onFiltreAdresse(e.target.value)}
              title="Filtrer les remplacements par adresse ponctuelle"
              aria-label="Filtrer par adresse"
              className="h-9 pl-9 pr-9 rounded-full bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-accent-400 cursor-pointer appearance-none max-w-[240px]"
            >
              <option value="">Toutes les adresses</option>
              {adressesDispo.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
          </div>
          <div className="relative">
            <i className="ri-folder-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
            <select
              value={filtreExercice}
              onChange={(e) => onFiltreExercice(e.target.value)}
              title="Filtrer les remplacements par exercice / mois concerné"
              aria-label="Filtrer par exercice"
              className="h-9 pl-9 pr-9 rounded-full bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-accent-400 cursor-pointer appearance-none max-w-[240px]"
            >
              <option value="">Tous les exercices</option>
              {exercicesDispo.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
          </div>
          {filtreMois && (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-100 text-accent-800 text-xs font-semibold whitespace-nowrap">
              <i className="ri-calendar-line"></i>
              {moisCleLabel(filtreMois)}
              <button
                type="button"
                onClick={() => onFiltreMois("")}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent-200 cursor-pointer"
                aria-label="Retirer le filtre de mois"
                title="Retirer le filtre de mois"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            </span>
          )}
          {/* Filtre rapide : n'afficher que les pièces du mois le plus actif de l'historique */}
          <button
            type="button"
            onClick={onRecordUniquement}
            aria-pressed={recordUniquement}
            title={`N'afficher que les pièces du mois le plus actif de votre historique${recordGlobalLabel ? ` (${recordGlobalLabel})` : ""}`}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              recordUniquement
                ? "bg-accent-500 text-background-50"
                : "bg-background-50 border border-background-200 text-foreground-700 hover:border-accent-300"
            }`}
          >
            <i className="ri-award-line"></i>
            Mois record uniquement
          </button>
          {/* Filtre rapide : n'afficher que les pièces des mois épinglés « à surveiller » */}
          <button
            type="button"
            onClick={onFiltreEpingle}
            aria-pressed={filtreEpingle}
            disabled={moisEpingles.length === 0}
            title={
              moisEpingles.length === 0
                ? "Épinglez d'abord un mois à surveiller depuis le mini-graphe"
                : `N'afficher que les pièces des mois épinglés (${moisEpingles.map((c) => moisCleLabel(c)).join(", ")})`
            }
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              filtreEpingle
                ? "bg-secondary-500 text-background-50"
                : "bg-background-50 border border-background-200 text-foreground-700 hover:border-secondary-300"
            }`}
          >
            <i className="ri-pushpin-2-line"></i>
            Mois épinglé uniquement
            {moisEpingles.length > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold ${
                  filtreEpingle ? "bg-background-50/30" : "bg-secondary-100 text-secondary-900"
                }`}
              >
                {moisEpingles.length}
              </span>
            )}
          </button>
          {/* Filtre rapide : n'afficher que les pièces des mois à faible activité (sous le seuil réglé).
              Même filtre que « Sous le seuil » du mini-graphe, simplement reporté dans la liste. */}
          <button
            type="button"
            onClick={onFiltreSousSeuil}
            aria-pressed={filtreSousSeuil}
            title={`N'afficher dans la liste que les pièces des mois à faible activité (moins de ${seuilRemp} renvoi${seuilRemp > 1 ? "s" : ""})`}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filtreSousSeuil
                ? "bg-secondary-500 text-background-50"
                : "bg-background-50 border border-background-200 text-foreground-700 hover:border-secondary-300"
            }`}
          >
            <i className="ri-filter-3-line"></i>
            Mois sous le seuil
            {nbSousSeuil > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold ${
                  filtreSousSeuil ? "bg-background-50/30" : "bg-secondary-100 text-secondary-900"
                }`}
              >
                {nbSousSeuil}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onEffacerFiltres}
            disabled={!filtreActif}
            title="Remettre l'adresse, l'exercice, le mois et les filtres record / épinglé / sous le seuil à leurs valeurs par défaut"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-secondary-300 hover:text-secondary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-filter-off-line"></i>
            Réinitialiser tous les filtres
          </button>

          <span className="w-px h-5 bg-background-300 mx-1 hidden sm:block"></span>

          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-sort-desc"></i>
            Trier
          </span>
          <div className="flex gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
            {TRIS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onTri(t.key)}
                title={t.title}
                aria-pressed={tri === t.key}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  tri === t.key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className={t.icon}></i>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ancre vers la liste filtrée : une barre cliquée du mini-graphe (mois faible en dégradé
          secondary) amène directement la comptabilité filtrée sur ce mois sous les yeux. */}
      <div ref={listeRef} className="scroll-mt-24" />

      {error && (
        <p className="text-[11px] text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      )}

      {loading && remplacementsCount === 0 ? (
        <p className="text-xs text-foreground-400 inline-flex items-center gap-1.5 py-1">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement des remplacements…
        </p>
      ) : remplacementsCount === 0 ? (
        <div className="flex items-start gap-2.5 p-3 rounded-md bg-background-50 border border-background-200">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-background-100 text-foreground-400">
            <i className="ri-information-line"></i>
          </span>
          <p className="text-xs text-foreground-600">
            Aucun remplacement pour l'instant. Dès que vous renverrez un journal ou un bilan d'archivage à une adresse
            ponctuelle (ex. comptable remplaçant), le renvoi apparaîtra ici avec sa date et l'exercice concerné.
          </p>
        </div>
      ) : remplacementsFiltres.length === 0 ? (
        <div className="flex items-start gap-2.5 p-3 rounded-md bg-background-50 border border-background-200">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-background-100 text-foreground-400">
            <i className="ri-filter-off-line"></i>
          </span>
          <p className="text-xs text-foreground-600">
            Aucun remplacement ne correspond à ce filtre. Modifiez l'adresse, l'exercice ou le mois, ou effacez les filtres.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {groupesTries.map((g) => {
            const ouvertGroupe = ouvert === g.cle;
            const estHabituel = clePlusUtilisee === g.cle;
            // « Dernière pièce » = la plus récente, indépendamment de l'ordre d'affichage
            // (le tri « Mois record » peut remonter une pièce plus ancienne en tête).
            const derniere = g.items.reduce(
              (a, b) => (new Date(b.envoye_le).getTime() > new Date(a.envoye_le).getTime() ? b : a),
              g.items[0],
            );
            return (
              <li
                key={g.cle}
                className={`rounded-md bg-background-50 border ${
                  estHabituel ? "border-accent-300" : "border-background-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleGroupe(g.cle)}
                  aria-expanded={ouvertGroupe}
                  className="w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left cursor-pointer hover:bg-background-100 transition-colors rounded-md"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full ${
                        estHabituel ? "bg-accent-500 text-background-50" : "bg-accent-100 text-accent-700"
                      }`}
                    >
                      <i className={estHabituel ? "ri-medal-line" : "ri-mail-send-line"}></i>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-950 truncate flex items-center gap-2">
                        {g.nom ? `${g.nom} · ` : ""}
                        <span className="font-normal text-foreground-600">{g.adresse}</span>
                        {estHabituel && (
                          <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded-full bg-accent-100 text-accent-800 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                            <i className="ri-medal-line"></i>
                            Remplaçant habituel
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-foreground-500 truncate">
                        Dernier renvoi : {dateHeureLabel(derniere.envoye_le)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-bold ${
                        estHabituel ? "bg-accent-500 text-background-50" : "bg-secondary-100 text-secondary-800"
                      }`}
                    >
                      <i className="ri-swap-box-line"></i>
                      {g.items.length} renvoi{g.items.length > 1 ? "s" : ""}
                    </span>
                    <i
                      className={
                        ouvertGroupe ? "ri-arrow-up-s-line text-foreground-500" : "ri-arrow-down-s-line text-foreground-500"
                      }
                    ></i>
                  </div>
                </button>

                {ouvertGroupe && (
                  <div className="px-3 pb-3 border-t border-background-200 pt-2 animate-fade-in">
                    <ul className="flex flex-col gap-1">
                      {g.items.map((r) => {
                        const cle = ligneCle(r.id);
                        const enCours = renvoyerCle === cle;
                        return (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-background-100 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <i
                                className={
                                  r.type === "bilan"
                                    ? "ri-archive-drawer-line text-secondary-600"
                                    : "ri-calendar-schedule-line text-primary-600"
                                }
                              ></i>
                              <span className="text-xs text-foreground-700">{natureLabel(r.type)}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground-500">
                              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-background-100 border border-background-200 text-foreground-700 font-medium whitespace-nowrap">
                                <i className="ri-folder-line"></i>
                                {exerciceLabel(r.exercice, r.type)}
                              </span>
                              <span className="whitespace-nowrap">{dateHeureLabel(r.envoye_le)}</span>
                              {canRenvoyer && (
                                <button
                                  type="button"
                                  onClick={() => onRenvoyerDerniere(r, cle)}
                                  disabled={enCours}
                                  title={`Renvoyer à ${g.adresse} cette pièce (${natureLabel(r.type)} · ${exerciceLabel(r.exercice, r.type)})`}
                                  className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  <i className={enCours ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
                                  Renvoyer
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {canRenvoyer && (
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-background-200">
                        <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
                          <i className="ri-history-line"></i>
                          Dernière pièce : {natureLabel(derniere.type)} · {exerciceLabel(derniere.exercice, derniere.type)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRenvoyerDerniere(derniere, piedCle(g.cle))}
                          disabled={renvoyerCle === piedCle(g.cle)}
                          title={`Renvoyer à ${g.adresse} la dernière pièce (${natureLabel(derniere.type)}) sans modifier votre comptable habituel`}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <i
                            className={
                              renvoyerCle === piedCle(g.cle) ? "ri-loader-4-line animate-spin" : "ri-refresh-line"
                            }
                          ></i>
                          Renvoyer la dernière pièce
                        </button>
                      </div>
                    )}

                    {renvoyerMsg &&
                      (renvoyerMsg.cle === piedCle(g.cle) || g.items.some((it) => ligneCle(it.id) === renvoyerMsg.cle)) && (
                        <p
                          className={`text-[11px] mt-1.5 inline-flex items-center gap-1.5 ${
                            renvoyerMsg.ok ? "text-accent-700" : "text-red-600"
                          }`}
                        >
                          <i className={renvoyerMsg.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                          {renvoyerMsg.text}
                        </p>
                      )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}