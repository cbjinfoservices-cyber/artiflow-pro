import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { FactureItem } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import { updateEncaissementAlerteSnooze } from "@/lib/artisanApi";
import { todayISO, startOfWeek, toISODate } from "@/lib/dates";
import { ecrireDerniereSemaineConsultee } from "@/lib/santeSemaine";
import { formatEuros } from "@/lib/format";
import { lireSeuilEncaissement, SEUIL_ENCAISSEMENT_EVENT } from "@/lib/encaissementSeuil";

interface Props {
  /** Factures de l'artisan : on compare le facturé émis et l'encaissé réel mois par mois. */
  factures: FactureItem[];
}

/** Un avoir (note de crédit) porte le préfixe AV et n'entre pas dans le facturé. */
function isAvoir(numero: string): boolean {
  return numero.trim().toUpperCase().startsWith("AV");
}

interface MoisStat {
  key: string;
  longLabel: string;
  facture: number;
  encaisse: number;
  taux: number | null;
}

/** Nombre de mois récents surveillés (le mois en cours + les deux précédents). */
const MOIS_SURVEILLES = 3;

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
 * Bandeau d'alerte du tableau de bord : il prévient quand le taux d'encaissement d'un mois
 * passe sous le seuil choisi par l'artisan (60 % par défaut). Il surveille le mois en cours
 * ET les deux mois précédents, afin de repérer aussi un décrochage récent. Modèle calqué sur
 * les autres alertes (taux de réussite, santé du compte) : même logique, seuil partagé et mise
 * à jour immédiate.
 *
 * L'alerte peut être mise de côté jusqu'à une date choisie (comme les trois autres alertes du
 * tableau de bord) : elle se remplace alors par une ligne discrète avec la date et un bouton de
 * réactivation, pour une expérience cohérente sur toutes les alertes.
 */
export default function AlerteEncaissementMois({ factures }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [seuil, setSeuil] = useState<number>(() => lireSeuilEncaissement());
  // Mise de côté de l'alerte : date choisie + état du panneau + indicateur d'enregistrement.
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(dansNJours(30));
  const [snoozeBusy, setSnoozeBusy] = useState(false);

  const snoozeJusqu = profile?.encaissement_alerte_snooze ?? null;
  const snoozeActif = Boolean(snoozeJusqu && snoozeJusqu >= todayISO());

  // Semaine en cours (lundi) : l'alerte étant mensuelle, le raccourci « Reprendre » ouvre la
  // comptabilité de la semaine en cours (le mois le plus récent au format semaine).
  const lundiCourant = toISODate(startOfWeek(new Date()));

  // Suit immédiatement le seuil quand l'artisan le change dans l'indicateur (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setSeuil(lireSeuilEncaissement());
    window.addEventListener(SEUIL_ENCAISSEMENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEUIL_ENCAISSEMENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Statistiques mensuelles (facturé TTC émis vs encaissé TTC réel) sur les 6 derniers mois.
  const mois = useMemo<MoisStat[]>(() => {
    const now = new Date();
    const raw: MoisStat[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      raw.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        longLabel: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        facture: 0,
        encaisse: 0,
        taux: null,
      });
    }
    const byKey = new Map(raw.map((b) => [b.key, b]));
    const keyOf = (value: string | null | undefined): string | null => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    factures.forEach((f) => {
      // Facturé du mois : factures émises (hors avoirs).
      if (!isAvoir(f.numero)) {
        const k = keyOf(f.date_emission ?? f.created_at);
        const bucket = k ? byKey.get(k) : undefined;
        if (bucket) bucket.facture += Number(f.total_ttc || 0);
      }
      // Encaissé du mois : factures réglées, datées au jour réel du règlement.
      if (f.statut === "Payée") {
        const k = keyOf(f.date_paiement ?? f.date_emission ?? f.created_at);
        const bucket = k ? byKey.get(k) : undefined;
        if (bucket) bucket.encaisse += Number(f.total_ttc || 0);
      }
    });

    return raw.map((b) => ({
      ...b,
      taux: b.facture > 0 ? Math.round((b.encaisse / b.facture) * 100) : null,
    }));
  }, [factures]);

  const enAlerte = useMemo(
    () => mois.slice(-MOIS_SURVEILLES).filter((b) => b.facture > 0 && b.taux !== null && b.taux < seuil),
    [mois, seuil],
  );

  // Met de côté l'alerte jusqu'à la date choisie : elle ne s'affichera plus jusque-là.
  const handleSnooze = async (date: string) => {
    if (!user || !date) return;
    setSnoozeBusy(true);
    try {
      await updateEncaissementAlerteSnooze(user.id, date);
      await refreshProfile();
      setSnoozeOpen(false);
    } catch {
      /* confort : l'échec laisse simplement l'alerte affichée */
    } finally {
      setSnoozeBusy(false);
    }
  };

  // Rouvre la comptabilité de la semaine en cours, et la mémorise comme « dernière consultée ».
  const reprendreSemaine = () => {
    ecrireDerniereSemaineConsultee({ semaine: lundiCourant, cible: "comptabilite" });
    navigate(`/app/comptabilite?semaine=${lundiCourant}`);
  };

  // Réactive immédiatement l'alerte mise de côté.
  const handleReactiver = async () => {
    if (!user) return;
    setSnoozeBusy(true);
    try {
      await updateEncaissementAlerteSnooze(user.id, null);
      await refreshProfile();
    } catch {
      /* confort */
    } finally {
      setSnoozeBusy(false);
    }
  };

  // Pas d'alerte tant que chaque mois surveillé reste au-dessus du seuil.
  if (enAlerte.length === 0) return null;

  const courant = mois[mois.length - 1];
  const courantAlerte = courant.facture > 0 && courant.taux !== null && courant.taux < seuil;

  // Alerte mise de côté : on affiche une ligne discrète avec la date et un moyen de réactiver.
  if (snoozeActif) {
    return (
      <div className="p-3 rounded-lg bg-background-100 border border-background-200 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-eye-off-line"></i>
          Alerte « taux d'encaissement faible » mise de côté jusqu'au{" "}
          <strong className="text-foreground-700">{snoozeJusqu ? dateFR(snoozeJusqu) : "—"}</strong>.
        </p>
        <button
          type="button"
          onClick={handleReactiver}
          disabled={snoozeBusy}
          title="Réafficher tout de suite l'alerte du taux d'encaissement"
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
        <i className="ri-money-euro-circle-line"></i>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-red-800">Alerte : taux d'encaissement faible</p>
          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
            seuil {seuil} %
          </span>
        </div>
        <p className="mt-0.5 text-xs text-red-700">
          {courantAlerte && courant.taux !== null ? (
            <>
              Ce mois-ci, vous n'avez encaissé que <strong>{courant.taux} %</strong> de ce que vous avez facturé (
              {formatEuros(courant.encaisse)} perçus sur {formatEuros(courant.facture)} facturés).
            </>
          ) : (
            <>Un mois récent est passé sous votre seuil d'encaissement.</>
          )}
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {enAlerte.map((b) => (
            <li key={b.key} className="text-[11px] text-red-700 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-red-100 text-red-700 font-bold whitespace-nowrap capitalize">
                <i className="ri-calendar-line"></i>
                {b.longLabel}
              </span>
              <strong>{b.taux} %</strong>
              <span className="text-red-600">
                · encaissé {formatEuros(b.encaisse)} sur {formatEuros(b.facture)} facturé
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to="/app/comptabilite?periode=Ce%20mois"
            title="Ouvrir la comptabilité sur le mois en cours"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-file-chart-line"></i>
            Voir la comptabilité
          </Link>
          <Link
            to="/app/comptabilite"
            title="Ouvrir la balance âgée des créances impayées"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-red-200 text-red-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
          >
            <i className="ri-scales-3-line"></i>
            Balance âgée
          </Link>
          <button
            type="button"
            onClick={reprendreSemaine}
            title={`Rouvrir la comptabilité de la semaine du ${semaineLabel(lundiCourant)} (semaine en cours)`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-red-200 text-red-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
          >
            <i className="ri-history-line"></i>
            Reprendre : {semaineLabel(lundiCourant)}
          </button>
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