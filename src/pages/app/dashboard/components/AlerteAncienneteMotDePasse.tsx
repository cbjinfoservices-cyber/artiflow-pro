import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAncienneteMotDePasse } from "@/hooks/useAncienneteMotDePasse";
import { libelleAnciennete } from "@/lib/ancienneteMotDePasse";
import { updateMotDePasseAlerteSnooze } from "@/lib/motDePasse";
import { todayISO } from "@/lib/dates";
import ChangerMotDePasseModal from "@/components/feature/ChangerMotDePasseModal";

/** Date lisible en français à partir d'une date ISO. */
function dateFR(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Date « AAAA-MM-JJ » à N jours d'aujourd'hui, pour proposer une mise de côté par défaut. */
function dansNJours(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Alerte de sécurité du tableau de bord : elle apparaît quand le mot de passe du compte
 * n'a pas été renouvelé depuis longtemps. Elle propose de le changer tout de suite
 * (même fenêtre que dans le profil) et peut être mise de côté plusieurs jours.
 */
export default function AlerteAncienneteMotDePasse() {
  const { user, profile, refreshProfile } = useAuth();
  const { ancien, jours, dateRef, enregistrerChangement } = useAncienneteMotDePasse();
  const [open, setOpen] = useState(false);
  // Mise de côté de l'alerte : date choisie + état du panneau + indicateur d'enregistrement.
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(dansNJours(90));
  const [snoozeBusy, setSnoozeBusy] = useState(false);

  const snoozeJusqu = profile?.mot_de_passe_alerte_snooze ?? null;
  const snoozeActif = Boolean(snoozeJusqu && snoozeJusqu >= todayISO());

  if (!user) return null;
  if (!ancien && !open) return null;

  // Met de côté l'alerte jusqu'à la date choisie : elle ne s'affichera plus jusque-là.
  const handleSnooze = async (date: string) => {
    if (!user || !date) return;
    setSnoozeBusy(true);
    try {
      await updateMotDePasseAlerteSnooze(user.id, date);
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
      await updateMotDePasseAlerteSnooze(user.id, null);
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
          Alerte « renouveler le mot de passe » mise de côté jusqu'au{" "}
          <strong className="text-foreground-700">{snoozeJusqu ? dateFR(snoozeJusqu) : "—"}</strong>.
        </p>
        <button
          type="button"
          onClick={handleReactiver}
          disabled={snoozeBusy}
          title="Réafficher tout de suite la recommandation de sécurité"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {snoozeBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-eye-line"></i>}
          Réactiver l'alerte
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 rounded-lg bg-accent-50 border border-accent-200 flex items-start gap-3 animate-fade-in">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
          <i className="ri-shield-keyhole-line"></i>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground-950">Sécurité : pensez à renouveler votre mot de passe</p>
            <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
              <i className="ri-shield-check-line"></i>
              Recommandation
            </span>
          </div>
          <p className="mt-0.5 text-xs text-foreground-600">
            Votre mot de passe n'a pas été changé depuis {jours !== null ? libelleAnciennete(jours) : "un moment"}
            {dateRef ? ` (dernier changement : ${dateFR(dateRef)})` : ""}. Le renouveler régulièrement protège votre
            espace ArtiFlow-pro et vos données clients.
          </p>
          <Link
            to="/guide/mot-de-passe-solide"
            className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
          >
            <i className="ri-book-open-line"></i>
            Comment créer un mot de passe solide ?
            <i className="ri-arrow-right-line"></i>
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              title="Ouvrir la fenêtre de changement de mot de passe"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
            >
              <i className="ri-key-2-line"></i>
              Modifier mon mot de passe
            </button>
            <button
              type="button"
              onClick={() => {
                setSnoozeDate(dansNJours(90));
                setSnoozeOpen((v) => !v);
              }}
              title="Masquer cette recommandation jusqu'à une date choisie"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                snoozeOpen
                  ? "bg-accent-100 border-accent-300 text-accent-800"
                  : "bg-background-50 border-accent-200 text-accent-800 hover:bg-accent-100"
              }`}
            >
              <i className="ri-eye-off-line"></i>
              Mettre de côté
            </button>
          </div>

          {snoozeOpen && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2 p-3 rounded-md bg-background-50 border border-accent-200 animate-fade-in">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">
                  Masquer jusqu'au
                </span>
                <input
                  type="date"
                  value={snoozeDate}
                  min={todayISO()}
                  onChange={(e) => setSnoozeDate(e.target.value)}
                  className="h-9 px-3 rounded-md bg-background-100 border border-background-200 text-xs text-foreground-800 outline-none focus:ring-2 focus:ring-accent-300 cursor-pointer"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleSnooze(snoozeDate)}
                disabled={!snoozeDate || snoozeBusy}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {snoozeBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-eye-off-line"></i>}
                Mettre de côté
              </button>
              {[30, 90, 180].map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setSnoozeDate(dansNJours(j))}
                  title={`Masquer la recommandation pendant ${j} jours`}
                  className="inline-flex items-center h-9 px-3 rounded-md bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
                >
                  +{j} j
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSnoozeOpen(false)}
                className="inline-flex items-center h-9 px-3 rounded-md bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {open && (
        <ChangerMotDePasseModal onClose={() => setOpen(false)} onSuccess={enregistrerChangement} />
      )}
    </>
  );
}