import { useMemo } from "react";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import {
  dureeMinutes,
  etatPointage,
  formatDuree,
  formatHeurePointage,
  type Pointage,
} from "@/lib/pointage";
import { formatDateLongue, formatDayName } from "@/lib/dates";

/**
 * Journal des pointages du mois, regroupé par jour (du plus récent au plus ancien).
 * Chaque ligne rappelle l'intervention, l'intervenant, les heures d'arrivée/départ,
 * la pause et la durée réellement travaillée.
 */
export default function PointagesJournal({
  pointages,
  creneaux,
  intervenants,
  maintenant,
}: {
  pointages: Pointage[];
  creneaux: { id: number; libelle: string; ville: string | null }[];
  intervenants: Intervenant[];
  maintenant: number;
}) {
  const infoCreneau = useMemo(() => {
    const map = new Map<number, { libelle: string; ville: string | null }>();
    creneaux.forEach((c) => map.set(c.id, { libelle: c.libelle, ville: c.ville }));
    return map;
  }, [creneaux]);

  const noms = useMemo(() => {
    const map = new Map<number, Intervenant>();
    intervenants.forEach((i) => map.set(i.id, i));
    return map;
  }, [intervenants]);

  const parJour = useMemo(() => {
    const map = new Map<string, Pointage[]>();
    pointages
      .filter((p) => Boolean(p.arrivee_le))
      .forEach((p) => {
        const liste = map.get(p.date) ?? [];
        liste.push(p);
        map.set(p.date, liste);
      });
    return Array.from(map.entries())
      .map(([date, liste]) => ({
        date,
        liste: [...liste].sort((a, b) => (a.arrivee_le ?? "").localeCompare(b.arrivee_le ?? "")),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [pointages]);

  if (parJour.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-background-300 bg-background-50 px-6 py-12 text-center">
        <span className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-background-100 text-foreground-400 text-xl">
          <i className="ri-time-line"></i>
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground-800">Aucun pointage sur ce mois</p>
        <p className="mt-1 text-xs text-foreground-500 max-w-md mx-auto">
          Les pointages saisis depuis le planning (arrivée / départ) apparaîtront ici, avec le total
          d'heures par intervenant.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {parJour.map((jour) => {
        const totalJour = jour.liste.reduce((s, p) => s + dureeMinutes(p, maintenant), 0);
        const d = new Date(`${jour.date}T12:00:00`);
        return (
          <section key={jour.date} className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-4 py-2.5 bg-background-50 border-b border-background-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <i className="ri-calendar-event-line text-xs"></i>
                </span>
                <p className="text-xs font-semibold text-foreground-900 truncate">
                  {formatDayName(d)} {formatDateLongue(jour.date)}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-foreground-700 tabular-nums whitespace-nowrap">
                {formatDuree(totalJour)}
              </span>
            </header>

            <div className="divide-y divide-background-200">
              {jour.liste.map((p) => {
                const creneau = infoCreneau.get(p.creneau_id);
                const intervenant = p.intervenant_id !== null ? noms.get(p.intervenant_id) : undefined;
                const etat = etatPointage(p);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
                    <span className="text-xs font-bold text-foreground-800 tabular-nums w-28 shrink-0">
                      {formatHeurePointage(p.arrivee_le)}
                      <span className="text-foreground-400"> → </span>
                      {formatHeurePointage(p.depart_le)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-900 truncate">
                        {creneau?.libelle ?? "Intervention"}
                      </p>
                      <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
                        <span className="text-[11px] text-foreground-600 inline-flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: intervenant?.couleur
                                ? couleurIntervenant(intervenant.couleur)
                                : "#a8a29e",
                            }}
                          />
                          {intervenant?.nom ?? "Non affecté"}
                        </span>
                        {creneau?.ville && (
                          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                            <i className="ri-map-pin-line"></i>
                            {creneau.ville}
                          </span>
                        )}
                        {p.pause_minutes > 0 && (
                          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                            <i className="ri-rest-time-line"></i>
                            pause {p.pause_minutes} min
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                        etat === "en-cours"
                          ? "bg-accent-100 text-accent-800"
                          : "bg-secondary-100 text-secondary-900"
                      }`}
                    >
                      <i className={etat === "en-cours" ? "ri-timer-flash-line" : "ri-check-line"}></i>
                      {formatDuree(dureeMinutes(p, maintenant))}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}