import { useMemo, useState } from "react";
import type { CreneauItem } from "@/hooks/useArtisanData";
import Modal from "@/pages/app/components/Modal";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import {
  libelleDisponibilite,
  suggererRemplacants,
} from "@/lib/conflitsConges";
import {
  iconeMotif,
  libellePeriode,
  type AbsenceJourResume,
  type Indisponibilite,
} from "@/lib/indisponibilites";
import { formatDateLongue } from "@/lib/dates";

/**
 * Fenêtre « Proposer un remplaçant » ouverte depuis le badge de congé d'une intervention.
 * Elle rappelle le conflit, propose les personnes les plus disponibles ce jour-là et
 * permet de réaffecter la mission en un clic (ou de choisir quelqu'un d'autre).
 */
export default function RemplacementCongeModal({
  creneau,
  absence,
  intervenantNom,
  intervenantMetier,
  intervenants,
  creneaux,
  indisponibilites,
  busy,
  onChoisir,
  onClose,
}: {
  creneau: CreneauItem;
  absence: AbsenceJourResume;
  intervenantNom: string | null;
  intervenantMetier: string | null;
  intervenants: Intervenant[];
  creneaux: CreneauItem[];
  indisponibilites: Indisponibilite[];
  busy: boolean;
  onChoisir: (intervenantId: number) => void;
  onClose: () => void;
}) {
  const [choix, setChoix] = useState<string>("");

  const propositions = useMemo(
    () =>
      suggererRemplacants({
        date: creneau.date,
        intervenantId: creneau.intervenant_id,
        metier: intervenantMetier,
        intervenants,
        creneaux,
        indisponibilites,
        limite: 4,
      }),
    [creneau.date, creneau.intervenant_id, intervenantMetier, intervenants, creneaux, indisponibilites],
  );

  const autres = useMemo(
    () => intervenants.filter((i) => i.actif && i.id !== creneau.intervenant_id),
    [intervenants, creneau.intervenant_id],
  );

  return (
    <Modal
      title="Proposer un remplaçant"
      subtitle={`${creneau.libelle} · ${formatDateLongue(creneau.date)} à ${creneau.heure.slice(0, 5)}`}
      onClose={onClose}
    >
      <div className="flex items-start gap-2 rounded-md bg-accent-100 border border-accent-200 px-3 py-2.5">
        <i className={`${iconeMotif(absence.motif)} text-accent-800 mt-0.5`}></i>
        <p className="text-xs text-accent-900 leading-relaxed">
          <span className="font-bold">{intervenantNom ?? "L'intervenant"}</span> est en{" "}
          {absence.motif.toLowerCase()} ({libellePeriode(absence.periode)}) ce jour-là.
          {absence.note ? ` Précision : ${absence.note}.` : ""} Choisissez une personne disponible pour reprendre
          l'intervention.
        </p>
      </div>

      {propositions.length === 0 ? (
        <div className="mt-4 rounded-md bg-background-100 border border-background-200 px-3 py-3">
          <p className="text-xs text-foreground-600">
            Personne n'est libre ce jour-là. Vous pouvez déplacer l'intervention, ou lever l'absence si elle a été
            posée par erreur.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide mb-2">
            Suggestions les plus pertinentes
          </p>
          <div className="flex flex-col gap-1.5">
            {propositions.map((p) => (
              <div
                key={p.intervenant.id}
                className="flex items-center gap-2.5 rounded-md bg-background-50 border border-background-200 p-2.5"
              >
                <span
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-background-50 text-[11px] font-bold"
                  style={{ backgroundColor: couleurIntervenant(p.intervenant.couleur) }}
                >
                  {p.intervenant.nom.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground-900 truncate">{p.intervenant.nom}</p>
                  <p className="text-[10px] text-foreground-500 truncate">
                    {p.intervenant.metier ? `${p.intervenant.metier} · ` : ""}
                    {libelleDisponibilite(p)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChoisir(p.intervenant.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
                >
                  <i className={busy ? "ri-loader-4-line animate-spin" : "ri-user-shared-line"}></i>
                  Réaffecter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-background-200">
        <label htmlFor="remplacant-autre" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
          Choisir une autre personne
        </label>
        <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
          <select
            id="remplacant-autre"
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
            className="flex-1 h-10 rounded-md border border-background-300 bg-background-50 px-3 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer min-w-0"
          >
            <option value="">Sélectionner un intervenant…</option>
            {autres.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nom}
                {i.metier ? ` — ${i.metier}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => choix && onChoisir(Number(choix))}
            disabled={!choix || busy}
            className="h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Réaffecter
          </button>
        </div>
      </div>
    </Modal>
  );
}