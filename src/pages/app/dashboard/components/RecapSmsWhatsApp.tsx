import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { EnvoiItem } from "@/hooks/useArtisanData";
import { canalIcon } from "@/lib/statuts";

const CANAL_TONE: Record<string, string> = {
  SMS: "bg-secondary-100 text-secondary-700",
  WhatsApp: "bg-accent-100 text-accent-700",
};

const CANAL_BAR: Record<string, string> = {
  SMS: "bg-secondary-500",
  WhatsApp: "bg-accent-500",
};

function typeLabel(type: string): string {
  if (type === "relance") return "Relance";
  if (type === "devis") return "Devis";
  return "Facture";
}

function formatWhen(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Récapitulatif des relances envoyées par SMS et WhatsApp : compteurs par canal,
 * volume du mois en cours (avec évolution vs mois précédent) et derniers envois.
 * Ces envois proviennent de la page Relances (canal SMS/WhatsApp) et sont tracés
 * dans l'historique des envois, exactement comme les emails.
 */
export default function RecapSmsWhatsApp({ envois }: { envois: EnvoiItem[] }) {
  const smsWhatsapp = useMemo(
    () => envois.filter((e) => e.canal === "SMS" || e.canal === "WhatsApp"),
    [envois],
  );

  const stats = useMemo(() => {
    const sms = smsWhatsapp.filter((e) => e.canal === "SMS").length;
    const whatsapp = smsWhatsapp.filter((e) => e.canal === "WhatsApp").length;
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const currentKey = monthKey(now);
    const previousKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let current = 0;
    let previous = 0;
    smsWhatsapp.forEach((e) => {
      const d = new Date(e.created_at);
      if (Number.isNaN(d.getTime())) return;
      const k = monthKey(d);
      if (k === currentKey) current += 1;
      else if (k === previousKey) previous += 1;
    });
    const delta = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
    return { sms, whatsapp, current, delta };
  }, [smsWhatsapp]);

  const total = smsWhatsapp.length;
  const recents = smsWhatsapp.slice(0, 5);
  const smsPct = total ? Math.round((stats.sms / total) * 100) : 0;
  const waPct = total ? 100 - smsPct : 0;

  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-heading font-semibold text-base text-foreground-950">Relances SMS &amp; WhatsApp</h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            Vos relances client parties par message, en dehors de l'email.
          </p>
        </div>
        <Link
          to="/app/envois"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
        >
          Historique des envois
          <i className="ri-arrow-right-line"></i>
        </Link>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-200 text-foreground-300">
            <i className="ri-message-3-line text-xl"></i>
          </span>
          <p className="text-sm text-foreground-500">Aucune relance SMS ou WhatsApp pour l'instant.</p>
          <p className="text-xs text-foreground-400">
            Depuis la page Relances, choisis le canal SMS ou WhatsApp pour contacter un client par message.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200">
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-lg">
                <i className="ri-message-2-line"></i>
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">SMS</p>
                <p className="font-heading font-bold text-xl text-foreground-950 leading-tight">
                  {stats.sms}
                  <span className="ml-1.5 text-xs font-medium text-foreground-500">envoyés</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200">
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
                <i className="ri-whatsapp-line"></i>
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">WhatsApp</p>
                <p className="font-heading font-bold text-xl text-foreground-950 leading-tight">
                  {stats.whatsapp}
                  <span className="ml-1.5 text-xs font-medium text-foreground-500">envoyés</span>
                </p>
              </div>
            </div>
          </div>

          {total > 0 && (
            <div className="mb-4">
              <div className="flex h-2 rounded-full overflow-hidden bg-background-200">
                {stats.sms > 0 && <div className={`${CANAL_BAR.SMS} h-full`} style={{ width: `${smsPct}%` }}></div>}
                {stats.whatsapp > 0 && (
                  <div className={`${CANAL_BAR.WhatsApp} h-full`} style={{ width: `${waPct}%` }}></div>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-foreground-500">
                Répartition : {smsPct}% SMS · {waPct}% WhatsApp
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 rounded-md bg-background-50 border border-background-200 mb-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground-700">
              <i className="ri-calendar-line text-foreground-500"></i>
              <strong className="font-semibold text-foreground-950">{stats.current}</strong>
              <span className="text-foreground-500">ce mois-ci</span>
            </span>
            {stats.delta === null ? (
              <span className="text-[11px] text-foreground-300">— vs mois précédent</span>
            ) : (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                  stats.delta > 0 ? "text-accent-700" : stats.delta < 0 ? "text-red-600" : "text-foreground-500"
                }`}
              >
                <i
                  className={
                    stats.delta > 0
                      ? "ri-arrow-up-line"
                      : stats.delta < 0
                        ? "ri-arrow-down-line"
                        : "ri-subtract-line"
                  }
                ></i>
                {stats.delta > 0 ? "+" : ""}
                {stats.delta}%
                <span className="ml-1 font-normal text-foreground-400">vs mois précédent</span>
              </span>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            {recents.map((e) => {
              const tone = CANAL_TONE[e.canal] ?? "bg-background-200 text-foreground-600";
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200"
                >
                  <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-lg ${tone}`}>
                    <i className={canalIcon(e.canal)}></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 font-semibold">
                        {typeLabel(e.type)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tone}`}>{e.canal}</span>
                      <span className="text-xs text-foreground-800 truncate">{e.destinataire ?? "—"}</span>
                    </div>
                    {e.sujet && <p className="text-[11px] text-foreground-500 mt-0.5 truncate">{e.sujet}</p>}
                  </div>
                  <span className="text-[11px] text-foreground-400 whitespace-nowrap inline-flex items-center gap-1 shrink-0">
                    <i className="ri-time-line"></i>
                    {formatWhen(e.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>

          {total > recents.length && (
            <Link
              to="/app/envois"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
            >
              Voir les {total - recents.length} autres envois
              <i className="ri-arrow-right-line"></i>
            </Link>
          )}
        </>
      )}
    </div>
  );
}