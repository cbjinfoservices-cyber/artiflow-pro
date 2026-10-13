import { useMemo, useState } from "react";
import { formatShortDate, todayISO } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  RECAP_TAUX_ALERTES,
  RECAP_HISTO_PERIODES,
  idsOubliesRecaps,
  lireRecapHistoOrigine,
  ecrireRecapHistoOrigine,
  lireRecapHistoOrigineMenuOuvert,
  ecrireRecapHistoOrigineMenuOuvert,
  type RecapHistoOrigine,
  type RecapHistoPeriode,
  type RecapRecontactEnvoi,
} from "@/lib/recontactSeuil";
import type { AbonnementItem, RecontactArtisanItem } from "@/lib/abonnementsApi";
import EvolutionRecapChart from "@/pages/app/abonnements/components/EvolutionRecapChart";
import DetailRecapModal from "@/pages/app/abonnements/components/DetailRecapModal";
import RecontacterTousModal, { type CibleRecontact } from "@/pages/app/abonnements/components/RecontacterTousModal";

interface Props {
  items: RecapRecontactEnvoi[];
  /** Parc d'abonnements, pour résoudre les comptes listés d'un récap (détail + recontact). */
  abos: AbonnementItem[];
  /** Journal des recontacts, pour distinguer, dans le détail, les comptes déjà relancés des oubliés. */
  recontacts: RecontactArtisanItem[];
  /** Seuil d'alerte du taux de recontact après envoi (%), sous lequel un récap est mis en évidence. */
  seuilAlerte: number;
  /** Change le seuil d'alerte (mémorisé localement et côté Backend). */
  onSeuilChange: (seuil: number) => void;
  /** Plage de dates affichée (mémorisée comme les autres préférences). */
  periode: RecapHistoPeriode;
  /** Change la plage de dates affichée. */
  onPeriodeChange: (periode: RecapHistoPeriode) => void;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  /** Notifie le parent qu'un recontact a été envoyé (rafraîchit le journal des recontacts). */
  onRecontactSent?: () => void;
}

/** Filtre d'origine des envois affichés au-dessus de l'historique (mémorisé comme les autres préférences). */
type FiltreOrigine = RecapHistoOrigine;

/**
 * Historique des récaps hebdomadaires de recontact envoyés : une ligne par envoi
 * (date + nombre de comptes très volatils concernés). Chaque ligne est cliquable pour
 * afficher les comptes listés, voir lesquels n'ont pas encore été relancés et les recontacter.
 * Un seuil d'alerte réglable met en évidence les envois dont le taux de recontact après récap
 * est trop faible, et un filtre par plage de dates (mémorisé) permet de se concentrer sur une période.
 * Un bouton regroupe en un clic tous les comptes oubliés des récaps affichés.
 */
export default function HistoriqueRecapHebdoCard({
  items,
  abos,
  recontacts,
  seuilAlerte,
  onSeuilChange,
  periode,
  onPeriodeChange,
  loading,
  error,
  onReload,
  onRecontactSent,
}: Props) {
  // Filtre d'origine : « automatiques / tests » pour isoler les envois planifiés des tests manuels.
  // Dernier filtre choisi, restauré localement à la prochaine visite comme la plage de dates.
  const [filtre, setFiltre] = useState<FiltreOrigine>(() => lireRecapHistoOrigine());
  // État ouvert/fermé du menu des filtres d'origine (« Récap automatiques / tests »), mémorisé
  // localement pour le retrouver tel quel à la prochaine visite.
  const [origineOuvert, setOrigineOuvert] = useState(() => lireRecapHistoOrigineMenuOuvert());

  // Bascule le menu des filtres d'origine et mémorise son état pour la prochaine visite.
  const handleToggleOrigine = () => {
    setOrigineOuvert((o) => {
      const suivant = !o;
      ecrireRecapHistoOrigineMenuOuvert(suivant);
      return suivant;
    });
  };
  // Envoi ouvert en détail (liste des comptes listés + recontact).
  const [detail, setDetail] = useState<RecapRecontactEnvoi | null>(null);
  // Envoi groupé des comptes oubliés de tous les récaps affichés.
  const [oubliesOpen, setOubliesOpen] = useState(false);

  // Borne temporelle du filtre de période (null = tout l'historique).
  const limitePeriode = useMemo(() => {
    const cfg = RECAP_HISTO_PERIODES.find((p) => p.key === periode);
    if (!cfg || cfg.jours === null) return null;
    const d = new Date();
    d.setDate(d.getDate() - cfg.jours);
    return d.getTime();
  }, [periode]);

  // Envois dans la période sélectionnée.
  const dansPeriode = useMemo(() => {
    if (limitePeriode === null) return items;
    return items.filter((e) => {
      const t = new Date(e.envoyeLe).getTime();
      return !Number.isNaN(t) && t >= limitePeriode;
    });
  }, [items, limitePeriode]);

  const nbAuto = useMemo(() => dansPeriode.filter((e) => e.origine === "auto").length, [dansPeriode]);
  const nbTest = useMemo(() => dansPeriode.filter((e) => e.origine === "test").length, [dansPeriode]);

  // Liste affichée (période, puis origine).
  const visibles = useMemo(
    () => (filtre === "tous" ? dansPeriode : dansPeriode.filter((e) => e.origine === filtre)),
    [dansPeriode, filtre],
  );

  // Taux moyen de recontact après récap : moyenne des taux calculables des envois affichés.
  const tauxMoyen = useMemo(() => {
    const taux = visibles.map((e) => e.tauxApres).filter((t): t is number => t !== null);
    if (taux.length === 0) return null;
    return Math.round(taux.reduce((s, t) => s + t, 0) / taux.length);
  }, [visibles]);

  // Un envoi est « sous le seuil » quand son taux est calculable et strictement inférieur.
  const estSousSeuil = (e: RecapRecontactEnvoi) => e.tauxApres !== null && e.tauxApres < seuilAlerte;
  const nbSousSeuil = useMemo(() => visibles.filter(estSousSeuil).length, [visibles, seuilAlerte]);

  // Comptes oubliés (listés et jamais relancés depuis) sur l'ensemble des récaps affichés.
  const oubliesIds = useMemo(() => idsOubliesRecaps(visibles, recontacts), [visibles, recontacts]);

  // Cibles de l'envoi groupé : les comptes oubliés résolus depuis le parc.
  const ciblesOublies: CibleRecontact[] = useMemo(() => {
    const parId = new Map(abos.map((a) => [a.id, a]));
    return [...oubliesIds]
      .map((id) => parId.get(id))
      .filter((a): a is AbonnementItem => a !== undefined)
      .map((a) => ({
        abonnementId: a.id,
        entreprise: a.entreprise,
        email: a.email,
        nbChangements: 0,
      }));
  }, [oubliesIds, abos]);

  const nbAvecEmail = useMemo(() => ciblesOublies.filter((c) => !!c.email).length, [ciblesOublies]);

  const filtres: { key: FiltreOrigine; label: string; count: number }[] = [
    { key: "tous", label: "Tous", count: dansPeriode.length },
    { key: "auto", label: "Automatiques", count: nbAuto },
    { key: "test", label: "Tests", count: nbTest },
  ];

  const toneTaux = (taux: number | null): string => {
    if (taux === null) return "bg-background-200 text-foreground-500";
    if (taux >= 50) return "bg-accent-100 text-accent-800";
    if (taux >= seuilAlerte) return "bg-secondary-100 text-secondary-800";
    return "bg-red-100 text-red-700";
  };

  // Export d'archivage : une ligne par envoi affiché, du plus ancien au plus récent.
  const handleExportCsv = () => {
    const rows = [...visibles]
      .reverse()
      .map((e) => [
        formatShortDate(e.envoyeLe),
        e.origine === "test" ? "Test manuel" : "Automatique",
        e.nbComptes,
        e.tauxApres === null ? "" : `${e.recontactesApres}/${e.nbComptes}`,
        e.tauxApres === null ? "" : `${e.tauxApres} %`,
        estSousSeuil(e) ? "Oui" : "",
      ]);
    downloadCsv(
      `historique-recaps-hebdo-${todayISO()}.csv`,
      toCsv(["Date", "Origine", "Comptes concernés", "Recontactés après", "Taux", "Sous le seuil"], rows),
    );
  };

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-background-200">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
          <i className="ri-history-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-base text-foreground-950">Historique des récaps hebdomadaires</h3>
          <p className="text-xs text-foreground-500">
            Cliquez une ligne pour voir les comptes listés, repérer les oubliés et les relancer. Les envois sous votre seuil d'alerte sont mis en évidence.
          </p>
        </div>
        {!loading && !error && ciblesOublies.length > 0 && (
          <button
            type="button"
            onClick={() => setOubliesOpen(true)}
            disabled={nbAvecEmail === 0}
            title={
              nbAvecEmail === 0
                ? "Aucun compte oublié n'a d'email renseigné"
                : `Recontacter d'un coup les ${ciblesOublies.length} comptes jamais relancés sur les récaps affichés`
            }
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-mail-add-line"></i>
            Relancer les oubliés de tous les récaps affichés
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-background-50/25 text-[10px] font-bold">
              {ciblesOublies.length}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={loading || visibles.length === 0}
          title="Exporter l'historique affiché (date, origine, comptes concernés, taux) au format CSV"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="ri-file-excel-2-line"></i>
          Exporter CSV
        </button>
        <button
          type="button"
          onClick={onReload}
          disabled={loading}
          title="Rafraîchir l'historique"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={`ri-refresh-line ${loading ? "animate-spin" : ""}`}></i>
          Rafraîchir
        </button>
      </div>

      {/* Filtre période + origine + seuil d'alerte + taux moyen de recontact après récap */}
      {!loading && !error && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-background-200 bg-background-50">
          {/* Filtre par plage de dates (mémorisé) */}
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-calendar-line text-foreground-400 text-sm"></i>
            <span className="text-[11px] font-medium text-foreground-600 whitespace-nowrap">Période</span>
            <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
              {RECAP_HISTO_PERIODES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onPeriodeChange(p.key)}
                  aria-pressed={periode === p.key}
                  title={
                    p.jours === null
                      ? "Afficher tout l'historique"
                      : `Afficher uniquement les envois des ${p.jours} derniers jours`
                  }
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    periode === p.key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </span>

          {/* Filtre d'origine : menu repliable « Récap automatiques / tests » (état mémorisé) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleOrigine}
              aria-expanded={origineOuvert}
              title={
                origineOuvert
                  ? "Replier le menu des filtres d'origine (Récap automatiques / tests)"
                  : "Déplier le menu des filtres d'origine (Récap automatiques / tests)"
              }
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
            >
              <i className="ri-filter-3-line text-accent-600"></i>
              Récap : {filtres.find((f) => f.key === filtre)?.label}
              <span className="text-foreground-400">{filtres.find((f) => f.key === filtre)?.count}</span>
              <i className={origineOuvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
            </button>
            {origineOuvert && (
              <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                {filtres.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setFiltre(f.key);
                      ecrireRecapHistoOrigine(f.key);
                    }}
                    aria-pressed={filtre === f.key}
                    title={
                      f.key === "tous"
                        ? "Afficher tous les envois"
                        : f.key === "auto"
                          ? "Isoler uniquement les envois automatiques (planifiés)"
                          : "Isoler uniquement les envois de test manuels"
                    }
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      filtre === f.key ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    {f.key !== "tous" && <i className={f.key === "auto" ? "ri-mail-check-line" : "ri-flask-line"}></i>}
                    {f.label}
                    <span className={filtre === f.key ? "text-background-50/80" : "text-foreground-400"}>{f.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Seuil d'alerte réglable : met en évidence les envois dont le taux est trop faible */}
          <span className="inline-flex items-center gap-1.5 pl-3 border-l border-background-200">
            <i className="ri-alarm-warning-line text-red-500 text-sm"></i>
            <span className="text-[11px] font-medium text-foreground-600 whitespace-nowrap">Alerte si taux &lt;</span>
            <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
              {RECAP_TAUX_ALERTES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSeuilChange(s)}
                  aria-pressed={seuilAlerte === s}
                  title={`Mettre en évidence les récaps dont le taux de recontact après envoi est inférieur à ${s} %`}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    seuilAlerte === s ? "bg-red-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {s} %
                </button>
              ))}
            </div>
          </span>

          {nbSousSeuil > 0 && (
            <span
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold whitespace-nowrap"
              title={`Envois affichés dont le taux de recontact après récap est inférieur à ${seuilAlerte} %`}
            >
              <i className="ri-alert-line"></i>
              {nbSousSeuil} envoi{nbSousSeuil > 1 ? "s" : ""} sous le seuil
            </span>
          )}

          {ciblesOublies.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary-100 text-primary-800 text-[11px] font-semibold whitespace-nowrap"
              title="Comptes listés dans les récaps affichés et jamais relancés depuis"
            >
              <i className="ri-mail-add-line"></i>
              {ciblesOublies.length} compte{ciblesOublies.length > 1 ? "s" : ""} oublié{ciblesOublies.length > 1 ? "s" : ""}
            </span>
          )}

          {tauxMoyen !== null && (
            <span
              className={`ml-auto inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap ${toneTaux(
                tauxMoyen,
              )}`}
              title="Part moyenne des comptes listés qui ont reçu un recontact après l'envoi (selon les filtres actifs)"
            >
              <i className="ri-focus-3-line"></i>
              Taux moyen de recontact après récap : {tauxMoyen} %
            </span>
          )}
        </div>
      )}

      {!loading && !error && visibles.length > 0 && <EvolutionRecapChart items={visibles} />}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm">Chargement de l'historique…</span>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 m-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          <i className="ri-error-warning-line mt-px"></i>
          <div className="flex flex-col gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={onReload}
              className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-100 text-red-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-200 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Réessayer
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-10 px-4 text-center">
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-background-200 text-foreground-400">
            <i className="ri-mail-send-line text-xl"></i>
          </span>
          <p className="text-sm font-medium text-foreground-700">Aucun récap hebdomadaire envoyé pour l'instant</p>
          <p className="text-xs text-foreground-500 max-w-md">
            Dès que la tâche planifiée enverra le premier récap, la date et le nombre de comptes concernés apparaîtront ici.
          </p>
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-8 px-4 text-center text-sm text-foreground-500">
          Aucun envoi {periode !== "tout" ? `sur les ${periode === "30j" ? 30 : 90} derniers jours` : ""}
          {periode !== "tout" && filtre !== "tous" ? " " : ""}
          {filtre === "test" ? "de test" : filtre === "auto" ? "automatique" : ""} dans l'historique.
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibles.map((e) => {
            const sous = estSousSeuil(e);
            return (
              <li key={e.id} className="border-t border-background-200 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setDetail(e)}
                  title="Voir les comptes listés dans ce récap, repérer les oubliés et les recontacter"
                  className={`w-full flex flex-wrap items-center gap-3 px-5 py-3 text-left cursor-pointer transition-colors ${
                    sous ? "bg-red-50 hover:bg-red-100" : "hover:bg-background-50"
                  }`}
                >
                  <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg ${e.origine === "test" ? "bg-secondary-100 text-secondary-700" : "bg-accent-100 text-accent-700"}`}>
                    <i className={e.origine === "test" ? "ri-flask-line" : "ri-mail-check-line"}></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground-950">{formatShortDate(e.envoyeLe)}</p>
                    <p className="text-[11px] text-foreground-500">
                      {e.origine === "test" ? "Test manuel déclenché depuis la page" : "Récap hebdomadaire envoyé"}
                    </p>
                  </div>
                  {sous && (
                    <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
                      <i className="ri-alert-line"></i>
                      Sous le seuil
                    </span>
                  )}
                  {e.origine === "test" && (
                    <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-bold whitespace-nowrap">
                      <i className="ri-flask-line"></i>
                      Test
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-bold whitespace-nowrap">
                    <i className="ri-fire-line"></i>
                    {e.nbComptes} compte{e.nbComptes > 1 ? "s" : ""} concerné{e.nbComptes > 1 ? "s" : ""}
                  </span>
                  {e.autoRelancesApres > 0 && (
                    <span
                      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap"
                      title={`${e.autoRelancesApres} compte(s) listé(s) dans ce récap ont été relancés automatiquement après l'envoi`}
                    >
                      <i className="ri-robot-2-line"></i>
                      Auto-relance{e.autoRelancesApres > 1 ? "s" : ""} : {e.autoRelancesApres}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${toneTaux(e.tauxApres)}`}
                    title={
                      e.tauxApres === null
                        ? "Taux non calculable pour cet envoi (aucun compte listé)"
                        : `${e.recontactesApres} compte(s) sur ${e.nbComptes} ont reçu un recontact après cet envoi`
                    }
                  >
                    <i className="ri-focus-3-line"></i>
                    {e.tauxApres === null ? "— %" : `${e.tauxApres} % recontactés après`}
                  </span>
                  <i className="ri-arrow-right-s-line text-foreground-400"></i>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {detail && (
        <DetailRecapModal
          recap={detail}
          abos={abos}
          recontacts={recontacts}
          seuilLabel="comptes très volatils"
          seuilAlerte={seuilAlerte}
          onClose={() => setDetail(null)}
          onRecontactSent={onRecontactSent}
        />
      )}

      {oubliesOpen && (
        <RecontacterTousModal
          cibles={ciblesOublies}
          seuilLabel="comptes oubliés des récaps affichés"
          onClose={() => setOubliesOpen(false)}
          onSent={onRecontactSent}
        />
      )}
    </div>
  );
}