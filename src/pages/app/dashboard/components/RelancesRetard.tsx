import { Link } from "react-router-dom";
import type { EscaladeJournalItem, RelanceItem } from "@/hooks/useArtisanData";
import { todayISO } from "@/lib/dates";
import BoutonPartager from "@/pages/app/components/BoutonPartager";

// Nombre de jours entiers écoulés depuis la date prévue (0 si non dépassée).
function joursDeRetard(datePrevue: string | null): number {
  if (!datePrevue) return 0;
  const d = new Date(`${datePrevue.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

// Heure + date d'un passage d'escalade serveur (ex. « 07 oct. 14:00 »).
function formatRunTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Bandeau affiché sur le tableau de bord : alerte sur les relances en retard
 * (un clic mène à la page Relances) et rappel du dernier passage de l'escalade
 * serveur (heure + nombre d'envois) pour voir que la tâche planifiée a bien tourné.
 */
export default function RelancesRetard({
  relances,
  journal = [],
}: {
  relances: RelanceItem[];
  journal?: EscaladeJournalItem[];
}) {
  const today = todayISO();
  const enRetard = relances.filter(
    (r) => r.statut !== "Envoyée" && r.date_prevue !== null && r.date_prevue.slice(0, 10) < today,
  );
  const dernierPassage = journal[0] ?? null;

  // Rien à signaler : ni retard, ni passage d'escalade enregistré.
  if (enRetard.length === 0 && !dernierPassage) return null;

  // Pas de retard mais un passage serveur : on affiche juste le rappel du dernier passage.
  if (enRetard.length === 0 && dernierPassage) {
    return (
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-base">
          <i className="ri-server-line"></i>
        </span>
        <p className="text-xs text-foreground-600">
          <span className="text-foreground-800 font-semibold">Aucun devis en retard</span> — dernier passage de
          l'escalade serveur le <strong>{formatRunTime(dernierPassage.run_at)}</strong>
          {dernierPassage.envoye > 0
            ? ` · ${dernierPassage.envoye} relance${dernierPassage.envoye > 1 ? "s" : ""} envoyée${dernierPassage.envoye > 1 ? "s" : ""}`
            : " · aucun envoi nécessaire"}
          .
        </p>
      </div>
    );
  }

  const critiques = enRetard.filter((r) => joursDeRetard(r.date_prevue) >= 30).length;
  const plusAncien = enRetard.reduce((max, r) => Math.max(max, joursDeRetard(r.date_prevue)), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-primary-50 border border-primary-200 hover:border-primary-300 transition-colors">
        <Link
          to="/app/relances"
          className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
        >
          <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xl">
            <i className="ri-alarm-warning-line"></i>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500 text-background-50 text-xs font-semibold">
                <i className="ri-notification-3-line"></i>
                {enRetard.length} relance{enRetard.length > 1 ? "s" : ""} en retard
              </span>
              {critiques > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold">
                  <i className="ri-fire-line"></i>
                  dont {critiques} depuis plus de 30 jours
                </span>
              )}
            </div>
            <p className="text-xs text-foreground-600 mt-1.5">
              La plus ancienne attend depuis <strong>{plusAncien} jour{plusAncien > 1 ? "s" : ""}</strong>. Ne laissez
              personne passer entre les mailles du filet.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 text-primary-700 text-xs font-semibold whitespace-nowrap border border-primary-200">
            Voir les relances
            <i className="ri-arrow-right-line"></i>
          </span>
        </Link>
        <BoutonPartager
          label="Relances en retard"
          chemin="/app/relances"
          title="Partager la vue des relances en retard"
        />
      </div>

      {dernierPassage && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-background-100 border border-background-200">
          <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-sm">
            <i className="ri-server-line"></i>
          </span>
          <p className="text-[11px] text-foreground-600">
            Dernier passage de l'escalade serveur :{" "}
            <strong className="text-foreground-800">{formatRunTime(dernierPassage.run_at)}</strong>
            {dernierPassage.envoye > 0 ? (
              <>
                {" "}
                ·{" "}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-100 text-accent-700 font-semibold">
                  <i className="ri-send-plane-2-line"></i>
                  {dernierPassage.envoye} envoi{dernierPassage.envoye > 1 ? "s" : ""}
                </span>
              </>
            ) : (
              " · aucun envoi nécessaire"
            )}
          </p>
        </div>
      )}
    </div>
  );
}