import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { SanteHistoriquePoint } from "@/hooks/useSanteHistorique";
import { useAuth } from "@/hooks/useAuth";
import { updateSanteAlerteSnooze } from "@/lib/artisanApi";
import { todayISO } from "@/lib/dates";
import { lireSeuilSante, SEUIL_SANTE_EVENT } from "@/lib/santeSeuil";
import { ecrireDerniereSemaineConsultee } from "@/lib/santeSemaine";

interface Props {
  /** Les 12 derniers points de score, du plus ancien au plus récent. */
  points: SanteHistoriquePoint[];
}

/** Libellé court d'une semaine (« 8 sept. »). */
function semaineLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Date lisible en français à partir d'une date « AAAA-MM-JJ ». */
function dateFR(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Date « AAAA-MM-JJ » à N jours d'aujourd'hui, pour proposer une mise de côté par défaut. */
function dansNJours(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Bandeau d'alerte du tableau de bord : il se déclenche quand le score de « Santé du compte »
 * reste sous le seuil choisi pendant deux semaines consécutives. Le seuil est celui réglé dans
 * le mini-graphe de tendance : le bandeau lit la même valeur partagée et se met à jour dès que
 * l'artisan la change. Il met en avant les deux semaines concernées et propose des raccourcis
 * pour agir tout de suite sur les relances et la régularité comptable.
 *
 * L'alerte peut être mise de côté jusqu'à une date choisie (comme l'alerte « bilan manquant ») :
 * elle se remplace alors par une ligne discrète avec la date et un bouton de réactivation.
 */
export default function AlerteSanteBaisse({ points }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [seuil, setSeuil] = useState<number>(() => lireSeuilSante());
  // Mise de côté de l'alerte : date choisie + état du panneau + indicateur d'enregistrement.
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  // Raccourci « Reprendre » : ouvre le choix de la vue (relances / comptabilité) de la semaine concernée.
  const [reprendreOpen, setReprendreOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(dansNJours(30));
  const [snoozeBusy, setSnoozeBusy] = useState(false);

  const snoozeJusqu = profile?.sante_alerte_snooze ?? null;
  const snoozeActif = Boolean(snoozeJusqu && snoozeJusqu >= todayISO());

  // Suit immédiatement le seuil quand l'artisan le change dans le mini-graphe (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setSeuil(lireSeuilSante());
    window.addEventListener(SEUIL_SANTE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEUIL_SANTE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Il faut au moins deux semaines mesurées pour parler de deux semaines de suite.
  if (points.length < 2) return null;
  const derniere = points[points.length - 1];
  const precedente = points[points.length - 2];

  // Alerte uniquement si les deux dernières semaines sont toutes les deux sous le seuil.
  if (!(derniere.score < seuil && precedente.score < seuil)) return null;

  // Baisse ou aggravation entre les deux semaines (pour le message).
  const delta = derniere.score - precedente.score;

  // Semaine la plus récente des deux semaines sous le seuil : c'est elle que rouvre le raccourci.
  const semaineConcernee = derniere.semaine;

  // Rouvre la vue choisie pour la semaine concernée, et la mémorise comme « dernière consultée »
  // (le raccourci de l'en-tête de « Santé du compte » et du graphe reste ainsi synchronisé).
  const reprendre = (cible: "relances" | "comptabilite") => {
    ecrireDerniereSemaineConsultee({ semaine: semaineConcernee, cible });
    setReprendreOpen(false);
    if (cible === "relances") {
      navigate(`/app/relances-programmees?statut=all&semaine=${semaineConcernee}`);
    } else {
      navigate(`/app/comptabilite?semaine=${semaineConcernee}`);
    }
  };

  // Met de côté l'alerte jusqu'à la date choisie : elle ne s'affichera plus jusque-là.
  const handleSnooze = async (date: string) => {
    if (!user || !date) return;
    setSnoozeBusy(true);
    try {
      await updateSanteAlerteSnooze(user.id, date);
      await refreshProfile();
      setSnoozeOpen(false);
    } catch {
      /* confort : l'échec laisse simplement l'alerte affichée */
    } finally {
      setSnoozeBusy(false);
    }
  };

  // Réactive immédiatement l'alerte mise de côté.
  const handleReactiver = async () => {
    if (!user) return;
    setSnoozeBusy(true);
    try {
      await updateSanteAlerteSnooze(user.id, null);
      await refreshProfile();
    } catch {
      /* confort */
    } finally {
      setSnoozeBusy(false);
    }
  };

  // Alerte mise de côté : on affiche une ligne discrète avec la date et un moyen de réactiver.
  if (snoozeActif) {
    return (
      <div className="p-3 rounded-lg bg-background-100 border border-background-200 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-eye-off-line"></i>
          Alerte « santé du compte sous le seuil » mise de côté jusqu'au{" "}
          <strong className="text-foreground-700">{snoozeJusqu ? dateFR(snoozeJusqu) : "—"}</strong>.
        </p>
        <button
          type="button"
          onClick={handleReactiver}
          disabled={snoozeBusy}
          title="Réafficher tout de suite l'alerte de santé du compte"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {snoozeBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-eye-line"></i>}
          Réactiver l'alerte
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-red-50 border border-red-300 flex items-start gap-3 animate-fade-in">
      <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-700 text-lg">
        <i className="ri-alarm-warning-line"></i>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-red-800">Alerte : santé du compte sous le seuil 2 semaines de suite</p>
          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
            seuil {seuil}/100
          </span>
        </div>
        <p className="mt-0.5 text-xs text-red-700">
          Le score est resté sous <strong>{seuil}</strong> deux semaines d'affilée : {semaineLabel(precedente.semaine)} (
          {precedente.score}) puis {semaineLabel(derniere.semaine)} ({derniere.score})
          {delta < 0 ? `, soit une baisse de ${Math.abs(delta)} pts` : ""}. Vérifiez vos échecs de relance et vos emails
          clients manquants.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to="/app/relances"
            title="Ouvrir la page Relances pour corriger les envois en échec"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-notification-3-line"></i>
            Ouvrir les relances
          </Link>
          <Link
            to="/app/comptabilite?manquants=1"
            title="Ouvrir la régularité comptable sur les mois restés sans envoi"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-red-200 text-red-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
          >
            <i className="ri-file-chart-line"></i>
            Régularité comptable
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setReprendreOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={reprendreOpen}
              title={`Rouvrir la semaine du ${semaineLabel(semaineConcernee)} (la plus récente sous le seuil)`}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                reprendreOpen
                  ? "bg-accent-100 border-accent-300 text-accent-800"
                  : "bg-background-50 border-red-200 text-red-700 hover:bg-red-100"
              }`}
            >
              <i className="ri-history-line"></i>
              Reprendre : {semaineLabel(semaineConcernee)}
            </button>
            {reprendreOpen && (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Fermer le menu de reprise de semaine"
                  onClick={() => setReprendreOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                ></button>
                <div className="absolute z-50 top-full mt-1.5 left-0 w-56 p-2 rounded-md bg-background-50 border border-background-200 flex flex-col gap-1">
                  <p className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                    Semaine du {semaineLabel(semaineConcernee)} · {derniere.score}/100
                  </p>
                  <button
                    type="button"
                    onClick={() => reprendre("relances")}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-notification-3-line"></i>
                    Relances de la semaine
                  </button>
                  <button
                    type="button"
                    onClick={() => reprendre("comptabilite")}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                  >
                    <i className="ri-file-chart-line"></i>
                    Comptabilité de la semaine
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSnoozeDate(dansNJours(30));
              setSnoozeOpen((v) => !v);
            }}
            title="Masquer cette alerte jusqu'à une date choisie, le temps d'attendre"
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              snoozeOpen
                ? "bg-red-100 border-red-300 text-red-700"
                : "bg-background-50 border-red-200 text-red-700 hover:bg-red-100"
            }`}
          >
            <i className="ri-eye-off-line"></i>
            Mettre de côté
          </button>
        </div>

        {snoozeOpen && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 p-3 rounded-md bg-background-50 border border-red-200 animate-fade-in">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">
                Masquer jusqu'au
              </span>
              <input
                type="date"
                value={snoozeDate}
                min={todayISO()}
                onChange={(e) => setSnoozeDate(e.target.value)}
                className="h-9 px-3 rounded-md bg-background-100 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleSnooze(snoozeDate)}
              disabled={!snoozeDate || snoozeBusy}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {snoozeBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-eye-off-line"></i>}
              Mettre de côté
            </button>
            {[7, 30, 90].map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setSnoozeDate(dansNJours(j))}
                title={`Masquer l'alerte pendant ${j} jours`}
                className="inline-flex items-center h-9 px-3 rounded-md bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
              >
                +{j} j
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSnoozeOpen(false)}
              className="inline-flex items-center h-9 px-3 rounded-md bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}