import { Link } from "react-router-dom";
import type { DevisItem, EnvoiItem, FactureItem } from "@/hooks/useArtisanData";
import { canalIcon } from "@/lib/statuts";

const CANAL_TONE: Record<string, string> = {
  Email: "bg-primary-100 text-primary-700",
  SMS: "bg-secondary-100 text-secondary-700",
  WhatsApp: "bg-accent-100 text-accent-700",
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

export default function RecentEnvois({
  envois,
  devis,
  factures,
}: {
  envois: EnvoiItem[];
  devis: DevisItem[];
  factures: FactureItem[];
}) {
  const devisNumero = new Map<number, string>();
  devis.forEach((d) => devisNumero.set(d.id, d.numero));
  const factureNumero = new Map<number, string>();
  factures.forEach((f) => factureNumero.set(f.id, f.numero));

  const items = envois.slice(0, 5);

  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-heading font-semibold text-base text-foreground-950">Derniers envois</h2>
          <p className="text-xs text-foreground-500 mt-0.5">Devis, factures et relances envoyés à vos clients.</p>
        </div>
        <Link
          to="/app/envois"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap"
        >
          Voir tout
          <i className="ri-arrow-right-line"></i>
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-200 text-foreground-300">
            <i className="ri-send-plane-line text-xl"></i>
          </span>
          <p className="text-sm text-foreground-500">Aucun envoi pour l'instant.</p>
          <p className="text-xs text-foreground-400">Envoie un devis ou une facture, il apparaîtra ici.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((e) => {
            const reference =
              (e.facture_id !== null ? factureNumero.get(e.facture_id) : undefined) ??
              (e.devis_id !== null ? devisNumero.get(e.devis_id) : undefined) ??
              "—";
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200"
              >
                <span
                  className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-lg ${
                    CANAL_TONE[e.canal] ?? "bg-background-200 text-foreground-600"
                  }`}
                >
                  <i className={canalIcon(e.canal)}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 font-semibold">
                      {typeLabel(e.type)}
                    </span>
                    <span className="text-sm font-semibold text-foreground-950">{reference}</span>
                    <span className="text-xs text-foreground-500 truncate">{e.destinataire ?? "—"}</span>
                  </div>
                </div>
                <span className="text-[11px] text-foreground-400 whitespace-nowrap inline-flex items-center gap-1 shrink-0">
                  <i className="ri-time-line"></i>
                  {formatWhen(e.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}