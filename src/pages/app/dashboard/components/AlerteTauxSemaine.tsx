import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { RelanceClientItem } from "@/lib/relancesClient";
import { useAuth } from "@/hooks/useAuth";
import { updateTauxAlerteSnooze } from "@/lib/artisanApi";
import { todayISO } from "@/lib/dates";
import { lireSeuilTaux, SEUIL_TAUX_EVENT } from "@/lib/tauxSeuil";

interface Props {
  /** Relances client (programmées + traitées) : on ne regarde que les relances déjà traitées. */
  relances: RelanceClientItem[];
}

/** Une relance est « en échec » quand son statut contient « échec ». */
function estEnEchec(statut: string): boolean {
  return /chec/i.test(statut);
}

/** Fenêtre d'observation de l'alerte : la semaine glissante écoulée (7 jours). */
const FENETRE_JOURS = 7;

/** Nombre minimum d'envois pour que l'alerte soit pertinente (évite les faux positifs sur 1 envoi). */
const MIN_ENVOIS = 2;

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
 * Bandeau d'alerte du tableau de bord : il se déclenche quand le taux de réussite des envois
 * chute sous le seuil choisi par l'artisan sur la semaine glissante (7 derniers jours). Le seuil
 * est celui réglé dans l'indicateur de taux de réussite : le bandeau lit la même valeur partagée
 * et se met à jour dès que l'artisan la change. Il met en avant la fiabilité, le motif d'échec
 * principal de la semaine et propose des raccourcis pour agir tout de suite.
 *
 * L'alerte peut être mise de côté jusqu'à une date choisie (comme les alertes « bilan manquant »
 * et « santé du compte ») : elle se remplace alors par une ligne discrète avec la date et un
 * bouton de réactivation, pour une expérience cohérente sur toutes les alertes du tableau de bord.
 */
export default function AlerteTauxSemaine({ relances }: Props) {
  const { user, profile, refreshProfile } = useAuth();

  // Seuil de notification, partagé avec l'indicateur de taux (mémorisé localement).
  const [seuilAlerte, setSeuilAlerte] = useState<number>(() => lireSeuilTaux());
  // Mise de côté de l'alerte : date choisie + état du panneau + indicateur d'enregistrement.
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(dansNJours(30));
  const [snoozeBusy, setSnoozeBusy] = useState(false);

  const snoozeJusqu = profile?.taux_alerte_snooze ?? null;
  const snoozeActif = Boolean(snoozeJusqu && snoozeJusqu >= todayISO());

  // Suit immédiatement le seuil quand l'artisan le change dans l'indicateur (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setSeuilAlerte(lireSeuilTaux());
    window.addEventListener(SEUIL_TAUX_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEUIL_TAUX_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const stats = useMemo(() => {
    const cutoff = Date.now() - FENETRE_JOURS * 86400000;
    const dedans = relances.filter((r) => {
      if (r.statut === "Programmée") return false;
      const d = new Date(r.envoye_le ?? r.date_prevue).getTime();
      return !Number.isNaN(d) && d >= cutoff;
    });
    const ok = dedans.filter((r) => r.statut === "Envoyée").length;
    const ko = dedans.filter((r) => estEnEchec(r.statut));
    const total = ok + ko.length;
    const taux = total > 0 ? Math.round((ok / total) * 100) : null;

    // Motif d'échec le plus fréquent de la semaine (pour orienter la correction).
    const map = new Map<string, number>();
    ko.forEach((r) => {
      const m = (r.motif_echec ?? "").trim();
      if (m) map.set(m, (map.get(m) ?? 0) + 1);
    });
    const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

    return { total, taux, echecs: ko.length, succes: ok, top };
  }, [relances]);

  // Met de côté l'alerte jusqu'à la date choisie : elle ne s'affichera plus jusque-là.
  const handleSnooze = async (date: string) => {
    if (!user || !date) return;
    setSnoozeBusy(true);
    try {
      await updateTauxAlerteSnooze(user.id, date);
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
      await updateTauxAlerteSnooze(user.id, null);
      await refreshProfile();
    } catch {
      /* confort */
    } finally {
      setSnoozeBusy(false);
    }
  };

  // Pas d'alerte tant que le taux reste au-dessus du seuil, ou si l'échantillon est trop faible.
  if (stats.taux === null || stats.taux >= seuilAlerte || stats.total < MIN_ENVOIS) return null;

  // Alerte mise de côté : on affiche une ligne discrète avec la date et un moyen de réactiver.
  if (snoozeActif) {
    return (
      <div className="p-3 rounded-lg bg-background-100 border border-background-200 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-eye-off-line"></i>
          Alerte « taux de réussite en chute » mise de côté jusqu'au{" "}
          <strong className="text-foreground-700">{snoozeJusqu ? dateFR(snoozeJusqu) : "—"}</strong>.
        </p>
        <button
          type="button"
          onClick={handleReactiver}
          disabled={snoozeBusy}
          title="Réafficher tout de suite l'alerte du taux de réussite"
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
          <p className="text-sm font-bold text-red-800">Alerte : taux de réussite en chute</p>
          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
            {stats.taux}% sur 7 jours
          </span>
        </div>
        <p className="mt-0.5 text-xs text-red-700">
          Seulement {stats.taux}% de réussite cette semaine ({stats.succes} réussie{stats.succes > 1 ? "s" : ""},{" "}
          {stats.echecs} en échec sur {stats.total} envoi{stats.total > 1 ? "s" : ""}).
          {stats.top ? (
            <>
              {" "}
              Motif principal : <strong>{stats.top[0]}</strong> (×{stats.top[1]}).
            </>
          ) : null}{" "}
          Vérifiez vos fiches clients et vos motifs d'échec.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to="/app/relances-programmees?statut=echec"
            title="Ouvrir la liste des relances en échec"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-filter-3-line"></i>
            Voir les échecs
          </Link>
          <Link
            to="/app/relances-programmees?statut=echec&retry=1"
            title="Re-tenter d'un coup toutes les relances en échec"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-red-200 text-red-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Re-tenter les échecs
          </Link>
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