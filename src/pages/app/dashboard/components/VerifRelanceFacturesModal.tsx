import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { listRelanceFactures, type RelanceFactureTarget } from "@/lib/artisanApi";
import { formatEuros } from "@/lib/format";

interface VerifRelanceFacturesModalProps {
  open: boolean;
  onClose: () => void;
  /** Seuil d'ancienneté de retard appliqué (0 = toutes les factures en retard). */
  minJoursRetard: number;
  /** Délai minimum (jours) entre deux rappels d'une même facture (anti-doublon). */
  delaiMin: number;
}

/** Formate une échéance en « 07 oct. 2026 ». */
function formatEcheance(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Modale « Vérifier avant envoi » : liste précisément les clients et factures qui vont
 * être relancés selon le filtre d'ancienneté choisi, sans rien expédier. Permet de
 * repérer d'un coup d'œil les clients sans adresse email (qui ne recevront rien).
 */
export default function VerifRelanceFacturesModal({
  open,
  onClose,
  minJoursRetard,
  delaiMin,
}: VerifRelanceFacturesModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [targets, setTargets] = useState<RelanceFactureTarget[]>([]);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoading(true);
    setError(null);
    listRelanceFactures(user.id, minJoursRetard, delaiMin)
      .then((res) => {
        if (!active) return;
        setTargets(res.targets);
        setConfigured(res.configured);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Vérification indisponible.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, user, minJoursRetard, delaiMin]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const avecEmail = targets.filter((t) => t.email.trim()).length;
  const sansEmail = targets.length - avecEmail;
  const total = targets.reduce((sum, t) => sum + t.montant, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Vérification avant envoi des relances de factures"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-lg bg-background-50 border border-background-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-background-200">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-lg">
              <i className="ri-shield-check-line"></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">Vérifier avant envoi</p>
              <p className="text-xs text-foreground-500 mt-0.5">
                Voici précisément les clients et factures qui seront relancés selon le filtre choisi — rien n'est encore
                parti.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la vérification"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {!loading && !error && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-background-200 bg-background-100">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
              <i className="ri-receipt-line"></i>
              {targets.length} facture{targets.length > 1 ? "s" : ""} ciblée{targets.length > 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap">
              <i className="ri-mail-send-line"></i>
              {avecEmail} destinataire{avecEmail > 1 ? "s" : ""}
            </span>
            {sansEmail > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold whitespace-nowrap">
                <i className="ri-error-warning-line"></i>
                {sansEmail} sans email
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-50 border border-background-200 text-foreground-800 text-[11px] font-semibold whitespace-nowrap ml-auto">
              <i className="ri-money-euro-circle-line"></i>
              Total : {formatEuros(total)}
            </span>
          </div>
        )}

        {!loading && !error && !configured && targets.length > 0 && (
          <p className="px-4 py-2 text-[11px] text-foreground-500 bg-background-100 border-b border-background-200 flex items-center gap-1.5">
            <i className="ri-information-line"></i>
            La liste est prête, mais l'envoi réel nécessitera Resend configuré (clé API + domaine d'envoi).
          </p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
              <p className="text-sm text-foreground-500">Analyse des factures ciblées…</p>
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="w-12 h-12 flex items-center justify-center rounded-full bg-red-50 text-red-600 text-xl">
                <i className="ri-error-warning-line"></i>
              </span>
              <p className="text-sm text-foreground-600 max-w-sm">{error}</p>
            </div>
          ) : targets.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-100 text-foreground-400 text-xl">
                <i className="ri-inbox-line"></i>
              </span>
              <p className="text-sm text-foreground-600 max-w-sm">
                Aucune facture en retard avec ce filtre. Aucun client ne sera relancé.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-background-100 text-[11px] uppercase tracking-wide text-foreground-500">
                  <th className="text-left font-semibold px-4 py-2.5">Client</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden sm:table-cell">Facture</th>
                  <th className="text-right font-semibold px-4 py-2.5">Montant</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden md:table-cell">Échéance</th>
                  <th className="text-right font-semibold px-4 py-2.5">Retard</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => {
                  const hasEmail = Boolean(t.email.trim());
                  return (
                    <tr key={t.factureId} className="border-t border-background-200">
                      <td className="px-4 py-2.5">
                        <span className="block text-sm font-medium text-foreground-900">{t.clientNom}</span>
                        {hasEmail ? (
                          <span className="block text-[11px] text-foreground-500 truncate max-w-[220px]">{t.email}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium">
                            <i className="ri-error-warning-line"></i>
                            Pas d'email — ne recevra rien
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell text-sm text-foreground-600">{t.numero || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium text-foreground-800 whitespace-nowrap">
                        {formatEuros(t.montant)}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-sm text-foreground-500 whitespace-nowrap">
                        {formatEcheance(t.echeance)}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold">
                          <i className="ri-time-line"></i>
                          {t.jours} j
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-background-200">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-background-100 border border-background-200 text-foreground-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className="ri-close-line"></i>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}