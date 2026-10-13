import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRecapQuotidien } from "@/hooks/useRecapQuotidien";
import type { FactureItem } from "@/hooks/useArtisanData";
import { runRelanceFacturesRetard } from "@/lib/artisanApi";
import { factureIsAvoir } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { RETARD_PERIODES } from "@/lib/relances";
import ApercuRelanceFacturesModal from "@/pages/app/dashboard/components/ApercuRelanceFacturesModal";
import VerifRelanceFacturesModal from "@/pages/app/dashboard/components/VerifRelanceFacturesModal";
import HistoriqueRelancesFactures from "@/pages/app/components/HistoriqueRelancesFactures";
import BoutonPartager from "@/pages/app/components/BoutonPartager";

interface RelancesFacturesPanelProps {
  factures: FactureItem[];
  onReload?: () => void | Promise<void>;
}

/** Une facture est « en retard » si elle est émise (non payée) et son échéance est dépassée. */
function estEnRetard(f: FactureItem): boolean {
  if (factureIsAvoir(f.numero)) return false;
  const v = String(f.statut ?? "").trim().toLowerCase();
  if (v.includes("pay") || v.includes("régl") || v.includes("regl")) return false;
  if (v.includes("brouillon") || v.includes("annul") || v.includes("avoir")) return false;
  if (!f.date_echeance) return false;
  const d = new Date(f.date_echeance);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/** Nombre de jours entiers de retard depuis l'échéance (0 si non dépassée). */
function joursRetard(f: FactureItem): number {
  if (!f.date_echeance) return 0;
  const d = new Date(f.date_echeance);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/**
 * Panneau du tableau de bord : « Relancer les factures en retard ».
 * Un filtre par ancienneté de retard (+7 j / +30 j / +60 j) permet de ne cibler que
 * les impayés les plus critiques. On peut vérifier la liste précise des cibles avant
 * envoi, prévisualiser l'email, puis déclencher l'envoi réel via la fonction Backend
 * « relancer-factures-retard ». L'onglet « Historique » réutilise l'archive comptable
 * partagée (filtres client/dates + export CSV), identique à celle de la page Profil.
 */
export default function RelancesFacturesPanel({ factures, onReload }: RelancesFacturesPanelProps) {
  const { user } = useAuth();
  const { relanceFactureDelai } = useRecapQuotidien();
  const [tab, setTab] = useState<"relances" | "historique">("relances");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minJours, setMinJours] = useState(0);
  const [apercuOpen, setApercuOpen] = useState(false);
  const [verifOpen, setVerifOpen] = useState(false);
  const [historyToken, setHistoryToken] = useState(0);
  // Joindre à chaque client en retard un PDF de SA propre balance âgée (factures impayées par ancienneté).
  const [joindreBalanceAgee, setJoindreBalanceAgee] = useState(false);

  const { count, montant, critiques } = useMemo(() => {
    const all = factures.filter(estEnRetard);
    const filtered = all.filter((f) => joursRetard(f) >= minJours);
    return {
      count: filtered.length,
      montant: filtered.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0),
      critiques: all.filter((f) => joursRetard(f) >= 30).length,
    };
  }, [factures, minJours]);

  const handleRelancer = async () => {
    if (!user || count === 0) return;
    setRunning(true);
    setNotice(null);
    setError(null);
    try {
      const res = await runRelanceFacturesRetard(user.id, minJours, relanceFactureDelai, joindreBalanceAgee);
      if (!res.configured) {
        setError(
          `Aucun email envoyé : Resend n'est pas encore configuré (clé API + domaine d'envoi). ${
            res.reason ?? ""
          }`.trim(),
        );
      } else if (res.sent > 0) {
        setNotice(
          `${res.sent} relance${res.sent > 1 ? "s" : ""} de facture${res.sent > 1 ? "s" : ""} en retard envoyée${
            res.sent > 1 ? "s" : ""
          }${res.skipped > 0 ? ` · ${res.skipped} ignorée${res.skipped > 1 ? "s" : ""} (sans email ou relancée récemment)` : ""}.`,
        );
        await onReload?.();
        setHistoryToken((t) => t + 1);
      } else {
        setNotice(
          `Aucun email envoyé : les factures ciblées n'ont pas d'adresse email client ou ont déjà été relancées récemment.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "La relance des factures a échoué.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200">
      {/* En-tête + onglets */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
            <i className="ri-notification-3-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Relances de factures</p>
            <p className="text-xs text-foreground-600">
              Relancez les impayés en un clic et gardez l'historique des rappels envoyés.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
            <button
              type="button"
              onClick={() => setTab("relances")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tab === "relances" ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-send-plane-line"></i>
              Relancer
            </button>
            <button
              type="button"
              onClick={() => setTab("historique")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tab === "historique" ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-history-line"></i>
              Historique
            </button>
          </div>
          <BoutonPartager
            label="Relances de factures"
            chemin={`/app/factures?statut=${encodeURIComponent("En retard")}`}
            title="Partager la vue des factures en retard"
            compact
          />
        </div>
      </div>

      {tab === "relances" ? (
        <div className="mt-3">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {count > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold">
                    <i className="ri-error-warning-line"></i>
                    {count} en retard
                  </span>
                )}
                {critiques > 0 && minJours === 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold">
                    <i className="ri-fire-line"></i>
                    {critiques} à +30 j
                  </span>
                )}
              </div>

              {/* Filtre par ancienneté de retard */}
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                  <i className="ri-filter-3-line"></i>
                  Factures en retard depuis :
                </span>
                <div className="flex gap-0.5 p-0.5 rounded-full bg-background-50 border border-background-200">
                  {RETARD_PERIODES.map((periode) => {
                    const on = minJours === periode.value;
                    return (
                      <button
                        key={periode.value}
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() => setMinJours(periode.value)}
                        title={
                          periode.value === 0
                            ? "Cibler toutes les factures en retard"
                            : `Cibler uniquement les factures en retard de plus de ${periode.value} jours`
                        }
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          on ? "bg-accent-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                        }`}
                      >
                        {periode.value > 0 && <i className="ri-time-line"></i>}
                        {periode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-foreground-400 mt-1.5 inline-flex items-center gap-1.5">
                <i className="ri-money-euro-circle-line"></i>
                {count > 0 ? (
                  <>
                    {count} facture{count > 1 ? "s" : ""} ciblée{count > 1 ? "s" : ""} · Total en attente&nbsp;:{" "}
                    <strong className="text-foreground-600">{formatEuros(montant)}</strong>
                  </>
                ) : minJours > 0 ? (
                  `Aucune facture en retard de plus de ${minJours} jours.`
                ) : (
                  "Aucune facture en retard pour l'instant."
                )}
              </p>

              {/* Rappel du garde-fou anti-doublon */}
              <p className="text-[11px] text-foreground-400 mt-1 inline-flex items-center gap-1.5">
                <i className="ri-timer-line"></i>
                Une facture déjà relancée depuis moins de{" "}
                <strong className="text-foreground-600">{relanceFactureDelai} jours</strong> est ignorée (réglable dans
                Profil).
              </p>

              {/* Option : joindre la balance âgée propre à chaque client */}
              <label className="mt-2 inline-flex items-start gap-2 w-fit cursor-pointer group">
                <input
                  type="checkbox"
                  checked={joindreBalanceAgee}
                  onChange={(e) => setJoindreBalanceAgee(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 rounded border-background-300 accent-accent-500 cursor-pointer"
                />
                <span className="text-[11px] text-foreground-600">
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground-700">
                    <i className="ri-attachment-2"></i>
                    Joindre à chaque client sa balance âgée (PDF)
                  </span>
                  <span className="block text-foreground-400">
                    Un seul email par client, avec le PDF de ses propres factures impayées réparties par ancienneté.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-auto">
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setVerifOpen(true)}
                  disabled={!user}
                  title="Lister précisément les clients et factures qui seront relancés, sans rien envoyer"
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-60 flex-1"
                >
                  <i className="ri-shield-check-line"></i>
                  Vérifier avant envoi
                </button>
                <button
                  type="button"
                  onClick={() => setApercuOpen(true)}
                  disabled={!user}
                  title="Voir le rappel tel qu'il sera envoyé, sans rien expédier"
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-60 flex-1"
                >
                  <i className="ri-eye-line"></i>
                  Aperçu
                </button>
              </div>
              <button
                type="button"
                onClick={handleRelancer}
                disabled={running || !user || count === 0}
                title={count === 0 ? "Aucune facture à relancer avec ce filtre" : "Envoyer un rappel aux clients ciblés"}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {running ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                {running ? "Envoi en cours…" : "Relancer les factures en retard"}
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
        </div>
      ) : (
        <div className="mt-3">
          <HistoriqueRelancesFactures userId={user?.id ?? null} reloadToken={historyToken} />
        </div>
      )}

      <ApercuRelanceFacturesModal
        open={apercuOpen}
        onClose={() => setApercuOpen(false)}
        minJoursRetard={minJours}
        delaiMin={relanceFactureDelai}
      />
      <VerifRelanceFacturesModal
        open={verifOpen}
        onClose={() => setVerifOpen(false)}
        minJoursRetard={minJours}
        delaiMin={relanceFactureDelai}
      />
    </div>
  );
}