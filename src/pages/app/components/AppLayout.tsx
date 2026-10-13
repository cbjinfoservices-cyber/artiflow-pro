import { useEffect, useMemo } from "react";
import { NavLink, Outlet, useLocation, Link, useNavigate, Navigate } from "react-router-dom";
import { useRobotsMeta } from "@/hooks/useRobotsMeta";
import { useAuth } from "@/hooks/useAuth";
import { useRelancesRetard } from "@/hooks/useRelancesRetard";
import { useRelancesProgrammeesCount } from "@/hooks/useRelancesProgrammeesCount";
import { useComptableMoisManquantsDetail } from "@/hooks/useComptableMoisManquants";
import { useCompteurBibliotheque } from "@/hooks/useBibliotheque";
import { useEnvoisAutoMenu } from "@/hooks/useEnvoisAutomatiques";
import { useJournalErreursChargement } from "@/hooks/useJournalErreursChargement";
import { useMonAbonnement } from "@/hooks/useMonAbonnement";
import { libelleDans } from "@/lib/envoisAutomatiques";
import { useSonActif } from "@/hooks/useSonActif";
import { usePreferencesAffichageSync } from "@/hooks/usePreferencesAffichageSync";
import { useNotificationImminente } from "@/hooks/useNotificationImminente";
import { useImminencePrefs } from "@/hooks/useImminencePrefs";
import BoutonAide from "@/pages/app/components/aide/BoutonAide";
import IndicateurSynchroPublique from "@/components/feature/IndicateurSynchroPublique";
import { statutMeta } from "@/lib/monAbonnement";
import RelanceDuJourBanner from "@/pages/app/components/RelanceDuJourBanner";
import BandeauProchainesAuto from "@/pages/app/components/BandeauProchainesAuto";
import ClocheImminents from "@/pages/app/components/ClocheImminents";
import EspaceArtisanNav from "@/pages/app/components/EspaceArtisanNav";
import MenuMobileApp from "@/pages/app/components/MenuMobileApp";
import MenuCompte from "@/pages/app/components/MenuCompte";

// Les entrées de menu et leur découpage en sous-thèmes vivent dans `menuAppData` (partagés avec la
// barre latérale artisan).

const titles: Record<string, string> = {
  "/app": "Tableau de bord",
  "/app/devis": "Devis",
  "/app/bibliotheque-lignes": "Bibliothèque de lignes",
  "/app/factures": "Factures",
  "/app/clients": "Clients",
  "/app/professionnels": "Professionnels",
  "/app/abonnements": "Abonnements",
  "/app/mon-compte-gestionnaire": "Mon compte gestionnaire",
  "/app/comptabilite": "Comptabilité",
  "/app/planning": "Planning",
  "/app/relances": "Relances",
  "/app/relances-programmees": "Relances programmées",
  "/app/envois": "Envois",
  "/app/envois-automatiques": "Envois automatiques",
  "/app/chantiers": "Chantiers",
  "/app/profil": "Mon profil",
  "/app/preferences": "Préférences d'affichage",
  "/app/back-office": "Back-office",
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    profile,
    user,
    signOut,
    isGestionnaire,
    isGestionnairePrincipal,
    gestionnaires,
    voirComptabilite,
    voirMonAbonnement,
  } = useAuth();
  const { enRetard, critiques, montantRetard } = useRelancesRetard(location.pathname);
  const {
    total: relancesProgrammees,
    montant: montantProgramme,
    enRetard: retardProgramme,
  } = useRelancesProgrammeesCount(location.pathname);
  const { count: moisManquants, mois: moisManquantsListe } = useComptableMoisManquantsDetail(location.pathname);
  const biblio = useCompteurBibliotheque();
  // Pastille « à vérifier » de l'entrée « Envois automatiques » et grille chronologique des
  // exécutions prévues dans la fenêtre d'alerte (bandeau du menu) : réservées aux comptes artisan.
  // La fenêtre (15 / 30 / 60 min) et les automatisations exclues du signalement sont réglables
  // depuis l'infobulle de la cloche de l'en-tête.
  const imminence = useImminencePrefs();
  const exclusionsImminentes = useMemo(() => imminence.exclusions.map((e) => e.id), [imminence.exclusions]);
  const { attention: envoisAutoAttention, imminentes: executionsImminentes } = useEnvoisAutoMenu(
    moisManquants,
    !isGestionnaire,
    imminence.fenetreMin * 60 * 1000,
    exclusionsImminentes,
  );
  const { abonnement } = useMonAbonnement();
  // Nombre de blocages de chargement encore ouverts : alimente la pastille rouge de l'entrée
  // Back-office du menu latéral, pour voir d'un coup d'œil qu'un écran est cassé sans y entrer.
  const { erreurs: erreursChargement } = useJournalErreursChargement();
  const blocagesChargement = useMemo(
    () => erreursChargement.filter((e) => e.gravite === "blocage" && !e.resolu).length,
    [erreursChargement],
  );
  // Préférence « son de confirmation » : sert au petit indicateur de sons coupés de l'en-tête.
  const sonActif = useSonActif();
  // Synchronisation des préférences d'affichage (barres, aide, ordres, son) vers le Backend, pour
  // les retrouver sur n'importe quel appareil. Démarrée ici pour tourner sur toutes les pages.
  usePreferencesAffichageSync();
  // Notification navigateur des traitements imminents : le hook est monté ici (layout) pour
  // fonctionner depuis n'importe quelle page, même hors de la page des envois automatiques.
  const notifImminente = useNotificationImminente(executionsImminentes);
  const offreStatut = abonnement ? statutMeta(abonnement.statut) : null;
  const retardCible = critiques > 0 ? 30 : 0;
  const title = titles[location.pathname] || "ArtiFlow-pro";

  // Un compte gestionnaire n'est pas un compte professionnel : il n'affiche que
  // le back-office, sans les entrées métier (devis, factures, clients…).
  const backOfficeOnly = isGestionnaire;

  const displayName = backOfficeOnly
    ? isGestionnairePrincipal
      ? "Gestionnaire principal"
      : "Gestionnaire"
    : profile?.entreprise || user?.email?.split("@")[0] || "Mon compte";
  const subLine = backOfficeOnly
    ? user?.email || "Compte gestionnaire"
    : profile?.metier || user?.email || "Espace artisan";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "AF";
  const compteLink = backOfficeOnly ? "/app/mon-compte-gestionnaire" : "/app/profil";

  const handleSignOut = async () => {
    await signOut();
  };

  // L'espace produit n'a pas vocation à être indexé : on concentre le
  // référencement sur les pages marketing.
  useRobotsMeta("noindex, nofollow");

  // Nouvel artisan : on propose le parcours de démarrage guidé tant qu'il n'a pas été
  // terminé (ou passé). La page de démarrage est hors de ce layout, donc pas de boucle.
  if (profile && profile.onboarding_done === false && !isGestionnaire && location.pathname !== "/app/demarrage") {
    return <Navigate to="/app/demarrage" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background-50">
      <BoutonAide />
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-background-100 border-r border-background-200">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-background-200">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
            <i className="ri-tools-fill text-lg"></i>
          </span>
          <span className="font-heading font-bold text-lg text-foreground-950">ArtiFlow-pro</span>
        </div>

        <BandeauProchainesAuto executions={executionsImminentes} fenetreMin={imminence.fenetreMin} />

        <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
          {!backOfficeOnly && (
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
            />
          )}

          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-foreground-400 uppercase tracking-wide">Back-office</p>
          {isGestionnaire && (
            <NavLink
              to="/app/back-office"
              className={({ isActive }) =>
                `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary-100 text-primary-800"
                    : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
                }`
              }
            >
              <i className="ri-dashboard-3-line text-lg"></i>
              Vue d'ensemble
              {blocagesChargement > 0 && (
                <span
                  className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-background-50 text-[10px] font-bold whitespace-nowrap"
                  title={`${blocagesChargement} écran${blocagesChargement > 1 ? "s" : ""} en erreur de chargement — ouvrir le journal du back-office`}
                  aria-label={`${blocagesChargement} blocage(s) de chargement à corriger`}
                >
                  {blocagesChargement > 99 ? "99+" : blocagesChargement}
                </span>
              )}
            </NavLink>
          )}
          {voirComptabilite && (
            <NavLink
              to="/app/comptabilite"
              title="Préparez les documents pour votre comptable (journal, TVA, régularité)."
              className={({ isActive }) =>
                `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary-100 text-primary-800"
                    : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
                }`
              }
            >
              <i className="ri-file-chart-line text-lg"></i>
              Comptabilité
              {moisManquants > 0 && (
                <span className="relative group ml-auto inline-flex items-center">
                  <span
                    role="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate("/app/comptabilite?manquants=1");
                    }}
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold cursor-pointer hover:bg-accent-600 transition-colors"
                    aria-label={`${moisManquants} mois manquant${moisManquants > 1 ? "s" : ""} — ouvrir l'alerte de régularité`}
                  >
                    {moisManquants > 99 ? "99+" : moisManquants}
                  </span>
                  <span className="pointer-events-none absolute right-0 bottom-full mb-2 z-50 hidden group-hover:block w-56 p-3 rounded-lg bg-background-50 border border-background-200 text-left">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground-900 mb-1.5">
                      <i className="ri-file-chart-line text-accent-600"></i>
                      Régularité comptable
                    </span>
                    <span className="flex items-center justify-between text-[11px] text-foreground-600">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="ri-calendar-close-line text-accent-600"></i>
                        Mois manquants
                      </span>
                      <strong className="text-foreground-900 tabular-nums">{moisManquants}</strong>
                    </span>
                    {moisManquantsListe.length > 0 && (
                      <span className="mt-2 pt-2 border-t border-background-200 flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                          <i className="ri-list-check-2"></i>
                          Mois concernés
                        </span>
                        {moisManquantsListe.slice(0, 4).map((m) => (
                          <span key={m} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-700 capitalize">
                            <i className="ri-calendar-line text-foreground-400"></i>
                            {m}
                          </span>
                        ))}
                        {moisManquantsListe.length > 4 && (
                          <span className="text-[11px] text-foreground-500">+ {moisManquantsListe.length - 4} autre{moisManquantsListe.length - 4 > 1 ? "s" : ""}</span>
                        )}
                      </span>
                    )}
                  </span>
                </span>
              )}
            </NavLink>
          )}
          {isGestionnaire && (
            <NavLink
              to="/app/abonnements"
              className={({ isActive }) =>
                `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary-100 text-primary-800"
                    : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
                }`
              }
            >
              <i className="ri-money-euro-circle-line text-lg"></i>
              Abonnements
            </NavLink>
          )}
          {isGestionnaire && (
            <NavLink
              to="/app/mon-compte-gestionnaire"
              className={({ isActive }) =>
                `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary-100 text-primary-800"
                    : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
                }`
              }
            >
              <i className="ri-shield-user-line text-lg"></i>
              <span className="truncate">Compte gestionnaire</span>
              {gestionnaires.length > 0 && (
                <span
                  className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-secondary-500 text-background-50 text-[10px] font-bold"
                  title={`${gestionnaires.length} adresse${gestionnaires.length > 1 ? "s" : ""} gestionnaire${gestionnaires.length > 1 ? "s" : ""} reconnue${gestionnaires.length > 1 ? "s" : ""}`}
                >
                  {gestionnaires.length > 99 ? "99+" : gestionnaires.length}
                </span>
              )}
            </NavLink>
          )}

          {!backOfficeOnly && (
            <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-foreground-400 uppercase tracking-wide">Compte</p>
          )}
          {!backOfficeOnly && (
            <NavLink
              to="/app/profil"
              title="Vos informations : entreprise, métier, coordonnées, e-mails."
              className={({ isActive }) =>
                `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary-100 text-primary-800"
                    : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
                }`
              }
            >
              <i className="ri-user-settings-line text-lg"></i>
              Mon profil
            </NavLink>
          )}

          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-foreground-400 uppercase tracking-wide">Système</p>
          <NavLink
            to="/app/preferences"
              title="Réglez ce que vous voyez à l'écran (formats, affichages, rappels)."
            className={({ isActive }) =>
              `flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                isActive
                  ? "bg-primary-100 text-primary-800"
                  : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
              }`
            }
          >
            <i className="ri-equalizer-2-line text-lg"></i>
            Préférences d'affichage
          </NavLink>
        </nav>

        <div className="p-3 border-t border-background-200">
          <Link
            to={compteLink}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 cursor-pointer transition-colors"
          >
            <span className="w-9 h-9 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 font-semibold text-sm shrink-0">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground-950 truncate">{displayName}</p>
              <p className="text-[10px] text-foreground-500 truncate">{subLine}</p>
              {voirMonAbonnement && abonnement && offreStatut && (
                <span
                  className={`mt-1 inline-flex items-center gap-1 h-5 px-1.5 rounded-full ${offreStatut.tone} text-[9px] font-bold whitespace-nowrap`}
                  title={`Offre ArtiFlow-pro ${abonnement.offre} · ${offreStatut.label}`}
                >
                  <i className="ri-vip-crown-2-line text-[9px]"></i>
                  {abonnement.offre}
                </span>
              )}
            </div>
            <i className="ri-settings-3-line text-foreground-400"></i>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-2 flex items-center gap-2 h-9 px-3 w-full rounded-md text-xs font-medium text-foreground-500 hover:bg-background-200 hover:text-red-600 cursor-pointer"
          >
            <i className="ri-logout-box-r-line"></i>
            Se déconnecter
          </button>
          <Link to="/" className="mt-1 flex items-center gap-2 h-9 px-3 rounded-md text-xs font-medium text-foreground-500 hover:bg-background-200 cursor-pointer">
            <i className="ri-arrow-left-line"></i>
            Retour au site
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 bg-background-50 border-b border-background-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
                <i className="ri-tools-fill text-lg"></i>
              </span>
            </div>
            <h1 className="hidden lg:block font-heading font-bold text-xl text-foreground-950 truncate">{title}</h1>
            {voirMonAbonnement && abonnement && ["Actif", "Essai"].includes(abonnement.statut) && (
              <Link
                to="/app/profil?onglet=abonnement"
                title={`Vous êtes abonné à l'offre ArtiFlow-pro ${abonnement.offre} — ouvrir votre abonnement`}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
              >
                <i className="ri-vip-crown-2-line text-[11px]"></i>
                Abonné
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {!backOfficeOnly && executionsImminentes.length > 0 && (
              <>
                <Link
                  to="/app/envois-automatiques"
                  title={`${executionsImminentes.length} traitement${executionsImminentes.length > 1 ? "s" : ""} automatique${executionsImminentes.length > 1 ? "s" : ""} dans l'heure :\n${executionsImminentes
                    .map((e) => `${e.item.nom} — ${libelleDans(e.dansMs)}`)
                    .join("\n")}`}
                  aria-label={`${executionsImminentes.length} traitement(s) imminent(s) — ouvrir les envois automatiques`}
                  className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-md bg-accent-100 border border-accent-200 text-accent-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                >
                  <span className="relative w-5 h-5 flex items-center justify-center">
                    <i className="ri-timer-flash-line text-sm"></i>
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary-500 animate-pulse"
                      aria-hidden="true"
                    ></span>
                  </span>
                  <span className="hidden sm:inline">Imminents</span>
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums">
                    {executionsImminentes.length > 99 ? "99+" : executionsImminentes.length}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={notifImminente.toggle}
                  title={
                    notifImminente.actif
                      ? "Désactiver la notification navigateur des traitements imminents"
                      : notifImminente.permission === "denied"
                        ? "Notifications bloquées par le navigateur"
                        : "Notifier le navigateur quand un traitement devient imminent"
                  }
                  aria-label="Notification navigateur des traitements imminents"
                  aria-pressed={notifImminente.actif}
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-md border whitespace-nowrap cursor-pointer transition-colors ${
                    notifImminente.actif
                      ? "bg-accent-500 border-accent-500 text-background-50 hover:bg-accent-600"
                      : "bg-background-100 border-background-200 text-foreground-500 hover:border-primary-300"
                  }`}
                >
                  <i
                    className={
                      notifImminente.actif ? "ri-notification-3-fill text-base" : "ri-notification-off-line text-base"
                    }
                  ></i>
                </button>
              </>
            )}
            {voirMonAbonnement && abonnement && offreStatut && (
              <Link
                to="/app/profil?onglet=abonnement"
                title={`Votre offre ArtiFlow-pro ${abonnement.offre} · ${offreStatut.label}`}
                className="hidden md:inline-flex items-center gap-2 h-10 pl-3 pr-2 rounded-md bg-background-100 border border-background-200 hover:border-primary-300 cursor-pointer transition-colors"
              >
                <i className="ri-vip-crown-2-line text-accent-600"></i>
                <span className="text-xs font-semibold text-foreground-800 whitespace-nowrap">ArtiFlow-pro {abonnement.offre}</span>
                <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-full ${offreStatut.tone} text-[10px] font-bold whitespace-nowrap`}>
                  <i className={offreStatut.icon}></i>
                  {offreStatut.label}
                </span>
              </Link>
            )}
            {!sonActif && (
              <Link
                to="/app/preferences#section-son"
                title="Son de confirmation coupé — ouvrir les préférences d'affichage"
                aria-label="Son de confirmation coupé"
                className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-md bg-background-100 border border-background-200 text-foreground-500 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
              >
                <i className="ri-volume-mute-line text-sm"></i>
                <span className="hidden sm:inline">Son coupé</span>
              </Link>
            )}
            {!backOfficeOnly && (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 h-10 rounded-md bg-background-100 border border-background-200 w-56">
                  <i className="ri-search-line text-foreground-400 text-sm"></i>
                  <span className="text-xs text-foreground-400">Rechercher…</span>
                </div>
                <span className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors">
                  <i className="ri-magic-line"></i>
                  <span className="hidden sm:inline">Nouveau devis IA</span>
                </span>
              </>
            )}
            <IndicateurSynchroPublique />
            <MenuCompte backOfficeOnly={backOfficeOnly} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 lg:pb-6">
          {!backOfficeOnly && <RelanceDuJourBanner refreshKey={location.pathname} />}
          <Outlet />
        </main>
      </div>

      <MenuMobileApp
        backOfficeOnly={backOfficeOnly}
        enRetard={enRetard}
        critiques={critiques}
        montantRetard={montantRetard}
        retardCible={retardCible}
        relancesProgrammees={relancesProgrammees}
        montantProgramme={montantProgramme}
        retardProgramme={retardProgramme}
        envoisAutoAttention={envoisAutoAttention}
        biblio={biblio}
        moisManquants={moisManquants}
        voirComptabilite={voirComptabilite}
        isGestionnaire={isGestionnaire}
        gestionnairesCount={gestionnaires.length}
        compteLink={compteLink}
        displayName={displayName}
        subLine={subLine}
        initials={initials}
        voirMonAbonnement={voirMonAbonnement}
        abonnementOffre={abonnement?.offre}
        offreLabel={offreStatut?.label}
        offreTone={offreStatut?.tone}
        onSignOut={handleSignOut}
      />
    </div>
  );
}