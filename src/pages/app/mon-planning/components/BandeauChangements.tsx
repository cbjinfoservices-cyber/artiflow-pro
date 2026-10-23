import type { CreneauPerso } from "@/lib/planningIntervenant";
import { formatDateLongue } from "@/lib/dates";

/** Petit libellé relatif (« il y a 2 h », « hier ») pour situer une modification. */
function quand(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (h < 1) return "il y a moins d'une heure";
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return j <= 1 ? "hier" : `il y a ${j} jours`;
}

/**
 * Bandeau « changements récents » : signale les interventions modifiées dans les
 * dernières 48 h (nouvelle heure, ajout, passage en provisoire…), pour que rien
 * n'échappe à l'intervenant. Le bouton permet de surligner ces interventions dans la liste.
 */
export default function BandeauChangements({
  recents,
  surligner,
  onToggleSurligner,
}: {
  recents: CreneauPerso[];
  surligner: boolean;
  onToggleSurligner: () => void;
}) {
  if (recents.length === 0) return null;

  return (
    <div className="rounded-lg bg-accent-100 border border-accent-200 p-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
            <i className="ri-flashlight-line text-lg"></i>
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-950">
              {recents.length} intervention{recents.length > 1 ? "s" : ""} mise{recents.length > 1 ? "s" : ""} à jour récemment
            </p>
            <p className="text-[11px] text-foreground-600">
              Ces changements datent des dernières 48 heures. Vérifiez les horaires avant de partir.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSurligner}
          aria-pressed={surligner}
          className={`self-start sm:self-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            surligner
              ? "bg-accent-500 text-background-50 hover:bg-accent-600"
              : "bg-background-50 border border-accent-300 text-accent-800 hover:bg-accent-50"
          }`}
        >
          <i className={surligner ? "ri-focus-3-line" : "ri-focus-2-line"}></i>
          {surligner ? "Surlignage activé" : "Surligner les changements"}
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {recents.slice(0, 4).map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 text-[12px] text-foreground-700 bg-background-50/70 border border-accent-200 rounded-md px-2.5 py-1.5"
          >
            <i className="ri-calendar-line text-accent-600"></i>
            <span className="font-semibold text-foreground-900">{formatDateLongue(c.date)}</span>
            <span className="text-foreground-500">· {c.heure}</span>
            <span className="flex-1 min-w-0 truncate">{c.libelle}</span>
            <span className="text-[11px] text-foreground-400 whitespace-nowrap">{quand(c.updated_at)}</span>
          </li>
        ))}
        {recents.length > 4 && (
          <li className="text-[11px] text-foreground-500 px-1">
            + {recents.length - 4} autre{recents.length - 4 > 1 ? "s" : ""} changement{recents.length - 4 > 1 ? "s" : ""}
          </li>
        )}
      </ul>
    </div>
  );
}