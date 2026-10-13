import { useState } from "react";
import { Link } from "react-router-dom";
import { OFFRES, essaisFinAujourdhui, essaisFinDemain, type AbonnementItem } from "@/lib/abonnementsApi";
import { formatEuros } from "@/lib/format";
import KpiBlocagesChargement from "@/pages/app/back-office/components/KpiBlocagesChargement";
import RelancerEssaisFinJourModal, {
  type CibleEssaiFinJour,
} from "@/components/feature/RelancerEssaisFinJourModal";

/**
 * Bandeau d'indicateurs clés des abonnements pour la page d'accueil Back-office :
 * abonnés actifs, revenu récurrent (MRR), impayés à recouvrer, essais et résiliés.
 * Chaque indicateur ouvre la page Abonnements filtrée sur le statut correspondant,
 * et une rangée dédiée permet d'ouvrir la page filtrée par offre.
 */
export default function BackOfficeKpis({
  abos,
  loading,
  error,
  onRetry,
}: {
  abos: AbonnementItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [relanceOuverte, setRelanceOuverte] = useState(false);
  const [relanceDemainOuverte, setRelanceDemainOuverte] = useState(false);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-background-100 border border-background-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
        <span className="inline-flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-error-warning-line text-red-500"></i>
          {error}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-refresh-line"></i>
          Réessayer
        </button>
      </div>
    );
  }

  const countByStatut = (s: string) => abos.filter((a) => a.statut === s).length;
  const countByOffre = (o: string) => abos.filter((a) => a.offre === o).length;
  const actifs = countByStatut("Actif");
  const essais = countByStatut("Essai");
  const impayes = countByStatut("Impayé");
  const resilies = countByStatut("Résilié");
  const mrr = abos.filter((a) => a.statut === "Actif").reduce((s, a) => s + a.montant_mensuel, 0);
  const manqueImpayes = abos
    .filter((a) => a.statut === "Impayé")
    .reduce((s, a) => s + a.montant_mensuel, 0);
  const partResilies = abos.length > 0 ? Math.round((resilies / abos.length) * 100) : 0;

  // Compteur des essais dont la fin tombe aujourd'hui : ce sont les conversions
  // imminentes (premier prélèvement demain) qu'un gestionnaire doit surveiller.
  const ciblesEssais: CibleEssaiFinJour[] = essaisFinAujourdhui(abos).map((a) => ({
    abonnementId: a.id,
    entreprise: a.entreprise,
    email: a.email,
    offre: a.offre,
    montant: a.montant_mensuel,
    echeance: a.date_echeance,
  }));
  const nbEssaisFinAujourdhui = ciblesEssais.length;
  // Montant des tout premiers prélèvements à convertir demain : le « CA » en jeu que
  // les relances de dernière chance doivent sauver.
  const montantEssaisFinAujourdhui = ciblesEssais.reduce((s, c) => s + c.montant, 0);
  // Essais dont la fin tombe demain : les conversions à anticiper dès la veille, avec un
  // bouton de relance préventive et le montant des premiers prélèvements en jeu.
  const ciblesEssaisDemain: CibleEssaiFinJour[] = essaisFinDemain(abos).map((a) => ({
    abonnementId: a.id,
    entreprise: a.entreprise,
    email: a.email,
    offre: a.offre,
    montant: a.montant_mensuel,
    echeance: a.date_echeance,
  }));
  const nbEssaisFinDemain = ciblesEssaisDemain.length;
  const montantEssaisFinDemain = ciblesEssaisDemain.reduce((s, c) => s + c.montant, 0);

  const cartes: {
    label: string;
    icon: string;
    iconTone: string;
    value: string;
    sub: string;
    sub2?: string;
    to: string;
    hint: string;
    badge?: { texte: string; actif: boolean };
    badgeDemain?: { texte: string; actif: boolean };
    sub3?: string;
    actions?: {
      label: string;
      icon: string;
      tone: "accent" | "secondary";
      title: string;
      onClick: () => void;
    }[];
  }[] = [
    {
      label: "Abonnés actifs",
      icon: "ri-user-follow-line",
      iconTone: "text-accent-600",
      value: `${actifs}`,
      sub: `${essais} en essai`,
      to: `/app/abonnements?statut=${encodeURIComponent("Actif")}`,
      hint: "Voir les abonnés actifs",
    },
    {
      label: "MRR",
      icon: "ri-line-chart-line",
      iconTone: "text-primary-600",
      value: formatEuros(mrr),
      sub: "revenu récurrent mensuel",
      to: "/app/abonnements",
      hint: "Ouvrir les abonnements",
    },
    {
      label: "Impayés",
      icon: "ri-error-warning-line",
      iconTone: "text-red-500",
      value: `${impayes}`,
      sub: `${formatEuros(manqueImpayes)} à recouvrer`,
      to: `/app/abonnements?statut=${encodeURIComponent("Impayé")}`,
      hint: "Voir les impayés",
    },
    {
      label: "Essais",
      icon: "ri-timer-line",
      iconTone: "text-secondary-600",
      value: `${essais}`,
      sub: "comptes en période d'essai",
      sub2:
        nbEssaisFinAujourdhui > 0
          ? `${formatEuros(montantEssaisFinAujourdhui)} à convertir demain`
          : undefined,
      sub3:
        nbEssaisFinDemain > 0
          ? `${formatEuros(montantEssaisFinDemain)} à convertir demain`
          : undefined,
      to: `/app/abonnements?statut=${encodeURIComponent("Essai")}`,
      hint:
        nbEssaisFinAujourdhui > 0
          ? `Voir les essais — ${nbEssaisFinAujourdhui} se termine${nbEssaisFinAujourdhui > 1 ? "nt" : ""} aujourd'hui`
          : "Voir les essais",
      badge: {
        texte: `${nbEssaisFinAujourdhui} se termine${nbEssaisFinAujourdhui > 1 ? "nt" : ""} aujourd'hui`,
        actif: nbEssaisFinAujourdhui > 0,
      },
      badgeDemain: {
        texte: `${nbEssaisFinDemain} se termine${nbEssaisFinDemain > 1 ? "nt" : ""} demain`,
        actif: nbEssaisFinDemain > 0,
      },
      actions: [
        ...(nbEssaisFinAujourdhui > 0
          ? [
              {
                label: "Relancer les essais",
                icon: "ri-mail-send-line",
                tone: "accent" as const,
                title: "Envoyer un email de dernière chance aux essais se terminant aujourd'hui",
                onClick: () => setRelanceOuverte(true),
              },
            ]
          : []),
        ...(nbEssaisFinDemain > 0
          ? [
              {
                label: "Relancer ceux de demain",
                icon: "ri-calendar-event-line",
                tone: "secondary" as const,
                title: "Envoyer un email préventif aux essais se terminant demain",
                onClick: () => setRelanceDemainOuverte(true),
              },
            ]
          : []),
      ],
    },
    {
      label: "Résiliés",
      icon: "ri-links-line",
      iconTone: "text-secondary-600",
      value: `${resilies}`,
      sub: `${partResilies} % du parc (${abos.length})`,
      to: `/app/abonnements?statut=${encodeURIComponent("Résilié")}`,
      hint: "Voir les résiliés",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiBlocagesChargement />
        {cartes.map((c) => {
          const contenu = (
            <>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                <i className={`${c.icon} ${c.iconTone}`}></i>
                {c.label}
                <i className="ri-arrow-right-up-line ml-auto text-foreground-300 group-hover:text-primary-600 transition-colors"></i>
              </span>
              <span className="font-heading font-bold text-2xl text-foreground-950">{c.value}</span>
              <span className="text-[11px] text-foreground-500">{c.sub}</span>
              {c.sub2 && (
                <span className="text-[11px] font-semibold text-accent-700">{c.sub2}</span>
              )}
              {c.badge && (
                <span
                  className={`mt-auto inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap self-start ${
                    c.badge.actif ? "bg-accent-500 text-background-50" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  <i className={c.badge.actif ? "ri-alarm-warning-line" : "ri-checkbox-circle-line"}></i>
                  {c.badge.texte}
                </span>
              )}
              {c.badgeDemain && (
                <span
                  className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap self-start ${
                    c.badgeDemain.actif ? "bg-secondary-100 text-secondary-800" : "bg-background-200 text-foreground-600"
                  }`}
                  title="Essais dont la fin tombe demain : à anticiper dès maintenant"
                >
                  <i className={c.badgeDemain.actif ? "ri-calendar-event-line" : "ri-checkbox-circle-line"}></i>
                  {c.badgeDemain.texte}
                </span>
              )}
              {c.sub3 && (
                <span className="text-[11px] font-semibold text-secondary-700">{c.sub3}</span>
              )}
            </>
          );
          if (c.actions && c.actions.length > 0) {
            return (
              <div
                key={c.label}
                className="group flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200 hover:border-primary-300 transition-colors"
              >
                <Link to={c.to} title={c.hint} className="flex flex-col gap-1 cursor-pointer">
                  {contenu}
                </Link>
                <div className="mt-1 flex flex-col gap-1">
                  {c.actions.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.onClick}
                      title={a.title}
                      className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        a.tone === "accent"
                          ? "bg-accent-500 text-background-50 hover:bg-accent-600"
                          : "bg-secondary-100 text-secondary-800 hover:bg-secondary-200"
                      }`}
                    >
                      <i className={a.icon}></i>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <Link
              key={c.label}
              to={c.to}
              title={c.hint}
              className="group flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200 hover:border-primary-300 cursor-pointer transition-colors"
            >
              {contenu}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
          <i className="ri-stack-line text-accent-600"></i>
          Par offre
        </span>
        {OFFRES.map((o) => (
          <Link
            key={o}
            to={`/app/abonnements?offre=${encodeURIComponent(o)}`}
            title={`Ouvrir les abonnements de l'offre ${o}`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
          >
            {o}
            <span className="text-foreground-400">{countByOffre(o)}</span>
          </Link>
        ))}
        <span className="text-[11px] text-foreground-400">
          Cliquez un indicateur pour ouvrir les Abonnements filtrés.
        </span>
      </div>

      {relanceOuverte && (
        <RelancerEssaisFinJourModal cibles={ciblesEssais} onClose={() => setRelanceOuverte(false)} />
      )}
      {relanceDemainOuverte && (
        <RelancerEssaisFinJourModal
          mode="demain"
          cibles={ciblesEssaisDemain}
          onClose={() => setRelanceDemainOuverte(false)}
        />
      )}
    </div>
  );
}