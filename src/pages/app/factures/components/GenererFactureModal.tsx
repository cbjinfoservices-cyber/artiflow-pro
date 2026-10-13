import { useState } from "react";
import type { DevisItem } from "@/hooks/useArtisanData";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";

const DELAIS = [
  { jours: 15, label: "15 jours" },
  { jours: 30, label: "30 jours" },
  { jours: 45, label: "45 jours" },
] as const;

export default function GenererFactureModal({
  devis,
  busy,
  onGenerate,
  onClose,
}: {
  devis: DevisItem[];
  busy: boolean;
  onGenerate: (devisId: number, echeanceJours: number) => void;
  onClose: () => void;
}) {
  const [delai, setDelai] = useState<number>(30);

  return (
    <Modal
      title="Générer une facture"
      subtitle="Choisissez un devis signé pour créer la facture correspondante."
      onClose={onClose}
      wide
    >
      <div className="mb-5 p-4 rounded-lg bg-background-100 border border-background-200">
        <p className="text-xs font-semibold text-foreground-700 mb-2">Délai d'échéance</p>
        <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
          {DELAIS.map((d) => (
            <button
              key={d.jours}
              type="button"
              onClick={() => setDelai(d.jours)}
              aria-pressed={delai === d.jours}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                delai === d.jours ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-foreground-400 mt-2">
          La date d'échéance de la facture sera fixée à aujourd'hui + {delai} jours.
        </p>
      </div>

      {devis.length === 0 ? (
        <div className="py-8 text-center">
          <span className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-2xl">
            <i className="ri-file-check-line"></i>
          </span>
          <p className="mt-4 text-sm text-foreground-600">
            Tous vos devis signés ont déjà une facture. Signez un nouveau devis pour en générer une.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {devis.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-md bg-background-100 border border-background-200">
              <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
                <i className="ri-file-text-line"></i>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground-900 truncate">
                  {d.numero} · {d.clientNom ?? "Sans client"}
                </p>
                <p className="text-[11px] text-foreground-500 truncate">
                  {d.objet ?? "Sans objet"} · signé le {formatShortDate(d.created_at)}
                </p>
              </div>
              <span className="hidden sm:block text-sm font-semibold text-foreground-950 whitespace-nowrap">
                {formatEuros(d.total_ht)}
              </span>
              <button
                type="button"
                onClick={() => onGenerate(d.id, delai)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
              >
                {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-add-line"></i>}
                Générer
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}