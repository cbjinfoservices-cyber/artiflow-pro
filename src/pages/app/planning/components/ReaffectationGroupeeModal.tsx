import { useMemo, useState } from "react";
import type { CreneauItem } from "@/hooks/useArtisanData";
import Modal from "@/pages/app/components/Modal";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { libelleDisponibilite, suggererRemplacants, type ConflitConge } from "@/lib/conflitsConges";
import { iconeMotif, libellePeriode, type Indisponibilite } from "@/lib/indisponibilites";
import { formatShortDate } from "@/lib/dates";

/**
 * Fenêtre « Réaffecter toutes ses interventions » : quand une personne absente cumule
 * plusieurs missions le même jour, on choisit un seul remplaçant et toutes les missions
 * de la journée lui sont confiées d'un coup.
 */
export default function ReaffectationGroupeeModal({
  conflits,
  intervenants,
  creneaux,
  indisponibilites,
  busy,
  onChoisir,
  onClose,
}: {
  /** Interventions du même intervenant, le même jour. */
  conflits: ConflitConge[];
  intervenants: Intervenant[];
  creneaux: CreneauItem[];
  indisponibilites: Indisponibilite[];
  busy: boolean;
  onChoisir: (intervenantId: number, nom: string) => void;
  onClose: () => void;
}) {
  const [choix, setChoix] = useState<string>("");

  const premier = conflits[0];
  const nomAbsent = premier?.intervenant?.nom ?? "L'intervenant";
  const date = premier?.creneau.date ?? "";
  const ids = useMemo(() => new Set(conflits.map((c) => c.creneau.id)), [conflits]);

  // Un remplaçant doit être libre et ne pas déjà assurer l'une des missions du lot.
  const propositions = useMemo(() => {
    if (!premier) return [];
    return suggererRemplacants({
      date,
      intervenantId: premier.creneau.intervenant_id,
      metier: premier.intervenant?.metier ?? null,
      intervenants,
      creneaux,
      indisponibilites,
      limite: 4,
    });
  }, [premier, date, intervenants, creneaux, indisponibilites]);

  const autres = useMemo(
    () => intervenants.filter((i) => i.actif && i.id !== premier?.creneau.intervenant_id),
    [intervenants, premier],
  );

  if (!premier) return null;

  const libelles = conflits.map((c) => `${c.creneau.heure.slice(0, 5)} · ${c.creneau.libelle}`);

  return (
    <Modal
      title="Réaffecter toutes ses interventions"
      subtitle={`${nomAbsent} · ${formatShortDate(date)} · ${conflits.length} interventions`}
      onClose={onClose}
    >
      <div className="flex items-start gap-2 rounded-md bg-accent-100 border border-accent-200 px-3 py-2.5">
        <i className={`${iconeMotif(premier.absence.motif)} text-accent-800 mt-0.5`}></i>
        <p className="text-xs text-accent-900 leading-relaxed">
          <span className="font-bold">{nomAbsent}</span> est en {premier.absence.motif.toLowerCase()} (
          {libellePeriode(premier.absence.periode)}) ce jour-là et cumule {conflits.length} interventions.
          Choisissez un seul remplaçant : toutes les missions de la journée lui seront confiées.
        </p>
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {libelles.map((libelle, index) => (
          <li
            key={conflits[index].creneau.id}
            className="flex items-center gap-2 rounded-md bg-background-100 border border-background-200 px-2.5 py-1.5"
          >
            <i className="ri-arrow-right-s-line text-foreground-400"></i>
            <span className="text-[11px] font-semibold text-foreground-800 truncate">{libelle}</span>
            <span className="text-[10px] text-foreground-500 truncate ml-auto">
              {conflits[index].creneau.ville || "Lieu à définir"}
            </span>
          </li>
        ))}
      </ul>

      {propositions.length === 0 ? (
        <div className="mt-4 rounded-md bg-background-100 border border-background-200 px-3 py-3">
          <p className="text-xs text-foreground-600">
            Personne n'est libre ce jour-là. Déplacez les interventions, ou levez l'absence si elle a été posée par
            erreur.
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
                  onClick={() => onChoisir(p.intervenant.id, p.intervenant.nom)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
                >
                  <i className={busy ? "ri-loader-4-line animate-spin" : "ri-user-shared-line"}></i>
                  Réaffecter {conflits.length}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-background-200">
        <label
          htmlFor="remplacant-groupe"
          className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide"
        >
          Choisir une autre personne
        </label>
        <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
          <select
            id="remplacant-groupe"
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
            onClick={() => {
              if (!choix) return;
              const nom = autres.find((i) => i.id === Number(choix))?.nom ?? "ce remplaçant";
              onChoisir(Number(choix), nom);
            }}
            disabled={!choix || busy}
            className="h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Réaffecter tout
          </button>
        </div>
        <p className="text-[10px] text-foreground-500 mt-2">
          {ids.size} intervention{ids.size > 1 ? "s" : ""} sera{ids.size > 1 ? "ont" : ""} déplacée
          {ids.size > 1 ? "s" : ""} vers la même personne.
        </p>
      </div>
    </Modal>
  );
}