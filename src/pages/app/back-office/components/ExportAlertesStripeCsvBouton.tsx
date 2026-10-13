import { useEffect, useRef, useState } from "react";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatHorodatage } from "@/lib/diagnosticUi";
import type { AlerteConfigStripeItem } from "@/lib/alertesConfigStripeApi";

/** Période couverte par l'export (0 = tout l'historique chargé). */
type Periode = 7 | 30 | 90 | 0;
/** Cause à inclure dans l'export. */
type Cause = "tout" | "carte" | "pays" | "configuration";

const PERIODES: { cle: Periode; label: string }[] = [
  { cle: 7, label: "7 derniers jours" },
  { cle: 30, label: "30 derniers jours" },
  { cle: 90, label: "90 derniers jours" },
  { cle: 0, label: "Tout l'historique" },
];

const CAUSES: { cle: Cause; label: string }[] = [
  { cle: "tout", label: "Toutes les causes" },
  { cle: "carte", label: "Carte non activée" },
  { cle: "pays", label: "Pays / devise" },
  { cle: "configuration", label: "Configuration incomplète" },
];

/** Libellé lisible d'une cause. */
function libelleCause(motif: string): string {
  if (motif === "carte") return "Carte non activée";
  if (motif === "pays") return "Pays / devise";
  return "Configuration incomplète";
}

/** Classe une alerte dans l'une des causes proposées à l'export. */
function causeDeMotif(motif: string): Cause {
  if (motif === "carte") return "carte";
  if (motif === "pays") return "pays";
  return "configuration";
}

/**
 * Bouton d'export CSV des alertes de configuration Stripe.
 *
 * Ouvre un petit panneau pour choisir la période (7 / 30 / 90 jours ou tout) et la cause,
 * puis génère un fichier CSV (séparateur « ; », compatible Excel FR) prêt à archiver.
 */
export default function ExportAlertesStripeCsvBouton({
  items,
}: {
  items: AlerteConfigStripeItem[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [periode, setPeriode] = useState<Periode>(30);
  const [cause, setCause] = useState<Cause>("tout");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ouvert]);

  const filtrer = () => {
    const seuil = periode === 0 ? 0 : Date.now() - periode * 24 * 60 * 60 * 1000;
    return items.filter((it) => {
      const t = new Date(it.created_at).getTime();
      if (Number.isNaN(t)) return false;
      if (seuil && t < seuil) return false;
      if (cause !== "tout" && causeDeMotif(it.motif) !== cause) return false;
      return true;
    });
  };

  const nbFiltre = filtrer().length;

  const telecharger = () => {
    const lignes = filtrer();
    const contenu = toCsv(
      ["Date", "Cause", "Pays", "Statut", "Traité par", "Traité le", "Destinataires"],
      lignes.map((it) => [
        formatHorodatage(it.created_at),
        libelleCause(it.motif),
        it.pays ? it.pays.toUpperCase() : "",
        it.statut === "traitee" ? "Traitée" : "À traiter",
        it.traite_par,
        it.traite_at ? formatHorodatage(it.traite_at) : "",
        it.destinataires.join(", "),
      ]),
    );
    const jour = new Date().toISOString().slice(0, 10);
    const suffixe = periode === 0 ? "tout" : `${periode}j`;
    downloadCsv(`alertes-stripe-${suffixe}-${jour}.csv`, contenu);
    setOuvert(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        disabled={items.length === 0}
        title="Exporter les alertes en CSV"
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <i className="ri-download-2-line"></i>
        Export CSV
      </button>

      {ouvert && (
        <div className="absolute right-0 top-9 z-30 w-64 p-3 rounded-lg bg-background-50 border border-background-200 shadow-none animate-fade-in">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400 mb-1.5">
            Période
          </p>
          <div className="flex flex-col gap-0.5 mb-3">
            {PERIODES.map((p) => (
              <label
                key={p.cle}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground-700 cursor-pointer hover:bg-background-100 transition-colors"
              >
                <input
                  type="radio"
                  name="export-periode"
                  checked={periode === p.cle}
                  onChange={() => setPeriode(p.cle)}
                  className="accent-primary-500"
                />
                {p.label}
              </label>
            ))}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400 mb-1.5">
            Cause
          </p>
          <div className="flex flex-col gap-0.5 mb-3">
            {CAUSES.map((c) => (
              <label
                key={c.cle}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground-700 cursor-pointer hover:bg-background-100 transition-colors"
              >
                <input
                  type="radio"
                  name="export-cause"
                  checked={cause === c.cle}
                  onChange={() => setCause(c.cle)}
                  className="accent-primary-500"
                />
                {c.label}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={telecharger}
            disabled={nbFiltre === 0}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line"></i>
            Télécharger ({nbFiltre})
          </button>
        </div>
      )}
    </div>
  );
}