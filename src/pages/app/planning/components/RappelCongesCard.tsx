import { useMemo, useState } from "react";
import { addDays, startOfWeek, toISODate } from "@/lib/dates";
import type { Indisponibilite } from "@/lib/indisponibilites";
import ApercuRappelCongesModal from "@/pages/app/planning/components/ApercuRappelCongesModal";

/** Formate une date ISO en « lundi 27 oct. ». */
function formatJourLisible(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });
}

/**
 * Compte les absences qui *démarrent* dans la semaine prochaine, avec la même logique
 * que le rappel du Backend : une absence déjà en cours n'est pas re-signalée.
 */
function absencesQuiDemarrent(
  indisponibilites: Indisponibilite[],
  lundi: string,
  dimanche: string,
): number {
  const veille = toISODate(addDays(new Date(`${lundi}T00:00:00`), -1));
  const parPersonne = new Map<string, Set<string>>();
  indisponibilites.forEach((i) => {
    const cle = `${i.intervenant_id ?? "equipe"}|${i.motif}`;
    const dates = parPersonne.get(cle) ?? new Set<string>();
    dates.add(i.date);
    parPersonne.set(cle, dates);
  });

  let total = 0;
  parPersonne.forEach((dates) => {
    dates.forEach((date) => {
      if (date < lundi || date > dimanche) return;
      const precedent = toISODate(addDays(new Date(`${date}T00:00:00`), -1));
      if (date === veille) return;
      if (dates.has(precedent)) return;
      total += 1;
    });
  });
  return total;
}

/**
 * Carte « Rappel hebdo des congés » : rappelle quand part l'email automatique au
 * responsable, combien d'absences il annoncera, et permet de le tester tout de suite
 * avec un aperçu fidèle avant envoi.
 */
export default function RappelCongesCard({
  userId,
  indisponibilites,
}: {
  /** Profil connecté : destinataire du rappel de test. */
  userId: string;
  /** Absences connues, pour annoncer combien seront signalées. */
  indisponibilites: Indisponibilite[];
}) {
  const [apercuOuvert, setApercuOuvert] = useState(false);

  const { lundi, dimanche, aSignaler } = useMemo(() => {
    const prochainLundi = addDays(startOfWeek(new Date()), 7);
    const prochainDimanche = addDays(prochainLundi, 6);
    const debut = toISODate(prochainLundi);
    const fin = toISODate(prochainDimanche);
    return {
      lundi: debut,
      dimanche: fin,
      aSignaler: absencesQuiDemarrent(indisponibilites, debut, fin),
    };
  }, [indisponibilites]);

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <i className="ri-mail-send-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Rappel hebdo au responsable</p>
            <p className="text-[11px] text-foreground-500">
              Chaque lundi à 7 h : les absences qui démarrent la semaine suivante, par email.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setApercuOuvert(true)}
          className="self-start inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors"
        >
          <i className="ri-play-circle-line"></i>
          Tester maintenant
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
          <i className="ri-calendar-check-line text-primary-600"></i>
          Prochain envoi : {formatJourLisible(lundi)} à 7 h
        </span>
        <span
          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
            aSignaler > 0 ? "bg-accent-100 text-accent-900" : "bg-background-50 border border-background-200 text-foreground-500"
          }`}
        >
          <i className={aSignaler > 0 ? "ri-suitcase-line" : "ri-checkbox-circle-line"}></i>
          {aSignaler > 0
            ? `${aSignaler} absence${aSignaler > 1 ? "s" : ""} à signaler`
            : "Rien à signaler pour l'instant"}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5"></i>
        « Tester maintenant » ouvre l'email tel qu'il partira, puis permet de l'envoyer sur-le-champ à votre
        adresse. Le rappel automatique du lundi n'est pas décalé.
      </p>

      {apercuOuvert && (
        <ApercuRappelCongesModal userId={userId} onClose={() => setApercuOuvert(false)} />
      )}
    </div>
  );
}