import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useComptableMoisManquants } from "@/hooks/useComptableMoisManquants";
import { useAuth } from "@/hooks/useAuth";
import { useSanteHistorique } from "@/hooks/useSanteHistorique";
import type { ClientItem, EscaladeJournalItem } from "@/hooks/useArtisanData";
import CompleterEmailsModal from "@/pages/app/components/CompleterEmailsModal";
import SanteHistoriqueChart from "@/pages/app/dashboard/components/SanteHistoriqueChart";
import AlerteSanteBaisse from "@/pages/app/dashboard/components/AlerteSanteBaisse";
import Infobulle from "@/components/base/Infobulle";
import {
  lireDerniereSemaineConsultee,
  SANTE_SEMAINE_EVENT,
  type DerniereSemaineConsultee,
} from "@/lib/santeSemaine";

/** Libellé court d'une semaine (« 8 sept. »). */
function semaineLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

interface Props {
  /** Tous les clients de l'artisan (pour repérer ceux sans adresse email). */
  clients: ClientItem[];
  /** Journal des passages d'escalade (pour compter les échecs d'envoi récents). */
  escaladeJournal: EscaladeJournalItem[];
  /** Recharge les clients après une complétion d'email. */
  onClientsChanged: () => Promise<void> | void;
}

/** Une ligne de synthèse de la santé du compte. */
interface Ligne {
  key: string;
  icon: string;
  titre: string;
  detail: string;
  ok: boolean;
  /** Valeur affichée (compteur) — 0 quand tout va bien. */
  valeur: number;
  /** Libellé de l'action corrective, ou null si rien à faire. */
  action: string | null;
}

/**
 * Panneau « Santé du compte » du tableau de bord : synthétise en un coup d'œil les trois
 * points de vigilance qui bloquent le bon fonctionnement d'ArtiFlow-pro — les clients sans
 * email (relances impossibles), les échecs d'envoi récents et la régularité de l'envoi
 * comptable — avec une action directe pour chacun.
 */
export default function SanteCompteCard({ clients, escaladeJournal, onClientsChanged }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const moisManquants = useComptableMoisManquants();
  const [emailsOpen, setEmailsOpen] = useState(false);
  // Dernière semaine consultée depuis le mini-graphe de tendance : reproposée en raccourci
  // dans l'en-tête du panneau, donc visible sans faire défiler le graphe.
  const [derniereSemaine, setDerniereSemaine] = useState<DerniereSemaineConsultee | null>(() =>
    lireDerniereSemaineConsultee(),
  );

  // Suit immédiatement le changement quand une barre du graphe est consultée (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setDerniereSemaine(lireDerniereSemaineConsultee());
    window.addEventListener(SANTE_SEMAINE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SANTE_SEMAINE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Clients sans adresse email : cause récurrente des relances impossibles.
  const emailsManquants = useMemo(
    () => clients.filter((c) => !c.email || !c.email.trim()).length,
    [clients],
  );

  // Échecs d'envoi des 7 derniers jours (tous passages d'escalade confondus).
  const echecs = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    let total = 0;
    let passages = 0;
    escaladeJournal.forEach((run) => {
      const t = Date.parse(run.run_at);
      if (Number.isNaN(t) || t < cutoff) return;
      if (run.echoue > 0) {
        total += run.echoue;
        passages += 1;
      }
    });
    return { total, passages };
  }, [escaladeJournal]);

  const lignes: Ligne[] = [
    {
      key: "emails",
      icon: "ri-mail-line",
      titre: "Emails manquants",
      detail:
        emailsManquants > 0
          ? `${emailsManquants} client${emailsManquants > 1 ? "s" : ""} sans adresse : impossible de les relancer par email.`
          : "Tous vos clients ont une adresse email.",
      ok: emailsManquants === 0,
      valeur: emailsManquants,
      action: emailsManquants > 0 ? "Compléter les emails" : null,
    },
    {
      key: "echecs",
      icon: "ri-error-warning-line",
      titre: "Relances en échec",
      detail:
        echecs.total > 0
          ? `${echecs.total} envoi${echecs.total > 1 ? "s" : ""} raté${echecs.total > 1 ? "s" : ""} sur ${echecs.passages} passage${echecs.passages > 1 ? "s" : ""} (7 derniers jours).`
          : "Aucun échec d'envoi ces 7 derniers jours.",
      ok: echecs.total === 0,
      valeur: echecs.total,
      action: echecs.total > 0 ? "Voir et réessayer" : null,
    },
    {
      key: "compta",
      icon: "ri-file-chart-line",
      titre: "Régularité comptable",
      detail:
        moisManquants > 0
          ? `${moisManquants} mois attendu${moisManquants > 1 ? "s" : ""} resté${moisManquants > 1 ? "s" : ""} sans envoi automatique au comptable.`
          : "Vos envois comptables automatiques sont à jour.",
      ok: moisManquants === 0,
      valeur: moisManquants,
      action: moisManquants > 0 ? "Ouvrir la régularité" : null,
    },
  ];

  const nbProblemes = lignes.filter((l) => !l.ok).length;

  // Score de santé : 100 quand tout est en ordre, dégressif selon l'ampleur des points de vigilance.
  const score = useMemo(() => {
    const penalite =
      Math.min(emailsManquants * 8, 40) + Math.min(echecs.total * 6, 30) + Math.min(moisManquants * 10, 30);
    return Math.max(0, Math.min(100, Math.round(100 - penalite)));
  }, [emailsManquants, echecs.total, moisManquants]);

  // Historique du score sur les 12 dernières semaines : la semaine en cours est enregistrée,
  // les semaines passées sont complétées pour rendre la tendance lisible dès la première visite.
  const { points: historique, tendance } = useSanteHistorique({
    userId: user?.id ?? null,
    ready: true,
    emailsManquants,
    echecs: echecs.total,
    moisManquants,
    escaladeJournal,
  });

  // Raccourci « Reprendre la semaine du X » : seulement si la semaine mémorisée est encore
  // dans la fenêtre affichée (sinon il n'y a plus de semaine à rouvrir).
  const resume =
    derniereSemaine && historique.some((p) => p.semaine === derniereSemaine.semaine) ? derniereSemaine : null;

  /** Rouvre la même vue que la dernière fois, pour la semaine mémorisée. */
  const rouvrirSemaine = () => {
    if (!resume) return;
    if (resume.cible === "relances") {
      navigate(`/app/relances-programmees?statut=all&semaine=${resume.semaine}`);
    } else {
      navigate(`/app/comptabilite?semaine=${resume.semaine}`);
    }
  };

  const statut =
    nbProblemes === 0
      ? { label: "Tout est en ordre", cls: "bg-accent-100 text-accent-800", barCls: "bg-accent-500", icon: "ri-shield-check-line" }
      : nbProblemes === 1
        ? { label: "À surveiller", cls: "bg-secondary-100 text-secondary-800", barCls: "bg-secondary-500", icon: "ri-alert-line" }
        : { label: "À corriger", cls: "bg-red-100 text-red-700", barCls: "bg-red-500", icon: "ri-error-warning-line" };

  return (
    <div id="sante-compte" className="scroll-mt-24 rounded-lg bg-background-100 border border-background-200 p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-heart-pulse-line text-xl"></i>
          </span>
          <div className="min-w-0">
            <h2 className="font-heading font-semibold text-base text-foreground-950 inline-flex items-center gap-1.5">
              Santé du compte
              <Infobulle
                contenu="Un résumé de ce qui peut freiner vos relances et votre comptabilité : clients sans email, envois en échec, mois comptables oubliés. Plus le score est haut, mieux c'est."
                position="haut"
                largeur={265}
              >
                <i className="ri-information-line text-foreground-300 hover:text-foreground-600 cursor-help text-sm"></i>
              </Infobulle>
            </h2>
            <p className="text-xs text-foreground-500 mt-0.5">
              Les points qui peuvent freiner vos relances et votre comptabilité, en un coup d'œil.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {resume && (
            <button
              type="button"
              onClick={rouvrirSemaine}
              title={`Rouvrir ${resume.cible === "relances" ? "les relances" : "la comptabilité"} de la semaine du ${semaineLabel(resume.semaine)} (dernière consultée)`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-100 border border-accent-300 text-accent-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
            >
              <i className="ri-history-line"></i>
              Reprendre : {semaineLabel(resume.semaine)}
              <span className="text-accent-600">· {resume.cible === "relances" ? "Relances" : "Comptabilité"}</span>
            </button>
          )}
          <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap ${statut.cls}`}>
            <i className={statut.icon}></i>
            {statut.label}
          </span>
        </div>
      </div>

      {/* Score global */}
      <div className="flex items-center gap-4 p-3.5 rounded-md bg-background-50 border border-background-200">
        <div className="flex flex-col items-center justify-center shrink-0">
          <span className="font-heading font-bold text-3xl text-foreground-950 leading-none">{score}</span>
          <span className="text-[10px] font-semibold text-foreground-400 uppercase tracking-wide mt-1">/ 100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-900">
            {nbProblemes === 0
              ? "Votre compte est en pleine forme."
              : `${nbProblemes} point${nbProblemes > 1 ? "s" : ""} d'attention détecté${nbProblemes > 1 ? "s" : ""}.`}
          </p>
          <div className="mt-2 h-2 rounded-full bg-background-200 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${statut.barCls}`} style={{ width: `${score}%` }}></div>
          </div>
        </div>
      </div>

      {/* Alerte si le score reste sous le seuil choisi deux semaines de suite */}
      <AlerteSanteBaisse points={historique} />

      {/* Tendance du score sur 12 semaines : montre si la santé du compte s'améliore dans le temps */}
      <SanteHistoriqueChart points={historique} tendance={tendance} />

      {/* Détail par axe */}
      <ul className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {lignes.map((l) => (
          <li
            key={l.key}
            className={`flex flex-col gap-2 p-3.5 rounded-md border ${
              l.ok ? "bg-background-50 border-background-200" : "bg-background-50 border-secondary-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full ${
                  l.ok ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-800"
                }`}
              >
                <i className={l.ok ? "ri-check-line" : l.icon}></i>
              </span>
              <span className="text-sm font-semibold text-foreground-950">{l.titre}</span>
              {!l.ok && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-secondary-500 text-background-50 text-[11px] font-bold">
                  {l.valeur}
                </span>
              )}
            </div>
            <p className="text-[11px] text-foreground-500 leading-relaxed min-h-[32px]">{l.detail}</p>
            {l.action ? (
              <button
                type="button"
                onClick={() => {
                  if (l.key === "emails") setEmailsOpen(true);
                  else if (l.key === "echecs") navigate("/app/relances");
                  else navigate("/app/comptabilite?manquants=1");
                }}
                className="mt-auto inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              >
                <i className="ri-arrow-right-line"></i>
                {l.action}
              </button>
            ) : (
              <span className="mt-auto inline-flex items-center gap-1.5 h-8 text-[11px] text-accent-700 font-semibold">
                <i className="ri-checkbox-circle-line"></i>
                Rien à faire
              </span>
            )}
          </li>
        ))}
      </ul>

      {emailsOpen && (
        <CompleterEmailsModal
          clients={clients}
          onClose={() => setEmailsOpen(false)}
          onSaved={onClientsChanged}
        />
      )}
    </div>
  );
}