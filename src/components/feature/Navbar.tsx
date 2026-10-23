import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSectionNav } from "@/hooks/useSectionNav";
import { useDemoModal } from "@/hooks/useDemoModal";
import BadgeNouveau from "@/components/base/BadgeNouveau";
import CompteurNouvellesRessources from "@/components/base/CompteurNouvellesRessources";
import { nouveautes } from "@/mocks/nouveautes";
import { compterGuidesNouveaux } from "@/mocks/ressources";
import NavDropdown from "@/components/feature/NavDropdown";
import { useMenuClavier } from "@/hooks/useMenuClavier";
import {
  MetiersMenuContent,
  RessourcesMenuContent,
  MetiersMobileLinks,
  RessourcesMobileLinks,
} from "@/components/feature/NavMenus";
import MobileActionBar, { PHONE_HREF } from "@/components/feature/MobileActionBar";
import IndicateurSynchroPublique from "@/components/feature/IndicateurSynchroPublique";
import { useAuth } from "@/hooks/useAuth";
import { useCompteursCompte } from "@/hooks/useCompteursCompte";
import { metierLabel } from "@/lib/metiers";
import { lireDernierDevis, effacerDernierDevis, ancienneteDevisOuvert, type DernierDevisOuvert } from "@/lib/devisDernierOuvert";
import { formatEuros } from "@/lib/format";

/** Petite pastille de comptage affichée à côté d'une entrée de menu (masquée si le compte est nul). */
function CompteurBadge({
  count,
  tone = "accent",
  tooltip,
}: {
  count: number;
  tone?: "accent" | "secondary";
  /** Détail affiché au survol (nombre + montant) dans une mini-infobulle. */
  tooltip?: string;
}) {
  if (!count) return null;
  const cls = tone === "accent" ? "bg-accent-100 text-accent-800" : "bg-secondary-100 text-secondary-800";
  return (
    <span className="group/badge relative ml-auto inline-flex">
      <span
        className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full ${cls} text-[10px] font-bold tabular-nums`}
      >
        {count > 99 ? "99+" : count}
      </span>
      {tooltip && (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-0 bottom-full mb-1.5 z-40 hidden group-hover/badge:block w-max max-w-[240px] px-2.5 py-1.5 rounded-md bg-foreground-950 text-background-50 text-[11px] font-medium whitespace-nowrap"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}

/** Date de la dernière mise à jour publiée dans le journal des nouveautés. */
const derniereNouveauteISO = nouveautes.reduce(
  (acc, n) => (n.dateIso > acc ? n.dateIso : acc),
  ""
);

/** Annonce mise en avant dans le menu : la personnalisation des documents. */
const annoncePersonnalisationISO =
  nouveautes.find((n) => n.id === "personnalisation-documents")?.dateIso ?? "";

/** Nombre de guides récemment publiés, affiché sur l'entrée « Ressources ». */
const nbNouveauxGuides = compterGuidesNouveaux();

const navLinks: { label: string; to?: string; section?: string; dropdown?: "metiers" | "ressources"; icon: string }[] = [
  { label: "Fonctionnalités", section: "fonctionnalites", icon: "ri-apps-2-line" },
  { label: "Métiers", dropdown: "metiers", icon: "ri-briefcase-4-line" },
  { label: "Tarifs", to: "/tarifs", icon: "ri-price-tag-3-line" },
  { label: "Ressources", dropdown: "ressources", icon: "ri-book-2-line" },
  { label: "Nouveautés", to: "/nouveautes", icon: "ri-sparkling-2-line" },
  { label: "Podcast", to: "/podcast", icon: "ri-mic-line" },
  { label: "FAQ", section: "faq", icon: "ri-question-line" },
];

const legalLinks: { label: string; to: string; icon: string }[] = [
  { label: "Mentions légales", to: "/mentions-legales", icon: "ri-file-text-line" },
  { label: "RGPD & données", to: "/rgpd", icon: "ri-shield-user-line" },
  { label: "Politique de cookies", to: "/cookies", icon: "ri-equalizer-line" },
  { label: "Accessibilité", to: "/accessibilite", icon: "ri-wheelchair-line" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [compteOpen, setCompteOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const compteRef = useRef<HTMLDivElement>(null);
  // Le focus clavier est piloté par le bouton (ouverture) et le panneau (navigation).
  const compteBtnRef = useRef<HTMLButtonElement>(null);
  const comptePanelRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const location = useLocation();
  const goSection = useSectionNav();
  const { openDemo } = useDemoModal();
  const { user, profile, signOut, isGestionnaire, voirMonAbonnement } = useAuth();
  const compteurs = useCompteursCompte();
  const [dernierDevis, setDernierDevis] = useState<DernierDevisOuvert | null>(null);
  const compteTo = user ? "/app" : "/app/auth";
  const compteLabel = user ? "Mon compte" : "Connexion / Inscription";
  const nomCompte = isGestionnaire
    ? "Compte gestionnaire"
    : profile?.entreprise || user?.email?.split("@")[0] || "Mon compte";
  const initiales =
    nomCompte
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "AF";
  const profilLink = isGestionnaire ? "/app/mon-compte-gestionnaire" : "/app/profil";
  const profilLabel = isGestionnaire ? "Mon compte gestionnaire" : "Mon profil";
  const metierCompte = metierLabel(profile?.metier);
  // Ancienneté du dernier devis ouvert, affichée aussi sur le raccourci « Reprendre » du menu.
  const ancienneteDernierDevis = dernierDevis ? ancienneteDevisOuvert(dernierDevis.at) : null;
  const handleSignOut = async () => {
    setCompteOpen(false);
    await signOut();
  };

  // Navigation clavier du menu du compte : flèches haut/bas, Début/Fin, Échap.
  const { onTriggerKeyDown: onCompteTriggerKeyDown, onPanelKeyDown: onComptePanelKeyDown } =
    useMenuClavier({
      ouvert: compteOpen,
      ouvrir: () => setCompteOpen(true),
      fermer: () => setCompteOpen(false),
      panelRef: comptePanelRef,
      triggerRef: compteBtnRef,
    });

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      // Referme le menu du compte dès qu'on fait défiler la page vers le bas.
      if (y > lastScrollY.current + 4) setCompteOpen(false);
      // Progression de lecture : part de 0 % en haut et atteint 100 % en bas de page.
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (y / max) * 100)) : 0);
      lastScrollY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setCompteOpen(false);
    setMobileDropdown(null);
  }, [location.pathname]);

  // Relit le dernier devis ouvert à chaque ouverture du menu, pour un raccourci toujours à jour.
  useEffect(() => {
    setDernierDevis(lireDernierDevis());
  }, [compteOpen]);

  useEffect(() => {
    if (!compteOpen) return;
    const onDown = (e: MouseEvent) => {
      if (compteRef.current && !compteRef.current.contains(e.target as Node)) setCompteOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCompteOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [compteOpen]);

  const isHome = location.pathname === "/";
  const isLinkActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const dark = isHome && !scrolled && !open;
  const solid = scrolled || open || !isHome;

  return (
    <>
      <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        solid ? "bg-background-50/95 backdrop-blur border-b border-background-200" : "bg-transparent"
      }`}
    >
      <div className="relative w-full px-4 md:px-6 lg:px-10 flex items-center justify-between h-16 md:h-[72px]">
        <Link to="/" className="group flex items-center gap-2.5 cursor-pointer">
          <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-background-50 transition-all duration-200 group-hover:scale-105 group-hover:-rotate-3">
            <i className="ri-tools-fill text-lg"></i>
          </span>
          <span className={`font-heading font-bold text-lg tracking-tight transition-colors ${dark ? "text-background-50" : "text-foreground-950"}`}>
            ArtiFlow-pro
          </span>
        </Link>

        <nav
          className={`hidden lg:flex items-center gap-0.5 rounded-full p-1 border transition-colors duration-300 ${
            dark
              ? "bg-background-50/10 border-background-50/15 backdrop-blur-sm"
              : "bg-background-100/80 border-background-200/70"
          }`}
        >
          {navLinks.map((link) => {
            const active =
              link.dropdown === "metiers"
                ? isLinkActive("/metiers")
                : link.dropdown === "ressources"
                  ? isLinkActive("/ressources")
                  : link.to
                    ? isLinkActive(link.to)
                    : false;
            const base = `group relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium tracking-tight whitespace-nowrap transition-all duration-200 cursor-pointer ${
              dark
                ? active
                  ? "bg-background-50/20 text-background-50"
                  : "text-background-100/80 hover:text-background-50 hover:bg-background-50/10"
                : active
                  ? "bg-background-50 text-foreground-950"
                  : "text-foreground-600 hover:text-foreground-950 hover:bg-background-50/70"
            }`;
            if (link.dropdown) {
              return link.dropdown === "metiers" ? (
                <NavDropdown
                  key={link.label}
                  label={link.label}
                  to="/metiers"
                  baseClass={base}
                  menuLabel="Métiers"
                  panelClassName="w-[540px]"
                >
                  {(close) => <MetiersMenuContent onNavigate={close} />}
                </NavDropdown>
              ) : (
                <NavDropdown
                  key={link.label}
                  label={link.label}
                  to="/ressources"
                  baseClass={base}
                  menuLabel="Ressources"
                  panelClassName="w-[720px]"
                  badge={<CompteurNouvellesRessources count={nbNouveauxGuides} />}
                >
                  {(close) => <RessourcesMenuContent onNavigate={close} />}
                </NavDropdown>
              );
            }
            return link.to ? (
              <Link key={link.label} to={link.to} className={base}>
                {link.label}
                {link.to === "/nouveautes" && (
                  <BadgeNouveau dateISO={derniereNouveauteISO} jours={7} compact />
                )}
              </Link>
            ) : (
              <button
                key={link.label}
                type="button"
                onClick={() => goSection(link.section as string)}
                className={base}
              >
                {link.label}
                {link.section === "fonctionnalites" && (
                  <BadgeNouveau dateISO={annoncePersonnalisationISO} jours={7} compact />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={PHONE_HREF}
            aria-label="Appeler ArtiFlow-pro"
            className={`lg:hidden inline-flex items-center justify-center gap-2 h-10 w-10 rounded-full cursor-pointer transition-colors ${
              dark
                ? "bg-background-50/15 text-background-50 hover:bg-background-50/25"
                : "bg-primary-100 text-primary-700 hover:bg-primary-200"
            }`}
          >
            <i className="ri-phone-line text-lg"></i>
          </a>
          <IndicateurSynchroPublique dark={dark} />
          {!user ? (
            <Link
              to="/app/auth"
              aria-label="Connexion / Inscription"
              title="Connexion / Inscription"
              className={`inline-flex items-center justify-center h-10 w-10 rounded-full cursor-pointer transition-colors ${
                dark
                  ? "bg-background-50/15 text-background-50 hover:bg-background-50/25"
                  : "bg-primary-100 text-primary-700 hover:bg-primary-200"
              }`}
            >
              <i className="ri-user-line text-lg"></i>
            </Link>
          ) : (
            <div ref={compteRef} className="relative">
              <button
                ref={compteBtnRef}
                type="button"
                onClick={() => setCompteOpen((v) => !v)}
                onKeyDown={onCompteTriggerKeyDown}
                aria-label={compteLabel}
                aria-haspopup="menu"
                aria-expanded={compteOpen}
                title={compteLabel}
                className={`relative inline-flex items-center justify-center h-10 w-10 rounded-full cursor-pointer transition-colors ${
                  dark
                    ? "bg-background-50/15 text-background-50 hover:bg-background-50/25"
                    : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                }`}
              >
                <span className="text-xs font-bold tracking-tight">{initiales}</span>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-background-50"
                  title="Connecté"
                  aria-hidden="true"
                ></span>
                {compteurs.devisEnAttente + compteurs.facturesImpayees > 0 && (
                  <span className="group/pastille absolute -top-1.5 -right-1.5">
                    <span
                      className="min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-red-500 text-background-50 text-[10px] font-bold tabular-nums ring-2 ring-background-50 cursor-help"
                      aria-label={`${compteurs.devisEnAttente + compteurs.facturesImpayees} élément(s) à traiter`}
                    >
                      {compteurs.devisEnAttente + compteurs.facturesImpayees > 99
                        ? "99+"
                        : compteurs.devisEnAttente + compteurs.facturesImpayees}
                    </span>
                    {/* Survol détaillé : sépare devis en attente et factures impayées au lieu d'un simple total. */}
                    <span className="pointer-events-none absolute right-0 top-full mt-2 z-50 hidden group-hover/pastille:block w-60 p-3 rounded-lg bg-background-50 border border-background-200 text-left">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground-900 mb-2">
                        <i className="ri-notification-3-line text-red-500"></i>
                        À traiter
                      </span>
                      <span className="flex items-center justify-between text-[11px] text-foreground-600">
                        <span className="inline-flex items-center gap-1.5">
                          <i className="ri-file-text-line text-accent-600"></i>
                          Devis en attente
                        </span>
                        <strong className="text-foreground-900 tabular-nums">{compteurs.devisEnAttente}</strong>
                      </span>
                      <span className="flex items-center justify-between text-[11px] text-foreground-600 mt-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <i className="ri-file-list-3-line text-secondary-600"></i>
                          Factures impayées
                        </span>
                        <strong className="text-foreground-900 tabular-nums">{compteurs.facturesImpayees}</strong>
                      </span>
                      <span className="flex items-center justify-between text-[11px] text-foreground-500 mt-2 pt-2 border-t border-background-200">
                        <span>Total</span>
                        <strong className="text-foreground-900 tabular-nums">
                          {compteurs.devisEnAttente + compteurs.facturesImpayees}
                        </strong>
                      </span>
                    </span>
                  </span>
                )}
              </button>
              {compteOpen && (
                <div
                  ref={comptePanelRef}
                  role="menu"
                  aria-label="Menu du compte"
                  onKeyDown={onComptePanelKeyDown}
                  className="absolute right-0 top-12 w-60 rounded-lg bg-background-50 border border-background-200 overflow-hidden z-50"
                >
                  <div className="px-4 py-3 border-b border-background-200">
                    <p className="text-sm font-semibold text-foreground-950 truncate">{nomCompte}</p>
                    {metierCompte && (
                      <p className="mt-0.5 text-xs text-foreground-600 truncate flex items-center gap-1.5">
                        <i className="ri-briefcase-line text-xs"></i>
                        {metierCompte}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-foreground-500 truncate">{user.email}</p>
                  </div>
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {!isGestionnaire && dernierDevis && (
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/app/devis?devis=${dernierDevis.id}`}
                          onClick={() => setCompteOpen(false)}
                          role="menuitem"
                          title={`Rouvrir le devis ${dernierDevis.numero}`}
                          className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 rounded-md bg-accent-50 text-accent-900 hover:bg-accent-100 cursor-pointer"
                        >
                          <i className="ri-history-line text-base shrink-0"></i>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent-600">
                              Reprendre
                            </span>
                            <span className="block text-sm font-semibold truncate">
                              {dernierDevis.objet?.trim() || dernierDevis.numero}
                            </span>
                            {ancienneteDernierDevis && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-accent-700">
                                <i className="ri-time-line text-[10px]"></i>
                                <span className="capitalize">{ancienneteDernierDevis}</span>
                              </span>
                            )}
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            effacerDernierDevis();
                            setDernierDevis(null);
                          }}
                          aria-label="Oublier ce devis"
                          title="Ne plus proposer ce devis"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-accent-600 hover:bg-accent-100 cursor-pointer"
                        >
                          <i className="ri-close-line text-sm"></i>
                        </button>
                      </div>
                    )}
                    <Link
                      to={profilLink}
                      onClick={() => setCompteOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 h-10 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className="ri-user-settings-line text-base"></i>
                      {profilLabel}
                    </Link>
                    {voirMonAbonnement && (
                      <Link
                        to="/app/profil?onglet=abonnement"
                        onClick={() => setCompteOpen(false)}
                        role="menuitem"
                        className="flex items-center gap-2.5 px-3 h-10 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                      >
                        <i className="ri-vip-crown-line text-base"></i>
                        Mon abonnement
                      </Link>
                    )}
                    <Link
                      to="/app"
                      onClick={() => setCompteOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 h-10 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className="ri-dashboard-line text-base"></i>
                      Mon espace
                    </Link>
                    {!isGestionnaire && (
                      <>
                        <Link
                          to="/app/devis"
                          onClick={() => setCompteOpen(false)}
                          role="menuitem"
                          title={
                            compteurs.devisEnAttente > 0
                              ? `${compteurs.devisEnAttente} devis en attente`
                              : "Mes devis"
                          }
                          className="flex items-center gap-2.5 px-3 h-10 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                        >
                          <i className="ri-file-text-line text-base"></i>
                          Mes devis
                          <CompteurBadge
                            count={compteurs.devisEnAttente}
                            tooltip={`${compteurs.devisEnAttente} devis en attente · ${formatEuros(compteurs.devisEnAttenteMontant)} HT`}
                          />
                        </Link>
                        <Link
                          to="/app/factures"
                          onClick={() => setCompteOpen(false)}
                          role="menuitem"
                          title={
                            compteurs.facturesImpayees > 0
                              ? `${compteurs.facturesImpayees} facture(s) impayée(s)`
                              : "Mes factures"
                          }
                          className="flex items-center gap-2.5 px-3 h-10 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                        >
                          <i className="ri-file-list-3-line text-base"></i>
                          Mes factures
                          <CompteurBadge
                            count={compteurs.facturesImpayees}
                            tone="secondary"
                            tooltip={`${compteurs.facturesImpayees} facture${compteurs.facturesImpayees > 1 ? "s" : ""} impayée${compteurs.facturesImpayees > 1 ? "s" : ""} · ${formatEuros(compteurs.facturesImpayeesMontant)} TTC`}
                          />
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="p-1.5 border-t border-background-200">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 h-10 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-100 hover:text-red-600 cursor-pointer"
                    >
                      <i className="ri-logout-box-r-line text-base"></i>
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => openDemo("navbar")}
            className="group/demo hidden md:inline-flex items-center gap-2 h-10 px-5 rounded-full bg-gradient-to-b from-primary-400 to-primary-600 text-background-50 text-sm font-semibold tracking-tight whitespace-nowrap cursor-pointer transition-all duration-200 hover:from-primary-500 hover:to-primary-700 active:scale-[0.98]"
          >
            <i className="ri-calendar-check-line transition-transform duration-200 group-hover/demo:-translate-y-0.5"></i>
            Demander une démo
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className={`lg:hidden w-10 h-10 flex items-center justify-center rounded-md cursor-pointer ${
              dark ? "text-background-50" : "text-foreground-950"
            }`}
          >
            <i className={open ? "ri-close-line text-2xl" : "ri-menu-line text-2xl"}></i>
          </button>
        </div>

        {/* Fin indicateur de progression de lecture, sous la barre. */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-[width] duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {open && (
        <div className="lg:hidden max-h-[calc(100vh-4rem)] overflow-y-auto bg-background-50 border-b border-background-200">
          <nav className="px-4 pt-4 pb-28 flex flex-col gap-3" aria-label="Menu principal">
            {/* Navigation principale */}
            <section className="rounded-lg border border-background-200 bg-background-50">
              <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                Navigation
              </p>
              <div className="px-1.5 pb-1.5 flex flex-col">
                {navLinks.map((link) => {
                  if (link.dropdown) {
                    const ouvert = mobileDropdown === link.dropdown;
                    return (
                      <div key={link.label}>
                        <button
                          type="button"
                          onClick={() => setMobileDropdown(ouvert ? null : link.dropdown ?? null)}
                          aria-expanded={ouvert}
                          className="w-full flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                        >
                          <i className={`${link.icon} text-lg text-foreground-400`}></i>
                          <span className="flex-1 text-left">{link.label}</span>
                          {link.dropdown === "ressources" && (
                            <CompteurNouvellesRessources count={nbNouveauxGuides} />
                          )}
                          <i className={`ri-arrow-down-s-line text-base text-foreground-400 transition-transform duration-200 ${ouvert ? "rotate-180" : ""}`}></i>
                        </button>
                        {ouvert && (
                          <div className="mb-1 ml-4 pl-3 border-l-2 border-background-200 flex flex-col gap-0.5">
                            {link.dropdown === "metiers" ? (
                              <MetiersMobileLinks onNavigate={() => setOpen(false)} />
                            ) : (
                              <RessourcesMobileLinks onNavigate={() => setOpen(false)} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return link.to ? (
                    <Link
                      key={link.label}
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className={`${link.icon} text-lg text-foreground-400`}></i>
                      <span className="flex-1">{link.label}</span>
                      {link.to === "/nouveautes" && (
                        <BadgeNouveau dateISO={derniereNouveauteISO} jours={7} compact />
                      )}
                    </Link>
                  ) : (
                    <button
                      key={link.label}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        goSection(link.section as string);
                      }}
                      className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className={`${link.icon} text-lg text-foreground-400`}></i>
                      <span className="flex-1 text-left">{link.label}</span>
                      {link.section === "fonctionnalites" && (
                        <BadgeNouveau dateISO={annoncePersonnalisationISO} jours={7} compact />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Accès rapides et compte */}
            <section className="rounded-lg border border-background-200 bg-background-50">
              <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                {user ? "Mon espace" : "Accès rapides"}
              </p>
              <div className="px-1.5 pb-1.5 flex flex-col">
                <Link
                  to="/plan-du-site"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                >
                  <i className="ri-map-2-line text-lg text-foreground-400"></i>
                  Plan du site
                </Link>
                <Link
                  to="/a-propos#equipe"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                >
                  <i className="ri-team-line text-lg text-foreground-400"></i>
                  À propos
                </Link>
                {user && !isGestionnaire && (
                  <>
                    <div className="px-3 pt-2 pb-1">
                      <IndicateurSynchroPublique className="inline-flex w-fit" />
                    </div>
                    <Link
                      to="/app/devis"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className="ri-file-text-line text-lg text-foreground-400"></i>
                      <span className="flex-1">Mes devis</span>
                      <CompteurBadge
                        count={compteurs.devisEnAttente}
                        tooltip={`${compteurs.devisEnAttente} devis en attente · ${formatEuros(compteurs.devisEnAttenteMontant)} HT`}
                      />
                    </Link>
                    <Link
                      to="/app/factures"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                    >
                      <i className="ri-file-list-3-line text-lg text-foreground-400"></i>
                      <span className="flex-1">Mes factures</span>
                      <CompteurBadge
                        count={compteurs.facturesImpayees}
                        tone="secondary"
                        tooltip={`${compteurs.facturesImpayees} facture${compteurs.facturesImpayees > 1 ? "s" : ""} impayée${compteurs.facturesImpayees > 1 ? "s" : ""} · ${formatEuros(compteurs.facturesImpayeesMontant)} TTC`}
                      />
                    </Link>
                  </>
                )}
                <Link
                  to={compteTo}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                >
                  <i className={`text-lg text-foreground-400 ${user ? "ri-user-3-line" : "ri-user-line"}`}></i>
                  {user ? "Mon espace" : "Connexion / Inscription"}
                </Link>
              </div>
            </section>

            {/* Informations légales (repliées par défaut) */}
            <details className="group rounded-lg border border-background-200 bg-background-50">
              <summary className="flex items-center gap-3 h-12 px-4 list-none [&::-webkit-details-marker]:hidden cursor-pointer text-sm font-medium text-foreground-700">
                <i className="ri-shield-check-line text-lg text-foreground-400"></i>
                <span className="flex-1">Informations légales</span>
                <i className="ri-arrow-down-s-line text-base text-foreground-400 transition-transform duration-200 group-open:rotate-180"></i>
              </summary>
              <div className="px-1.5 pb-1.5 flex flex-col border-t border-background-200">
                {legalLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                  >
                    <i className={`${link.icon} text-lg text-foreground-400`}></i>
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openDemo("navbar-mobile");
              }}
              className="inline-flex items-center justify-center gap-2 h-12 rounded-full bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer"
            >
              <i className="ri-calendar-check-line"></i>
              Demander une démo
            </button>
          </nav>
        </div>
      )}
      </header>
      <MobileActionBar />
    </>
  );
}