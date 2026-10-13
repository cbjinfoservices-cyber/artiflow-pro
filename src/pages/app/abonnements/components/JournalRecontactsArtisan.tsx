import { formatShortDate } from "@/lib/dates";
import { useRecontactsArtisan } from "@/hooks/useRecontactsArtisan";

interface Props {
  abonnementId: number;
  refreshKey?: number;
}

function statutTone(statut: string): { cls: string; label: string; icone: string } {
  if (statut === "echec") {
    return { cls: "bg-red-100 text-red-700", label: "Échec", icone: "ri-error-warning-line" };
  }
  return { cls: "bg-accent-100 text-accent-800", label: "Envoyé", icone: "ri-check-line" };
}

/**
 * Journal des recontacts envoyés à un compte volatil : date, destinataire et statut.
 * Se charge à l'ouverture (montage) pour ne pas requêter toutes les lignes de la liste.
 */
export default function JournalRecontactsArtisan({ abonnementId, refreshKey = 0 }: Props) {
  const { items, loading, error } = useRecontactsArtisan(abonnementId, true, refreshKey);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[11px] text-foreground-500">
        <i className="ri-loader-4-line animate-spin"></i>
        Chargement du journal…
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-3 text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
        <i className="ri-error-warning-line"></i>
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-3 text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
        <i className="ri-information-line"></i>
        Aucun recontact envoyé pour l'instant.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-background-200 overflow-hidden">
      <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
        <span className="col-span-3">Date</span>
        <span className="col-span-6">Destinataire</span>
        <span className="col-span-3 text-right">Statut</span>
      </div>
      <ul className="divide-y divide-background-200">
        {items.map((it) => {
          const tone = statutTone(it.statut);
          return (
            <li key={it.id} className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 px-3 py-2">
              <span className="sm:col-span-3 text-[11px] text-foreground-600">
                {formatShortDate(it.created_at)}
              </span>
              <span className="sm:col-span-6 min-w-0">
                <span className="block text-[11px] font-semibold text-foreground-800 truncate">
                  {it.email ?? "—"}
                </span>
                {it.sujet && (
                  <span className="block text-[10px] text-foreground-400 truncate">{it.sujet}</span>
                )}
                {it.statut === "echec" && it.erreur && (
                  <span className="block text-[10px] text-red-600 truncate">{it.erreur}</span>
                )}
              </span>
              <span className="sm:col-span-3 sm:text-right">
                <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold ${tone.cls}`}>
                  <i className={`${tone.icone} text-[10px]`}></i>
                  {tone.label}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}