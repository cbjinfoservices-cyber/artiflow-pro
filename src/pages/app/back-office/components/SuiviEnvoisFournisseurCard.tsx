import { useCallback, useEffect, useState } from "react";
import { chargerSuiviEnvois, type StatsFournisseur, type SuiviEnvois } from "@/lib/suiviEnvoisFournisseur";

/** Périodes proposées pour le suivi (en jours). */
const PERIODES = [7, 30, 90] as const;

/** Formate une date courte en français (« 17 oct. 2026 à 09:12 »). */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Carte « Suivi des envois » du back-office.
 *
 * Elle répond à une question simple : est-ce que les emails partent vraiment ? Resend étant
 * le canal d'envoi unique, on affiche le nombre d'envois et le taux de réussite réel. Une
 * alerte visuelle apparaît dès que le taux passe sous 95 %.
 */
export default function SuiviEnvoisFournisseurCard() {
  const [jours, setJours] = useState<number>(30);
  const [etat, setEtat] = useState<"loading" | "ready" | "error">("loading");
  const [suivi, setSuivi] = useState<SuiviEnvois | null>(null);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async (periode: number) => {
    setEtat("loading");
    setErreur("");
    try {
      const res = await chargerSuiviEnvois(periode);
      setSuivi(res);
      setEtat("ready");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de charger le suivi des envois pour l'instant.");
      setEtat("error");
    }
  }, []);

  useEffect(() => {
    void charger(jours);
  }, [charger, jours]);

  const stats = suivi?.stats ?? [];
  const total = suivi?.total ?? 0;
  const envoisSauves = suivi?.envoisSauves ?? 0;

  /** Tonalité d'un taux de réussite : vert au-dessus de 98 %, orange en dessous de 95 %. */
  const tonalite = (taux: number) => {
    if (taux >= 98) return { barre: "bg-accent-500", pastille: "bg-accent-100 text-accent-800" };
    if (taux >= 95) return { barre: "bg-secondary-500", pastille: "bg-secondary-100 text-secondary-800" };
    return { barre: "bg-red-500", pastille: "bg-red-100 text-red-700" };
  };

  const resume =
    etat === "error"
      ? { icone: "ri-error-warning-line", ton: "bg-red-100 text-red-700", texte: "Indisponible" }
      : etat === "loading"
        ? { icone: "ri-loader-4-line", ton: "bg-background-200 text-foreground-600", texte: "Chargement…" }
        : envoisSauves > 0
          ? {
              icone: "ri-shield-check-line",
              ton: "bg-primary-100 text-primary-800",
              texte: `${envoisSauves} envoi${envoisSauves > 1 ? "s" : ""} sauvé${envoisSauves > 1 ? "s" : ""}`,
            }
          : { icone: "ri-checkbox-circle-line", ton: "bg-accent-100 text-accent-800", texte: "Tout est parti" };

  const Ligne = ({ s }: { s: StatsFournisseur }) => {
    const t = tonalite(s.taux);
    return (
      <li className="p-3 rounded-md bg-background-50 border border-background-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className={s.icon}></i>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground-900">{s.label}</p>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              {s.total} envoi{s.total > 1 ? "s" : ""} · {s.succes} réussi{s.succes > 1 ? "s" : ""} · {s.echecs} échec
              {s.echecs > 1 ? "s" : ""}
              {s.replis > 0 ? ` · ${s.replis} via le secours` : ""}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-bold tabular-nums whitespace-nowrap ${t.pastille}`}
          >
            <i className={s.taux >= 95 ? "ri-arrow-up-line" : "ri-arrow-down-line"}></i>
            {s.taux} %
          </span>
        </div>

        <div className="mt-2.5 h-1.5 w-full rounded-full bg-background-200 overflow-hidden">
          <div
            className={`h-full rounded-full ${t.barre} transition-all`}
            style={{ width: `${Math.max(2, Math.min(100, s.taux))}%` }}
          ></div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-500">
          <span className="inline-flex items-center gap-1">
            <i className="ri-time-line"></i>
            Dernier succès : {formatDate(s.dernierEnvoi)}
          </span>
          {s.derniereErreurAt && (
            <span className="inline-flex items-center gap-1 text-red-700">
              <i className="ri-error-warning-line"></i>
              Dernier incident : {formatDate(s.derniereErreurAt)}
            </span>
          )}
        </div>

        {s.derniereErreur && (
          <p className="mt-2 text-[11px] text-foreground-600 bg-background-100 border border-background-200 rounded px-2.5 py-1.5 break-words">
            {s.derniereErreur}
          </p>
        )}
      </li>
    );
  };

  return (
    <section className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-pie-chart-2-line"></i>
          </span>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground-950">Suivi des envois</h3>
            <p className="text-xs text-foreground-500 mt-0.5 max-w-2xl leading-relaxed">
              Le taux de réussite réel des emails envoyés (devis, factures, relances, récapitulatifs).
            </p>
          </div>
        </div>
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap ${resume.ton}`}
          >
            <i className={`${resume.icone}${etat === "loading" ? " animate-spin" : ""}`}></i>
            {resume.texte}
          </span>
          <button
            type="button"
            onClick={() => { void charger(jours); }}
            disabled={etat === "loading"}
            title="Actualiser le suivi des envois"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`ri-refresh-line${etat === "loading" ? " animate-spin" : ""}`}></i>
            Actualiser
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-full bg-background-200/70">
          {PERIODES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setJours(p)}
              className={`h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                jours === p
                  ? "bg-primary-500 text-background-50"
                  : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              {p} jours
            </button>
          ))}
        </div>
        <span className="text-[11px] text-foreground-500">
          {total} tentative{total > 1 ? "s" : ""} sur la période
        </span>
      </div>

      {etat === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 p-4 rounded-lg bg-background-50 border border-background-200">
          <i className="ri-error-warning-line text-primary-600 text-lg"></i>
          <p className="text-sm text-foreground-600 flex-1 min-w-[180px]">
            {erreur || "Le suivi des envois n'a pas pu être chargé."}
          </p>
          <button
            type="button"
            onClick={() => { void charger(jours); }}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : etat === "loading" ? (
        <p className="mt-4 text-xs text-foreground-500 flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Lecture des traces d'envoi…
        </p>
      ) : stats.length === 0 ? (
        <p className="mt-4 text-xs text-foreground-500">
          Aucun envoi enregistré sur cette période. Les traces apparaissent dès qu'un récapitulatif, une alerte ou
          une relance part.
        </p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {stats.map((s) => (
              <Ligne key={s.fournisseur} s={s} />
            ))}
          </ul>

          <p className="mt-3 pt-3 border-t border-background-200 text-[11px] text-foreground-500 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-shield-check-line"></i>
              {envoisSauves > 0
                ? `${envoisSauves} envoi${envoisSauves > 1 ? "s" : ""} rattrapé${envoisSauves > 1 ? "s" : ""} automatiquement : aucune relance perdue.`
                : "Tous les envois de la période sont partis du premier coup."}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-database-2-line"></i>
              Traces des {jours} derniers jours
            </span>
          </p>
        </>
      )}
    </section>
  );
}