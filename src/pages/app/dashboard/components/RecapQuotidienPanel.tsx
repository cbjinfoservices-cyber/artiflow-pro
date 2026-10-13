import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRecapQuotidien } from "@/hooks/useRecapQuotidien";
import { fetchRecapEnvois, runRecapNow, type RecapEnvoi } from "@/lib/artisanApi";
import { CANAUX, RECAP_DEVIS_SEUIL_OPTIONS, RECAP_RELANCE_FACTURE_SEUIL_OPTIONS, RELANCE_FACTURE_DELAI_OPTIONS } from "@/lib/relances";
import ApercuRecapModal from "@/pages/app/dashboard/components/ApercuRecapModal";

const CANAL_ICONS: Record<string, string> = {
  Email: "ri-mail-line",
  SMS: "ri-message-2-line",
  WhatsApp: "ri-whatsapp-line",
};

/** Heures proposées pour l'envoi du récapitulatif (06:00 → 22:00, heure de Paris). */
const HEURES = Array.from({ length: 17 }, (_, i) => i + 6);

function formatHeure(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** Formate l'horodatage du dernier envoi réel (« 07 oct. 2026 à 08:00 »). */
function formatDernierEnvoi(value?: string | null): string {
  if (!value) return "jamais encore";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "jamais encore";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${heure}`;
}

/** Formate une ligne d'historique (« 07 oct. 2026 · 08:00 »). */
function formatHistorique(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${heure}`;
}

/**
 * Panneau « Récapitulatif quotidien » du tableau de bord : interrupteur par artisan
 * (enregistré dans le profil), heure d'envoi, seuil des devis sans réponse, filtre
 * par canal inclus dans l'email, aperçu avant envoi, bouton pour déclencher l'email
 * du jour à la demande et petit historique des envois passés.
 */
export default function RecapQuotidienPanel() {
  const { user, profile, refreshProfile } = useAuth();
  const {
    actif,
    canaux,
    heure,
    devisSeuil,
    relanceFactureAuto,
    relanceFactureSeuil,
    relanceFactureDelai,
    toggleActif,
    toggleCanal,
    changeHeure,
    changeDevisSeuil,
    toggleRelanceFactureAuto,
    changeRelanceFactureSeuil,
    changeRelanceFactureDelai,
  } = useRecapQuotidien();
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apercuOpen, setApercuOpen] = useState(false);
  const [historique, setHistorique] = useState<RecapEnvoi[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistorique = useCallback(async () => {
    if (!user) {
      setHistorique([]);
      return;
    }
    setHistoryLoading(true);
    try {
      setHistorique(await fetchRecapEnvois(user.id, 8));
    } catch {
      /* l'historique est informatif : un échec ne bloque pas le reste */
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistorique();
  }, [loadHistorique]);

  const handleTest = async () => {
    if (!user) return;
    setRunning(true);
    setNotice(null);
    setError(null);
    try {
      const res = await runRecapNow(user.id);
      if (!res.configured) {
        setError(
          `Email non envoyé : Resend n'est pas encore configuré (clé API + domaine d'envoi). ${res.reason ?? ""}`.trim(),
        );
      } else if (res.sent > 0) {
        setNotice(`Récapitulatif envoyé au titre des ${res.window || "dernières 24 h"}. Vérifiez votre boîte mail.`);
        await refreshProfile();
        await loadHistorique();
      } else {
        setNotice(
          `Aucun email envoyé : adresse email manquante ou envoi refusé. (${res.skipped} ignoré${
            res.skipped > 1 ? "s" : ""
          })`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le lancement du récapitulatif a échoué.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-lg">
            <i className="ri-mail-check-line"></i>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground-950">Récapitulatif quotidien</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold">
                <i className="ri-checkbox-blank-circle-fill text-[6px]"></i>
                Email automatique
              </span>
            </div>
            <p className="text-xs text-foreground-600 mt-0.5">
              Recevez chaque jour un seul email : reprogrammations, échecs d'envoi, factures en retard et devis sans
              réponse.
            </p>
            <p className="text-[11px] text-foreground-400 mt-1.5 inline-flex items-center gap-1.5">
              <i className="ri-history-line"></i>
              Dernier envoi réel&nbsp;: <strong className="text-foreground-600">{formatDernierEnvoi(profile?.recap_dernier_envoi)}</strong>
            </p>

            {/* Interrupteur activer/couper */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={actif}
                onClick={toggleActif}
                title={actif ? "Couper le récapitulatif quotidien" : "Activer le récapitulatif quotidien"}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  actif
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-50 text-foreground-500 border border-background-200"
                }`}
              >
                <i className={actif ? "ri-toggle-line text-base" : "ri-toggle-line text-base opacity-60"}></i>
                {actif ? "Récap activé" : "Récap coupé"}
              </button>

              {/* Heure d'envoi choisie par l'artisan */}
              <label
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                  actif
                    ? "bg-background-50 border-background-200 text-foreground-700"
                    : "bg-background-50 border-background-200 text-foreground-400"
                }`}
                title="Heure d'envoi du récapitulatif (heure de Paris)"
              >
                <i className="ri-time-line"></i>
                Envoi à
                <select
                  value={heure}
                  onChange={(e) => changeHeure(Number(e.target.value))}
                  disabled={!actif}
                  className="bg-transparent text-[11px] font-semibold text-foreground-900 outline-none cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Heure d'envoi du récapitulatif"
                >
                  {HEURES.map((h) => (
                    <option key={h} value={h}>
                      {formatHeure(h)}
                    </option>
                  ))}
                </select>
              </label>

              <span className="text-[11px] text-foreground-400">
                {actif
                  ? `Enregistré dans votre profil · heure de Paris.`
                  : "Aucun email récap ne sera envoyé tant qu'il est coupé."}
              </span>
            </div>

            {/* Filtre par canal */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                <i className="ri-filter-3-line"></i>
                Canaux inclus :
              </span>
              <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
                {CANAUX.map((canal) => {
                  const on = canaux.includes(canal);
                  return (
                    <button
                      key={canal}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleCanal(canal)}
                      disabled={!actif}
                      title={
                        on
                          ? `Retirer ${canal} du récapitulatif email`
                          : `Inclure ${canal} dans le récapitulatif email`
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        on ? "bg-secondary-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                      }`}
                    >
                      <i className={CANAL_ICONS[canal] ?? "ri-send-plane-line"}></i>
                      {canal}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seuil des devis sans réponse */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                <i className="ri-hourglass-line"></i>
                Devis « sans réponse » après :
              </span>
              <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
                {RECAP_DEVIS_SEUIL_OPTIONS.map((jours) => {
                  const on = devisSeuil === jours;
                  return (
                    <button
                      key={jours}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => changeDevisSeuil(jours)}
                      disabled={!actif}
                      title={`N'inclure que les devis sans réponse depuis plus de ${jours} jours`}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        on ? "bg-accent-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                      }`}
                    >
                      {jours} j
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-foreground-400">
                Au-delà de {devisSeuil} jours sans réponse.
              </span>
            </div>

            {/* Relance automatique des factures critiques */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                <i className="ri-refresh-line"></i>
                Relance auto factures :
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={relanceFactureAuto}
                onClick={toggleRelanceFactureAuto}
                disabled={!actif}
                title={
                  relanceFactureAuto
                    ? "Couper la relance automatique des factures critiques"
                    : "Activer la relance automatique des factures critiques"
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  relanceFactureAuto
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-50 text-foreground-500 border border-background-200"
                }`}
              >
                <i className={relanceFactureAuto ? "ri-toggle-line text-base" : "ri-toggle-line text-base opacity-60"}></i>
                {relanceFactureAuto ? "Activée" : "Coupée"}
              </button>
              <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
                {RECAP_RELANCE_FACTURE_SEUIL_OPTIONS.map((jours) => {
                  const on = relanceFactureSeuil === jours;
                  return (
                    <button
                      key={jours}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => changeRelanceFactureSeuil(jours)}
                      disabled={!actif || !relanceFactureAuto}
                      title={`Relancer les factures en retard de plus de ${jours} jours`}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        on ? "bg-accent-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                      }`}
                    >
                      +{jours} j
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-foreground-400">
                Rappels clients envoyés automatiquement avec le récap.
              </span>
            </div>

            {/* Délai anti-doublon entre deux rappels d'une même facture */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                <i className="ri-timer-line"></i>
                Ne pas relancer deux fois avant :
              </span>
              <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
                {RELANCE_FACTURE_DELAI_OPTIONS.map((jours) => {
                  const on = relanceFactureDelai === jours;
                  return (
                    <button
                      key={jours}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => changeRelanceFactureDelai(jours)}
                      title={`Délai minimum de ${jours} jours entre deux rappels d'une même facture`}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        on ? "bg-secondary-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                      }`}
                    >
                      {jours} j
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-foreground-400">
                Une facture déjà relancée plus récemment est ignorée.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setApercuOpen(true)}
            disabled={!user}
            title="Voir l'email tel qu'il sera envoyé, sans rien expédier"
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-60"
          >
            <i className="ri-eye-line"></i>
            Aperçu
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={running || !user}
            title="Envoyer tout de suite le récapitulatif du jour à votre adresse email"
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
          >
            {running ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            {running ? "Envoi en cours…" : "Tester maintenant"}
          </button>
        </div>
      </div>

      {notice && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5 mt-3">
          <i className="ri-checkbox-circle-line"></i>
          {notice}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5 mt-3">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      )}

      {/* Historique des récaps envoyés */}
      <div className="mt-3 pt-3 border-t border-background-200">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-history-line"></i>
            Historique des envois
          </p>
          <button
            type="button"
            onClick={loadHistorique}
            disabled={historyLoading}
            title="Rafraîchir l'historique"
            className="w-7 h-7 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <i className={historyLoading ? "ri-loader-4-line animate-spin text-sm" : "ri-refresh-line text-sm"}></i>
          </button>
        </div>

        {historyLoading && historique.length === 0 ? (
          <p className="text-xs text-foreground-400 mt-2 inline-flex items-center gap-1.5">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement de l'historique…
          </p>
        ) : historique.length === 0 ? (
          <p className="text-xs text-foreground-400 mt-2">
            Aucun récapitulatif envoyé pour l'instant. Dès qu'un email partira, il apparaîtra ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 mt-2">
            {historique.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-md bg-background-50 border border-background-200"
              >
                <span className="text-xs font-medium text-foreground-800 inline-flex items-center gap-1.5 whitespace-nowrap">
                  <i className="ri-calendar-check-line text-foreground-400"></i>
                  {formatHistorique(h.envoye_le)}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 ml-auto">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background-100 text-foreground-600 text-[10px] font-semibold whitespace-nowrap">
                    <i className="ri-repeat-line"></i>
                    {h.repros} reprog.
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background-100 text-foreground-600 text-[10px] font-semibold whitespace-nowrap">
                    <i className="ri-error-warning-line"></i>
                    {h.echecs} échec{h.echecs > 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap">
                    <i className="ri-receipt-line"></i>
                    {h.factures} fact.
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
                    <i className="ri-file-text-line"></i>
                    {h.devis} devis
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ApercuRecapModal open={apercuOpen} onClose={() => setApercuOpen(false)} />
    </div>
  );
}