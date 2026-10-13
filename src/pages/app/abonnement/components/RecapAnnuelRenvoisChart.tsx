import { useMemo, useState } from "react";
import type { ComptableEnvoi } from "@/lib/artisanApi";
import type { AdresseComptable } from "@/pages/app/abonnement/components/HistoriqueEnvoisComptable";

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

/** Palette de segments (classes Tailwind statiques) pour distinguer les destinataires. */
const COULEURS = [
  "bg-accent-500",
  "bg-secondary-500",
  "bg-primary-500",
  "bg-accent-300",
  "bg-secondary-300",
  "bg-foreground-400",
  "bg-primary-300",
];

/** Libellé lisible d'une adresse destinataire (« Cabinet principal », « Remplaçant A »…). */
function labelDestinataire(email: string, adresses: AdresseComptable[]): string {
  const cle = email.trim().toLowerCase();
  const trouve = adresses.find((a) => a.email.toLowerCase() === cle);
  if (trouve) return trouve.label;
  return email || "Destinataire inconnu";
}

interface RecapAnnuelRenvoisChartProps {
  /** Envois au comptable, du plus récent au plus ancien (les tests sont exclus du calcul). */
  envois: ComptableEnvoi[];
  /** Adresses enregistrées (cabinet principal / remplaçants) pour nommer les destinataires. */
  adressesComptable?: AdresseComptable[];
}

/**
 * Récap annuel des renvois au comptable : un petit graphique « mois par mois » (une colonne
 * par mois de l'année choisie), chaque colonne étant empilée par destinataire. Les envois de
 * test sont exclus. Une légende indique la couleur de chaque destinataire et son total annuel.
 */
export default function RecapAnnuelRenvoisChart({ envois, adressesComptable = [] }: RecapAnnuelRenvoisChartProps) {
  // Années réellement présentes dans l'historique (hors tests), la plus récente d'abord.
  const annees = useMemo(() => {
    const set = new Set<number>();
    envois.forEach((e) => {
      if (e.test) return;
      const d = new Date(e.envoye_le);
      if (!Number.isNaN(d.getTime())) set.add(d.getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [envois]);

  const anneeDefaut = annees[0] ?? new Date().getFullYear();
  const [anneeChoisie, setAnneeChoisie] = useState<number>(anneeDefaut);
  // Année effective : retombe sur la plus récente disponible si la sélection n'existe plus.
  const annee = annees.includes(anneeChoisie) ? anneeChoisie : anneeDefaut;

  const { parMois, totauxParDestinataire, destinatairesOrdre, totalAnnee, maxMois } = useMemo(() => {
    const mois: Record<string, number>[] = Array.from({ length: 12 }, () => {
      return {} as Record<string, number>;
    });
    const totaux: Record<string, number> = {};
    envois.forEach((e) => {
      if (e.test) return;
      const d = new Date(e.envoye_le);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== annee) return;
      const cle = (e.destinataire ?? "").trim().toLowerCase() || "__inconnu";
      mois[d.getMonth()][cle] = (mois[d.getMonth()][cle] ?? 0) + 1;
      totaux[cle] = (totaux[cle] ?? 0) + 1;
    });
    const ordre = Object.keys(totaux).sort((a, b) => totaux[b] - totaux[a]);
    const total = ordre.reduce((s, k) => s + totaux[k], 0);
    const max = Math.max(
      1,
      ...mois.map((m) => Object.values(m).reduce((s, v) => s + v, 0)),
    );
    return {
      parMois: mois,
      totauxParDestinataire: totaux,
      destinatairesOrdre: ordre,
      totalAnnee: total,
      maxMois: max,
    };
  }, [envois, annee]);

  const couleurDe = (cle: string) => COULEURS[Math.max(0, destinatairesOrdre.indexOf(cle)) % COULEURS.length];

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-sm">
            <i className="ri-bar-chart-2-line"></i>
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground-900">Récap annuel des renvois par destinataire</p>
            <p className="text-[10px] text-foreground-500">Nombre d'envois réels au comptable, mois par mois (hors tests).</p>
          </div>
        </div>
        {annees.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {annees.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAnneeChoisie(a)}
                aria-pressed={annee === a}
                className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  annee === a
                    ? "bg-accent-500 text-background-50"
                    : "bg-background-50 border border-background-200 text-foreground-600 hover:border-accent-300"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        ) : (
          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] font-bold text-foreground-700 tabular-nums">
            {annee} · {totalAnnee} envoi{totalAnnee > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {totalAnnee === 0 ? (
        <p className="text-[11px] text-foreground-500">
          Aucun envoi réel enregistré en {annee}.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-1 sm:gap-1.5" role="img" aria-label={`Nombre d'envois au comptable par mois en ${annee}`}>
            {parMois.map((mois, index) => {
              const totalMois = Object.values(mois).reduce((s, v) => s + v, 0);
              const segments = destinatairesOrdre.filter((cle) => (mois[cle] ?? 0) > 0);
              const infobulle =
                totalMois > 0
                  ? `${MOIS_COURTS[index]} ${annee} — ${totalMois} envoi${totalMois > 1 ? "s" : ""}\n` +
                    segments
                      .map((cle) => `• ${labelDestinataire(cle === "__inconnu" ? "" : cle, adressesComptable)} : ${mois[cle]}`)
                      .join("\n")
                  : `${MOIS_COURTS[index]} ${annee} — aucun envoi`;
              return (
                <div key={index} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                  <div className="h-32 w-full flex items-end justify-center" title={infobulle}>
                    <div
                      className="w-full max-w-[24px] flex flex-col-reverse rounded-sm overflow-hidden"
                      style={{ height: `${(totalMois / maxMois) * 100}%`, minHeight: totalMois > 0 ? 4 : 0 }}
                    >
                      {segments.map((cle) => (
                        <div
                          key={cle}
                          className={couleurDe(cle)}
                          style={{ flexGrow: mois[cle] || 0 }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className={`text-[10px] tabular-nums ${totalMois > 0 ? "font-semibold text-foreground-700" : "text-foreground-400"}`}>
                    {MOIS_COURTS[index]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 border-t border-background-200">
            {destinatairesOrdre.map((cle) => (
              <span key={cle} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${couleurDe(cle)}`}></span>
                <span className="font-semibold text-foreground-800">
                  {labelDestinataire(cle === "__inconnu" ? "" : cle, adressesComptable)}
                </span>
                <span className="tabular-nums text-foreground-500">{totauxParDestinataire[cle]}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}