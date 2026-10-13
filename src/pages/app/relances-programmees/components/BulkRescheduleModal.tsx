import { useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { addDays, toISODate, todayISO } from "@/lib/dates";
import type { BulkReschedulePayload } from "@/lib/relancesClient";

/** Raccourcis de date proposés pour fixer une nouvelle date d'envoi commune. */
const RACCOURCIS_DATE: { label: string; jours: number }[] = [
  { label: "Aujourd'hui", jours: 0 },
  { label: "Dans 3 j", jours: 3 },
  { label: "Dans 7 j", jours: 7 },
  { label: "Dans 14 j", jours: 14 },
  { label: "Dans 30 j", jours: 30 },
];

/** Raccourcis de décalage (en jours) appliqués à la date actuelle de chaque relance. */
const RACCOURCIS_DECALAGE: number[] = [1, 3, 7, 14, 30];

type Mode = "date" | "shift";

/**
 * Fenêtre de reprogrammation en lot : soit on fixe une date d'envoi commune à toutes les
 * relances sélectionnées, soit on les décale de +N jours à partir de leur date actuelle
 * (chaque relance garde alors son espacement relatif).
 */
export default function BulkRescheduleModal({
  count,
  label,
  favori,
  onClose,
  onConfirm,
  onSaveFavori,
}: {
  count: number;
  /** Libellé de la portée (« la sélection », le nom d'un client…), affiché sous le titre. */
  label?: string;
  /** Décalage favori enregistré (jours), ou null si aucun. */
  favori: number | null;
  onClose: () => void;
  onConfirm: (payload: BulkReschedulePayload) => Promise<void> | void;
  onSaveFavori: (days: number | null) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<Mode>("date");
  const [date, setDate] = useState(toISODate(addDays(new Date(), 7)));
  const [days, setDays] = useState(favori ?? 7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoriBusy, setFavoriBusy] = useState(false);
  const [favoriMsg, setFavoriMsg] = useState<string | null>(null);

  const isFavori = favori !== null && favori === days;

  const toggleFavori = async () => {
    setFavoriBusy(true);
    setFavoriMsg(null);
    try {
      await onSaveFavori(isFavori ? null : days);
      setFavoriMsg(
        isFavori ? "Décalage par défaut retiré." : `+${days} j enregistré comme décalage par défaut.`,
      );
    } catch {
      setFavoriMsg("Enregistrement impossible. Réessayez.");
    } finally {
      setFavoriBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (mode === "date" && !date) {
      setError("Choisissez une date d'envoi.");
      return;
    }
    if (mode === "shift" && !days) {
      setError("Choisissez un nombre de jours de décalage (différent de zéro).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(mode === "date" ? { mode: "date", datePrevue: date } : { mode: "shift", days });
      onClose();
    } catch {
      setError("La reprogrammation a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
      active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
    }`;

  return (
    <Modal
      title="Reprogrammer la sélection"
      subtitle={`${count} relance${count > 1 ? "s" : ""} concernée${count > 1 ? "s" : ""}${label ? ` · ${label}` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-calendar-check-line"></i>}
            Reprogrammer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Choix du mode : date fixe ou décalage de +N jours */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
          <button type="button" onClick={() => setMode("date")} className={tabClass(mode === "date")}>
            <i className="ri-calendar-line"></i>
            Date fixe
          </button>
          <button type="button" onClick={() => setMode("shift")} className={tabClass(mode === "shift")}>
            <i className="ri-time-line"></i>
            Décaler de +N j
          </button>
        </div>

        {mode === "date" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
              <i className="ri-calendar-line text-foreground-400"></i>
              Nouvelle date d'envoi (commune)
            </span>
            <input
              type="date"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 px-3 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 cursor-pointer"
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {RACCOURCIS_DATE.map((r) => {
                const value = toISODate(addDays(new Date(), r.jours));
                const actif = date === value;
                return (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setDate(value)}
                    className={`inline-flex items-center h-7 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      actif
                        ? "bg-secondary-500 border-secondary-500 text-background-50"
                        : "bg-background-100 border-background-200 text-foreground-600 hover:border-secondary-300"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
              <i className="ri-time-line text-foreground-400"></i>
              Décaler chaque relance de
            </span>
            <div className="flex flex-wrap gap-1.5">
              {RACCOURCIS_DECALAGE.map((n) => {
                const actif = days === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDays(n)}
                    className={`inline-flex items-center h-7 px-3 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      actif
                        ? "bg-secondary-500 border-secondary-500 text-background-50"
                        : "bg-background-100 border-background-200 text-foreground-600 hover:border-secondary-300"
                    }`}
                  >
                    +{n} j
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={days}
                min={-365}
                max={365}
                onChange={(e) => setDays(Number(e.target.value))}
                className="h-10 w-28 px-3 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400"
              />
              <span className="text-xs text-foreground-500">jour(s) à ajouter (négatif possible pour avancer)</span>
            </div>
            <button
              type="button"
              onClick={toggleFavori}
              disabled={favoriBusy || !days}
              className={`inline-flex items-center gap-2 h-9 px-3 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors self-start disabled:opacity-60 ${
                isFavori
                  ? "bg-accent-100 border-accent-300 text-accent-800"
                  : "bg-background-100 border-background-200 text-foreground-600 hover:border-accent-300"
              }`}
              title="Enregistrer ce décalage comme réglage appliqué en un clic"
            >
              <i className={isFavori ? "ri-star-fill" : "ri-star-line"}></i>
              {isFavori ? `+${days} j : mon décalage par défaut` : "Définir comme décalage par défaut"}
            </button>
            {favoriMsg && <p className="text-[11px] text-accent-700">{favoriMsg}</p>}
          </div>
        )}

        <p className="text-[11px] text-foreground-500 leading-relaxed">
          {mode === "date"
            ? "Les relances sélectionnées seront toutes envoyées à cette nouvelle date, via la tâche quotidienne. Le message de chacune reste inchangé."
            : "Chaque relance sélectionnée est décalée de ce nombre de jours à partir de sa date actuelle : elles gardent donc leur ordre et leur espacement. Le message de chacune reste inchangé."}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}