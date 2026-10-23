import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  chargerAlertesTaux,
  chargerTauxEnvois,
  SEUIL_ALERTE_ENVOIS,
  type AlerteTauxEntree,
  type ResumeTauxEnvois,
} from "@/lib/alerteTauxEnvois";

/** Formate une date complète en français (« 17 oct. 2026 à 09:12 »). */
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
 * Carte « Alerte envoi d'emails » du back-office.
 *
 * Elle rend visible la surveillance automatique : le taux de réussite réel des emails
 * envoyés via Resend sur 24 h, le seuil de 95 %, et la date de la dernière alerte
 * réellement envoyée aux gestionnaires. La surveillance tourne côté Backend (tâche
 * planifiée) : cette carte ne fait que l'afficher et permettre un contrôle à la demande.
 */
export default function AlerteTauxEnvoisCard() {
  const [etat, setEtat] = useState<"loading" | "ready" | "error">("loading");
  const [resume, setResume] = useState<ResumeTauxEnvois | null>(null);
  const [alertes, setAlertes] = useState<AlerteTauxEntree[]>([]);
  const [erreur, setErreur] = useState("");
  const [controle, setControle] = useState<"idle" | "encours" | "fait">("idle");
  const [controleMsg, setControleMsg] = useState("");
  const [test, setTest] = useState<"idle" | "encours">("idle");
  const [testMsg, setTestMsg] = useState("");
  const [testKo, setTestKo] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const charger = useCallback(async () => {
    setEtat("loading");
    setErreur("");
    try {
      const [stats, hist] = await Promise.all([chargerTauxEnvois(24), chargerAlertesTaux(5)]);
      setResume(stats);
      setAlertes(hist);
      setEtat("ready");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de charger la surveillance des envois.");
      setEtat("error");
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  /** Demande au Backend son calcul exact (sans envoyer d'email), puis rafraîchit l'affichage. */
  const controler = async () => {
    setControle("encours");
    setControleMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("alerte-taux-brevo", {
        body: { preview: true },
      });
      if (error) throw new Error(error.message);
      const payload = data as
        | { ok?: boolean; error?: string; taux?: number; total?: number; alerte?: boolean }
        | null;
      if (!payload?.ok) throw new Error(payload?.error || "Le contrôle n'a pas abouti.");
      setControleMsg(
        payload.alerte
          ? `Contrôle Backend : ${payload.taux} % sur ${payload.total} envoi(s) — sous le seuil, l'alerte partirait.`
          : `Contrôle Backend : ${payload.taux} % sur ${payload.total} envoi(s) — rien à signaler.`,
      );
      setControle("fait");
      await charger();
    } catch (e) {
      setControleMsg(e instanceof Error ? e.message : "Le contrôle n'a pas abouti.");
      setControle("idle");
    }
  };

  /** Envoie une démonstration de l'email d'alerte aux gestionnaires, sans créer d'incident. */
  const testerAlerte = async () => {
    setTest("encours");
    setTestMsg("");
    setTestKo(false);
    try {
      const { data, error } = await supabase.functions.invoke("alerte-taux-brevo", {
        body: { demo: true },
      });
      if (error) throw new Error(error.message);
      const payload = data as
        | { ok?: boolean; error?: string; destinataires?: number; fournisseur?: string }
        | null;
      if (!payload?.ok) throw new Error(payload?.error || "La démonstration n'a pas abouti.");
      setTestMsg(
        `Démonstration envoyée à ${payload.destinataires ?? 0} gestionnaire${
          (payload.destinataires ?? 0) > 1 ? "s" : ""
        } via Resend. Aucun incident n'a été enregistré.`,
      );
      setTest("idle");
    } catch (e) {
      setTestKo(true);
      setTestMsg(e instanceof Error ? e.message : "La démonstration n'a pas abouti.");
      setTest("idle");
    }
  };

  /** Archive en CSV tout l'historique des alertes de taux réellement envoyées. */
  const exporterCsv = async () => {
    setExportEnCours(true);
    setExportMsg("");
    try {
      const toutes = await chargerAlertesTaux(500);
      if (!toutes.length) {
        setExportMsg("Aucune alerte enregistrée : rien à archiver pour l'instant.");
        setExportEnCours(false);
        return;
      }
      const lignes = toutes.map((a) => [
        new Date(a.created_at).toLocaleDateString("fr-FR"),
        new Date(a.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        String(a.taux),
        String(a.seuil),
        String(a.total),
        String(a.succes),
        String(a.echecs),
        String(a.destinataires),
        a.taux < a.seuil ? "Sous le seuil" : "Au-dessus du seuil",
      ]);
      const csv = toCsv(
        [
          "Date",
          "Heure",
          "Taux de réussite (%)",
          "Seuil (%)",
          "Envois",
          "Réussis",
          "Échecs",
          "Destinataires",
          "Statut",
        ],
        lignes,
      );
      downloadCsv(`alertes-envoi-emails-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      setExportMsg(
        `${toutes.length} alerte${toutes.length > 1 ? "s" : ""} exportée${toutes.length > 1 ? "s" : ""} en CSV.`,
      );
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : "L'export CSV a échoué.");
    } finally {
      setExportEnCours(false);
    }
  };

  const total = resume?.total ?? 0;
  const taux = resume?.taux ?? 100;
  const echantillonFaible = total > 0 && total < 5;
  const sousSeuil = total >= 5 && taux < SEUIL_ALERTE_ENVOIS;
  const derniereAlerte = alertes[0] ?? null;

  const badge = (() => {
    if (etat === "loading")
      return { icone: "ri-loader-4-line", ton: "bg-background-200 text-foreground-600", texte: "Chargement…" };
    if (etat === "error")
      return { icone: "ri-error-warning-line", ton: "bg-red-100 text-red-700", texte: "Indisponible" };
    if (sousSeuil) return { icone: "ri-alert-line", ton: "bg-red-100 text-red-700", texte: "Sous le seuil" };
    if (echantillonFaible)
      return { icone: "ri-time-line", ton: "bg-secondary-100 text-secondary-800", texte: "Échantillon faible" };
    return { icone: "ri-checkbox-circle-line", ton: "bg-accent-100 text-accent-800", texte: "Au-dessus du seuil" };
  })();

  const barreTaux = sousSeuil ? "bg-red-500" : taux >= 98 ? "bg-accent-500" : "bg-secondary-500";

  return (
    <section className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-alarm-warning-line"></i>
          </span>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground-950">Alerte envoi d'emails (24 h)</h3>
            <p className="text-xs text-foreground-500 mt-0.5 max-w-2xl leading-relaxed">
              Surveillance automatique du taux de réussite des emails envoyés via Resend. Sous{" "}
              {SEUIL_ALERTE_ENVOIS} % sur les 24 dernières heures, un email part aux gestionnaires — une seule
              alerte par 24 h.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap ${badge.ton}`}
          >
            <i className={`${badge.icone}${etat === "loading" ? " animate-spin" : ""}`}></i>
            {badge.texte}
          </span>
          <button
            type="button"
            onClick={() => { void testerAlerte(); }}
            disabled={test === "encours" || etat === "loading"}
            title="Envoyer une démonstration de l'email d'alerte aux gestionnaires"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`${test === "encours" ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}`}></i>
            Tester l'alerte
          </button>
          <button
            type="button"
            onClick={() => { void exporterCsv(); }}
            disabled={exportEnCours}
            title="Archiver l'historique des alertes d'envoi au format CSV"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`${exportEnCours ? "ri-loader-4-line animate-spin" : "ri-download-2-line"}`}></i>
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={() => { void controler(); }}
            disabled={controle === "encours"}
            title="Faire recalculer le taux côté Backend, sans envoyer d'email"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`${controle === "encours" ? "ri-loader-4-line animate-spin" : "ri-radar-line"}`}></i>
            Contrôler
          </button>
        </div>
      </div>

      {etat === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 p-4 rounded-lg bg-background-50 border border-background-200">
          <i className="ri-error-warning-line text-primary-600 text-lg"></i>
          <p className="text-sm text-foreground-600 flex-1 min-w-[180px]">
            {erreur || "La surveillance des envois n'a pas pu être chargée."}
          </p>
          <button
            type="button"
            onClick={() => { void charger(); }}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : etat === "loading" ? (
        <p className="mt-4 text-xs text-foreground-500 flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Lecture du taux de réussite sur 24 h…
        </p>
      ) : (
        <>
          <div className="mt-4 p-4 rounded-md bg-background-50 border border-background-200">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div>
                <p className="text-[11px] text-foreground-500">Taux de réussite des emails (24 h)</p>
                <p className="font-heading font-bold text-2xl text-foreground-950 tabular-nums leading-none mt-1">
                  {taux} %
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-foreground-500">Seuil d'alerte</p>
                <p className="text-sm font-bold text-foreground-900 tabular-nums mt-1">{SEUIL_ALERTE_ENVOIS} %</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-background-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${barreTaux} transition-all`}
                style={{ width: `${Math.max(2, Math.min(100, taux))}%` }}
              ></div>
            </div>
            <p className="mt-2 text-[11px] text-foreground-500">
              {total} envoi{total > 1 ? "s" : ""} · {resume?.succes ?? 0} réussi
              {(resume?.succes ?? 0) > 1 ? "s" : ""} · {resume?.echecs ?? 0} échec
              {(resume?.echecs ?? 0) > 1 ? "s" : ""}
              {echantillonFaible ? " · échantillon trop faible pour déclencher une alerte" : ""}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-500">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-mail-send-line"></i>
              Dernière alerte envoyée : {formatDate(derniereAlerte?.created_at ?? null)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-shield-check-line"></i>
              Tests et démonstrations exclus du calcul
            </span>
          </div>

          {controleMsg && (
            <p className="mt-3 text-[11px] text-foreground-700 bg-background-50 border border-background-200 rounded-md px-3 py-2 flex items-start gap-1.5">
              <i
                className={`mt-0.5 shrink-0 ${
                  controle === "fait" ? "ri-checkbox-circle-line" : "ri-information-line"
                }`}
              ></i>
              <span>{controleMsg}</span>
            </p>
          )}

          {testMsg && (
            <p
              className={`mt-3 text-[11px] rounded-md px-3 py-2 flex items-start gap-1.5 border ${
                testKo ? "bg-red-50 border-red-200 text-red-700" : "bg-accent-100 border-accent-200 text-accent-900"
              }`}
            >
              <i className={`mt-0.5 shrink-0 ${testKo ? "ri-error-warning-line" : "ri-checkbox-circle-line"}`}></i>
              <span>{testMsg}</span>
            </p>
          )}

          {exportMsg && (
            <p className="mt-2 text-[11px] text-foreground-600 flex items-start gap-1.5">
              <i className="ri-file-text-line mt-0.5 shrink-0"></i>
              <span>{exportMsg}</span>
            </p>
          )}

          {alertes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {alertes.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 p-2.5 rounded-md bg-background-50 border border-background-200"
                >
                  <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-red-100 text-red-700">
                    <i className="ri-alarm-warning-line"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground-900">
                      {a.taux} % — {a.echecs} échec{a.echecs > 1 ? "s" : ""} sur {a.total} envoi
                      {a.total > 1 ? "s" : ""}
                    </p>
                    <p className="text-[11px] text-foreground-500 mt-0.5">
                      {formatDate(a.created_at)} · {a.destinataires} destinataire{a.destinataires > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-secondary-100 text-secondary-800">
                    Seuil {a.seuil} %
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}