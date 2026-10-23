import { useState } from "react";

interface Props {
  defaultOptionDebits: boolean;
  defaultAutoliquidation: boolean;
  defaultDispenseTva: boolean;
  defaultEscompte: string;
  defaultMentionsLibres: string;
  defaultPdp: string;
  busy: boolean;
  notice: string | null;
  error: string | null;
  onSave: (valeurs: {
    optionDebits: boolean;
    autoliquidation: boolean;
    dispenseTva: boolean;
    escompte: string;
    mentionsLibres: string;
    pdp: string;
  }) => void;
}

interface BasculeProps {
  actif: boolean;
  label: string;
  aide: string;
  onChange: (v: boolean) => void;
}

function Bascule({ actif, label, aide, onChange }: BasculeProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!actif)}
      aria-pressed={actif}
      className="flex items-start gap-3 p-3 rounded-lg bg-background-50 border border-background-200 text-left w-full cursor-pointer hover:border-primary-300 transition-colors"
    >
      <span
        className={`mt-0.5 w-9 h-5 shrink-0 rounded-full p-0.5 flex items-center transition-colors ${
          actif ? "bg-primary-500 justify-end" : "bg-background-300 justify-start"
        }`}
      >
        <span className="w-4 h-4 rounded-full bg-background-50"></span>
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-foreground-900">{label}</span>
        <span className="block text-[11px] text-foreground-500 mt-0.5">{aide}</span>
      </span>
    </button>
  );
}

/**
 * Réglages des mentions imprimées sur les factures et de la plateforme de
 * dématérialisation utilisée pour la transmission des fichiers.
 */
export default function ReglagesEfactureCard({
  defaultOptionDebits,
  defaultAutoliquidation,
  defaultDispenseTva,
  defaultEscompte,
  defaultMentionsLibres,
  defaultPdp,
  busy,
  notice,
  error,
  onSave,
}: Props) {
  const [optionDebits, setOptionDebits] = useState(defaultOptionDebits);
  const [autoliquidation, setAutoliquidation] = useState(defaultAutoliquidation);
  const [dispenseTva, setDispenseTva] = useState(defaultDispenseTva);
  const [escompte, setEscompte] = useState(defaultEscompte);
  const [mentionsLibres, setMentionsLibres] = useState(defaultMentionsLibres);
  const [pdp, setPdp] = useState(defaultPdp);

  return (
    <section className="rounded-lg bg-background-100 border border-background-200">
      <div className="px-5 py-4 border-b border-background-200">
        <h3 className="font-heading font-semibold text-sm text-foreground-950">Mentions et plateforme</h3>
        <p className="text-xs text-foreground-500 mt-0.5">
          Ces mentions sont ajoutées automatiquement au pied de vos factures.
        </p>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
          <Bascule
            actif={optionDebits}
            label="TVA sur les débits"
            aide="Option pour le paiement de la TVA d'après les débits."
            onChange={setOptionDebits}
          />
          <Bascule
            actif={autoliquidation}
            label="Autoliquidation"
            aide="Sous-traitance : la TVA est due par le preneur (art. 283-2 nonies)."
            onChange={setAutoliquidation}
          />
          <Bascule
            actif={dispenseTva}
            label="Franchise en base"
            aide="TVA non applicable, art. 293 B du CGI."
            onChange={setDispenseTva}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <label
              htmlFor="efacture-escompte"
              className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide"
            >
              Escompte pour paiement anticipé
            </label>
            <input
              id="efacture-escompte"
              type="text"
              value={escompte}
              onChange={(e) => setEscompte(e.target.value)}
              placeholder="Ex. 2 % si règlement sous 10 jours"
              className="w-full box-border h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label
              htmlFor="efacture-pdp"
              className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide"
            >
              Plateforme de dématérialisation (PDP)
            </label>
            <input
              id="efacture-pdp"
              type="text"
              value={pdp}
              onChange={(e) => setPdp(e.target.value)}
              placeholder="Ex. l'annuaire ou le nom de votre plateforme"
              className="w-full box-border h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-0">
          <label
            htmlFor="efacture-mentions"
            className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide"
          >
            Mentions libres
          </label>
          <textarea
            id="efacture-mentions"
            value={mentionsLibres}
            onChange={(e) => setMentionsLibres(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Une mention par ligne (ex. « Membre d'un centre de gestion agréé »)"
            className="w-full box-border px-3 py-2 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 resize-y"
          ></textarea>
          <p className="text-[11px] text-foreground-400">{mentionsLibres.length}/500 caractères</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              onSave({ optionDebits, autoliquidation, dispenseTva, escompte, mentionsLibres, pdp })
            }
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-3-line"></i>}
            Enregistrer les mentions
          </button>
          {notice && (
            <span className="text-xs text-accent-700 inline-flex items-center gap-1.5">
              <i className="ri-checkbox-circle-line"></i>
              {notice}
            </span>
          )}
          {error && (
            <span className="text-xs text-red-600 inline-flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {error}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}