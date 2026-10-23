import { useEffect, useMemo, useState } from "react";

/**
 * Comparatif « avant / après » ciblé sur le cas d'un email client refusé et de la
 * relance différée de 24 h. Réutilisé sur l'accueil (section Bénéfices) et sur la
 * page d'annonce dédiée au suivi des emails, pour raconter exactement la même chose.
 *
 * Côté « après », un décompte tourne en direct et le bouton Annuler fonctionne :
 * on montre le comportement réel plutôt qu'une capture figée.
 */

const avant = {
  label: "Avant",
  headline: "Un refus, puis plus rien",
  intro:
    "L'email est refusé, mais on ne le sait pas vraiment. On renvoie à l'aveugle à la même adresse, ou on oublie — et le client reste sans nouvelles.",
  points: [
    {
      icon: "ri-mail-close-line",
      title: "Aucune explication",
      desc: "Pas de date, pas d'adresse tentée, pas de raison : impossible de savoir ce qui a bloqué.",
    },
    {
      icon: "ri-repeat-2-line",
      title: "Renvoi à l'aveugle",
      desc: "On relance vers une adresse déjà refusée, en espérant que ça passe cette fois.",
    },
    {
      icon: "ri-time-line",
      title: "Relance dans le vide",
      desc: "Personne ne pense à retenter le lendemain : le chantier reste silencieux trop longtemps.",
    },
  ],
};

const apres = {
  label: "Après",
  headline: "Vérifié, programmé à 24 h, annulable",
  intro:
    "Le refus est documenté, l'adresse se contrôle en un clic, et le renvoi se programme à 24 h. Il part seul, une seule fois, et s'annule si vous corrigez la fiche entre-temps.",
  points: [
    {
      icon: "ri-shield-check-line",
      title: "Adresse vérifiée avant l'envoi",
      desc: "Format puis domaine : tant que l'adresse est douteuse, aucun email ne part.",
    },
    {
      icon: "ri-time-line",
      title: "Renvoi programmé à 24 h",
      desc: "Un décompte en direct indique l'échéance, et chaque relance s'annule d'un clic.",
    },
    {
      icon: "ri-magic-line",
      title: "Annule tout seul si la fiche change",
      desc: "Vous corrigez l'adresse entre-temps ? La programmation tombe d'elle-même.",
    },
  ],
};

/** Formate un reste de temps en « dans 3 h 12 min » (ou « dans 4 min »). */
function libelleReste(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures > 0) return `dans ${heures} h ${reste} min`;
  return `dans ${reste} min`;
}

export default function ComparatifRelanceDifferee() {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  // Échéance fictive posée au montage : 23 h 41 min plus tard, pour rester crédible.
  const echeance = useMemo(() => Date.now() + 23 * 60 * 60 * 1000 + 41 * 60 * 1000, []);
  const [annule, setAnnule] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const reste = echeance - maintenant;
  const imminent = reste < 60 * 60 * 1000;

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 overflow-hidden">
      <div className="p-6 md:p-8 border-b border-background-200 bg-background-100">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold uppercase tracking-wide">
          <i className="ri-time-line"></i>
          Cas concret · relance différée
        </span>
        <h3 className="mt-3 font-heading font-bold text-xl md:text-3xl text-foreground-950 tracking-tight">
          Un email refusé : la relance repart dans 24 h, sans vous
        </h3>
        <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed max-w-3xl">
          Même situation de départ, deux façons de la gérer. À gauche, ce qui se passe quand on renvoie à
          l'aveugle. À droite, ce qui se passe quand l'adresse est contrôlée et le renvoi programmé.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Avant */}
        <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-background-200">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-bold uppercase tracking-wide">
            <i className="ri-emotion-unhappy-line"></i>
            {avant.label}
          </span>
          <h4 className="mt-3 font-heading font-bold text-lg md:text-xl text-foreground-950">{avant.headline}</h4>
          <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{avant.intro}</p>

          <ul className="mt-5 flex flex-col gap-3">
            {avant.points.map((p) => (
              <li key={p.title} className="flex items-start gap-3">
                <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-base">
                  <i className={p.icon}></i>
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground-950">{p.title}</p>
                  <p className="mt-0.5 text-xs text-foreground-500 leading-relaxed">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">
                <i className="ri-close-line"></i>
              </span>
              <span className="text-xs font-semibold text-foreground-900">Email refusé · aucune trace</span>
            </div>
            <p className="mt-2 text-[11px] text-foreground-500 leading-relaxed">
              « On a bien envoyé quelque chose ? À quelle adresse ? Pourquoi ça n'est pas arrivé ? » Sans
              réponse, on renvoie au hasard — ou on laisse tomber.
            </p>
          </div>
        </div>

        {/* Après */}
        <div className="p-6 md:p-8 bg-foreground-950">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background-50/15 text-background-50 text-[11px] font-bold uppercase tracking-wide">
            <i className="ri-sparkling-2-line"></i>
            {apres.label}
          </span>
          <h4 className="mt-3 font-heading font-bold text-lg md:text-xl text-background-50">{apres.headline}</h4>
          <p className="mt-2 text-sm text-background-200/85 leading-relaxed">{apres.intro}</p>

          <ul className="mt-5 flex flex-col gap-3">
            {apres.points.map((p) => (
              <li key={p.title} className="flex items-start gap-3">
                <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-background-50/10 text-primary-400 text-base">
                  <i className={p.icon}></i>
                </span>
                <div>
                  <p className="text-sm font-semibold text-background-50">{p.title}</p>
                  <p className="mt-0.5 text-xs text-background-200/75 leading-relaxed">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Mini aperçu réel : renvoi programmé avec décompte vivant. */}
          <div className="mt-5 rounded-lg border border-background-50/15 bg-background-50/[0.06] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-background-200/70">
                <i className="ri-notification-3-line"></i>
                Renvois prévus
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                  annule
                    ? "bg-background-50/15 text-background-200"
                    : imminent
                      ? "bg-accent-500 text-background-50"
                      : "bg-primary-100 text-primary-800"
                }`}
              >
                {annule ? "Annulé" : libelleReste(reste)}
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-background-50/10 text-background-100">
                <i className="ri-mail-send-line text-sm"></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-background-50 truncate">
                  SARL Moreau Rénovation
                </p>
                <p className="text-[10px] text-background-200/70 truncate">
                  {annule ? "Programmation supprimée" : "Renvoyer dans 24 h · demain à 14:32"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnnule((v) => !v)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-background-50/10 border border-background-50/20 text-background-100 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
              >
                <i className={annule ? "ri-refresh-line" : "ri-close-line"}></i>
                {annule ? "Reprogrammer" : "Annuler"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}