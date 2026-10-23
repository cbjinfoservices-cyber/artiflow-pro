import { formatDateHeureCourte } from "@/lib/dates";
import { RAPPEL_CONFLITS_DEFAUT, type EnvoiListeConflits, type RappelConflitsConfig } from "@/lib/conflitsCongesApi";

/** Jours de la semaine au format ISO (1 = lundi … 7 = dimanche). */
const JOURS_SEMAINE: { valeur: number; label: string; court: string }[] = [
  { valeur: 1, label: "Lundi", court: "lun." },
  { valeur: 2, label: "Mardi", court: "mar." },
  { valeur: 3, label: "Mercredi", court: "mer." },
  { valeur: 4, label: "Jeudi", court: "jeu." },
  { valeur: 5, label: "Vendredi", court: "ven." },
  { valeur: 6, label: "Samedi", court: "sam." },
  { valeur: 7, label: "Dimanche", court: "dim." },
];

/** Heures proposées pour le rappel automatique (0 h à 23 h, heure de Paris). */
const HEURES_RAPPEL: number[] = Array.from({ length: 24 }, (_, i) => i);

/** Libellé et style de la pastille de mode d'envoi. */
function modeEnvoi(mode: string): { label: string; icone: string; classe: string } {
  const valeur = mode.toLowerCase();
  if (valeur === "auto") {
    return { label: "Veille auto", icone: "ri-time-line", classe: "bg-primary-100 text-primary-800" };
  }
  if (valeur === "relance") {
    return { label: "Relance", icone: "ri-refresh-line", classe: "bg-accent-100 text-accent-900" };
  }
  return { label: "Manuel", icone: "ri-cursor-line", classe: "bg-background-50 border border-background-300 text-foreground-600" };
}

/** Jour juste avant la réunion, pour annoncer quand part le rappel automatique. */
function libelleVeille(jourReunion: number): string {
  const veille = jourReunion === 1 ? 7 : jourReunion - 1;
  return JOURS_SEMAINE.find((j) => j.valeur === veille)?.label.toLowerCase() ?? "la veille";
}

/**
 * Journal des envois de la liste des conflits de congé, affiché sous la carte de réaffectation.
 *
 * On y lit, pour chaque envoi, la date et l'heure, le destinataire et le nombre
 * d'interventions transmises : de quoi vérifier avant la réunion que le responsable a bien
 * reçu le fichier. Le bloc porte aussi le réglage du rappel automatique de la veille
 * (email avec le CSV joint, envoyé par la tâche planifiée quotidienne).
 */
export default function HistoriqueEnvoisConflits({
  envois,
  config,
  configBusy,
  onChangerConfig,
  onRenvoyer,
  renvoiId,
}: {
  /** Envois déjà journalisés, du plus récent au plus ancien. */
  envois: EnvoiListeConflits[];
  /** Réglage courant du rappel automatique. */
  config: RappelConflitsConfig;
  /** Enregistrement du réglage en cours. */
  configBusy: boolean;
  onChangerConfig: (config: RappelConflitsConfig) => void;
  /** Réexpédie la liste au responsable avec le même fichier CSV en pièce jointe. */
  onRenvoyer: (envoi: EnvoiListeConflits) => void;
  /** Identifiant de l'envoi en cours de renvoi (affiche un indicateur sur sa ligne). */
  renvoiId: number | null;
}) {
  const jourReunion = JOURS_SEMAINE.find((j) => j.valeur === config.jourReunion) ?? JOURS_SEMAINE[0];
  const dernier = envois[0] ?? null;

  return (
    <div className="rounded-lg bg-background-50 border border-background-200 p-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800">
            <i className="ri-history-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">
              Historique des envois de la liste
              {envois.length > 0 && (
                <span className="ml-2 inline-flex items-center h-5 px-2 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-[10px] font-bold whitespace-nowrap">
                  {envois.length} envoi{envois.length > 1 ? "s" : ""}
                </span>
              )}
            </p>
            <p className="text-[11px] text-foreground-600">
              {dernier
                ? `Dernier envoi le ${formatDateHeureCourte(dernier.createdAt)} à ${
                    dernier.destinataire ?? "destinataire inconnu"
                  } · ${dernier.total} intervention${dernier.total > 1 ? "s" : ""}.`
                : "Aucun envoi pour le moment : la liste n'a encore jamais été transmise au responsable."}
            </p>
          </div>
        </div>

        {/* Réglage du rappel automatique de la veille */}
        <div className="flex flex-col gap-1.5 shrink-0 lg:items-end">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              role="switch"
              aria-checked={config.actif}
              disabled={configBusy}
              onClick={() => onChangerConfig({ ...config, actif: !config.actif })}
              title="Activer ou couper le rappel automatique de la veille de la réunion"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                config.actif
                  ? "bg-secondary-500 text-background-50 hover:bg-secondary-600"
                  : "bg-background-100 border border-background-300 text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className={configBusy ? "ri-loader-4-line animate-spin" : config.actif ? "ri-notification-3-fill" : "ri-notification-off-line"}></i>
              Rappel la veille : {config.actif ? "activé" : "coupé"}
            </button>
            <label className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-full bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
              Réunion le
              <select
                value={config.jourReunion}
                disabled={configBusy}
                onChange={(e) =>
                  onChangerConfig({ ...config, jourReunion: Number(e.target.value) || RAPPEL_CONFLITS_DEFAUT.jourReunion })
                }
                className="h-6 pr-4 pl-1 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {JOURS_SEMAINE.map((j) => (
                  <option key={j.valeur} value={j.valeur}>
                    {j.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-full bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
              Rappel à
              <select
                value={config.heureRappel}
                disabled={configBusy}
                onChange={(e) =>
                  onChangerConfig({
                    ...config,
                    heureRappel: Number(e.target.value) || 0,
                  })
                }
                title="Heure d'envoi du rappel automatique (heure de Paris)"
                className="h-6 pr-4 pl-1 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {HEURES_RAPPEL.map((h) => (
                  <option key={h} value={h}>
                    {h} h
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[10px] text-foreground-500 lg:text-right max-w-[330px]">
            {config.actif
              ? `Email avec le CSV joint, chaque ${libelleVeille(config.jourReunion)} à ${config.heureRappel} h (veille de la réunion du ${jourReunion.court}).`
              : "Aucun rappel automatique : seuls les envois manuels partent."}
          </p>
        </div>
      </div>

      {envois.length === 0 ? (
        <div className="flex items-center gap-2 mt-3 rounded-md bg-background-100 border border-dashed border-background-300 px-3 py-2.5">
          <i className="ri-mail-forbid-line text-foreground-400"></i>
          <p className="text-xs text-foreground-600">
            Rien à vérifier pour l'instant. Utilisez « Envoyer au responsable » : chaque envoi
            apparaîtra ici avec sa date et son destinataire.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 mt-3 max-h-[220px] overflow-y-auto pr-1">
          {envois.map((envoi) => {
            const echec = envoi.statut.toLowerCase() !== "envoye";
            const mode = modeEnvoi(envoi.mode);
            const enRenvoi = renvoiId === envoi.id;
            return (
              <div
                key={envoi.id}
                className={`flex items-center gap-2.5 rounded-md border px-3 py-2 ${
                  echec ? "bg-accent-100/60 border-accent-200" : "bg-background-100 border-background-200"
                }`}
                title={echec ? envoi.message ?? "L'envoi n'a pas abouti." : "Le responsable a bien reçu la liste."}
              >
                <span
                  className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-[12px] ${
                    echec ? "bg-accent-200 text-accent-900" : "bg-secondary-100 text-secondary-800"
                  }`}
                >
                  <i className={echec ? "ri-mail-close-line" : "ri-mail-check-line"}></i>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground-900 truncate">
                    {echec ? "Envoi en échec le" : "Envoyé le"} {formatDateHeureCourte(envoi.createdAt)}
                    <span className="font-normal text-foreground-600">
                      {" "}
                      à {envoi.destinataire ?? "destinataire inconnu"}
                    </span>
                  </p>
                  <p className="text-[10px] text-foreground-500 truncate">
                    {envoi.total} intervention{envoi.total > 1 ? "s" : ""} dans le CSV ·{" "}
                    {envoi.restants} à réaffecter au moment de l'envoi
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${mode.classe}`}
                >
                  <i className={`${mode.icone} text-[9px]`}></i>
                  {mode.label}
                </span>
                <button
                  type="button"
                  onClick={() => onRenvoyer(envoi)}
                  disabled={enRenvoi}
                  title={`Renvoyer la liste au responsable avec le CSV en pièce jointe${
                    envoi.fichier ? ` (${envoi.fichier})` : ""
                  }`}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-background-300 text-foreground-700 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <i className={enRenvoi ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
                  <span className="hidden sm:inline">{enRenvoi ? "Renvoi…" : "Renvoyer cette liste"}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}