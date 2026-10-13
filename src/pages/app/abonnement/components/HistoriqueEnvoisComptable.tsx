import { useMemo, useState } from "react";
import type { ComptableEnvoi } from "@/lib/artisanApi";
import {
  categorieNature,
  cleMoisEnvoi,
  compterEnvoisParAdresse,
  formatDateHeure,
  natureEnvoi,
  perimetreEnvoi,
  tendanceEnvoisParAdresse,
  type NatureCle,
  type TendanceEnvoi,
} from "@/lib/comptableEnvois";
import RecapAnnuelRenvoisChart from "@/pages/app/abonnement/components/RecapAnnuelRenvoisChart";

/** Adresse de comptable enregistrée sur le profil, avec son rôle. */
export interface AdresseComptable {
  label: string;
  email: string;
  role: "principal" | "remplacant";
}

type FiltreRole = "tous" | "principal" | "remplacant";

interface HistoriqueEnvoisComptableProps {
  /** Envois au comptable, du plus récent au plus ancien. */
  envois: ComptableEnvoi[];
  /** Un envoi de pack comptable existe-t-il (active le bouton de renvoi) ? */
  renvoiDisponible: boolean;
  /** Destinataire du dernier pack, affiché en infobulle du bouton de renvoi. */
  renvoiDestinataire: string | null;
  /** Renvoi en cours (désactive le bouton). */
  renvoiLoading: boolean;
  /** Ouvre l'aperçu de validation avant de réexpédier le dernier pack (destinataire éventuellement choisi). */
  onRenvoi: (destinataire?: string) => void;
  /** Id de l'envoi du dernier relevé seul : le bouton de renvoi s'affiche sur sa ligne. */
  renvoiReleveId?: number | null;
  /** Destinataire du dernier relevé seul, affiché en infobulle du bouton. */
  renvoiReleveDestinataire: string | null;
  /** Renvoi du relevé en cours (désactive le bouton). */
  renvoiReleveLoading: boolean;
  /** Ouvre l'aperçu de validation avant de réexpédier le dernier relevé seul (destinataire éventuellement choisi). */
  onRenvoiReleve: (destinataire?: string) => void;
  /** Adresses de comptable enregistrées (cabinet principal / remplaçants) pour le filtre par rôle et le renvoi. */
  adressesComptable?: AdresseComptable[];
  /** Destinataire choisi pour le renvoi (valeur contrôlée ; vide = destinataire d'origine du dernier envoi). */
  destinataireRenvoi?: string;
  onDestinataireRenvoiChange?: (value: string) => void;
  /** Adresse du comptable remplaçant habituel (dernière utilisée), cible du renvoi dédié. */
  remplacantHabituel?: string;
  /** Renvoie le dernier pack directement au remplaçant habituel. */
  onRenvoiRemplacant?: () => void;
  /** Message d'accompagnement du renvoi (pré-rempli depuis le profil). */
  messageRenvoi: string;
  onMessageRenvoiChange: (value: string) => void;
  /** Mémorise le message courant pour les prochains renvois. */
  onMemoriserMessage: () => void;
  /** Exporte en CSV la liste affichée (filtrée). */
  onExporterCsv: (envois: ComptableEnvoi[]) => void;
  /** Mémorisation du message en cours (désactive le bouton). */
  memoriserLoading?: boolean;
  /** Remonte la page suivante d'envois plus anciens (« Charger plus »). */
  onLoadMore: () => void;
  /** Chargement d'une page supplémentaire en cours. */
  loadingMore?: boolean;
  /** Reste-t-il des envois plus anciens à remonter ? */
  hasMore?: boolean;
  /** Nombre total d'envois existants (pour « X affichés sur Y »). */
  total?: number;
}

/** Filtres de nature proposés au-dessus de l'historique. */
const NATURES: { cle: NatureCle; label: string; icon: string }[] = [
  { cle: "tous", label: "Tous", icon: "ri-apps-2-line" },
  { cle: "pack", label: "Pack", icon: "ri-briefcase-4-line" },
  { cle: "recap", label: "Récap", icon: "ri-line-chart-line" },
  { cle: "journal", label: "Journal", icon: "ri-file-list-3-line" },
];

function tonerNature(envoi: ComptableEnvoi): string {
  switch (categorieNature(envoi)) {
    case "pack":
      return "bg-accent-100 text-accent-800";
    case "recap":
      return "bg-secondary-100 text-secondary-800";
    default:
      return "bg-background-200 text-foreground-600";
  }
}

/** Statistique compacte du récap d'historique (valeur + libellé). */
function Stat({ icon, valeur, libelle, accent = false }: { icon: string; valeur: string; libelle: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background-100 border border-background-200">
      <span
        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-sm ${
          accent ? "bg-accent-500 text-background-50" : "bg-secondary-100 text-secondary-700"
        }`}
      >
        <i className={icon}></i>
      </span>
      <div className="min-w-0">
        <p className="font-heading font-bold text-sm text-foreground-950 truncate max-w-[200px]" title={valeur}>
          {valeur}
        </p>
        <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">{libelle}</p>
      </div>
    </div>
  );
}

/**
 * Panneau « Historique des envois au comptable » : récap total (nombre d'envois, dernier
 * envoi, destinataires distincts, renvois vers remplaçants ce mois-ci), filtres par nature, par
 * rôle (cabinet principal / remplaçant) et par adresse exacte, récap « X cabinet principal ·
 * Y remplaçants » quand un rôle est filtré, interrupteur « Masquer les envois de test » avec
 * récap des lignes cachées, badge « Test » sur les envois de test, et renvoi en un clic du
 * dernier pack comptable (en-tête, y compris vers le remplaçant habituel) ou du dernier relevé
 * seul (sur sa ligne) — avec choix et mémorisation du destinataire au moment de réexpédier.
 * Le sélecteur de destinataire indique, pour chaque adresse enregistrée, le nombre de renvois
 * déjà effectués (avec une flèche de tendance quand l'usage évolue) et un bouton « Voir les
 * renvois de cette adresse » filtre la liste en un clic. Un récap annuel « mois par mois »
 * empilé par destinataire complète l'historique.
 */
export default function HistoriqueEnvoisComptable({
  envois,
  renvoiDisponible,
  renvoiDestinataire,
  renvoiLoading,
  onRenvoi,
  renvoiReleveId = null,
  renvoiReleveDestinataire,
  renvoiReleveLoading,
  onRenvoiReleve,
  adressesComptable = [],
  destinataireRenvoi = "",
  onDestinataireRenvoiChange,
  remplacantHabituel = "",
  onRenvoiRemplacant,
  messageRenvoi,
  onMessageRenvoiChange,
  onMemoriserMessage,
  onExporterCsv,
  memoriserLoading = false,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
  total,
}: HistoriqueEnvoisComptableProps) {
  const [nature, setNature] = useState<NatureCle>("tous");
  const [destinataire, setDestinataire] = useState("");
  // Filtre par rôle : plus large que l'adresse exacte (le cabinet principal peut changer d'adresse).
  const [role, setRole] = useState<FiltreRole>("tous");
  // N'affiche que les transmissions réelles (masque les envois de test vers l'artisan lui-même).
  const [masquerTests, setMasquerTests] = useState(false);
  // Destinataire choisi pour le renvoi (vide = adresse d'origine du dernier envoi concerné).
  // Contrôlé par le parent pour être mémorisé sur le profil et reproposé à la prochaine session.
  const renvoiDestinataireChoisi = destinataireRenvoi;

  const destinataires = useMemo(
    () => Array.from(new Set(envois.map((e) => e.destinataire).filter((v): v is string => Boolean(v)))).sort(),
    [envois],
  );

  const nbTestsTotal = useMemo(() => envois.filter((e) => e.test).length, [envois]);

  // Nombre d'envois réels déjà effectués vers chaque adresse (clé en minuscules), affiché à
  // côté du nom dans le sélecteur de destinataire pour savoir où l'on a déjà expédié.
  const envoisParAdresse = useMemo(() => compterEnvoisParAdresse(envois), [envois]);

  // Sens d'évolution de l'usage de chaque adresse (30 derniers jours vs 30 précédents), pour
  // afficher une petite flèche ↑/↓ à côté du compteur quand l'usage monte ou descend.
  const tendances = useMemo(() => tendanceEnvoisParAdresse(envois), [envois]);

  /** Flèche de tendance compacte (« ↑ » / « ↓ ») à côté du compteur d'une adresse. */
  const flecheTendance = (tendance?: TendanceEnvoi) =>
    tendance === "hausse" ? " ↑" : tendance === "baisse" ? " ↓" : "";

  // Rôles disponibles pour le filtre (cabinet principal / remplaçant(s)).
  const emailsPrincipal = useMemo(
    () => new Set(adressesComptable.filter((a) => a.role === "principal").map((a) => a.email.toLowerCase())),
    [adressesComptable],
  );
  const emailsRemplacant = useMemo(
    () => new Set(adressesComptable.filter((a) => a.role === "remplacant").map((a) => a.email.toLowerCase())),
    [adressesComptable],
  );
  const aPrincipal = emailsPrincipal.size > 0;
  const aRemplacant = emailsRemplacant.size > 0;

  // Récap par rôle (affiché quand un rôle est filtré) : combien d'envois réels relèvent du
  // cabinet principal et combien des remplaçants, dans le périmètre des autres filtres.
  const envoisSansTestFiltres = useMemo(
    () =>
      envois.filter(
        (e) =>
          !e.test &&
          (nature === "tous" || categorieNature(e) === nature) &&
          (!destinataire || e.destinataire === destinataire),
      ),
    [envois, nature, destinataire],
  );
  const nbPrincipal = envoisSansTestFiltres.filter((e) => emailsPrincipal.has((e.destinataire ?? "").toLowerCase())).length;
  const nbRemplacant = envoisSansTestFiltres.filter((e) => emailsRemplacant.has((e.destinataire ?? "").toLowerCase())).length;

  // Envois correspondant à tous les filtres SAUF l'interrupteur des tests : sert à compter
  // combien de lignes réelles et combien de tests l'interrupteur masque réellement.
  const envoisBase = useMemo(() => {
    const matchRole = (email?: string | null) => {
      if (role === "tous") return true;
      const cle = (email ?? "").toLowerCase();
      return role === "principal" ? emailsPrincipal.has(cle) : emailsRemplacant.has(cle);
    };
    return envois.filter(
      (e) =>
        (nature === "tous" || categorieNature(e) === nature) &&
        (!destinataire || e.destinataire === destinataire) &&
        matchRole(e.destinataire),
    );
  }, [envois, nature, destinataire, role, emailsPrincipal, emailsRemplacant]);

  const envoisFiltres = useMemo(
    () => (masquerTests ? envoisBase.filter((e) => !e.test) : envoisBase),
    [envoisBase, masquerTests],
  );

  const filtreActif = nature !== "tous" || destinataire !== "" || role !== "tous" || masquerTests;
  // Les statistiques du récap portent sur les transmissions réelles : les envois de test
  // (vers l'artisan lui-même) restent visibles mais marqués, sans gonfler les compteurs.
  const reels = envoisFiltres.filter((e) => !e.test);
  const nbTests = envoisFiltres.length - reels.length;
  const dernier = reels[0] ?? null;
  const nbDestinataires = new Set(reels.map((e) => e.destinataire).filter(Boolean)).size;

  // Renvois vers les comptables remplaçants réalisés ce mois-ci (périmètre affiché, hors tests) :
  // alimente la statistique « renvois remplaçants ce mois-ci » du récap d'historique.
  const cleMoisCourant = cleMoisEnvoi(new Date().toISOString());
  const nbRemplacantMois = reels.filter(
    (e) =>
      emailsRemplacant.has((e.destinataire ?? "").toLowerCase()) && cleMoisEnvoi(e.envoye_le) === cleMoisCourant,
  ).length;

  // Récap du masquage : « X réels · Y tests masqués » quand l'interrupteur est actif.
  const reelsMasques = envoisBase.filter((e) => !e.test).length;
  const testsMasques = envoisBase.length - reelsMasques;

  // Le sélecteur de destinataire du renvoi n'a de sens que si un renvoi est possible.
  const renvoiPossible = renvoiDisponible || renvoiReleveId !== null;
  const adresseRenvoi = renvoiDestinataireChoisi || undefined;

  // Options du filtre « adresse exacte » : les adresses réellement présentes dans l'historique,
  // enrichies de l'adresse choisie pour le renvoi afin qu'elle reste sélectionnable en un clic.
  const destinatairesOptions = useMemo(() => {
    const base = new Set(destinataires);
    if (destinataire) base.add(destinataire);
    if (renvoiDestinataireChoisi) base.add(renvoiDestinataireChoisi);
    return Array.from(base).sort();
  }, [destinataires, destinataire, renvoiDestinataireChoisi]);

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg bg-background-50 border border-background-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-background-200 text-foreground-600 text-sm">
            <i className="ri-history-line"></i>
          </span>
          <p className="text-xs font-semibold text-foreground-900">Historique des envois au comptable</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {renvoiPossible && adressesComptable.length > 0 ? (
            <div className="relative" title="Choisir le destinataire du renvoi (adresse enregistrée)">
              <i className="ri-user-received-line absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
              <select
                value={renvoiDestinataireChoisi}
                onChange={(e) => onDestinataireRenvoiChange?.(e.target.value)}
                className="h-7 w-full sm:w-64 pl-8 pr-7 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 outline-none cursor-pointer focus:ring-2 focus:ring-primary-300 appearance-none"
              >
                <option value="">Destinataire d'origine…</option>
                {adressesComptable.map((a) => {
                  const nb = envoisParAdresse[a.email.toLowerCase()] ?? 0;
                  const fleche = flecheTendance(tendances[a.email.toLowerCase()]);
                  return (
                    <option key={a.email} value={a.email}>
                      {a.label} — {a.email}
                      {nb > 0 ? ` (${nb} renvoi${nb > 1 ? "s" : ""}${fleche})` : ""}
                    </option>
                  );
                })}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-foreground-400 text-xs pointer-events-none"></i>
            </div>
          ) : null}
          {renvoiPossible && renvoiDestinataireChoisi ? (
            <button
              type="button"
              onClick={() => setDestinataire(renvoiDestinataireChoisi)}
              title={`Filtrer l'historique sur les renvois à ${renvoiDestinataireChoisi}`}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              <i className="ri-filter-3-line"></i>
              Voir les renvois de cette adresse
            </button>
          ) : null}
          {renvoiDisponible ? (
            <button
              type="button"
              onClick={() => onRenvoi(adresseRenvoi)}
              disabled={renvoiLoading}
              title={
                renvoiDestinataireChoisi
                  ? `Renvoyer le pack à ${renvoiDestinataireChoisi}`
                  : renvoiDestinataire
                    ? `Renvoyer le pack au même destinataire (${renvoiDestinataire})`
                    : undefined
              }
              className="inline-flex items-center gap-2 h-7 px-3 rounded-md bg-secondary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {renvoiLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-refresh-line"></i>}
              Renvoyer le dernier pack
            </button>
          ) : null}
          {renvoiDisponible && remplacantHabituel ? (
            <button
              type="button"
              onClick={() => onRenvoiRemplacant?.()}
              disabled={renvoiLoading}
              title={`Renvoyer le dernier pack au remplaçant habituel (${remplacantHabituel})`}
              className="inline-flex items-center gap-2 h-7 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {renvoiLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-user-shared-line"></i>}
              Renvoyer au remplaçant habituel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onExporterCsv(envoisFiltres)}
            disabled={envoisFiltres.length === 0}
            className="inline-flex items-center gap-2 h-7 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-file-download-line"></i>
            Exporter CSV
          </button>
        </div>
      </div>

      {envois.length > 0 ? (
        <>
          <div className={`grid grid-cols-1 gap-2 ${aRemplacant ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
            <Stat
              icon="ri-send-plane-line"
              valeur={String(reels.length)}
              libelle={filtreActif ? "Envois (filtrés)" : "Envois au total"}
            />
            <Stat
              icon="ri-time-line"
              valeur={dernier ? formatDateHeure(dernier.envoye_le) : "—"}
              libelle="Dernier envoi"
              accent
            />
            <Stat
              icon="ri-group-line"
              valeur={String(nbDestinataires)}
              libelle={nbDestinataires > 1 ? "Destinataires distincts" : "Destinataire distinct"}
            />
            {aRemplacant ? (
              <Stat
                icon="ri-user-shared-line"
                valeur={String(nbRemplacantMois)}
                libelle="Renvois remplaçants ce mois-ci"
              />
            ) : null}
          </div>

          {nbTests > 0 ? (
            <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-flask-line text-foreground-400"></i>
              Dont {nbTests} envoi{nbTests > 1 ? "s" : ""} de test (vers vous-même), non compté{nbTests > 1 ? "s" : ""} dans les transmissions réelles.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide mr-1">Nature</span>
            {NATURES.map((n) => (
              <button
                key={n.cle}
                type="button"
                onClick={() => setNature(n.cle)}
                aria-pressed={nature === n.cle}
                className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  nature === n.cle
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:border-primary-300"
                }`}
              >
                <i className={n.icon}></i>
                {n.label}
              </button>
            ))}

            <div className="relative sm:ml-auto">
              <i className="ri-mail-line absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-xs pointer-events-none"></i>
              <select
                value={destinataire}
                onChange={(e) => setDestinataire(e.target.value)}
                title="Filtrer par adresse exacte"
                className="h-7 pl-7 pr-7 rounded-full bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 outline-none cursor-pointer focus:ring-2 focus:ring-primary-300 appearance-none"
              >
                <option value="">Toutes les adresses</option>
                {destinatairesOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-foreground-400 text-xs pointer-events-none"></i>
            </div>

            {aPrincipal || aRemplacant ? (
              <>
                <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide ml-1">Rôle</span>
                {aPrincipal ? (
                  <button
                    type="button"
                    onClick={() => setRole(role === "principal" ? "tous" : "principal")}
                    aria-pressed={role === "principal"}
                    title="Filtrer sur le cabinet principal"
                    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      role === "principal"
                        ? "bg-accent-500 text-background-50"
                        : "bg-background-100 border border-background-200 text-foreground-600 hover:border-accent-300"
                    }`}
                  >
                    <i className="ri-user-star-line"></i>
                    Cabinet principal
                  </button>
                ) : null}
                {aRemplacant ? (
                  <button
                    type="button"
                    onClick={() => setRole(role === "remplacant" ? "tous" : "remplacant")}
                    aria-pressed={role === "remplacant"}
                    title="Filtrer sur les comptables remplaçants"
                    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      role === "remplacant"
                        ? "bg-accent-500 text-background-50"
                        : "bg-background-100 border border-background-200 text-foreground-600 hover:border-accent-300"
                    }`}
                  >
                    <i className="ri-user-shared-line"></i>
                    Remplaçant
                  </button>
                ) : null}
              </>
            ) : null}

            {nbTestsTotal > 0 ? (
              <button
                type="button"
                role="switch"
                aria-checked={masquerTests}
                onClick={() => setMasquerTests((v) => !v)}
                title="N'afficher que les transmissions réelles au comptable"
                className={`inline-flex items-center gap-2 h-7 pl-1.5 pr-3 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  masquerTests
                    ? "bg-foreground-800 border-foreground-800 text-background-50"
                    : "bg-background-100 border-background-200 text-foreground-600 hover:border-primary-300"
                }`}
              >
                <span
                  className={`w-4 h-4 flex items-center justify-center rounded-full ${
                    masquerTests ? "bg-background-50 text-foreground-800" : "bg-background-200 text-foreground-500"
                  }`}
                >
                  <i className={masquerTests ? "ri-eye-off-line text-[10px]" : "ri-flask-line text-[10px]"}></i>
                </span>
                Masquer les envois de test
              </button>
            ) : null}

            {masquerTests ? (
              <span
                className="inline-flex items-center gap-1.5 text-[11px] text-foreground-500 tabular-nums whitespace-nowrap"
                title="Transmissions réelles affichées et envois de test masqués par l'interrupteur"
              >
                <i className="ri-checkbox-circle-line text-accent-600"></i>
                {reelsMasques} réel{reelsMasques > 1 ? "s" : ""} · {testsMasques} test{testsMasques > 1 ? "s" : ""} masqué{testsMasques > 1 ? "s" : ""}
              </span>
            ) : null}

            {filtreActif ? (
              <button
                type="button"
                onClick={() => {
                  setNature("tous");
                  setDestinataire("");
                  setRole("tous");
                  setMasquerTests(false);
                }}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer text-foreground-500 hover:text-foreground-800 transition-colors"
              >
                <i className="ri-close-circle-line"></i>
                Réinitialiser
              </button>
            ) : null}
          </div>

          {role !== "tous" ? (
            <p className="inline-flex flex-wrap items-center gap-1.5 text-[11px] text-foreground-600">
              <i className="ri-pie-chart-line text-accent-600"></i>
              <span>
                <strong className="font-heading tabular-nums text-foreground-900">{nbPrincipal}</strong> envoi
                {nbPrincipal > 1 ? "s" : ""} cabinet principal
              </span>
              <span className="text-foreground-300">·</span>
              <span>
                <strong className="font-heading tabular-nums text-foreground-900">{nbRemplacant}</strong> remplaçant
                {nbRemplacant > 1 ? "s" : ""}
              </span>
            </p>
          ) : null}

          <RecapAnnuelRenvoisChart envois={envois} adressesComptable={adressesComptable} />
        </>
      ) : null}

      {renvoiDisponible ? (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-secondary-100/60 border border-secondary-200/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="message-renvoi-pack" className="text-[11px] font-semibold text-foreground-600 uppercase tracking-wide">
              Message d'accompagnement du renvoi
            </label>
            <span className="text-[11px] text-foreground-400 tabular-nums whitespace-nowrap">{messageRenvoi.length} / 500</span>
          </div>
          <textarea
            id="message-renvoi-pack"
            name="message_renvoi_pack"
            value={messageRenvoi}
            maxLength={500}
            onChange={(e) => onMessageRenvoiChange(e.target.value)}
            rows={2}
            placeholder="Bonjour, veuillez trouver ci-joint le pack comptable actualisé de notre abonnement. Bien cordialement,"
            className="w-full resize-none rounded-md bg-background-50 border border-background-200 px-3 py-2 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-foreground-500">
              Pré-rempli avec votre dernier message et repris au prochain renvoi. Laissez vide pour le message par défaut.
            </p>
            <button
              type="button"
              onClick={onMemoriserMessage}
              disabled={memoriserLoading}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {memoriserLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-bookmark-line"></i>}
              Mémoriser ce message
            </button>
          </div>
        </div>
      ) : null}

      {envois.length === 0 ? (
        <p className="text-[11px] text-foreground-500">
          Aucun envoi pour l'instant. Vos envois au comptable (journal, récap ou pack) apparaîtront ici.
        </p>
      ) : envoisFiltres.length === 0 ? (
        <p className="text-[11px] text-foreground-500">
          Aucun envoi ne correspond à ces filtres.
        </p>
      ) : (
        <>
          <ul className="flex flex-col">
            {envoisFiltres.map((envoi) => (
              <li
                key={envoi.id}
                className="flex flex-wrap items-center gap-3 py-2 border-t border-background-200 first:border-t-0"
              >
                <span
                  className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-xs ${
                    envoi.test ? "bg-background-200 text-foreground-600" : "bg-secondary-100 text-secondary-700"
                  }`}
                >
                  <i className={envoi.test ? "ri-flask-line" : "ri-mail-send-line"}></i>
                </span>
                <div className="flex-1 min-w-[140px]">
                  <p className="text-xs font-semibold text-foreground-900 truncate">
                    {envoi.destinataire || "Destinataire inconnu"}
                  </p>
                  <p className="text-[11px] text-foreground-500 truncate">
                    {formatDateHeure(envoi.envoye_le)} · {perimetreEnvoi(envoi)}
                  </p>
                </div>
                {envoi.test ? (
                  <span
                    className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-background-200 text-foreground-700 text-[10px] font-bold whitespace-nowrap"
                    title="Envoi de test vers vous-même — non transmis au comptable"
                  >
                    <i className="ri-flask-line"></i>
                    Test
                  </span>
                ) : null}
                <span
                  className={`inline-flex items-center h-6 px-2.5 rounded-full text-[10px] font-bold whitespace-nowrap ${tonerNature(envoi)}`}
                >
                  {natureEnvoi(envoi)}
                </span>
                {renvoiReleveId !== null && envoi.id === renvoiReleveId ? (
                  <button
                    type="button"
                    onClick={() => onRenvoiReleve(adresseRenvoi)}
                    disabled={renvoiReleveLoading}
                    title={
                      renvoiDestinataireChoisi
                        ? `Renvoyer ce relevé seul à ${renvoiDestinataireChoisi}`
                        : renvoiReleveDestinataire
                          ? `Renvoyer ce relevé seul au même destinataire (${renvoiReleveDestinataire})`
                          : undefined
                    }
                    className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background-100 border border-secondary-300 text-secondary-800 text-[10px] font-bold whitespace-nowrap cursor-pointer hover:bg-secondary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {renvoiReleveLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-refresh-line"></i>}
                    Renvoyer le relevé seul
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-foreground-500 tabular-nums">
              {envois.length} envoi{envois.length > 1 ? "s" : ""} affiché{envois.length > 1 ? "s" : ""} sur{" "}
              {typeof total === "number" && total > 0 ? total : envois.length}
            </p>
            {hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 h-8 px-4 rounded-full bg-background-100 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-arrow-down-line"></i>}
                Charger plus
              </button>
            ) : (
              <span className="text-[11px] text-foreground-400">Tout l'historique est affiché.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}