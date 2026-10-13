import { evaluerForceMotDePasse } from "@/lib/motDePasse";

const COULEURS_BARRE = ["bg-red-400", "bg-red-500", "bg-amber-500", "bg-emerald-500"];
const COULEURS_TEXTE = [
  "text-red-600",
  "text-red-600",
  "text-amber-600",
  "text-emerald-600",
  "text-emerald-700",
];

/**
 * Indicateur visuel de robustesse d'un mot de passe : une jauge de 4 segments,
 * un libellé et les critères remplis. Ne s'affiche que lorsque le champ est rempli.
 * `seuilLongueur` permet d'aligner l'indicateur sur la longueur minimale exigée
 * (6 caractères par défaut, 8 à l'inscription).
 */
export default function IndicateurForceMotDePasse({
  valeur,
  seuilLongueur = 6,
}: {
  valeur: string;
  seuilLongueur?: number;
}) {
  if (!valeur) return null;

  const { score, label, criteres } = evaluerForceMotDePasse(valeur);
  const couleurBarre = COULEURS_BARRE[Math.max(0, score - 1)] ?? "bg-red-400";

  const puces = [
    { ok: valeur.length >= seuilLongueur, texte: `${seuilLongueur} caract. min.` },
    { ok: criteres.casse, texte: "Maj. + min." },
    { ok: criteres.chiffre, texte: "Un chiffre" },
    { ok: criteres.special, texte: "Un spécial" },
  ];

  return (
    <div className="flex flex-col gap-2 mt-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < score ? couleurBarre : "bg-background-200"
              }`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-semibold whitespace-nowrap ${COULEURS_TEXTE[score]}`}>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {puces.map((p) => (
          <span
            key={p.texte}
            className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium ${
              p.ok ? "bg-emerald-50 text-emerald-700" : "bg-background-100 text-foreground-400"
            }`}
          >
            <i className={p.ok ? "ri-check-line" : "ri-subtract-line"}></i>
            {p.texte}
          </span>
        ))}
      </div>
    </div>
  );
}