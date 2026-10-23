import { useEffect, useMemo, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import EspaceArtisanNav from "@/pages/app/components/EspaceArtisanNav";
import CompteurQuoiDeNeufTiroir from "@/pages/app/components/CompteurQuoiDeNeufTiroir";
import type { EcheancesDuJour } from "@/hooks/useEcheancesDuJour";
import { formatEuros } from "@/lib/format";
import { MODE_TERRAIN } from "@/lib/modeTerrain";

/** Un onglet de la barre fixe du bas. */
interface OngletMobile {
  to: string;
  /** Correspondance exacte du chemin (page racine uniquement). */
  end?: boolean;
  icon: string;
  /** Libellé court affiché sous l'icône. */
  label: string;
  /** Compteur affiché en pastille (masqué si nul). */
  badge?: number;
  /** Couleur de la pastille. */
  badgeTone?: "rouge" | "accent";
  /** Infobulle / description longue (non affichée sur mobile, utile aux lecteurs d'écran). */
  title?: string;
  /** Petite ligne chiffrée sous le libellé (ex. montant à encaisser), visible sans survol. */
  detail?: { text: string; tone: "rouge" | "accent" };
}

/** Montant compact pour la barre du bas (ex. « 740 € », « 1,2 k€ »). */
function montantCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1000) {
    const milliers = value / 1000;
    return `${milliers.toFixed(milliers >= 10 ? 0 : 1).replace(".", ",")} k€`;
  }
  return `${Math.round(value)} €`;
}

/** Pile de propriétés alimentée par `AppLayout`, qui calcule déjà tous les compteurs. */
export interface MenuMobileAppProps {
  /** Compte gestionnaire : la barre n'affiche que les entrées du back-office. */
  backOfficeOnly: boolean;
  enRetard: number;
  critiques: number;
  montantRetard: number;
  retardCible: number;
  relancesProgrammees: number;
  montantProgramme: number;
  retardProgramme: number;
  envoisAutoAttention: number;
  biblio: number;
  /** Échéances du jour : mêmes compteurs que le bloc « Aujourd'hui » de la barre latérale. */
  echeancesJour: EcheancesDuJour;
  /** Nombre d'entreprises au carnet : pastille de la sous-entrée « Entreprises ». */
  clientsPro: number;
  /** Nombre de particuliers au carnet : pastille de la sous-entrée « Particuliers ». */
  clientsParticuliers: number;
  /** Chantiers silencieux (client sans nouvelles depuis 14 jours) : pastille du menu Chantiers. */
  chantiersSansNouvelles: number;
  moisManquants: number;
  voirComptabilite: boolean;
  isGestionnaire: boolean;
  /** Nombre total de pros inscrits (pastille de l'entrée du menu). */
  prosInscrits: number;
  /** Nouvelles inscriptions du mois, rappelées dans l'infobulle de la pastille. */
  prosInscritsNouveaux: number;
  gestionnairesCount: number;
  compteLink: string;
  displayName: string;
  subLine: string;
  initials: string;
  voirMonAbonnement: boolean;
  abonnementOffre?: string;
  offreLabel?: string;
  offreTone?: string;
  onSignOut: () => void;
}

/** Pastille de comptage affichée sur une icône de la barre (masquée si le compte est nul). */
function PastilleOnglet({ count, tone = "rouge" }: { count: number; tone?: "rouge" | "accent" }) {
  if (!count) return null;
  const cls = tone === "accent" ? "bg-accent-500" : "bg-red-500";
  return (
    <span
      className={`absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full ${cls} text-background-50 text-[9px] font-bold ring-2 ring-background-50 tabular-nums`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Ligne d'action du tiroir (icône + libellé), pour les raccourcis compte et système. */
function LigneAction({
  to,
  icon,
  label,
  onClick,
  danger,
}: {
  to?: string;
  icon: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const cls = `w-full flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
    danger
      ? "text-foreground-600 hover:bg-background-100 hover:text-red-600"
      : "text-foreground-700 hover:bg-background-100"
  }`;
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={cls}>
        <i className={`${icon} text-lg text-foreground-400`}></i>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      <i className={`${icon} text-lg text-foreground-400`}></i>
      {label}
    </button>
  );
}

/**
 * Navigation mobile de l'espace artisan : une barre fixe à 4 onglets principaux, plus un bouton
 * « Plus » qui ouvre un tiroir contenant le menu complet (groupé, avec recherche) et les accès au
 * compte. Remplace l'ancien bandeau horizontal qui empilait toutes les entrées.
 */
export default function MenuMobileApp(props: MenuMobileAppProps) {
  const {
    backOfficeOnly,
    enRetard,
    critiques,
    montantRetard,
    retardCible,
    relancesProgrammees,
    montantProgramme,
    retardProgramme,
    envoisAutoAttention,
    biblio,
    echeancesJour,
    clientsPro,
    clientsParticuliers,
    chantiersSansNouvelles,
    moisManquants,
    voirComptabilite,
    isGestionnaire,
    prosInscrits,
    prosInscritsNouveaux,
    gestionnairesCount,
    compteLink,
    displayName,
    subLine,
    initials,
    voirMonAbonnement,
    abonnementOffre,
    offreLabel,
    onSignOut,
  } = props;

  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Referme le tiroir dès qu'on change de page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Ferme le tiroir avec Échap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Onglets principaux de la barre du bas : l'artisan garde les 5 gestes du quotidien (dont le
  // planning, consulté sur le terrain), le gestionnaire retrouve les 3 écrans du back-office.
  const onglets: OngletMobile[] = useMemo(() => {
    if (backOfficeOnly) {
      const base: OngletMobile[] = [
        { to: "/app/back-office", icon: "ri-dashboard-3-line", label: "Accueil" },
        { to: "/app/abonnements", icon: "ri-money-euro-circle-line", label: "Abos" },
      ];
      if (voirComptabilite) {
        base.push({ to: "/app/comptabilite", icon: "ri-file-chart-line", label: "Compta", badge: moisManquants, badgeTone: "accent" });
      }
      base.push({ to: "/app/mon-compte-gestionnaire", icon: "ri-shield-user-line", label: "Compte", badge: gestionnairesCount, badgeTone: "accent" });
      return base;
    }
    // Application mobile (version terrain) : les gestes du chantier, sans devis ni factures.
    if (MODE_TERRAIN) {
      return [
        { to: "/app/planning", icon: "ri-calendar-2-line", label: "Planning" },
        { to: "/app/chantiers", icon: "ri-building-2-line", label: "Chantiers" },
        { to: "/app/clients", icon: "ri-contacts-book-2-line", label: "Clients" },
        { to: "/app/pointages", icon: "ri-timer-line", label: "Pointages" },
      ];
    }
    const echeancesFactures = echeancesJour.facturesJour + echeancesJour.facturesRetard;
    return [
      { to: "/app", end: true, icon: "ri-dashboard-line", label: "Accueil" },
      { to: "/app/planning", icon: "ri-calendar-2-line", label: "Planning" },
      { to: "/app/devis", icon: "ri-file-text-line", label: "Devis" },
      {
        // Quand des échéances du jour existent, l'onglet ouvre directement la liste filtrée
        // (et déjà triée par échéance la plus ancienne) au lieu de la vue complète.
        to: echeancesFactures > 0 ? "/app/factures?encaisser=jour" : "/app/factures",
        icon: "ri-receipt-line",
        label: "Factures",
        badge: echeancesFactures,
        badgeTone: echeancesJour.facturesRetard > 0 ? "rouge" : "accent",
        detail:
          echeancesJour.montant > 0
            ? {
                text: montantCompact(echeancesJour.montant),
                tone: echeancesJour.facturesRetard > 0 ? "rouge" : "accent",
              }
            : undefined,
        title:
          echeancesFactures > 0
            ? `${formatEuros(echeancesJour.montant)} à encaisser · ${echeancesFactures} facture${
                echeancesFactures > 1 ? "s" : ""
              } : ${echeancesJour.facturesJour} aujourd'hui, ${echeancesJour.facturesRetard} en retard. Ouvre la liste filtrée.`
            : "Factures",
      },
      { to: "/app/relances", icon: "ri-notification-3-line", label: "Relances", badge: enRetard, badgeTone: "rouge" },
    ];
  }, [backOfficeOnly, voirComptabilite, moisManquants, gestionnairesCount, enRetard, echeancesJour]);

  // Signale discrètement, sur le bouton « Plus », qu'une alerte se cache dans le menu.
  const alertesMasquees = backOfficeOnly
    ? 0
    : envoisAutoAttention + relancesProgrammees + biblio + echeancesJour.relancesJour + chantiersSansNouvelles;

  return (
    <>
      {/* Barre fixe du bas */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background-50 border-t border-background-200 flex items-stretch px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
        aria-label="Navigation principale"
      >
        {onglets.map((o) => (
          <NavLink
            key={o.to}
            to={o.to}
            end={o.end}
            title={o.title}
            aria-label={o.title}
            className={({ isActive }) =>
              `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1 rounded-md cursor-pointer transition-colors ${
                isActive ? "text-primary-700" : "text-foreground-400"
              }`
            }
          >
            <span className="relative">
              <i className={`${o.icon} text-xl`}></i>
              {o.badge ? <PastilleOnglet count={o.badge} tone={o.badgeTone} /> : null}
            </span>
            <span className="text-[10px] font-medium truncate max-w-full px-0.5">{o.label}</span>
            {o.detail ? (
              <span
                className={`text-[9px] font-bold tabular-nums leading-none truncate max-w-full px-0.5 ${
                  o.detail.tone === "rouge" ? "text-red-600" : "text-accent-700"
                }`}
              >
                {o.detail.text}
              </span>
            ) : null}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Ouvrir tout le menu"
          className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1 rounded-md cursor-pointer transition-colors ${
            open ? "text-primary-700" : "text-foreground-400"
          }`}
        >
          <span className="relative">
            <i className="ri-menu-3-line text-xl"></i>
            {alertesMasquees > 0 && (
              <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-accent-500 ring-2 ring-background-50" aria-hidden="true"></span>
            )}
          </span>
          <span className="text-[10px] font-medium">Plus</span>
        </button>
      </nav>

      {/* Tiroir « tout le menu » */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 w-full bg-foreground-950/40 backdrop-blur-[1px] cursor-pointer"
          ></button>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu complet"
            className="absolute inset-x-0 bottom-0 max-h-[88vh] flex flex-col rounded-t-2xl bg-background-50 border-t border-background-200 overflow-hidden"
          >
            <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-background-200">
              <span className="font-heading font-bold text-base text-foreground-950">Menu</span>
              {/* Même compteur que la barre latérale et l'en-tête : une seule mémoire pour les trois. */}
              <span className="ml-auto">
                <CompteurQuoiDeNeufTiroir onNavigate={() => setOpen(false)} />
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-3">
              {/* Carte du compte */}
              <Link
                to={compteLink}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg border border-background-200 bg-background-50 hover:border-primary-300 cursor-pointer transition-colors"
              >
                <span className="w-10 h-10 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 font-semibold text-sm shrink-0">
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground-950 truncate">{displayName}</span>
                  <span className="block text-xs text-foreground-500 truncate">{subLine}</span>
                </span>
                <i className="ri-arrow-right-s-line text-foreground-400"></i>
              </Link>

              {/* Menu complet : groupé et filtrable pour l'artisan */}
              {!backOfficeOnly && (
                <div className="rounded-lg border border-background-200 bg-background-50 p-2">
                  <EspaceArtisanNav
                    enRetard={enRetard}
                    critiques={critiques}
                    montantRetard={montantRetard}
                    retardCible={retardCible}
                    relancesProgrammees={relancesProgrammees}
                    montantProgramme={montantProgramme}
                    retardProgramme={retardProgramme}
                    envoisAutoAttention={envoisAutoAttention}
                    biblio={biblio}
                    echeancesJour={echeancesJour}
                    clientsPro={clientsPro}
                    clientsParticuliers={clientsParticuliers}
                    chantiersSansNouvelles={chantiersSansNouvelles}
                    moisManquants={moisManquants}
                    voirComptabilite={voirComptabilite}
                    masquerQuoiDeNeuf
                  />
                </div>
              )}

              {/* Raccourcis back-office pour le gestionnaire */}
              {backOfficeOnly && (
                <div className="rounded-lg border border-background-200 bg-background-50 p-1.5 flex flex-col gap-0.5">
                  <NavLink
                    to="/app/back-office"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                  >
                    <i className="ri-dashboard-3-line text-lg text-foreground-400"></i>
                    Vue d'ensemble
                  </NavLink>
                  <NavLink
                    to="/app/abonnements"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                  >
                    <i className="ri-money-euro-circle-line text-lg text-foreground-400"></i>
                    Abonnements
                  </NavLink>
                  <NavLink
                    to="/app/pros-inscrits"
                    onClick={() => setOpen(false)}
                    title={`${prosInscrits} pro${prosInscrits > 1 ? "s" : ""} inscrit${prosInscrits > 1 ? "s" : ""}${
                      prosInscritsNouveaux > 0
                        ? ` · ${prosInscritsNouveaux} nouveau${prosInscritsNouveaux > 1 ? "x" : ""} ce mois-ci`
                        : ""
                    }`}
                    className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                  >
                    <i className="ri-user-star-line text-lg text-foreground-400"></i>
                    Pros inscrits
                    {prosInscrits > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums">
                        {prosInscrits > 99 ? "99+" : prosInscrits}
                      </span>
                    )}
                  </NavLink>
                  {voirComptabilite && (
                    <NavLink
                      to="/app/comptabilite"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className="ri-file-chart-line text-lg text-foreground-400"></i>
                      Comptabilité
                      {moisManquants > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums">
                          {moisManquants > 99 ? "99+" : moisManquants}
                        </span>
                      )}
                    </NavLink>
                  )}
                  <NavLink
                    to="/app/mon-compte-gestionnaire"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                  >
                    <i className="ri-shield-user-line text-lg text-foreground-400"></i>
                    Compte gestionnaire
                  </NavLink>
                </div>
              )}

              {/* Compte & système */}
              <div className="rounded-lg border border-background-200 bg-background-50 p-1.5 flex flex-col gap-0.5">
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                  Compte
                </p>
                {!backOfficeOnly && (
                  <LigneAction to="/app/profil" icon="ri-user-settings-line" label="Mon profil" onClick={() => setOpen(false)} />
                )}
                {voirMonAbonnement && abonnementOffre && (
                  <LigneAction
                    to="/app/profil?onglet=abonnement"
                    icon="ri-vip-crown-line"
                    label={`Mon abonnement${offreLabel ? ` · ${offreLabel}` : ""}`}
                    onClick={() => setOpen(false)}
                  />
                )}
                <LigneAction to="/app/preferences" icon="ri-equalizer-2-line" label="Préférences d'affichage" onClick={() => setOpen(false)} />
                {!Capacitor.isNativePlatform() && (
                  <LigneAction to="/" icon="ri-arrow-left-line" label="Retour au site" onClick={() => setOpen(false)} />
                )}
                <LigneAction
                  icon="ri-logout-box-r-line"
                  label="Se déconnecter"
                  danger
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}