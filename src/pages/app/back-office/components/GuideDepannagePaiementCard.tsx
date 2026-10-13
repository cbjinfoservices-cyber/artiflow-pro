import { useEffect, useState } from "react";
import { useAlertesConfigStripe } from "@/hooks/useAlertesConfigStripe";
import { formatHorodatage } from "@/lib/diagnosticUi";
import { viderCacheDiagnosticPaiement } from "@/lib/diagnosticPaiementCache";
import {
  testerPaiementBlanc,
  verifierPaiementEur,
  type DiagnosticPaiementEur,
  type DiagnosticPaiementEurDetail,
} from "@/lib/abonnementPaiement";
import DetailDiagnosticPaiementEur from "./DetailDiagnosticPaiementEur";
import DetailCompteStripe from "./DetailCompteStripe";
import {
  lireSessionPaiementCopiee,
  memoriserSessionPaiementCopiee,
} from "@/lib/sessionPaiementCopiee";

/** Étape du guide de dépannage côté Stripe. */
interface EtapeDepannage {
  icon: string;
  titre: string;
  texte: string;
}

/** Causes possibles d'un bandeau « paiement indisponible » et le geste associé. */
const ETAPES: EtapeDepannage[] = [
  {
    icon: "ri-shield-check-line",
    titre: "Vérifier que le compte Stripe est activé",
    texte:
      "Sans activation complète (entreprise, IBAN, représentant, vérification d'identité), aucun encaissement réel n'est possible. Terminer l'activation depuis le bandeau affiché en haut du Dashboard Stripe.",
  },
  {
    icon: "ri-bank-card-line",
    titre: "Activer la carte bancaire",
    texte:
      "Paramètres → Paiements → Moyens de paiement. Trouver « Cartes » et basculer le bouton sur Activé — vérifier qu'elle n'est pas réglée sur Off ou masquée.",
  },
  {
    icon: "ri-settings-3-line",
    titre: "Vérifier la configuration par défaut",
    texte:
      "Le piège classique : la carte semble activée globalement mais elle est décochée dans la configuration de moyens de paiement par défaut / active. L'ouvrir, cocher Cartes, puis enregistrer.",
  },
  {
    icon: "ri-refresh-line",
    titre: "Refaire l'opération en Test ET en Live",
    texte:
      "Le réglage des moyens de paiement est séparé entre le mode Test et le mode Live. Configurer la carte dans les deux, sinon seuls les tests passeront (ou l'inverse).",
  },
  {
    icon: "ri-key-2-line",
    titre: "Reconnecter Stripe si la clé a changé",
    texte:
      "Après une révocation ou un renouvellement de clé secrète, rouvrir le panneau d'intégration Stripe pour que le Backend récupère la nouvelle clé. Sans ça, les paiements échouent avec l'ancienne.",
  },
  {
    icon: "ri-restart-line",
    titre: "Revérifier depuis la page Tarifs",
    texte:
      "Le diagnostic est mis en cache 10 minutes. Cliquer sur « Revérifier maintenant » ci-dessus, ou patienter, pour que le statut repasse à « disponible » et que le bandeau disparaisse.",
  },
  {
    icon: "ri-test-tube-line",
    titre: "Tester un paiement de bout en bout",
    texte:
      "En mode Test, lancer un abonnement avec la carte 4242 4242 4242 4242 (date future, CVC au hasard). Si la page de paiement s'ouvre et que l'abonnement se confirme, le tunnel est bon.",
  },
];

/** Libellé et tonalité associés à une cause détectée par le diagnostic. */
function causeMeta(motif: string): { label: string; icon: string; tone: string } {
  if (motif === "pays") {
    return { label: "Pays / devise non supporté", icon: "ri-earth-line", tone: "bg-secondary-100 text-secondary-800" };
  }
  if (motif === "carte") {
    return { label: "Carte non activée", icon: "ri-bank-card-line", tone: "bg-accent-100 text-accent-900" };
  }
  return { label: "Configuration incomplète", icon: "ri-error-warning-line", tone: "bg-secondary-100 text-secondary-800" };
}

/**
 * Guide de dépannage back-office : « Que faire si le bandeau paiement revient ? ».
 *
 * Il rappelle l'état de la dernière détection (lue depuis les alertes de configuration
 * Stripe) et déroule les gestes à faire côté Stripe, dans l'ordre. Le bouton
 * « Revérifier maintenant » relance le diagnostic en direct et rafraîchit le statut.
 */
export default function GuideDepannagePaiementCard() {
  const { items, loading, reload } = useAlertesConfigStripe(1);
  const [ouvert, setOuvert] = useState(true);
  const [diag, setDiag] = useState<DiagnosticPaiementEur | null>(null);
  const [verifEnCours, setVerifEnCours] = useState(false);
  const [verifErreur, setVerifErreur] = useState<string | null>(null);
  const [testEnCours, setTestEnCours] = useState(false);
  const [testResultat, setTestResultat] = useState<{ etat: "succes" | "erreur"; message: string } | null>(
    null,
  );
  // Dernier identifiant de session de test (cs_…) — réaffiché au retour sur la page
  // grâce à la mémoire navigateur, pour ne pas le perdre entre deux visites.
  const [sessionId, setSessionId] = useState(() => lireSessionPaiementCopiee()?.sessionId ?? "");
  const [copie, setCopie] = useState<"idle" | "ok" | "erreur">("idle");
  const [modeCle, setModeCle] = useState<"test" | "live" | "">("");
  const [cacheVide, setCacheVide] = useState(false);
  const [compte, setCompte] = useState<DiagnosticPaiementEurDetail | null>(null);
  const [compteEnCours, setCompteEnCours] = useState(false);
  const [compteErreur, setCompteErreur] = useState<string | null>(null);

  const derniere = items[0];
  const causeDerniere = derniere ? causeMeta(derniere.motif) : null;

  // Au montage, on interroge le diagnostic uniquement pour connaître le MODE de la clé
  // Stripe branchée (test / live), affiché en badge dans l'en-tête. En cas d'échec, on
  // n'affiche simplement pas le badge.
  useEffect(() => {
    let actif = true;
    verifierPaiementEur()
      .then((r) => {
        if (actif) setModeCle(r.mode);
      })
      .catch(() => {
        /* mode inconnu : on n'affiche pas le badge */
      });
    return () => {
      actif = false;
    };
  }, []);

  // Ouvre une session Stripe en MODE TEST dans un nouvel onglet : valide le tunnel de
  // bout en bout (carte 4242 4242 4242 4242) sans jamais encaisser d'argent réel.
  const lancerTestBlanc = async () => {
    setTestEnCours(true);
    setTestResultat(null);
    setCopie("idle");
    try {
      const { url, sessionId: sid } = await testerPaiementBlanc();
      if (sid) setSessionId(sid);
      window.open(url, "_blank", "noopener,noreferrer");
      setTestResultat({
        etat: "succes",
        message:
          "Session de test ouverte dans un nouvel onglet. Renseignez la carte 4242 4242 4242 4242 (date future, CVC au hasard) pour valider le tunnel de bout en bout — aucune somme réelle n'est prélevée.",
      });
    } catch (e) {
      setTestResultat({
        etat: "erreur",
        message: e instanceof Error ? e.message : "Le test à blanc n'a pas pu être lancé.",
      });
    } finally {
      setTestEnCours(false);
    }
  };

  // Copie l'identifiant de session (cs_…) et le mémorise : c'est le même identifiant que
  // celui consigné dans « Tests à blanc du paiement », ce qui permet de tracer le test.
  const copierSession = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      memoriserSessionPaiementCopiee(sessionId);
      setCopie("ok");
      window.setTimeout(() => setCopie("idle"), 2500);
    } catch {
      setCopie("erreur");
      window.setTimeout(() => setCopie("idle"), 2500);
    }
  };

  const reverifier = async () => {
    setVerifEnCours(true);
    setVerifErreur(null);
    try {
      const resultat = await verifierPaiementEur();
      setDiag(resultat);
      setModeCle(resultat.mode);
      await reload();
    } catch (e) {
      setVerifErreur(e instanceof Error ? e.message : "Vérification impossible pour l'instant.");
    } finally {
      setVerifEnCours(false);
    }
  };

  // Interroge le compte Stripe réellement utilisé par la clé branchée et affiche en clair
  // son nom, son pays et son état d'activation (acct_…). Permet de vérifier qu'on configure
  // bien le bon compte avant d'activer la carte dans le Dashboard Stripe.
  const verifierCompte = async () => {
    setCompteEnCours(true);
    setCompteErreur(null);
    try {
      const resultat = await verifierPaiementEur();
      setDiag(resultat);
      setModeCle(resultat.mode);
      if (resultat.detail) setCompte(resultat.detail);
      else setCompteErreur("Le détail du compte Stripe est indisponible pour l'instant.");
    } catch (e) {
      setCompteErreur(e instanceof Error ? e.message : "Vérification impossible pour l'instant.");
    } finally {
      setCompteEnCours(false);
    }
  };

  // Vide le cache du diagnostic puis relance la vérification : utile après avoir corrigé la
  // configuration Stripe sans repasser par un vrai paiement (sinon le statut reste figé 10 min).
  const viderCache = async () => {
    viderCacheDiagnosticPaiement();
    setCacheVide(true);
    await reverifier();
    window.setTimeout(() => setCacheVide(false), 4000);
  };

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-lifebuoy-line"></i>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-sm text-foreground-950">
                Que faire si le bandeau paiement revient ?
              </h3>
              {modeCle && (
                <span
                  title={
                    modeCle === "live"
                      ? "La clé Stripe branchée opère en mode LIVE : les paiements engagent de vrais montants."
                      : "La clé Stripe branchée opère en mode TEST : aucun montant réel n'est engagé."
                  }
                  className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
                    modeCle === "live"
                      ? "bg-primary-100 text-primary-800"
                      : "bg-accent-100 text-accent-800"
                  }`}
                >
                  <i className={modeCle === "live" ? "ri-live-line" : "ri-test-tube-line"}></i>
                  {modeCle === "live" ? "Mode live" : "Mode test"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-foreground-500">
              Mémo de dépannage côté Stripe, à suivre dans l'ordre.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={verifierCompte}
            disabled={compteEnCours}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 dark:text-foreground-950 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={compteEnCours ? "ri-loader-4-line animate-spin" : "ri-store-2-line"}></i>
            Vérifier le compte Stripe
          </button>
          <button
            type="button"
            onClick={lancerTestBlanc}
            disabled={testEnCours}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={testEnCours ? "ri-loader-4-line animate-spin" : "ri-flask-line"}></i>
            Tester un paiement à blanc
          </button>
          <button
            type="button"
            onClick={copierSession}
            disabled={!sessionId}
            title={
              sessionId
                ? "Copier l'identifiant de session pour le retrouver dans « Tests à blanc du paiement »."
                : "L'identifiant sera disponible après un premier test à blanc."
            }
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i
              className={
                copie === "ok"
                  ? "ri-check-line text-accent-600"
                  : copie === "erreur"
                    ? "ri-error-warning-line text-red-500"
                    : "ri-file-copy-line"
              }
            ></i>
            {copie === "ok" ? "Identifiant copié" : "Copier l'identifiant"}
          </button>
          <button
            type="button"
            onClick={reverifier}
            disabled={verifEnCours}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={verifEnCours ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
            Revérifier maintenant
          </button>
          <button
            type="button"
            onClick={viderCache}
            disabled={verifEnCours}
            title="Vider le cache du diagnostic puis revérifier — utile après une correction de la config Stripe."
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="ri-delete-bin-6-line"></i>
            Vider le cache
          </button>
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className={ouvert ? "ri-eye-off-line" : "ri-eye-line"}></i>
            {ouvert ? "Masquer le guide" : "Afficher le guide"}
          </button>
        </div>
      </div>

      {/* État live : résultat de la vérification directe, sinon dernière détection */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3 border-b border-background-200">
        {diag ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
              <i className="ri-radar-line"></i>
              Vérifié à l'instant
            </span>
            {diag.eurDisponible ? (
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-checkbox-circle-line"></i>
                Paiement carte en euros disponible
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-close-circle-line"></i>
                  Indisponible · {causeMeta(diag.motif).label}
                </span>
                {diag.pays && (
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-medium whitespace-nowrap uppercase">
                    {diag.pays}
                  </span>
                )}
              </>
            )}
          </>
        ) : loading ? (
          <span className="inline-flex items-center gap-2 text-xs text-foreground-500">
            <i className="ri-loader-4-line animate-spin"></i>
            Lecture de la dernière détection…
          </span>
        ) : derniere && causeDerniere ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
              <i className="ri-error-warning-line"></i>
              Dernière détection
            </span>
            <span
              className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${causeDerniere.tone}`}
            >
              <i className={causeDerniere.icon}></i>
              {causeDerniere.label}
            </span>
            {derniere.pays && (
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-medium whitespace-nowrap uppercase">
                {derniere.pays}
              </span>
            )}
            <span className="ml-auto text-[11px] text-foreground-400 whitespace-nowrap">
              {formatHorodatage(derniere.created_at)}
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs text-foreground-600">
            <i className="ri-checkbox-circle-line text-accent-600"></i>
            Aucune détection récente — le paiement carte en euros fonctionne normalement.
          </span>
        )}
      </div>

      {compte && (
        <div className="px-5 py-4 border-b border-background-200">
          <DetailCompteStripe detail={compte} onClose={() => setCompte(null)} />
        </div>
      )}

      {compteErreur && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-background-50 border-b border-background-200">
          <i className="ri-error-warning-line text-red-500"></i>
          <span className="text-xs text-foreground-600">{compteErreur}</span>
        </div>
      )}

      {diag && !diag.eurDisponible && diag.detail ? (
        <div className="px-5 py-4 border-b border-background-200">
          <DetailDiagnosticPaiementEur detail={diag.detail} />
        </div>
      ) : null}

      {verifErreur && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-background-50 border-b border-background-200">
          <i className="ri-error-warning-line text-red-500"></i>
          <span className="text-xs text-foreground-600">{verifErreur}</span>
        </div>
      )}

      {cacheVide && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-accent-100/60 border-b border-background-200">
          <i className="ri-checkbox-circle-line text-accent-600"></i>
          <span className="text-xs text-foreground-600">
            Cache du diagnostic vidé. Le statut ci-dessus a été rafraîchi à l'instant.
          </span>
        </div>
      )}

      {sessionId && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-background-200 bg-background-50">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-hashtag"></i>
            Session de test
          </span>
          <code className="min-w-0 flex-1 truncate text-xs font-mono text-foreground-700" title={sessionId}>
            {sessionId}
          </code>
          <span className="text-[11px] text-foreground-400">
            Même identifiant que dans « Tests à blanc du paiement » ci-dessous.
          </span>
        </div>
      )}

      {copie === "erreur" && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-background-200 bg-background-50">
          <i className="ri-error-warning-line text-red-500"></i>
          <span className="text-xs text-foreground-600">
            La copie automatique n'est pas disponible dans ce navigateur. Sélectionnez l'identifiant ci-dessus pour le copier.
          </span>
        </div>
      )}

      {testResultat && (
        <div
          className={`flex items-start gap-2 px-5 py-2.5 border-b border-background-200 ${
            testResultat.etat === "succes" ? "bg-accent-100/60" : "bg-background-50"
          }`}
        >
          <i
            className={`mt-0.5 ${
              testResultat.etat === "succes"
                ? "ri-checkbox-circle-line text-accent-600"
                : "ri-error-warning-line text-red-500"
            }`}
          ></i>
          <span className="text-xs text-foreground-600 leading-relaxed">{testResultat.message}</span>
        </div>
      )}

      {ouvert && (
        <div className="flex flex-col gap-3 p-5">
          <ol className="flex flex-col gap-2.5">
            {ETAPES.map((etape, i) => (
              <li
                key={etape.titre}
                className="flex gap-3.5 p-3.5 rounded-lg bg-background-50 border border-background-200"
              >
                <div className="flex flex-col items-center shrink-0">
                  <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <i className={`${etape.icon} text-lg`}></i>
                  </span>
                  <span className="mt-1.5 text-[11px] font-bold tabular-nums text-foreground-400">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-semibold text-sm text-foreground-950">{etape.titre}</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-600">{etape.texte}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-start gap-2.5 p-3.5 rounded-lg bg-secondary-100/60 border border-secondary-200">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
              <i className="ri-information-line"></i>
            </span>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-secondary-900">
              Ouvre directement le Dashboard Stripe pour appliquer ces réglages :{" "}
              <a
                href="https://dashboard.stripe.com/settings/payment_methods"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-2 hover:text-primary-700 cursor-pointer"
              >
                Stripe → Moyens de paiement
              </a>
              . Une fois la carte activée (Test et Live), le bandeau se retire de lui-même après la
              prochaine vérification.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}