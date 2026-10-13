import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDernierBilan } from "@/hooks/useDernierBilan";
import { useAuth } from "@/hooks/useAuth";
import { runEnvoiBilanNow } from "@/lib/artisanApi";
import ErreurChargementInline from "@/pages/app/components/ErreurChargementInline";

/** Date et heure d'un envoi (« 12 janv. 2026 à 08:00 »). */
function dateHeureLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${heure}`;
}

/**
 * Encart « Dernier bilan d'archivage » du tableau de bord : rappelle quand le dernier
 * bilan est parti, sur quel exercice, combien d'exercices sont déjà archivés, donne un
 * accès direct à l'Espace comptable et permet de renvoyer le dernier bilan en un clic.
 */
export default function DernierBilanCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bilan, bilans, loading, error: erreurChargement, reload } = useDernierBilan();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Nombre d'exercices distincts déjà archivés (un bilan par exercice, mais on compte
  // les années uniques pour ne pas doubler en cas de renvoi du même exercice).
  const nbExercices = useMemo(
    () => new Set(bilans.map((b) => b.annee).filter((a) => a && a.trim().length > 0)).size,
    [bilans],
  );

  // Renvoie le dernier bilan d'archivage au comptable en un seul clic, sans ouvrir l'Espace comptable.
  const handleRenvoyer = async () => {
    if (!user || !bilan) return;
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const res = await runEnvoiBilanNow(user.id, bilan.annee || undefined);
      if (res.sent > 0) {
        setNotice(
          `Bilan d'archivage${bilan.annee ? ` de l'exercice ${bilan.annee}` : ""} renvoyé à votre comptable par email.`,
        );
        await reload();
      } else if (!res.configured) {
        setError("L'envoi d'emails n'est pas encore activé : configurez Resend pour renvoyer le bilan.");
      } else {
        setError(res.reason || "Le renvoi du bilan n'a rien pu expédier. Vérifiez l'email du comptable.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le renvoi du bilan a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-secondary-50 border border-secondary-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-archive-drawer-line"></i>
          </span>
          <h2 className="font-heading font-semibold text-sm text-foreground-950">Dernier bilan d'archivage</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bilan && (
            <button
              type="button"
              onClick={handleRenvoyer}
              disabled={busy}
              title={`Renvoyer par email le bilan d'archivage${bilan.annee ? ` de l'exercice ${bilan.annee}` : ""} au comptable`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
              Renvoyer le dernier bilan
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/app/comptabilite")}
            title="Ouvrir l'Espace comptable pour consulter ou renvoyer les bilans d'archivage"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
          >
            <i className="ri-arrow-right-up-line"></i>
            Accès direct
          </button>
        </div>
      </div>

      {erreurChargement && bilans.length === 0 ? (
        <ErreurChargementInline
          titre="Dernier bilan d'archivage"
          message={erreurChargement}
          onRetry={reload}
        />
      ) : loading && bilans.length === 0 ? (
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5 py-1">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement de l'archivage…
        </p>
      ) : bilan ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-md bg-background-50 border border-background-200">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Dernier envoi</p>
            <p className="mt-0.5 font-heading font-bold text-sm text-foreground-950">{dateHeureLabel(bilan.envoye_le)}</p>
            <p className="text-[11px] text-foreground-400">{bilan.auto ? "Envoi automatique" : "Envoi de test"}</p>
          </div>
          <div className="p-3 rounded-md bg-background-50 border border-background-200">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Exercice archivé</p>
            <p className="mt-0.5 font-heading font-bold text-base text-foreground-950">{bilan.annee || "—"}</p>
            <p className="text-[11px] text-foreground-400">
              {bilan.nbLignes != null ? `${bilan.nbLignes} ligne${bilan.nbLignes > 1 ? "s" : ""} archivées` : "historique transmis"}
            </p>
          </div>
          <div className="p-3 rounded-md bg-background-50 border border-background-200">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Exercices archivés</p>
            <p className="mt-0.5 font-heading font-bold text-base text-foreground-950">{nbExercices}</p>
            <p className="text-[11px] text-foreground-400">
              {nbExercices > 1 ? "bilans d'archivage conservés" : "bilan d'archivage conservé"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-secondary-600">
            <i className="ri-information-line"></i>
          </span>
          <p className="text-xs text-foreground-600">
            Aucun bilan d'archivage envoyé pour l'instant. Chaque année en janvier, l'historique des envois comptables de
            l'exercice écoulé partira automatiquement au comptable — vous pouvez aussi le lancer depuis l'Espace comptable.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-[11px] text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mt-3 text-[11px] text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {notice}
        </p>
      )}
    </div>
  );
}