import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEchecsEnvoiAutoNouvelles } from "@/hooks/useEchecsEnvoiAutoNouvelles";

function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/**
 * Rappel du tableau de bord quand l'envoi groupé automatique n'a pas pu partir :
 * Resend a refusé un ou plusieurs emails, donc des clients silencieux n'ont rien reçu.
 * On affiche les chantiers concernés et la raison exacte renvoyée par le serveur.
 */
export default function AlerteEchecEnvoiAuto() {
  const { echecs, loading } = useEchecsEnvoiAutoNouvelles();
  const [masque, setMasque] = useState(false);

  const raisons = useMemo(() => {
    const vues = new Map<string, number>();
    echecs.forEach((e) => {
      const raison = (e.erreur ?? "").trim() || "Envoi refusé par le service d'email.";
      vues.set(raison, (vues.get(raison) ?? 0) + 1);
    });
    return Array.from(vues.entries()).sort((a, b) => b[1] - a[1]);
  }, [echecs]);

  if (loading || masque || echecs.length === 0) return null;

  const derniere = echecs[0];
  const chantiersTouches = new Set(echecs.map((e) => e.chantierId)).size;

  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex flex-col sm:flex-row sm:items-start gap-3 animate-fade-in">
      <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-700">
        <i className="ri-mail-close-line text-lg"></i>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground-950">
          L&apos;envoi automatique des nouvelles n&apos;a pas pu partir
        </p>
        <p className="mt-0.5 text-xs text-foreground-700">
          {echecs.length} email{echecs.length > 1 ? "s" : ""} refusé{echecs.length > 1 ? "s" : ""} par le service
          d&apos;envoi, sur {chantiersTouches} chantier{chantiersTouches > 1 ? "s" : ""} — dernier échec le{" "}
          <strong className="text-foreground-900">{dateCourte(derniere.created_at)}</strong>. Ces clients n&apos;ont donc
          rien reçu.
        </p>

        <ul className="mt-2 flex flex-col gap-1">
          {echecs.slice(0, 3).map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-1.5 rounded-md bg-background-50 border border-red-200 px-2.5 py-1.5 text-[11px] text-foreground-700"
            >
              <i className="ri-building-2-line text-red-600"></i>
              <span className="font-semibold text-foreground-900 truncate max-w-[45%]">{e.chantierLibelle}</span>
              <span className="text-foreground-400">·</span>
              <span className="truncate max-w-[40%]">{e.destinataire ?? "adresse inconnue"}</span>
              <span className="text-red-700 truncate">{(e.erreur ?? "Envoi refusé").slice(0, 90)}</span>
            </li>
          ))}
          {echecs.length > 3 && (
            <li className="text-[10px] text-foreground-500 pl-1">+ {echecs.length - 3} autre(s) échec(s)</li>
          )}
        </ul>

        {raisons.length > 0 && (
          <p className="mt-1.5 text-[11px] text-red-800 leading-relaxed">
            <span className="font-semibold">Raison principale : </span>
            {raisons[0][0]}
            {raisons[0][1] > 1 ? ` (${raisons[0][1]} envois)` : ""}. Vérifiez l&apos;adresse email du client dans sa
            fiche, puis relancez l&apos;envoi.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to="/app/chantiers#envoi-auto"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap hover:bg-primary-600 transition-colors"
          >
            <i className="ri-settings-3-line"></i>
            Vérifier le réglage
          </Link>
          <Link
            to="/app/chantiers?sans-nouvelles=1"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-red-200 text-red-800 text-xs font-semibold whitespace-nowrap hover:bg-red-100 transition-colors"
          >
            <i className="ri-mail-send-line"></i>
            Renvoyer à la main
          </Link>
          <button
            type="button"
            onClick={() => setMasque(true)}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-foreground-500 text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
          >
            <i className="ri-close-line"></i>
            Masquer
          </button>
        </div>
      </div>
    </div>
  );
}