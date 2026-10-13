import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useExportCsvMensuel } from "@/hooks/useExportCsvMensuel";
import { runExportCsvMensuelNow } from "@/lib/exportCsvMensuel";
import ApercuExportCsvMensuelModal from "@/pages/app/components/ApercuExportCsvMensuelModal";

// Jours du mois proposés (1 → 28) pour l'envoi automatique de l'export CSV.
const JOURS = Array.from({ length: 28 }, (_, i) => i + 1);
// Heures proposées (0 → 23).
const HEURES = Array.from({ length: 24 }, (_, i) => i);

/** Libellé lisible d'un jour du mois (« 1er » / « 12 »). */
function libelleJour(j: number): string {
  return j === 1 ? "1er" : String(j);
}

/** Formatte une date d'envoi en « 12 sept. à 08:00 ». */
function quand(iso: string | null): string {
  if (!iso) return "Jamais";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Réglage de l'export CSV mensuel par email : active l'envoi automatique des journaux
 * (réessais d'envoi + escalade serveur) en pièces jointes, choisit le jour du mois, l'heure
 * et une liste de destinataires en copie (Cc), affiche la date du dernier envoi et un petit
 * historique, permet de tester l'envoi réel et de prévisualiser le rendu de l'email. Partagé
 * entre le tableau de bord et la page Relances (bloc de surveillance unifié).
 */
export default function ExportCsvMensuelReglage() {
  const { user } = useAuth();
  const {
    actif,
    jour,
    heure,
    cc,
    dernierEnvoi,
    historique,
    refreshHistorique,
    toggleActif,
    changeJour,
    changeHeure,
    changeCc,
  } = useExportCsvMensuel();
  const [testEnCours, setTestEnCours] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [apercuOuvert, setApercuOuvert] = useState(false);

  // Envoie tout de suite les deux CSV par email pour vérifier le rendu, sans attendre
  // le jour programmé. La décision et l'envoi sont gérés côté Backend.
  const handleTest = async () => {
    if (testEnCours || !user) return;
    setTestEnCours(true);
    setMessage(null);
    try {
      const res = await runExportCsvMensuelNow(user.id);
      if (res.sent > 0) {
        const detail =
          res.reessais != null && res.passages != null
            ? ` (${res.reessais} réessai${res.reessais > 1 ? "s" : ""} · ${res.passages} passage${
                res.passages > 1 ? "s" : ""
              })`
            : "";
        setMessage({ ok: true, texte: `Email de test envoyé${detail} — vérifiez votre boîte de réception.` });
        await refreshHistorique();
      } else {
        setMessage({
          ok: false,
          texte: res.reason || "L'envoi de test n'a pas pu être expédié. Vérifiez la configuration d'envoi.",
        });
      }
    } catch {
      setMessage({ ok: false, texte: "L'envoi de test a échoué. Réessayez dans un instant." });
    } finally {
      setTestEnCours(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-sm">
          <i className="ri-mail-download-line"></i>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-950">Export CSV mensuel par email</p>
          <p className="text-xs text-foreground-600">
            Reçoit chaque mois, en pièces jointes, le journal des réessais et le journal d'escalade des 31 derniers jours.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={actif}
          onClick={toggleActif}
          title={actif ? "Couper l'envoi mensuel automatique des exports" : "Activer l'envoi mensuel automatique des exports"}
          className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            actif ? "bg-accent-500 text-background-50" : "bg-background-100 text-foreground-600 border border-background-200"
          }`}
        >
          <i className={actif ? "ri-toggle-fill" : "ri-toggle-line"}></i>
          {actif ? "Activé" : "Coupé"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
          <i className="ri-calendar-event-line"></i>
          Le
          <select
            value={jour}
            disabled={!actif}
            onChange={(e) => changeJour(Number(e.target.value))}
            title="Jour du mois de l'envoi automatique"
            className="h-7 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] text-foreground-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {JOURS.map((j) => (
              <option key={j} value={j}>
                {libelleJour(j)} du mois
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
          <i className="ri-time-line"></i>
          à
          <select
            value={heure}
            disabled={!actif}
            onChange={(e) => changeHeure(Number(e.target.value))}
            title="Heure d'envoi (heure de Paris)"
            className="h-7 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] text-foreground-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {HEURES.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setApercuOuvert(true)}
          disabled={!user}
          title="Voir le rendu exact de l'email mensuel, sans rien envoyer"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors bg-background-50 text-foreground-600 border border-background-200 hover:bg-background-200 disabled:opacity-60"
        >
          <i className="ri-eye-line"></i>
          Aperçu
        </button>
        <button
          type="button"
          onClick={() => { void handleTest(); }}
          disabled={testEnCours}
          title="Recevoir tout de suite un email de démonstration avec les deux CSV"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors bg-background-100 text-foreground-600 border border-background-200 hover:bg-background-200 disabled:opacity-60"
        >
          <i className={testEnCours ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
          Tester l'envoi
        </button>
      </div>

      {/* Destinataires en copie (Cc) : pour archiver aussi chez le comptable */}
      <label className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
          <i className="ri-user-add-line"></i>
          Destinataires en copie (Cc)
          <span className="text-foreground-400">· pour archiver aussi chez votre comptable</span>
        </span>
        <input
          type="text"
          value={cc}
          onChange={(e) => changeCc(e.target.value)}
          placeholder="comptable@exemple.fr, archive@cabinet.fr"
          title="Séparez plusieurs adresses par une virgule"
          className="h-8 w-full px-2.5 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-700 placeholder:text-foreground-400 focus:outline-none focus:border-primary-300"
        />
      </label>

      {/* Dernier envoi + historique */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] text-foreground-600 whitespace-nowrap">
          <i className="ri-history-line"></i>
          Dernier envoi : <span className="font-semibold text-foreground-800">{quand(dernierEnvoi)}</span>
        </span>
        {message && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] ${
              message.ok ? "text-accent-700" : "text-red-700"
            }`}
          >
            <i className={message.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
            {message.texte}
          </span>
        )}
      </div>

      {historique.length > 0 && (
        <div className="rounded-lg bg-background-50 border border-background-200">
          <p className="px-3 pt-2.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            Historique des envois
          </p>
          <ul className="divide-y divide-background-200/70 mt-1.5">
            {historique.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-[11px]">
                <span className="text-foreground-500 whitespace-nowrap">{quand(h.sentAt)}</span>
                <span className="inline-flex items-center gap-1 text-foreground-600">
                  <i className="ri-file-text-line"></i>
                  {h.nbReessais} réessai{h.nbReessais > 1 ? "s" : ""} · {h.nbPassages} passage{h.nbPassages > 1 ? "s" : ""}
                </span>
                {h.cc && (
                  <span className="inline-flex items-center gap-1 text-foreground-500 min-w-0">
                    <i className="ri-share-forward-line"></i>
                    <span className="truncate">{h.cc}</span>
                  </span>
                )}
                {h.test && (
                  <span className="inline-flex items-center gap-1 shrink-0 h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 font-semibold">
                    <i className="ri-flask-line"></i>
                    test
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {apercuOuvert && user && (
        <ApercuExportCsvMensuelModal userId={user.id} onClose={() => setApercuOuvert(false)} />
      )}
    </div>
  );
}