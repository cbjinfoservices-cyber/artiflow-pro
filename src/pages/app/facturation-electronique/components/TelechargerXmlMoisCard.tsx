import { useMemo, useState } from "react";
import type { FactureItem } from "@/hooks/useArtisanData";
import { formatEuros } from "@/lib/format";

interface Props {
  factures: FactureItem[];
  busy: boolean;
  /** Reçoit la clé du mois (AAAA-MM) et les factures retenues, puis déclenche l'archive. */
  onTelecharger: (mois: string, liste: FactureItem[]) => void;
}

/** Clé « AAAA-MM » d'une facture (date d'émission, sinon date de création). */
function cleMois(f: FactureItem): string {
  const base = f.date_emission ?? f.created_at.slice(0, 10);
  return base.slice(0, 7);
}

/** Libellé français d'un mois « AAAA-MM ». */
function libelleMois(cle: string): string {
  const [annee, mois] = cle.split("-").map((v) => Number(v));
  if (!annee || !mois) return cle;
  const date = new Date(annee, mois - 1, 1);
  const texte = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return texte;
}

/**
 * Téléchargement groupé des fichiers XML Factur-X d'un mois : une seule archive
 * ZIP à déposer sur la plateforme de dématérialisation, au lieu de télécharger
 * chaque facture une par une.
 */
export default function TelechargerXmlMoisCard({ factures, busy, onTelecharger }: Props) {
  // Mois disponibles, du plus récent au plus ancien, avec leur nombre de factures.
  const moisDisponibles = useMemo(() => {
    const compteur = new Map<string, number>();
    factures.forEach((f) => {
      const cle = cleMois(f);
      compteur.set(cle, (compteur.get(cle) ?? 0) + 1);
    });
    return Array.from(compteur.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([cle, nombre]) => ({ cle, nombre }));
  }, [factures]);

  const [moisChoisi, setMoisChoisi] = useState<string>("");
  const moisActif = moisChoisi || moisDisponibles[0]?.cle || "";
  const liste = useMemo(
    () => (moisActif ? factures.filter((f) => cleMois(f) === moisActif) : []),
    [factures, moisActif],
  );
  const aPreparer = liste.filter((f) => f.efacture_statut === "non_preparee").length;
  const montant = liste.reduce((somme, f) => somme + Number(f.total_ttc || 0), 0);

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
            <i className="ri-folder-zip-line"></i>
            Dépôt groupé
          </span>
          <h3 className="mt-1 font-heading font-semibold text-sm text-foreground-950">
            Toutes les factures du mois dans une seule archive
          </h3>
          <p className="mt-1 text-xs text-foreground-600 max-w-xl">
            Chaque facture du mois devient un fichier XML Factur-X, réuni dans un ZIP prêt à déposer sur votre
            plateforme de dématérialisation. Plus besoin de les télécharger une par une.
          </p>
        </div>

        {moisDisponibles.length === 0 ? (
          <p className="text-xs text-foreground-500">
            Aucune facture à préparer pour l'instant : générez une facture depuis un devis signé.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 shrink-0">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="mois-archive-xml"
                className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide"
              >
                Mois
              </label>
              <select
                id="mois-archive-xml"
                value={moisActif}
                onChange={(e) => setMoisChoisi(e.target.value)}
                className="h-10 pl-3 pr-8 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 cursor-pointer capitalize"
              >
                {moisDisponibles.map((m) => (
                  <option key={m.cle} value={m.cle}>
                    {libelleMois(m.cle)} — {m.nombre} facture{m.nombre > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => onTelecharger(moisActif, liste)}
              disabled={busy || liste.length === 0}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-download-2-line"></i>}
              {busy ? "Création de l'archive…" : `Télécharger le ZIP (${liste.length})`}
            </button>
          </div>
        )}
      </div>

      {moisDisponibles.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-foreground-500">
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-money-euro-circle-line"></i>
            {formatEuros(montant)} TTC sur le mois
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-file-add-line"></i>
            {aPreparer === 0
              ? "Toutes les factures du mois ont déjà leur XML"
              : `${aPreparer} facture${aPreparer > 1 ? "s" : ""} encore à préparer dans ce mois`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-information-line"></i>
            Les factures incluses passent en « Prête à transmettre ».
          </span>
        </div>
      )}
    </section>
  );
}