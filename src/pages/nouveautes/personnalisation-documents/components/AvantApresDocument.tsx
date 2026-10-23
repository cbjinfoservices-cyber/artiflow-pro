import { useState } from "react";

/**
 * Section « Avant / Après » de la page d'annonce. Le même devis est présenté
 * dans deux versions : générique (aucune personnalisation), puis à l'image du
 * profil (couleur d'accent, logo, coordonnées de paiement et pied de page).
 * Une bascule interactive (comme sur l'accueil) permet de passer d'une version
 * à l'autre au clic, plutôt que d'afficher les deux côte à côte en permanence.
 */

type Mode = "avant" | "apres";

/** Lignes de détail communes aux deux versions du devis (même contenu). */
function LignesDevis() {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-foreground-500">
          <th className="text-left font-semibold pb-1.5 border-b border-background-200">Désignation</th>
          <th className="text-right font-semibold pb-1.5 border-b border-background-200">Total HT</th>
        </tr>
      </thead>
      <tbody className="text-foreground-800">
        <tr>
          <td className="py-1.5 border-b border-background-100">Dépose et évacuation</td>
          <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">420,00 €</td>
        </tr>
        <tr>
          <td className="py-1.5 border-b border-background-100">Pose faïence et plomberie</td>
          <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">3 960,00 €</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Version neutre : aucun logo, aucune couleur, aucun message de pied de page. */
function DocumentGenerique() {
  return (
    <div className="rounded-lg border border-background-200 bg-background-100 overflow-hidden">
      <div className="h-1.5 bg-background-300" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-full bg-background-200 text-foreground-400 flex items-center justify-center">
              <i className="ri-image-line text-lg"></i>
            </span>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm text-foreground-500 truncate">Votre entreprise</p>
              <p className="text-[11px] text-foreground-400 truncate">Sans logo · sans couleur</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-heading font-extrabold text-base tracking-wide text-foreground-500">DEVIS</p>
            <p className="text-[11px] text-foreground-400">N° D-2026-014</p>
          </div>
        </div>

        <div className="h-px bg-background-200 my-4" />

        <LignesDevis />

        <div className="mt-3 flex justify-end">
          <div className="w-48 rounded-md bg-background-200/60 px-3 py-2 text-[11px]">
            <div className="flex justify-between font-bold text-foreground-600 pt-0.5">
              <span>Total TTC</span>
              <span>5 256,00 €</span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-foreground-400 italic">Aucun message de pied de page</p>
      </div>
    </div>
  );
}

/** Version personnalisée : barre d'accent, logo, total coloré et pied de page. */
function DocumentPersonnalise() {
  return (
    <div className="rounded-lg border border-background-200 bg-background-50 overflow-hidden">
      <div className="h-1.5 bg-accent-500" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-full bg-accent-500 text-background-50 flex items-center justify-center font-heading font-bold text-sm">
              PB
            </span>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm text-foreground-950 truncate">Plomberie Benali</p>
              <p className="text-[11px] text-foreground-500 truncate">Plombier chauffagiste · Lyon</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-heading font-extrabold text-base tracking-wide text-foreground-950">DEVIS</p>
            <p className="text-[11px] text-foreground-500">N° D-2026-014</p>
          </div>
        </div>

        <div className="h-px bg-background-200 my-4" />

        <LignesDevis />

        <div className="mt-3 flex justify-end">
          <div className="w-48 rounded-md bg-background-100 flex overflow-hidden">
            <span className="w-1 shrink-0 bg-accent-500" />
            <div className="flex-1 px-3 py-2 text-[11px]">
              <div className="flex justify-between font-bold text-foreground-950 pt-0.5">
                <span>Total TTC</span>
                <span>5 256,00 €</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-foreground-600">
          Merci de votre confiance · Devis gratuit sous 48 h
        </p>
      </div>
    </div>
  );
}

type ContenuMode = {
  badgeLabel: string;
  badgeIcon: string;
  sousTitre: string;
  titre: string;
  intro: string;
  points: string[];
  pointIcon: string;
  legende: string;
  legendeIcon: string;
};

const contenu: Record<Mode, ContenuMode> = {
  avant: {
    badgeLabel: "Avant",
    badgeIcon: "ri-file-line",
    sousTitre: "Le devis générique",
    titre: "Neutre, interchangeable, sans image de marque",
    intro:
      "C'est le devis que produisent tous les outils génériques : le même pour tout le monde, au logo de l'éditeur près.",
    points: [
      "Aucun logo et aucune couleur d'accent",
      "Aucun message de pied de page",
      "Rien qui distingue votre entreprise d'une autre",
    ],
    pointIcon: "ri-close-line",
    legende: "Neutre, interchangeable, sans image de marque.",
    legendeIcon: "ri-emotion-unhappy-line",
  },
  apres: {
    badgeLabel: "Après",
    badgeIcon: "ri-sparkling-2-line",
    sousTitre: "Votre devis, à votre image",
    titre: "Votre marque, du premier PDF au dernier clic",
    intro:
      "Le même contenu, mais l'image d'un professionnel soigné — et une identité qui vous suit jusqu'à la signature du client.",
    points: [
      "Couleur d'accent et logo sur vos devis et factures",
      "Coordonnées de paiement reprises sur vos factures",
      "Message de pied de page libre, à votre voix",
    ],
    pointIcon: "ri-check-line",
    legende: "Votre couleur, votre logo et votre pied de page, dès le premier devis.",
    legendeIcon: "ri-palette-line",
  },
};

export default function AvantApresDocument() {
  const [mode, setMode] = useState<Mode>("avant");
  const isApres = mode === "apres";
  const data = contenu[mode];

  return (
    <div className="flex flex-col gap-8">
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200 self-start">
        <button
          type="button"
          onClick={() => setMode("avant")}
          aria-pressed={!isApres}
          className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
            !isApres ? "bg-foreground-950 text-background-50" : "text-foreground-600 hover:text-foreground-900"
          }`}
        >
          <i className="ri-file-line"></i>
          Avant
        </button>
        <button
          type="button"
          onClick={() => setMode("apres")}
          aria-pressed={isApres}
          className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
            isApres ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
          }`}
        >
          <i className="ri-sparkling-2-line"></i>
          Après
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
        <figure className="flex flex-col">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                isApres ? "bg-accent-500 text-background-50" : "bg-secondary-100 text-secondary-800"
              }`}
            >
              <i className={data.badgeIcon}></i>
              {data.badgeLabel}
            </span>
            <span className="text-xs text-foreground-500">{data.sousTitre}</span>
          </div>

          {isApres ? <DocumentPersonnalise /> : <DocumentGenerique />}

          <figcaption className="mt-3 flex items-center gap-2 text-xs text-foreground-500">
            <i className={`${data.legendeIcon} ${isApres ? "text-accent-600" : "text-foreground-400"}`}></i>
            {data.legende}
          </figcaption>
        </figure>

        <div className="lg:pt-9">
          <h3 className="font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
            {data.titre}
          </h3>
          <p className="mt-3 text-sm text-foreground-600 leading-relaxed">{data.intro}</p>

          <ul className="mt-6 flex flex-col gap-4">
            {data.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-lg ${
                    isApres ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"
                  }`}
                >
                  <i className={data.pointIcon}></i>
                </span>
                <span className="text-sm text-foreground-700 pt-1.5">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}