import { useState } from "react";
import { Link } from "react-router-dom";
import { useDernierBilan } from "@/hooks/useDernierBilan";
import { useAuth } from "@/hooks/useAuth";
import { runEnvoiBilanNow, updateComptableBilanAlerteSnooze } from "@/lib/artisanApi";
import { todayISO } from "@/lib/dates";

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

/** Mois et année courants en heure de Paris (cohérent avec la tâche planifiée du bilan). */
function parisYearMonth(): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "numeric",
    }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
    return { year: get("year"), month: get("month") };
  } catch {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
}

/**
 * Bandeau d'alerte du tableau de bord : il prévient quand l'exercice précédent n'a toujours pas
 * reçu son bilan d'archivage alors que janvier est passé. Le bilan d'archivage est censé partir
 * chaque année en janvier ; s'il n'y a aucune trace pour l'exercice écoulé après janvier, c'est
 * le signe qu'il faut le (re)lancer. On propose de l'archiver tout de suite en un clic.
 */
export default function AlerteBilanManquant() {
  const { user, profile, refreshProfile } = useAuth();
  const { bilans, loading } = useDernierBilan();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  // Mise de côté de l'alerte : date choisie + état du panneau + indicateur d'enregistrement.
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(dansNJours(30));
  const [snoozeBusy, setSnoozeBusy] = useState(false);
  const snoozeJusqu = profile?.comptable_bilan_alerte_snooze ?? null;
  const snoozeActif = Boolean(snoozeJusqu && snoozeJusqu >= todayISO());

  const { year, month } = parisYearMonth();
  // L'exercice à archiver est l'année qui vient de s'achever (archivée en janvier).
  const exerciceCible = String(year - 1);
  // Janvier passé = à partir de février : la fenêtre d'archivage est écoulée.
  const janvierPasse = month > 1;
  const dejaArchive = bilans.some((b) => b.annee === exerciceCible);

  // Envoie tout de suite le bilan d'archivage de l'exercice manquant au comptable.
  const handleArchiver = async () => {
    if (!user || !janvierPasse || dejaArchive) return;
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const res = await runEnvoiBilanNow(user.id, exerciceCible);
      if (res.sent > 0) {
        setEnvoye(true);
        setNotice(
          `Bilan d'archivage de l'exercice ${exerciceCible} envoyé à votre comptable. L'alerte disparaîtra une fois la page rechargée.`,
        );
      } else if (!res.configured) {
        setError("L'envoi d'emails n'est pas encore activé : configurez Resend pour archiver le bilan.");
      } else {
        setError(res.reason || "L'archivage n'a rien pu expédier. Vérifiez l'email du comptable.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'archivage du bilan a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  // Met de côté l'alerte jusqu'à la date choisie : elle ne s'affichera plus jusque-là.
  const handleSnooze = async (date: string) => {
    if (!user || !date) return;
    setSnoozeBusy(true);
    try {
      await updateComptableBilanAlerteSnooze(user.id, date);
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
      await updateComptableBilanAlerteSnooze(user.id, null);
      await refreshProfile();
    } catch {
      /* confort */
    } finally {
      setSnoozeBusy(false);
    }
  };

  // Rien à signaler tant qu'on charge, qu'on n'est pas allé au-delà de janvier,
  // que l'exercice est déjà archivé, ou qu'on vient de le renvoyer à l'instant.
  if (loading && bilans.length === 0) return null;
  if (!janvierPasse || dejaArchive || envoye) return null;

  // Alerte mise de côté : on affiche une ligne discrète avec la date et un moyen de réactiver.
  if (snoozeActif) {
    return (
      <div className="p-3 rounded-lg bg-background-100 border border-background-200 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-eye-off-line"></i>
          Alerte « bilan d'archivage manquant » (exercice {exerciceCible}) mise de côté jusqu'au{" "}
          <strong className="text-foreground-700">{snoozeJusqu ? dateFR(snoozeJusqu) : "—"}</strong>.
        </p>
        <button
          type="button"
          onClick={handleReactiver}
          disabled={snoozeBusy}
          title="Réafficher tout de suite l'alerte du bilan manquant"
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
        <i className="ri-archive-drawer-line"></i>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-red-800">Alerte : bilan d'archivage manquant</p>
          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap">
            exercice {exerciceCible}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-red-700">
          Janvier est passé et l'exercice <strong>{exerciceCible}</strong> n'a toujours pas reçu son{" "}
          <strong>bilan d'archivage</strong>. Il devait partir automatiquement en janvier ; vérifiez que la tâche
          planifiée tourne bien, ou archivez-le maintenant.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleArchiver}
            disabled={busy}
            title={`Envoyer maintenant au comptable le bilan d'archivage de l'exercice ${exerciceCible}`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            Archiver l'exercice {exerciceCible} maintenant
          </button>
          <Link
            to="/app/comptabilite"
            title="Ouvrir l'Espace comptable pour gérer les bilans d'archivage"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-red-200 text-red-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
          >
            <i className="ri-archive-stack-line"></i>
            Espace comptable
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
        {error && (
          <p className="mt-2 text-[11px] text-red-700 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="mt-2 text-[11px] text-accent-700 flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}