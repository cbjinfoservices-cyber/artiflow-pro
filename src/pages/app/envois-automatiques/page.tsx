import { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useEnvoisAutomatiques } from "@/hooks/useEnvoisAutomatiques";
import { capacitesEnvoiAuto, executerTestEnvoiAuto } from "@/lib/envoisAutomatiquesActions";
import type { AutoStatut } from "@/lib/envoisAutomatiques";
import DataState from "@/pages/app/components/DataState";
import AutomatisationCard from "@/pages/app/envois-automatiques/components/AutomatisationCard";
import HistoriqueTestsCard from "@/pages/app/envois-automatiques/components/HistoriqueTestsCard";
import RecapHebdoAlertesTauxCard from "@/pages/app/envois-automatiques/components/RecapHebdoAlertesTauxCard";
import RecapHebdoEchecsBlancCard from "@/pages/app/envois-automatiques/components/RecapHebdoEchecsBlancCard";
import BandeauDernierPassageCron from "@/pages/app/envois-automatiques/components/BandeauDernierPassageCron";
import TestABlancPanel from "@/pages/app/envois-automatiques/components/TestABlancPanel";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

/**
 * Formate un délai en millisecondes en compte à rebours court : « dans 3 h 12 », « dans 45 min »,
 * « dans 1 j 4 h ». Sert au badge du titre quand le prochain récap est imminent (< 24 h).
 */
function formatCompteARebours(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const jours = Math.floor(totalMin / 1440);
  const heures = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (jours > 0) return `dans ${jours} j ${heures} h`;
  if (heures > 0) return `dans ${heures} h ${String(minutes).padStart(2, "0")}`;
  return `dans ${minutes} min`;
}

/** Pastille de statut affichée dans l'entête de la section de réglage du récap hebdo. */
const STATUT_RECAP_META: Record<AutoStatut, { label: string; icon: string; tone: string; dot: string }> = {
  ok: { label: "À jour", icon: "ri-checkbox-circle-line", tone: "bg-accent-100 text-accent-800", dot: "bg-accent-500" },
  attention: { label: "À vérifier", icon: "ri-error-warning-line", tone: "bg-red-100 text-red-700", dot: "bg-red-500" },
  inactif: { label: "Coupé", icon: "ri-pause-circle-line", tone: "bg-background-200 text-foreground-600", dot: "bg-background-300" },
  inconnu: { label: "Sans suivi", icon: "ri-question-line", tone: "bg-secondary-100 text-secondary-800", dot: "bg-secondary-500" },
};

/** Filtres par statut proposés au-dessus de la liste des automatisations. */
const FILTRES_STATUT: { value: AutoStatut | "tous"; label: string; icon: string }[] = [
  { value: "tous", label: "Tous", icon: "ri-list-check-2" },
  { value: "ok", label: "À jour", icon: "ri-checkbox-circle-line" },
  { value: "attention", label: "À vérifier", icon: "ri-error-warning-line" },
  { value: "inactif", label: "En pause", icon: "ri-pause-circle-line" },
];

export default function AppEnvoisAutomatiques() {
  usePageMeta(
    "Envois automatiques · ArtiFlow-pro",
    "Vérifiez le dernier passage, l'état et la prochaine exécution de chaque envoi automatique d'ArtiFlow-pro.",
  );
  const { user } = useAuth();
  const { items, loading, error, reload } = useEnvoisAutomatiques();
  const userId = user?.id ?? "";

  // Filtre par statut + clé de rafraîchissement de l'historique des tests.
  const [filtreStatut, setFiltreStatut] = useState<AutoStatut | "tous">("tous");
  const [historiqueKey, setHistoriqueKey] = useState(0);

  // Guide de première visite : ouvert au premier passage, puis mémorisé une fois fermé par l'artisan.
  // Il ne réapparaît plus ensuite, sauf si l'on clique « Revoir le guide des envois automatiques ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("envois-automatiques"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("envois-automatiques");
    setGuideVisible(false);
  };

  // Re-test en série des automatisations « à vérifier ».
  const [relanceEnCours, setRelanceEnCours] = useState(false);
  const [relanceResume, setRelanceResume] = useState<string | null>(null);

  const stats = useMemo(() => {
    const aJour = items.filter((i) => i.statut === "ok").length;
    const attention = items.filter((i) => i.statut === "attention").length;
    const inactifs = items.filter((i) => i.statut === "inactif").length;
    const inconnu = items.filter((i) => i.statut === "inconnu").length;
    return { total: items.length, aJour, attention, inactifs, inconnu };
  }, [items]);

  const itemsAffiches = useMemo(
    () => (filtreStatut === "tous" ? items : items.filter((i) => i.statut === filtreStatut)),
    [items, filtreStatut],
  );

  // État du récap hebdo des alertes de taux, résumé dans l'entête de sa section de réglage.
  const recapAlertesTaux = useMemo(
    () => items.find((i) => i.id === "recap-hebdo-alertes-taux") ?? null,
    [items],
  );

  // Horloge légère (rafraîchie toutes les 30 s) pour un compte à rebours vivant du prochain récap.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setMaintenant(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Écart (ms) avant le prochain envoi du récap : renseigné uniquement s'il tombe dans moins de 24 h.
  const recapDans = useMemo(() => {
    if (!recapAlertesTaux?.actif || !recapAlertesTaux.prochaine) return null;
    const t = new Date(recapAlertesTaux.prochaine).getTime();
    if (Number.isNaN(t)) return null;
    const diff = t - maintenant;
    if (diff < 0 || diff >= 24 * 60 * 60 * 1000) return null;
    return diff;
  }, [recapAlertesTaux, maintenant]);

  /** Libellé lisible du filtre de statut actif (pour l'état vide). */
  const labelFiltre =
    filtreStatut === "ok"
      ? "À jour"
      : filtreStatut === "inactif"
        ? "En pause"
        : filtreStatut === "inconnu"
          ? "Sans suivi"
          : "À vérifier";

  // Automatisations « à vérifier » dont un test réel est possible (destinataire = l'artisan).
  const aRetester = useMemo(
    () => items.filter((i) => i.statut === "attention" && capacitesEnvoiAuto(i.id).test),
    [items],
  );

  const handleReTester = async () => {
    if (relanceEnCours || aRetester.length === 0 || !userId) return;
    setRelanceEnCours(true);
    setRelanceResume(null);
    let ok = 0;
    let ko = 0;
    // Tests lancés en série, un par un, pour ne pas saturer les envois.
    for (const item of aRetester) {
      const res = await executerTestEnvoiAuto(item.id, item.nom, userId);
      if (res.ok) ok += 1;
      else ko += 1;
    }
    setRelanceEnCours(false);
    setHistoriqueKey((k) => k + 1);
    const ignorees = stats.attention - aRetester.length;
    const parts = [`${ok} test(s) réussi(s)`];
    if (ko > 0) parts.push(`${ko} en échec`);
    if (ignorees > 0) parts.push(`${ignorees} sans test possible (destinataire tiers)`);
    setRelanceResume(`${aRetester.length} test(s) lancé(s) en série : ${parts.join(", ")}.`);
  };

  return (
    <DataState loading={loading} error={error} onRetry={() => { void reload(); }}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading font-semibold text-lg text-foreground-950">Envois automatiques</h2>
            <p className="text-sm text-foreground-500 mt-0.5 max-w-2xl">
              Un coup d'œil sur tout ce qui part tout seul : ce qui a déjà été envoyé, l'état de chaque envoi et
              quand il repartira.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void reload(); }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Rafraîchir
          </button>
        </div>

        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : vos envois qui partent tout seuls"
            sousTitre="Voici, en 4 repères, comment surveiller ce qui s'envoie automatiquement à votre place. Rien à installer ni à programmer : tout se règle et se vérifie depuis cet écran."
            etapes={[
              {
                icone: "ri-dashboard-3-line",
                titre: "Vérifiez d'un coup d'œil",
                texte:
                  "Les compteurs en haut résument la situation : combien d'envois sont suivis, combien vont bien, combien sont à vérifier.",
              },
              {
                icone: "ri-error-warning-line",
                titre: "Repérez ce qui coince",
                texte:
                  "Cliquez le filtre « À vérifier » pour ne voir que les envois qui demandent votre attention. Tout le reste s'occupe de lui-même.",
              },
              {
                icone: "ri-restart-line",
                titre: "Testez d'un clic",
                texte:
                  "Le bouton « Re-tester » vous envoie un email d'exemple à vous-même : vous voyez tout de suite si ça fonctionne, sans rien envoyer au client.",
              },
              {
                icone: "ri-settings-3-line",
                titre: "Réglez le rythme",
                texte:
                  "Plus bas, chaque section de réglage a un interrupteur et un jour/heure : vous décidez si et quand le message part.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Pour le revoir, cliquez « Revoir le guide des envois automatiques » sous l'en-tête."
            onFermer={fermerGuide}
          />
        )}

        {!guideVisible && (
          <button
            type="button"
            onClick={() => setGuideVisible(true)}
            className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-accent-700 transition-colors"
          >
            <i className="ri-question-line"></i>
            Revoir le guide des envois automatiques
          </button>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-background-100 border border-background-200">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Envois suivis</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg bg-accent-50 border border-accent-200">
            <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide">Tout va bien</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{stats.aJour}</p>
          </div>
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">À vérifier</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{stats.attention}</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary-50 border border-secondary-200">
            <p className="text-[11px] font-semibold text-secondary-700 uppercase tracking-wide">En pause</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{stats.inactifs}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <i className="ri-lightbulb-line"></i>
          </span>
          <p className="text-xs text-foreground-600 leading-relaxed">
            Ces envois partent tout seuls, à l'heure prévue : vous n'avez rien à faire. Les dates de
            <strong> « dernier envoi »</strong> viennent des envois réellement effectués. Si un envoi n'est jamais parti,
            le déclenchement dépend de la tâche planifiée côté plateforme (voir le guide de configuration des tâches
            planifiées). Les dates de
            <strong> « prochain envoi »</strong> sont calculées d'après vos réglages (jour et heure choisis).
          </p>
        </div>

        <BandeauDernierPassageCron />

        <TestABlancPanel items={items} userId={userId} />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="tablist"
                aria-label="Filtrer les automatisations par statut"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200"
              >
                {FILTRES_STATUT.map((f) => {
                  const actif = filtreStatut === f.value;
                  const count =
                    f.value === "tous"
                      ? stats.total
                      : f.value === "ok"
                        ? stats.aJour
                        : f.value === "attention"
                          ? stats.attention
                          : stats.inactifs;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      role="tab"
                      aria-selected={actif}
                      onClick={() => setFiltreStatut(f.value)}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        actif ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      <i className={f.icon}></i>
                      {f.label}
                      <span
                        className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold ${
                          actif ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
                {stats.inconnu > 0 && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filtreStatut === "inconnu"}
                    onClick={() => setFiltreStatut("inconnu")}
                    title="Envois dont on ne garde pas la date de passage en base"
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      filtreStatut === "inconnu" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    <i className="ri-question-line"></i>
                    Sans suivi
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold ${
                        filtreStatut === "inconnu" ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      {stats.inconnu}
                    </span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => { void handleReTester(); }}
                disabled={relanceEnCours || aRetester.length === 0 || !userId}
                title={
                  aRetester.length === 0
                    ? "Aucune automatisation à vérifier ne peut être testée (destinataire tiers)"
                    : "Lancer en série un email de test à votre adresse pour chaque automatisation à vérifier"
                }
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {relanceEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-restart-line"></i>}
                Re-tester les automatisations à vérifier
                {aRetester.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-background-50/25 text-background-50">
                    {aRetester.length}
                  </span>
                )}
              </button>
            </div>
            {filtreStatut !== "tous" && (
              <p className="text-xs text-foreground-500">
                {itemsAffiches.length} automatisation{itemsAffiches.length > 1 ? "s" : ""} affichée
                {itemsAffiches.length > 1 ? "s" : ""} pour ce filtre.
              </p>
            )}
          </div>
          {relanceResume && (
            <p className="flex items-start gap-2 text-xs text-foreground-600 leading-relaxed">
              <i className="ri-information-line mt-px shrink-0 text-primary-600"></i>
              <span>{relanceResume}</span>
            </p>
          )}
        </div>

        {itemsAffiches.length === 0 ? (
          <p className="flex items-center justify-center gap-2 p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            {filtreStatut === "tous" ? (
              "Aucune automatisation à afficher pour l'instant."
            ) : filtreStatut === "attention" ? (
              <>
                <i className="ri-checkbox-circle-line text-accent-600"></i>
                Aucune automatisation à vérifier. Tout est en ordre.
              </>
            ) : (
              `Aucune automatisation « ${labelFiltre} » pour l'instant.`
            )}
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {itemsAffiches.map((item) => (
              <AutomatisationCard
                key={item.id}
                item={item}
                userId={userId}
                onTestEnregistre={() => setHistoriqueKey((k) => k + 1)}
              />
            ))}
          </div>
        )}

        <section id="reglages-recap-alertes-taux" className="flex flex-col gap-3 scroll-mt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
                <i className="ri-settings-3-line"></i>
              </span>
              <div>
                <h3 className="font-heading font-semibold text-base text-foreground-950 flex flex-wrap items-center gap-2">
                  Réglage du récap hebdo des alertes de taux
                  {recapDans !== null && (
                    <span
                      className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap animate-pulse"
                      title={`Prochain récap dans moins de 24 h — ${recapAlertesTaux?.prochaineLibelle}`}
                    >
                      <i className="ri-timer-flash-line text-[11px]"></i>
                      Prochain récap {formatCompteARebours(recapDans)}
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-foreground-500 max-w-2xl leading-relaxed">
                  Pilotez ici, au même endroit que vos autres envois automatiques, l'envoi de la synthèse
                  hebdomadaire des alertes de taux de réussite (interrupteur, jour et heure).
                </p>
              </div>
            </div>

            {/* Mini-résumé : statut + prochaine date du récap hebdo des alertes de taux. */}
            {recapAlertesTaux && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold whitespace-nowrap ${STATUT_RECAP_META[recapAlertesTaux.statut].tone}`}
                  title="État du récap hebdo des alertes de taux"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUT_RECAP_META[recapAlertesTaux.statut].dot}`}></span>
                  {STATUT_RECAP_META[recapAlertesTaux.statut].label}
                </span>
                {recapAlertesTaux.actif ? (
                  <span
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap"
                    title="Prochaine date d'envoi prévue du récap hebdo"
                  >
                    <i className="ri-calendar-schedule-line text-accent-600"></i>
                    Prochain récap : {recapAlertesTaux.prochaineLibelle}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-500 text-[11px] font-semibold whitespace-nowrap"
                    title="Le récap hebdo des alertes de taux est désactivé"
                  >
                    <i className="ri-notification-off-line"></i>
                    Désactivé — aucun envoi prévu
                  </span>
                )}
              </div>
            )}
          </div>
          <RecapHebdoAlertesTauxCard />
        </section>

        <section id="reglages-recap-echecs-blanc" className="flex flex-col gap-3 scroll-mt-6">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-red-100 text-red-700 text-lg">
              <i className="ri-settings-3-line"></i>
            </span>
            <div>
              <h3 className="font-heading font-semibold text-base text-foreground-950">
                Réglage du récap hebdo des échecs test à blanc
              </h3>
              <p className="mt-0.5 text-xs text-foreground-500 max-w-2xl leading-relaxed">
                Programmez ici l'envoi hebdomadaire du récapitulatif d'échecs de vos rejeux « test à blanc »
                (CSV en pièce jointe), au même endroit que vos autres envois automatiques.
              </p>
            </div>
          </div>
          <RecapHebdoEchecsBlancCard />
        </section>

        <HistoriqueTestsCard userId={userId} refreshKey={historiqueKey} />
      </div>
    </DataState>
  );
}