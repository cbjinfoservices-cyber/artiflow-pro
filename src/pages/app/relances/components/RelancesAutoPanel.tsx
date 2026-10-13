import {
  DECALAGE_OPTIONS,
  ESCALADE_RETARD_OPTIONS,
  SEUIL_OPTIONS,
} from "@/lib/relances";

interface Props {
  /** Relances automatiques globalement actives ou non. */
  auto: boolean;
  /** Nombre de relances actuellement actives (pour le libellé). */
  actives: number;
  /** Seuil de reprogrammations avant escalade automatique. */
  seuil: number;
  /** Décalage par défaut (jours) des reports. */
  decalage: number;
  /** Seuil (jours de retard) avant escalade automatique. */
  escaladeRetard: number;
  onToggleAuto: () => void;
  onChangeSeuil: (value: number) => void;
  onChangeDecalage: (value: number) => void;
  onChangeEscaladeRetard: (value: number) => void;
}

/**
 * Panneau « Relances automatiques » : activation globale + réglages des seuils
 * d'escalade et du décalage par défaut des reports.
 */
export default function RelancesAutoPanel({
  auto,
  actives,
  seuil,
  decalage,
  escaladeRetard,
  onToggleAuto,
  onChangeSeuil,
  onChangeDecalage,
  onChangeEscaladeRetard,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-accent-50 border border-accent-200">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className="ri-sparkling-2-line text-lg"></i>
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground-950">Relances automatiques</p>
          <p className="text-xs text-foreground-600">
            {auto ? `${actives} relances actives programmées.` : "Toutes les relances sont mises en pause."}
          </p>
          <p className="text-[11px] text-foreground-500 mt-0.5 inline-flex items-center gap-1">
            <i className="ri-server-line"></i>
            La relance automatique des retards tourne aussi 24h/24 côté serveur, même application fermée.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold">
              <i className="ri-flashlight-line"></i>
              Renvoi auto après {seuil} report{seuil > 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold">
              <i className="ri-calendar-schedule-line"></i>
              Reports par défaut à +{decalage}j
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 text-[11px] font-semibold">
              <i className="ri-alarm-warning-line"></i>
              Renvoi auto des retards de plus de {escaladeRetard}j
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-[11px] text-foreground-500">Renvoi automatique après</span>
            <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
              {SEUIL_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChangeSeuil(v)}
                  title={`Renvoyer automatiquement après ${v} report${v > 1 ? "s" : ""}`}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                    seuil === v ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
            <span className="text-[11px] text-foreground-500">
              reports — une relance dépassée est alors renvoyée au client.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-[11px] text-foreground-500">Décalage par défaut des reports</span>
            <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
              {DECALAGE_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChangeDecalage(v)}
                  title={`Reculer les relances de ${v} jours par défaut`}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                    decalage === v ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  +{v}j
                </button>
              ))}
            </div>
            <span className="text-[11px] text-foreground-500">
              appliqué aux boutons « Dupliquer » et « Tout décaler ».
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-[11px] text-foreground-500">Renvoi auto des retards de plus de</span>
            <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
              {ESCALADE_RETARD_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChangeEscaladeRetard(v)}
                  title={`Renvoyer automatiquement les relances en retard de plus de ${v} jours`}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                    escaladeRetard === v ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {v}j
                </button>
              ))}
            </div>
            <span className="text-[11px] text-foreground-500">
              jours — renvoyées au client automatiquement, sans action de votre part.
            </span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleAuto}
        className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0 ${auto ? "bg-accent-500" : "bg-background-300"}`}
        aria-label="Activer les relances automatiques"
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-background-50 transition-all ${auto ? "left-6" : "left-1"}`}></span>
      </button>
    </div>
  );
}