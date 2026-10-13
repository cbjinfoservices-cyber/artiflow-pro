import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useTousRecontacts } from "@/hooks/useTousRecontacts";
import {
  fetchAbonnements,
  fetchResumesHistorique,
  createAbonnement,
  updateAbonnementStatut,
  updateAbonnementOffre,
  OFFRE_PRIX,
  OFFRES,
  STATUTS_ABO,
  SEUIL_TRES_VOLATIL,
  estRecontactVolatil,
  essaisFinAujourdhui,
  essaisFinDemain,
  type AbonnementItem,
  type AbonnementPayload,
  type AbonnementHistoriqueResume,
  type RecontactArtisanItem,
} from "@/lib/abonnementsApi";
import { formatEuros } from "@/lib/format";
import { formatShortDate, todayISO, toISODate, addDays } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import { downloadZip } from "@/lib/zip";
import { buildAbonnementsArchivePdf, savePdf } from "@/lib/pdf";
import DataState from "@/pages/app/components/DataState";
import Toast from "@/components/base/Toast";
import AbonnementFormModal from "@/pages/app/abonnements/components/AbonnementFormModal";
import AbonnementsCharts, { repartitionOffres, evolutionMrr } from "@/pages/app/abonnements/components/AbonnementsCharts";
import ChangementsOffreParMoisCard from "@/pages/app/abonnements/components/ChangementsOffreParMoisCard";
import ArtisansVolatilsCard from "@/pages/app/abonnements/components/ArtisansVolatilsCard";
import EvolutionMrrHistoriqueCard from "@/pages/app/abonnements/components/EvolutionMrrHistoriqueCard";
import CompteurChangementsOffre from "@/pages/app/abonnements/components/CompteurChangementsOffre";
import RappelRecontactVolatils, { type CompteARappeler } from "@/pages/app/abonnements/components/RappelRecontactVolatils";
import RecontacterTousModal, { type CibleRecontact } from "@/pages/app/abonnements/components/RecontacterTousModal";
import RelancerImpayesModal, { type CibleImpaye } from "@/pages/app/abonnements/components/RelancerImpayesModal";
import RelancerEssaisFinJourModal, {
  type CibleEssaiFinJour,
} from "@/components/feature/RelancerEssaisFinJourModal";
import ApercuRecapHebdoModal from "@/pages/app/abonnements/components/ApercuRecapHebdoModal";
import RecapHebdoBadge from "@/pages/app/abonnements/components/RecapHebdoBadge";
import HistoriqueRecapHebdoCard from "@/pages/app/abonnements/components/HistoriqueRecapHebdoCard";
import HistoriqueAlertesAutoRelanceCard from "@/pages/app/abonnements/components/HistoriqueAlertesAutoRelanceCard";
import {
  lireDelaiRappelRecontact,
  ecrireDelaiRappelRecontact,
  chargerDelaiRappelRecontactBackend,
  enregistrerDelaiRappelRecontactBackend,
  lireRecapHebdoActif,
  ecrireRecapHebdoActif,
  chargerReglagesRecapBackend,
  enregistrerRecapHebdoActifBackend,
  declencherRecapHebdoMaintenant,
  prochainRecapHebdo,
  prochainsRecapsHebdo,
  lireRecapJour,
  ecrireRecapJour,
  lireRecapHeure,
  ecrireRecapHeure,
  lireTauxAlerteRecap,
  ecrireTauxAlerteRecap,
  enregistrerCadenceRecapBackend,
  enregistrerTauxAlerteRecapBackend,
  lireRecapHistoPeriode,
  ecrireRecapHistoPeriode,
  enregistrerRecapHistoPeriodeBackend,
  lireRecapAlertesGrapheMois,
  ecrireRecapAlertesGrapheMois,
  enregistrerRecapAlertesGrapheMoisBackend,
  lireRecapOubliesAutoJours,
  ecrireRecapOubliesAutoJours,
  enregistrerRecapOubliesAutoJoursBackend,
  lireRecapOubliesAlerteEmail,
  ecrireRecapOubliesAlerteEmail,
  enregistrerRecapOubliesAlerteEmailBackend,
  RECAP_OUBLIES_AUTO_JOURS,
  libelleOubliesAutoJours,
  RECAP_JOURS,
  RECAP_HEURES,
  DELAI_RECONTACT_EVENT,
  DELAIS_RECONTACT,
  RECAP_HEBDO_EVENT,
  type RecapHistoPeriode,
} from "@/lib/recontactSeuil";
import { useAuth } from "@/hooks/useAuth";
import { useRecapRecontactHistorique } from "@/hooks/useRecapRecontactHistorique";
import { useAlertesAutoRelance } from "@/hooks/useAlertesAutoRelance";
import ComparerOffresModal from "@/components/feature/ComparerOffresModal";
import RechercheRepliable from "@/components/feature/RechercheRepliable";

function offreTone(offre: string): string {
  if (offre === "Entreprise") return "bg-accent-100 text-accent-800";
  if (offre === "Pro") return "bg-primary-100 text-primary-800";
  return "bg-secondary-100 text-secondary-800";
}

function statutTone(statut: string): string {
  if (statut === "Actif") return "bg-accent-100 text-accent-800";
  if (statut === "Essai") return "bg-secondary-100 text-secondary-800";
  if (statut === "Impayé") return "bg-red-100 text-red-700";
  return "bg-background-200 text-foreground-600";
}

/** Construit le CSV des abonnements (mêmes colonnes que l'export CSV de la liste). */
function csvAbonnements(
  rows: AbonnementItem[],
  recontacts: Record<number, RecontactArtisanItem>,
  recontactesCeMoisIds: Set<number>,
): string {
  const now = Date.now();
  const data = rows.map((a) => {
    const dernier = recontacts[a.id] ?? null;
    const jours = dernier
      ? Math.max(0, Math.floor((now - new Date(dernier.created_at).getTime()) / 86400000))
      : null;
    return [
      a.entreprise,
      a.email ?? "",
      a.metier ?? "",
      a.ville ?? "",
      a.offre,
      a.statut,
      a.montant_mensuel.toFixed(2).replace(".", ","),
      a.canal_paiement ?? "",
      a.date_debut ? formatShortDate(a.date_debut) : "",
      a.date_echeance ? formatShortDate(a.date_echeance) : "",
      dernier ? formatShortDate(dernier.created_at) : "",
      jours !== null ? String(jours) : "",
      recontactesCeMoisIds.has(a.id) ? "Oui" : "Non",
    ];
  });
  return toCsv(
    [
      "Entreprise",
      "Email",
      "Métier",
      "Ville",
      "Offre",
      "Statut",
      "Montant mensuel",
      "Paiement",
      "Début",
      "Échéance",
      "Dernier recontact",
      "Jours depuis",
      "Recontacté ce mois",
    ],
    data,
  );
}

/** Construit le CSV du journal des recontacts (mêmes colonnes que l'export ciblé). */
function csvJournal(items: RecontactArtisanItem[]): string {
  const data = items.map((r) => [
    r.entreprise ?? "",
    formatShortDate(r.created_at),
    r.email ?? "—",
    r.sujet ?? "",
    r.statut === "echec" ? "Échec" : "Envoyé",
  ]);
  return toCsv(["Entreprise", "Date", "Destinataire", "Sujet", "Statut"], data);
}

/**
 * Construit le CSV de préparation des prélèvements du mois (compatible banque / GoCardless) :
 * une ligne par abonnement affiché, avec l'IBAN et la référence de mandat SEPA.
 */
function csvPrelevementsSepa(rows: AbonnementItem[]): string {
  const data = rows.map((a) => [
    a.entreprise,
    a.montant_mensuel.toFixed(2).replace(".", ","),
    a.date_echeance ?? "",
    a.iban ?? "",
    a.mandat_sepa ?? "",
    a.statut,
    a.offre,
    a.email ?? "",
  ]);
  return toCsv(
    ["Entreprise", "Montant mensuel", "Date d'échéance", "IBAN", "Mandat SEPA", "Statut", "Offre", "Email"],
    data,
  );
}

export default function AppAbonnements() {
  usePageMeta(
    "Abonnements · ArtiFlow-pro",
    "Back-office de suivi des abonnements des artisans inscrits : offres, MRR, essais, impayés et résiliations.",
  );

  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abos, setAbos] = useState<AbonnementItem[]>([]);
  const [resumes, setResumes] = useState<Record<number, AbonnementHistoriqueResume>>({});
  const [comparer, setComparer] = useState<{ a: string; b: string; abonnementId?: number } | null>(null);
  const [query, setQuery] = useState("");
  const [statutFilter, setStatutFilter] = useState("Tous");
  const [offreFilter, setOffreFilter] = useState("");
  const [echeanceFilter, setEcheanceFilter] = useState<"" | "7j" | "mois">("");
  const [enRetardFilter, setEnRetardFilter] = useState(false);
  const [changeOffreFilter, setChangeOffreFilter] = useState(false);
  const [tresVolatilsFilter, setTresVolatilsFilter] = useState(false);
  const [recontactFilter, setRecontactFilter] = useState<"" | "a_recontacter" | "deja">("");
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [delaiRappel, setDelaiRappel] = useState(() => lireDelaiRappelRecontact());
  const [recapHebdoActif, setRecapHebdoActif] = useState(() => lireRecapHebdoActif());
  const [recapJour, setRecapJour] = useState(() => lireRecapJour());
  const [recapHeure, setRecapHeure] = useState(() => lireRecapHeure());
  const [tauxAlerteRecap, setTauxAlerteRecap] = useState(() => lireTauxAlerteRecap());
  const [periodeHistoRecap, setPeriodeHistoRecap] = useState(() => lireRecapHistoPeriode());
  const [alertesGrapheMois, setAlertesGrapheMois] = useState(() => lireRecapAlertesGrapheMois());
  const [recapOubliesAutoJours, setRecapOubliesAutoJours] = useState(() => lireRecapOubliesAutoJours());
  const [recapOubliesAlerteEmail, setRecapOubliesAlerteEmail] = useState(() => lireRecapOubliesAlerteEmail());
  const [apercuRecapOpen, setApercuRecapOpen] = useState(false);
  const [envoiRecapEnCours, setEnvoiRecapEnCours] = useState(false);
  const [rappelTousOpen, setRappelTousOpen] = useState(false);
  const [relanceImpayesOpen, setRelanceImpayesOpen] = useState(false);
  const [relanceEssaisOpen, setRelanceEssaisOpen] = useState(false);
  const [relanceEssaisDemainOpen, setRelanceEssaisDemainOpen] = useState(false);

  // Pré-filtrage depuis l'URL : la vue d'ensemble Back-office ouvre cette page
  // directement filtrée sur un statut (?statut=…) ou une offre (?offre=…).
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const statut = searchParams.get("statut");
    const offre = searchParams.get("offre");
    if (statut && (statut === "Tous" || (STATUTS_ABO as readonly string[]).includes(statut))) {
      setStatutFilter(statut);
    }
    if (offre && (OFFRES as readonly string[]).includes(offre)) {
      setOffreFilter(offre);
    }
  }, [searchParams]);

  // Suit le réglage du délai de rappel (partagé via événement, comme les autres seuils).
  useEffect(() => {
    const onDelai = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number") setDelaiRappel(detail);
    };
    const onRecap = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setRecapHebdoActif(detail);
    };
    window.addEventListener(DELAI_RECONTACT_EVENT, onDelai);
    window.addEventListener(RECAP_HEBDO_EVENT, onRecap);
    return () => {
      window.removeEventListener(DELAI_RECONTACT_EVENT, onDelai);
      window.removeEventListener(RECAP_HEBDO_EVENT, onRecap);
    };
  }, []);

  // Le délai est aussi mémorisé dans le profil (Backend) pour que le récap hebdomadaire
  // par email, envoyé automatiquement, utilise exactement le même seuil que l'interface.
  useEffect(() => {
    if (!user) return;
    let active = true;
    chargerDelaiRappelRecontactBackend(user.id).then((value) => {
      if (active && typeof value === "number") setDelaiRappel(value);
    });
    chargerReglagesRecapBackend(user.id).then((reglages) => {
      if (!active || !reglages) return;
      if (typeof reglages.actif === "boolean") setRecapHebdoActif(reglages.actif);
      if (typeof reglages.jour === "number") setRecapJour(reglages.jour);
      if (typeof reglages.heure === "number") setRecapHeure(reglages.heure);
      if (typeof reglages.tauxAlerte === "number") setTauxAlerteRecap(reglages.tauxAlerte);
      if (reglages.histoPeriode) setPeriodeHistoRecap(reglages.histoPeriode);
      if (typeof reglages.alertesGrapheMois === "number") setAlertesGrapheMois(reglages.alertesGrapheMois);
      if (typeof reglages.oubliesAutoJours === "number") setRecapOubliesAutoJours(reglages.oubliesAutoJours);
      if (typeof reglages.oubliesAlerteEmail === "boolean") setRecapOubliesAlerteEmail(reglages.oubliesAlerteEmail);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, res] = await Promise.all([fetchAbonnements(), fetchResumesHistorique()]);
      setAbos(data);
      setResumes(res);
    } catch {
      setError("Impossible de charger les abonnements pour l'instant. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const {
    items: tousRecontacts,
    parAbonnement: derniersRecontacts,
    reload: reloadRecontacts,
  } = useTousRecontacts();

  // Historique des récaps hebdomadaires envoyés automatiquement (date + comptes concernés).
  const recapHistorique = useRecapRecontactHistorique(user?.id, 12);
  // Historique des alertes email réellement envoyées à l'artisan (auto-relance des oubliés).
  const alertesAuto = useAlertesAutoRelance(user?.id, 12);

  const countByStatut = (s: string) => abos.filter((a) => a.statut === s).length;
  const countByOffre = (o: string) => abos.filter((a) => a.offre === o).length;

  const actifs = countByStatut("Actif");
  const essais = countByStatut("Essai");
  const impayes = countByStatut("Impayé");
  const resilies = countByStatut("Résilié");

  // Essais dont la fin tombe aujourd'hui : conversions imminentes (premier prélèvement demain),
  // affichées en tête de page avec un bouton de relance « dernière chance ».
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
  // les relances de dernière chance doivent sauver (partagé avec la tuile back-office).
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

  // Revenu mensuel récurrent : uniquement les abonnements actifs.
  const mrr = useMemo(() => abos.filter((a) => a.statut === "Actif").reduce((s, a) => s + a.montant_mensuel, 0), [abos]);
  // Montant bloqué dans les impayés (à recouvrer).
  const manqueImpayes = useMemo(
    () => abos.filter((a) => a.statut === "Impayé").reduce((s, a) => s + a.montant_mensuel, 0),
    [abos],
  );

  const today = todayISO();
  const enRetard = (a: AbonnementItem) => a.statut !== "Résilié" && !!a.date_echeance && a.date_echeance < today;
  // Renouvellements à venir : échéance dans les 7 prochains jours (aujourd'hui inclus).
  const limite7j = toISODate(addDays(new Date(), 7));
  const sous7jProche = (a: AbonnementItem) =>
    a.statut !== "Résilié" && !!a.date_echeance && a.date_echeance >= today && a.date_echeance <= limite7j;
  const nbSous7j = useMemo(() => abos.filter(sous7jProche).length, [abos, today, limite7j]);
  // Abonnements échus : échéance passée et compte non résilié (isolés par le filtre « En retard »).
  const nbEnRetard = useMemo(() => abos.filter(enRetard).length, [abos, today]);

  // Renouvellements de ce mois-ci : échéance entre aujourd'hui et la fin du mois courant.
  const now = new Date();
  const finDeMois = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const ceMoisProche = (a: AbonnementItem) =>
    a.statut !== "Résilié" && !!a.date_echeance && a.date_echeance >= today && a.date_echeance <= finDeMois;
  const nbCeMois = useMemo(() => abos.filter(ceMoisProche).length, [abos, today, finDeMois]);

  const nbChangeOffre = useMemo(() => abos.filter((a) => (resumes[a.id]?.offres ?? 0) > 0).length, [abos, resumes]);
  const nbTresVolatils = useMemo(
    () => abos.filter((a) => (resumes[a.id]?.offres6mois ?? 0) >= SEUIL_TRES_VOLATIL).length,
    [abos, resumes],
  );

  // Suivi des recontacts : un compte volatil est « à recontacter » tant qu'aucun
  // recontact n'a été envoyé, et « déjà recontacté » dès qu'un envoi est journalisé.
  const estTresVolatil = (a: AbonnementItem) => (resumes[a.id]?.offres6mois ?? 0) >= SEUIL_TRES_VOLATIL;
  const nbARecontacter = abos.filter((a) => estTresVolatil(a) && !derniersRecontacts[a.id]).length;
  const nbDejaRecontactes = abos.filter((a) => estTresVolatil(a) && !!derniersRecontacts[a.id]).length;
  const recontactOptions: { key: "" | "a_recontacter" | "deja"; label: string; count: number | null }[] = [
    { key: "", label: "Tous", count: null },
    { key: "a_recontacter", label: "À recontacter", count: nbARecontacter },
    { key: "deja", label: "Déjà recontactés", count: nbDejaRecontactes },
  ];

  // Compteur « Recontactés ce mois-ci » : comptes distincts ayant reçu au moins un
  // recontact réussi ce mois-ci, et total d'emails de recontact envoyés sur la période.
  const recontactesCeMois = useMemo(() => {
    const now = new Date();
    const comptes = new Set<number>();
    let total = 0;
    tousRecontacts.forEach((r) => {
      if (r.statut !== "envoye") return;
      // Les rappels de paiement (impayés) et les relances de fin d'essai ne sont pas des recontacts de volatilité.
      if (!estRecontactVolatil(r)) return;
      const d = new Date(r.created_at);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      total += 1;
      if (r.abonnement_id !== null) comptes.add(r.abonnement_id);
    });
    return { comptes: comptes.size, total, ids: comptes };
  }, [tousRecontacts]);

  // Compteur « oubliés relancés automatiquement ce mois-ci » : relances parties via l'auto-relance
  // des oubliés (origine « auto ») sur le mois courant, en comptes distincts et en emails envoyés.
  const autoRelancesCeMois = useMemo(() => {
    const now = new Date();
    const comptes = new Set<number>();
    let total = 0;
    tousRecontacts.forEach((r) => {
      if (r.origine !== "auto" || r.statut !== "envoye") return;
      const d = new Date(r.created_at);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      total += 1;
      if (r.abonnement_id !== null) comptes.add(r.abonnement_id);
    });
    return { comptes: comptes.size, total };
  }, [tousRecontacts]);

  // Compteur « déjà recontactés depuis le rappel » : comptes volatils recontactés
  // (envoi réussi) depuis leur signalement, c.-à-d. après leur dernier changement d'offre.
  const recontactesDepuisRappel = useMemo(() => {
    const dernierSucces: Record<number, number> = {};
    tousRecontacts.forEach((r) => {
      if (r.statut !== "envoye" || r.abonnement_id === null) return;
      if (!estRecontactVolatil(r)) return;
      const t = new Date(r.created_at).getTime();
      if (Number.isNaN(t)) return;
      const prev = dernierSucces[r.abonnement_id];
      if (prev === undefined || t > prev) dernierSucces[r.abonnement_id] = t;
    });
    return abos.filter((a) => {
      const resume = resumes[a.id];
      if (!resume) return false;
      if ((resume.offres6mois ?? 0) < SEUIL_TRES_VOLATIL) return false;
      if (!resume.dernierChangement) return false;
      const t = dernierSucces[a.id];
      if (t === undefined) return false;
      return t >= new Date(resume.dernierChangement).getTime();
    }).length;
  }, [abos, resumes, tousRecontacts]);

  // Comptes très volatils toujours « à recontacter » dont le dernier changement d'offre
  // remonte à plus de `delaiRappel` jours : alimente le bandeau de rappel.
  const aRappeler: CompteARappeler[] = useMemo(() => {
    const now = Date.now();
    return abos
      .map((a) => ({ abo: a, resume: resumes[a.id] }))
      .filter(({ abo, resume }) => {
        if (!resume) return false;
        if ((resume.offres6mois ?? 0) < SEUIL_TRES_VOLATIL) return false;
        if (derniersRecontacts[abo.id]) return false;
        if (!resume.dernierChangement) return false;
        const jours = (now - new Date(resume.dernierChangement).getTime()) / 86400000;
        return jours >= delaiRappel;
      })
      .map(({ abo, resume }) => ({
        abonnementId: abo.id,
        entreprise: abo.entreprise,
        email: abo.email,
        dernierChangement: resume.dernierChangement,
        joursDepuis: Math.floor((now - new Date(resume.dernierChangement as string).getTime()) / 86400000),
        nbChangements: resume.offres6mois ?? 0,
      }))
      .sort((x, y) => y.joursDepuis - x.joursDepuis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abos, resumes, derniersRecontacts, delaiRappel]);

  // Cibles de l'envoi groupé depuis le bandeau de rappel.
  const ciblesRappel: CibleRecontact[] = useMemo(
    () =>
      aRappeler.map((c) => ({
        abonnementId: c.abonnementId,
        entreprise: c.entreprise,
        email: c.email,
        nbChangements: c.nbChangements,
      })),
    [aRappeler],
  );

  // Comptes en retard (statut Impayé) ciblés par le bouton « Relancer les impayés ».
  const ciblesImpayes: CibleImpaye[] = useMemo(
    () =>
      abos
        .filter((a) => a.statut === "Impayé")
        .map((a) => ({
          abonnementId: a.id,
          entreprise: a.entreprise,
          email: a.email,
          montant: a.montant_mensuel,
          echeance: a.date_echeance,
        })),
    [abos],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return abos.filter((a) => {
      const matchQ =
        !q ||
        a.entreprise.toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q) ||
        (a.metier ?? "").toLowerCase().includes(q) ||
        (a.ville ?? "").toLowerCase().includes(q);
      const matchStatut = statutFilter === "Tous" || a.statut === statutFilter;
      const matchOffre = !offreFilter || a.offre === offreFilter;
      const matchEcheance = echeanceFilter === "" || (echeanceFilter === "7j" ? sous7jProche(a) : ceMoisProche(a));
      const matchEnRetard = !enRetardFilter || enRetard(a);
      const matchChange = !changeOffreFilter || (resumes[a.id]?.offres ?? 0) > 0;
      const matchTresVolatils = !tresVolatilsFilter || (resumes[a.id]?.offres6mois ?? 0) >= SEUIL_TRES_VOLATIL;
      const volatil = (resumes[a.id]?.offres6mois ?? 0) >= SEUIL_TRES_VOLATIL;
      const matchRecontact =
        recontactFilter === "" ||
        (recontactFilter === "a_recontacter"
          ? volatil && !derniersRecontacts[a.id]
          : volatil && !!derniersRecontacts[a.id]);
      return matchQ && matchStatut && matchOffre && matchEcheance && matchEnRetard && matchChange && matchTresVolatils && matchRecontact;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abos, query, statutFilter, offreFilter, echeanceFilter, enRetardFilter, changeOffreFilter, tresVolatilsFilter, recontactFilter, resumes, derniersRecontacts, today, limite7j, finDeMois]);

  const handleStatut = async (id: number, statut: string) => {
    try {
      await updateAbonnementStatut(id, statut);
      setAbos((prev) => prev.map((a) => (a.id === id ? { ...a, statut } : a)));
      setToast(`Statut mis à jour : ${statut}`);
    } catch {
      setToast("La mise à jour du statut a échoué.");
    }
  };

  const handleOffre = async (id: number, offre: string) => {
    try {
      await updateAbonnementOffre(id, offre);
      setAbos((prev) => prev.map((a) => (a.id === id ? { ...a, offre, montant_mensuel: OFFRE_PRIX[offre] ?? a.montant_mensuel } : a)));
      setToast(`Offre changée : ${offre}`);
    } catch {
      setToast("Le changement d'offre a échoué.");
    }
  };

  // Enregistre le délai localement (immédiat) et le mémorise côté Backend (récap hebdo).
  const handleDelai = (d: number) => {
    ecrireDelaiRappelRecontact(d);
    if (user) enregistrerDelaiRappelRecontactBackend(user.id, d);
  };

  // Active/désactive le récap hebdomadaire (local immédiat + mémorisé côté Backend).
  const handleRecapHebdo = (value: boolean) => {
    ecrireRecapHebdoActif(value);
    if (user) enregistrerRecapHebdoActifBackend(user.id, value);
  };

  // Règle le jour d'envoi du récap (local immédiat + mémorisé côté Backend).
  const handleRecapJour = (j: number) => {
    ecrireRecapJour(j);
    setRecapJour(j);
    if (user) enregistrerCadenceRecapBackend(user.id, j, recapHeure);
  };

  // Règle l'heure d'envoi du récap (local immédiat + mémorisé côté Backend).
  const handleRecapHeure = (h: number) => {
    ecrireRecapHeure(h);
    setRecapHeure(h);
    if (user) enregistrerCadenceRecapBackend(user.id, recapJour, h);
  };

  // Règle le seuil d'alerte du taux de recontact après récap (local + Backend).
  const handleTauxAlerte = (s: number) => {
    ecrireTauxAlerteRecap(s);
    setTauxAlerteRecap(s);
    if (user) enregistrerTauxAlerteRecapBackend(user.id, s);
  };

  // Règle la plage de dates de l'historique des récaps (local immédiat + Backend), pour la retrouver à la prochaine visite.
  const handlePeriodeHisto = (p: RecapHistoPeriode) => {
    ecrireRecapHistoPeriode(p);
    setPeriodeHistoRecap(p);
    if (user) enregistrerRecapHistoPeriodeBackend(user.id, p);
  };

  // Règle la fenêtre (en mois) du mini-graphe des alertes (local immédiat + Backend), comme le filtre de période de la liste.
  const handleAlertesGrapheMois = (mois: number) => {
    ecrireRecapAlertesGrapheMois(mois);
    setAlertesGrapheMois(mois);
    if (user) enregistrerRecapAlertesGrapheMoisBackend(user.id, mois);
  };

  // Règle le délai d'auto-relance des oubliés (local immédiat + mémorisé côté Backend).
  const handleOubliesAuto = (jours: number) => {
    ecrireRecapOubliesAutoJours(jours);
    setRecapOubliesAutoJours(jours);
    if (user) enregistrerRecapOubliesAutoJoursBackend(user.id, jours);
  };

  // Active/coupe l'alerte email à l'artisan quand l'auto-relance des oubliés part (local + Backend).
  const handleOubliesAlerteEmail = (actif: boolean) => {
    ecrireRecapOubliesAlerteEmail(actif);
    setRecapOubliesAlerteEmail(actif);
    if (user) enregistrerRecapOubliesAlerteEmailBackend(user.id, actif);
  };

  // Déclenche un envoi de test immédiat du récap, journalisé dans l'historique.
  const handleEnvoyerRecapMaintenant = async () => {
    if (!user) return;
    setEnvoiRecapEnCours(true);
    try {
      const res = await declencherRecapHebdoMaintenant(user.id);
      await recapHistorique.reload();
      setToast(
        res.envoye
          ? "Récap envoyé et ajouté à l'historique"
          : "Test enregistré dans l'historique (Resend non configuré : aucun email envoyé)",
      );
    } catch {
      setToast("L'envoi du récap a échoué. Réessayez.");
    } finally {
      setEnvoiRecapEnCours(false);
    }
  };

  // Prochaine date d'envoi selon la cadence réglée (jour de la semaine + heure).
  const heureRecapLabel = `${String(recapHeure).padStart(2, "0")}:00`;
  const prochainRecap = useMemo(() => prochainRecapHebdo(recapJour, recapHeure), [recapJour, recapHeure]);
  const prochainRecapLabel = useMemo(() => {
    if (!recapHebdoActif) return "Récap hebdo en pause";
    return `Prochain récap : ${formatShortDate(toISODate(prochainRecap))} à ${heureRecapLabel}`;
  }, [recapHebdoActif, prochainRecap, heureRecapLabel]);

  // Libellé compact affiché dans le badge d'en-tête de la page.
  const badgeDateLabel = useMemo(() => {
    if (!recapHebdoActif) return "Prochain envoi suspendu";
    return `Prochain : ${formatShortDate(toISODate(prochainRecap))} · ${heureRecapLabel}`;
  }, [recapHebdoActif, prochainRecap, heureRecapLabel]);

  // Les 3 prochains créneaux d'envoi prévus selon la cadence réglée (jour + heure).
  const prochainsLabels = useMemo(
    () =>
      prochainsRecapsHebdo(recapJour, recapHeure, 3).map(
        (d) => `${formatShortDate(toISODate(d))} · ${heureRecapLabel}`,
      ),
    [recapJour, recapHeure, heureRecapLabel],
  );

  const handleCreate = async (payload: AbonnementPayload) => {
    setBusy(true);
    try {
      await createAbonnement(payload);
      setFormOpen(false);
      await load();
      setToast(`Abonnement « ${payload.entreprise} » enregistré`);
    } catch {
      setToast("L'enregistrement de l'abonnement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = () => {
    downloadCsv(`abonnements-artiflow-${todayISO()}.csv`, csvAbonnements(filtered, derniersRecontacts, recontactesCeMois.ids));
  };

  const handleExportJournalCsv = () => {
    if (tousRecontacts.length === 0) {
      setToast("Aucun recontact à exporter pour l'instant.");
      return;
    }
    downloadCsv(`journal-recontacts-artiflow-${todayISO()}.csv`, csvJournal(tousRecontacts));
  };

  // Export de préparation des prélèvements du mois, sur le tableau affiché (filtres actifs).
  const handleExportSepa = () => {
    if (filtered.length === 0) {
      setToast("Aucun abonnement à exporter pour l'instant.");
      return;
    }
    downloadCsv(`prelevements-sepa-artiflow-${todayISO()}.csv`, csvPrelevementsSepa(filtered));
  };

  const handleExportTout = async () => {
    if (filtered.length === 0 && tousRecontacts.length === 0) {
      setToast("Aucune donnée à exporter pour l'instant.");
      return;
    }
    setExportingZip(true);
    try {
      await downloadZip(`export-abonnements-artiflow-${todayISO()}.zip`, [
        { name: `abonnements-filtres-${todayISO()}.csv`, content: csvAbonnements(filtered, derniersRecontacts, recontactesCeMois.ids) },
        { name: `journal-recontacts-${todayISO()}.csv`, content: csvJournal(tousRecontacts) },
      ]);
      setToast("Export complet généré (ZIP)");
    } catch {
      setToast("L'export ZIP a échoué. Réessayez.");
    } finally {
      setExportingZip(false);
    }
  };

  // Libellé humain du filtre actif, repris en en-tête du PDF d'archive.
  const filtreLabelActuel = useMemo(() => {
    const parts: string[] = [];
    if (query.trim()) parts.push(`Recherche : « ${query.trim()} »`);
    if (statutFilter !== "Tous") parts.push(`Statut : ${statutFilter}`);
    if (offreFilter) parts.push(`Offre : ${offreFilter}`);
    if (echeanceFilter === "7j") parts.push("Échéances sous 7 j");
    if (echeanceFilter === "mois") parts.push("Échéances ce mois-ci");
    if (enRetardFilter) parts.push("En retard");
    if (changeOffreFilter) parts.push("A changé d'offre");
    if (tresVolatilsFilter) parts.push(`Très volatils (${SEUIL_TRES_VOLATIL}+ en 6 mois)`);
    if (recontactFilter === "a_recontacter") parts.push("À recontacter");
    if (recontactFilter === "deja") parts.push("Déjà recontactés");
    return parts.length ? parts.join(" · ") : "Tout le parc";
  }, [query, statutFilter, offreFilter, echeanceFilter, enRetardFilter, changeOffreFilter, tresVolatilsFilter, recontactFilter]);

  /**
   * Génère un PDF d'archive pour un sous-ensemble donné d'abonnements
   * (utilisé par l'export complet et par les exports ciblés : résiliés, impayés, offre).
   */
  const exportSubset = async (subset: AbonnementItem[], filtreLabel: string, suffix: string) => {
    if (subset.length === 0) {
      setToast("Aucun abonnement à exporter pour ce filtre.");
      return;
    }
    setExportingPdf(true);
    try {
      const doc = await buildAbonnementsArchivePdf({
        kpis: { actifs, mrr, essais, impayes, manqueImpayes, resilies, parc: abos.length },
        repartition: repartitionOffres(subset),
        mrrEvolution: evolutionMrr(subset).map((m) => ({ label: m.label, mrr: m.mrr })),
        abonnements: subset.map((a) => ({
          entreprise: a.entreprise,
          email: a.email,
          metier: a.metier,
          ville: a.ville,
          offre: a.offre,
          statut: a.statut,
          montant_mensuel: a.montant_mensuel,
          date_echeance: a.date_echeance ? formatShortDate(a.date_echeance) : null,
        })),
        filtreLabel,
      });
      savePdf(doc, `abonnements-artiflow-${suffix}-${todayISO()}.pdf`);
    } catch {
      setToast("L'export PDF a échoué. Réessayez.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportPdf = () => exportSubset(filtered, filtreLabelActuel, "complet");

  const handleExportStatut = (statut: string, suffix: string) =>
    exportSubset(abos.filter((a) => a.statut === statut), `Statut : ${statut}`, suffix);

  const handleExportOffre = (offre: string) =>
    exportSubset(abos.filter((a) => a.offre === offre), `Offre : ${offre}`, `offre-${offre.toLowerCase()}`);

  const selectCls =
    "h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-700 outline-none focus:border-primary-400 cursor-pointer";

  return (
    <DataState loading={loading} error={error} onRetry={load}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-money-euro-circle-line text-xl"></i>
            </span>
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground-950">Suivi des abonnements</h2>
              <p className="text-xs text-foreground-500">
                {abos.length} abonnements suivis · MRR {formatEuros(mrr)}
              </p>
            </div>
          </div>
          <RecapHebdoBadge
            actif={recapHebdoActif}
            dateLabel={badgeDateLabel}
            prochains={recapHebdoActif ? prochainsLabels : []}
            onOpen={() =>
              document.getElementById("reglages-recap-hebdo")?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          />
        </div>
        <RappelRecontactVolatils
          items={aRappeler}
          delaiJours={delaiRappel}
          dejaRecontactesDepuisRappel={recontactesDepuisRappel}
          nbTraites={nbDejaRecontactes}
          nbVolatils={nbDejaRecontactes + nbARecontacter}
          onVoirARecontacter={() => {
            setRecontactFilter("a_recontacter");
            document.getElementById("liste-abonnements")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onContacterTous={() => setRappelTousOpen(true)}
        />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <RechercheRepliable
              carteId="abonnements"
              carteLabel="Abonnements"
              value={query}
              onChange={setQuery}
              placeholder="Rechercher un artisan abonné…"
              conteneurClassName="w-full sm:w-72"
            />
            <div className="relative">
              <i className="ri-stack-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
              <select
                value={offreFilter}
                onChange={(e) => setOffreFilter(e.target.value)}
                className="h-10 pl-9 pr-9 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
                aria-label="Filtrer par offre"
              >
                <option value="">Toutes les offres</option>
                {OFFRES.map((o) => (
                  <option key={o} value={o}>
                    {o} ({countByOffre(o)})
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
            </div>
            <button
              type="button"
              onClick={() => setEcheanceFilter((f) => (f === "7j" ? "" : "7j"))}
              aria-pressed={echeanceFilter === "7j"}
              title="Afficher uniquement les abonnements dont l'échéance tombe dans les 7 prochains jours"
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                echeanceFilter === "7j"
                  ? "bg-accent-500 border-accent-500 text-background-50"
                  : "bg-background-100 border-background-200 text-foreground-700 hover:border-accent-300"
              }`}
            >
              <i className="ri-calendar-check-line"></i>
              Échéances sous 7 j
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  echeanceFilter === "7j" ? "bg-background-50/25 text-background-50" : "bg-accent-100 text-accent-800"
                }`}
              >
                {nbSous7j}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEnRetardFilter((f) => !f)}
              aria-pressed={enRetardFilter}
              title="Isoler d'un clic les abonnements échus (échéance passée et compte non résilié)"
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                enRetardFilter
                  ? "bg-red-500 border-red-500 text-background-50"
                  : "bg-background-100 border-background-200 text-foreground-700 hover:border-red-300"
              }`}
            >
              <i className="ri-alarm-warning-line"></i>
              En retard
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  enRetardFilter ? "bg-background-50/25 text-background-50" : "bg-red-100 text-red-700"
                }`}
              >
                {nbEnRetard}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setChangeOffreFilter((f) => !f)}
              aria-pressed={changeOffreFilter}
              title="Isoler uniquement les artisans ayant déjà changé d'offre"
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                changeOffreFilter
                  ? "bg-accent-500 border-accent-500 text-background-50"
                  : "bg-background-100 border-background-200 text-foreground-700 hover:border-accent-300"
              }`}
            >
              <i className="ri-swap-box-line"></i>
              A changé d'offre
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  changeOffreFilter ? "bg-background-50/25 text-background-50" : "bg-accent-100 text-accent-800"
                }`}
              >
                {nbChangeOffre}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTresVolatilsFilter((f) => !f)}
              aria-pressed={tresVolatilsFilter}
              title={`Isoler uniquement les artisans ayant changé d'offre au moins ${SEUIL_TRES_VOLATIL} fois sur les 6 derniers mois`}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tresVolatilsFilter
                  ? "bg-accent-500 border-accent-500 text-background-50"
                  : "bg-background-100 border-background-200 text-foreground-700 hover:border-accent-300"
              }`}
            >
              <i className="ri-fire-line"></i>
              Très volatils ({SEUIL_TRES_VOLATIL}+ en 6 mois)
              <span
                className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                  tresVolatilsFilter ? "bg-background-50/25 text-background-50" : "bg-accent-100 text-accent-800"
                }`}
              >
                {nbTresVolatils}
              </span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              <strong className="text-foreground-900">{abos.length}</strong> abonnements
            </span>
            <button
              type="button"
              onClick={handleExportTout}
              disabled={exportingZip || (filtered.length === 0 && tousRecontacts.length === 0)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter en un ZIP le CSV des abonnements filtrés et le journal des recontacts"
            >
              {exportingZip ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-zip-line"></i>}
              Tout exporter
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter les abonnements affichés au format CSV"
            >
              <i className="ri-file-excel-2-line"></i>
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || abos.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter un PDF d'archive : indicateurs, graphes et abonnements affichés"
            >
              {exportingPdf ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
              Exporter PDF
            </button>
            <button
              type="button"
              onClick={() => setRelanceImpayesOpen(true)}
              disabled={impayes === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-red-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Envoyer un email de rappel de paiement aux abonnements en retard"
            >
              <i className="ri-mail-send-line"></i>
              Relancer les impayés
              {impayes > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-background-50/25 text-background-50 text-[10px] font-bold">
                  {impayes}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i>
              Nouvel abonnement
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-user-follow-line text-accent-600"></i> Abonnés actifs
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{actifs}</span>
            <span className="text-[11px] text-foreground-500">{essais} en essai</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-timer-line text-secondary-600"></i> Essais
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{essais}</span>
            <span className="text-[11px] text-foreground-500">comptes en période d'essai</span>
            {nbEssaisFinAujourdhui > 0 && (
              <span className="text-[11px] font-semibold text-accent-700">
                {formatEuros(montantEssaisFinAujourdhui)} à convertir demain
              </span>
            )}
            <span
              className={`mt-auto inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap self-start ${
                nbEssaisFinAujourdhui > 0 ? "bg-accent-500 text-background-50" : "bg-background-200 text-foreground-600"
              }`}
              title="Essais dont la fin tombe aujourd'hui : premier prélèvement demain"
            >
              <i className={nbEssaisFinAujourdhui > 0 ? "ri-alarm-warning-line" : "ri-checkbox-circle-line"}></i>
              {nbEssaisFinAujourdhui} se termine{nbEssaisFinAujourdhui > 1 ? "nt" : ""} aujourd'hui
            </span>
            <span
              className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap self-start ${
                nbEssaisFinDemain > 0 ? "bg-secondary-100 text-secondary-800" : "bg-background-200 text-foreground-600"
              }`}
              title="Essais dont la fin tombe demain : à anticiper dès maintenant"
            >
              <i className={nbEssaisFinDemain > 0 ? "ri-calendar-event-line" : "ri-checkbox-circle-line"}></i>
              {nbEssaisFinDemain} se termine{nbEssaisFinDemain > 1 ? "nt" : ""} demain
            </span>
            {nbEssaisFinDemain > 0 && (
              <span className="text-[11px] font-semibold text-secondary-700">
                {formatEuros(montantEssaisFinDemain)} à convertir demain
              </span>
            )}
            {nbEssaisFinAujourdhui > 0 && (
              <button
                type="button"
                onClick={() => setRelanceEssaisOpen(true)}
                title="Envoyer un email de dernière chance aux essais se terminant aujourd'hui"
                className="mt-1.5 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
              >
                <i className="ri-mail-send-line"></i>
                Relancer les essais
              </button>
            )}
            {nbEssaisFinDemain > 0 && (
              <button
                type="button"
                onClick={() => setRelanceEssaisDemainOpen(true)}
                title="Envoyer un email préventif aux essais se terminant demain"
                className="mt-1.5 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              >
                <i className="ri-calendar-event-line"></i>
                Relancer ceux de demain
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-line-chart-line text-primary-600"></i> MRR
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{formatEuros(mrr)}</span>
            <span className="text-[11px] text-foreground-500">revenu récurrent mensuel</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-error-warning-line text-red-500"></i> Impayés
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{impayes}</span>
            <span className="text-[11px] text-foreground-500">{formatEuros(manqueImpayes)} à recouvrer</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-links-line text-secondary-600"></i> Résiliés
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{resilies}</span>
            <span className="text-[11px] text-foreground-500">
              {abos.length > 0 ? `${Math.round((resilies / abos.length) * 100)} % du parc` : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-mail-check-line text-accent-600"></i> Recontactés ce mois-ci
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{recontactesCeMois.comptes}</span>
            <span className="text-[11px] text-foreground-500">
              {recontactesCeMois.total} email{recontactesCeMois.total > 1 ? "s" : ""} de recontact
            </span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-robot-2-line text-accent-600"></i> Oubliés auto-relancés
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{autoRelancesCeMois.comptes}</span>
            <span className="text-[11px] text-foreground-500">
              {autoRelancesCeMois.total} relance{autoRelancesCeMois.total > 1 ? "s" : ""} automatique
              {autoRelancesCeMois.total > 1 ? "s" : ""} ce mois-ci
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEcheanceFilter((f) => (f === "mois" ? "" : "mois"))}
            aria-pressed={echeanceFilter === "mois"}
            title="Afficher les abonnements dont l'échéance tombe ce mois-ci"
            className={`flex flex-col gap-1 p-4 rounded-lg border text-left cursor-pointer transition-colors ${
              echeanceFilter === "mois"
                ? "bg-accent-500 border-accent-500"
                : "bg-background-100 border-background-200 hover:border-accent-300"
            }`}
          >
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                echeanceFilter === "mois" ? "text-background-50/90" : "text-foreground-500"
              }`}
            >
              <i className={`ri-calendar-event-line ${echeanceFilter === "mois" ? "text-background-50" : "text-accent-600"}`}></i>
              Renouvellements
            </span>
            <span
              className={`font-heading font-bold text-2xl ${echeanceFilter === "mois" ? "text-background-50" : "text-foreground-950"}`}
            >
              {nbCeMois}
            </span>
            <span className={`text-[11px] ${echeanceFilter === "mois" ? "text-background-50/80" : "text-foreground-500"}`}>
              ce mois-ci · voir les échéances
            </span>
          </button>
        </div>

        <AbonnementsCharts abos={abos} onOffreClick={handleExportOffre} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ChangementsOffreParMoisCard />
          <ArtisansVolatilsCard
            abos={abos}
            resumes={resumes}
            onComparer={(ancienne, nouvelle, abonnementId) => setComparer({ a: ancienne, b: nouvelle, abonnementId })}
            onRecontactEnvoye={reloadRecontacts}
          />
        </div>

        <EvolutionMrrHistoriqueCard />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-file-pdf-2-line text-foreground-400"></i> Exports ciblés
          </span>
          <button
            type="button"
            onClick={() => handleExportStatut("Résilié", "resilies")}
            disabled={exportingPdf || resilies === 0}
            title="Exporter uniquement les abonnements résiliés en PDF"
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-links-line text-secondary-600"></i>
            Résiliés
            <span className="text-foreground-400">{resilies}</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportStatut("Impayé", "impayes")}
            disabled={exportingPdf || impayes === 0}
            title="Exporter uniquement les abonnements impayés en PDF"
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-error-warning-line text-red-500"></i>
            Impayés
            <span className="text-foreground-400">{impayes}</span>
          </button>
          <button
            type="button"
            onClick={handleExportJournalCsv}
            disabled={tousRecontacts.length === 0}
            title="Exporter le journal complet des recontacts (date, destinataire, sujet, statut) au format CSV"
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-mail-download-line text-accent-600"></i>
            Journal recontacts
            <span className="text-foreground-400">{tousRecontacts.length}</span>
          </button>
          <button
            type="button"
            onClick={handleExportSepa}
            disabled={filtered.length === 0}
            title="Exporter les abonnements affichés (filtres actifs) au format prélèvement SEPA : IBAN, mandat, montant et échéance"
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-bank-line text-primary-600"></i>
            Prélèvements SEPA
            <span className="text-foreground-400">{filtered.length}</span>
          </button>
          <span className="text-[11px] text-foreground-400">
            Astuce : cliquez une ligne d'offre dans le graphe « Répartition des offres » pour l'exporter seule.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            {["Tous", ...STATUTS_ABO].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatutFilter(s)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  statutFilter === s ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {s}
                {s !== "Tous" && (
                  <span className={statutFilter === s ? "text-background-50/80" : "text-foreground-400"}>{countByStatut(s)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-customer-service-2-line text-accent-600"></i>
            Suivi des recontacts
          </span>
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            {recontactOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRecontactFilter(opt.key)}
                aria-pressed={recontactFilter === opt.key}
                title="Isoler les comptes volatils déjà recontactés ou encore à traiter"
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  recontactFilter === opt.key
                    ? "bg-accent-500 text-background-50"
                    : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {opt.label}
                {opt.count !== null && (
                  <span className={recontactFilter === opt.key ? "text-background-50/80" : "text-foreground-400"}>
                    {opt.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1 whitespace-nowrap">
              <i className="ri-timer-line"></i>
              Rappel après
            </span>
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
              {DELAIS_RECONTACT.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDelai(d)}
                  aria-pressed={delaiRappel === d}
                  title={`Rappeler les comptes très volatils à recontacter ${d} jours après leur dernier changement d'offre`}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    delaiRappel === d ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {d} j
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          id="reglages-recap-hebdo"
          className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-background-100 border border-background-200 scroll-mt-20"
        >
          <button
            type="button"
            role="switch"
            aria-checked={recapHebdoActif}
            onClick={() => handleRecapHebdo(!recapHebdoActif)}
            title="Envoyer chaque semaine par email un récapitulatif des comptes très volatils à recontacter"
            className={`relative w-10 h-6 shrink-0 rounded-full transition-colors cursor-pointer ${recapHebdoActif ? "bg-accent-500" : "bg-background-300"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${
                recapHebdoActif ? "translate-x-4" : ""
              }`}
            />
          </button>
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-900 whitespace-nowrap">
              <i className="ri-mail-send-line text-accent-600"></i>
              Récap hebdo activé
            </span>
            <span className={`text-[11px] font-medium ${recapHebdoActif ? "text-foreground-500" : "text-red-600"}`}>
              {recapHebdoActif
                ? "Un email récapitulatif part chaque semaine aux comptes concernés"
                : "Envoi automatique désactivé"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-3 border-l border-background-200">
            <span className="text-[11px] font-medium text-foreground-500 inline-flex items-center gap-1 whitespace-nowrap">
              <i className="ri-calendar-line text-accent-600"></i>
              Envoi le
            </span>
            <select
              value={recapJour}
              onChange={(e) => handleRecapJour(Number(e.target.value))}
              className={selectCls}
              aria-label="Jour d'envoi du récap hebdomadaire"
              title="Choisir le jour d'envoi hebdomadaire du récap"
            >
              {RECAP_JOURS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
            <select
              value={recapHeure}
              onChange={(e) => handleRecapHeure(Number(e.target.value))}
              className={selectCls}
              aria-label="Heure d'envoi du récap hebdomadaire"
              title="Choisir l'heure d'envoi du récap"
            >
              {RECAP_HEURES.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-3 border-l border-background-200">
            <span className="text-[11px] font-medium text-foreground-500 inline-flex items-center gap-1 whitespace-nowrap">
              <i className="ri-robot-2-line text-accent-600"></i>
              Relancer les oubliés
            </span>
            <select
              value={recapOubliesAutoJours}
              onChange={(e) => handleOubliesAuto(Number(e.target.value))}
              className={selectCls}
              aria-label="Délai d'auto-relance des comptes oubliés après un récap"
              title="Relancer automatiquement les comptes oubliés après ce délai (0 = jamais) ; la tâche planifiée applique ce réglage"
            >
              {RECAP_OUBLIES_AUTO_JOURS.map((j) => (
                <option key={j} value={j}>
                  {libelleOubliesAutoJours(j)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-3 border-l border-background-200">
            <button
              type="button"
              role="switch"
              aria-checked={recapOubliesAlerteEmail}
              onClick={() => handleOubliesAlerteEmail(!recapOubliesAlerteEmail)}
              title="Recevoir un email quand l'auto-relance des oubliés a réellement expédié des relances"
              className={`relative w-10 h-6 shrink-0 rounded-full transition-colors cursor-pointer ${
                recapOubliesAlerteEmail ? "bg-accent-500" : "bg-background-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${
                  recapOubliesAlerteEmail ? "translate-x-4" : ""
                }`}
              />
            </button>
            <span className="text-[11px] font-medium text-foreground-500 inline-flex items-center gap-1 whitespace-nowrap">
              <i className="ri-notification-3-line text-accent-600"></i>
              M'alerter quand des oubliés partent
            </span>
          </div>
          <button
            type="button"
            onClick={() => setApercuRecapOpen(true)}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
            title="Voir le rendu exact de l'email de récap hebdomadaire (aucun envoi n'est effectué)"
          >
            <i className="ri-eye-line"></i>
            Aperçu de l'email
          </button>
          <button
            type="button"
            onClick={handleEnvoyerRecapMaintenant}
            disabled={envoiRecapEnCours || !user}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Déclencher tout de suite un envoi du récap hebdomadaire et le voir apparaître dans l'historique"
          >
            {envoiRecapEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
            Envoyer un récap maintenant
          </button>
          <span
            className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
              recapHebdoActif
                ? "bg-background-50 border-background-200 text-foreground-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
            title="Date estimée du prochain récap hebdomadaire, d'après le dernier envoi automatique"
          >
            <i className={`ri-calendar-schedule-line ${recapHebdoActif ? "text-accent-600" : "text-red-500"}`}></i>
            {prochainRecapLabel}
          </span>
        </div>

        <HistoriqueRecapHebdoCard
          items={recapHistorique.items}
          abos={abos}
          recontacts={tousRecontacts}
          seuilAlerte={tauxAlerteRecap}
          onSeuilChange={handleTauxAlerte}
          periode={periodeHistoRecap}
          onPeriodeChange={handlePeriodeHisto}
          loading={recapHistorique.loading}
          error={recapHistorique.error}
          onReload={recapHistorique.reload}
          onRecontactSent={reloadRecontacts}
        />

        <HistoriqueAlertesAutoRelanceCard
          items={alertesAuto.items}
          loading={alertesAuto.loading}
          error={alertesAuto.error}
          onReload={alertesAuto.reload}
          userId={user?.id ?? null}
          alertePersonnalisee={!!((profile?.email_sujet_alerte_artisan ?? "").trim() || (profile?.email_corps_alerte_artisan ?? "").trim())}
          moisAffiches={alertesGrapheMois}
          onMoisAffichesChange={handleAlertesGrapheMois}
        />

        <div id="liste-abonnements" className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-3 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
            <span className="col-span-3">Artisan / entreprise</span>
            <span className="col-span-2">Offre</span>
            <span className="col-span-2">Statut</span>
            <span className="col-span-2 text-right">MRR</span>
            <span className="col-span-2">Prochaine échéance</span>
            <span className="col-span-1 text-right">Paiement</span>
          </div>
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-foreground-500">Aucun abonnement ne correspond à votre recherche.</p>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 px-5 py-4 border-t border-background-200 hover:bg-background-50 transition-colors"
              >
                <div className="lg:col-span-3 flex items-start gap-3 min-w-0">
                  <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                    <i className="ri-store-2-line"></i>
                  </span>
                  <div className="min-w-0">
                    <span className="lg:hidden block text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mb-0.5">
                      Artisan
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold text-foreground-950 truncate">{a.entreprise}</p>
                      {(resumes[a.id]?.offres6mois ?? 0) >= SEUIL_TRES_VOLATIL && (
                        <span
                          className="shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap"
                          title={`${resumes[a.id]?.offres6mois ?? 0} changements d'offre sur les 6 derniers mois — à recontacter`}
                        >
                          <i className="ri-fire-line text-[10px]"></i>
                          Très volatil
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground-500 truncate">
                      {a.metier ?? "Métier non renseigné"}
                      {a.ville ? ` · ${a.ville}` : ""} · {a.email ?? "—"}
                    </p>
                    {derniersRecontacts[a.id] ? (
                      <div className="mt-1.5">
                        <span
                          className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap"
                          title={`Dernier recontact le ${formatShortDate(derniersRecontacts[a.id].created_at)}`}
                        >
                          <i className="ri-mail-check-line"></i>
                          Recontacté le {formatShortDate(derniersRecontacts[a.id].created_at)}
                        </span>
                      </div>
                    ) : (resumes[a.id]?.offres6mois ?? 0) >= SEUIL_TRES_VOLATIL ? (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap">
                          <i className="ri-mail-add-line"></i>
                          À recontacter
                        </span>
                      </div>
                    ) : null}
                    <CompteurChangementsOffre
                      resume={resumes[a.id]}
                      onComparer={(ancienne, nouvelle, abonnementId) =>
                        ancienne && nouvelle && setComparer({ a: ancienne, b: nouvelle, abonnementId })
                      }
                    />
                  </div>
                </div>
                <div className="lg:col-span-2 flex items-center">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5 shrink-0">
                    Offre
                  </span>
                  <select
                    value={a.offre}
                    onChange={(e) => handleOffre(a.id, e.target.value)}
                    className={selectCls}
                    title="Changer l'offre de cet artisan"
                  >
                    {OFFRES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <span className={`ml-2 hidden xl:inline-flex items-center h-6 px-2 rounded-full text-[10px] font-bold ${offreTone(a.offre)}`}>
                    {a.offre}
                  </span>
                </div>
                <div className="lg:col-span-2 flex items-center gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5 shrink-0">
                    Statut
                  </span>
                  <select
                    value={a.statut}
                    onChange={(e) => handleStatut(a.id, e.target.value)}
                    className={selectCls}
                    title="Changer le statut de l'abonnement"
                  >
                    {STATUTS_ABO.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span className={`hidden xl:inline-flex items-center h-6 px-2 rounded-full text-[10px] font-bold ${statutTone(a.statut)}`}>
                    {a.statut}
                  </span>
                </div>
                <div className="lg:col-span-2 lg:text-right text-sm font-semibold text-foreground-950">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    MRR
                  </span>
                  {a.montant_mensuel > 0 ? `${formatEuros(a.montant_mensuel)}/mois` : "—"}
                </div>
                <div className="lg:col-span-2 flex items-center gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5 shrink-0">
                    Échéance
                  </span>
                  <span className="text-sm text-foreground-700">
                    {a.date_echeance ? formatShortDate(a.date_echeance) : "—"}
                  </span>
                  {enRetard(a) && (
                    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-red-100 text-red-700 text-[10px] font-bold whitespace-nowrap">
                      <i className="ri-alarm-warning-line text-[10px]"></i>
                      En retard
                    </span>
                  )}
                </div>
                <div className="lg:col-span-1 lg:text-right">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Paiement
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
                    <i className={a.canal_paiement === "Carte" ? "ri-bank-card-line" : "ri-bank-line"}></i>
                    {a.canal_paiement ?? "—"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-[11px] text-foreground-400">
          Vue back-office : {abos.length} abonnements suivis · {OFFRES.map((o) => `${countByOffre(o)} ${o}`).join(" · ")}
        </p>

        {formOpen && <AbonnementFormModal busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />}
        {apercuRecapOpen && user && (
          <ApercuRecapHebdoModal userId={user.id} onClose={() => setApercuRecapOpen(false)} />
        )}
        {rappelTousOpen && (
          <RecontacterTousModal
            cibles={ciblesRappel}
            seuilLabel={`${SEUIL_TRES_VOLATIL}+ en 6 mois`}
            onClose={() => setRappelTousOpen(false)}
            onSent={reloadRecontacts}
          />
        )}
        {relanceImpayesOpen && (
          <RelancerImpayesModal
            cibles={ciblesImpayes}
            onClose={() => setRelanceImpayesOpen(false)}
            onSent={reloadRecontacts}
          />
        )}
        {relanceEssaisOpen && (
          <RelancerEssaisFinJourModal
            cibles={ciblesEssais}
            onClose={() => setRelanceEssaisOpen(false)}
            onSent={reloadRecontacts}
          />
        )}
        {relanceEssaisDemainOpen && (
          <RelancerEssaisFinJourModal
            mode="demain"
            cibles={ciblesEssaisDemain}
            onClose={() => setRelanceEssaisDemainOpen(false)}
            onSent={reloadRecontacts}
          />
        )}
        {comparer && (
          <ComparerOffresModal
            offreA={comparer.a}
            offreB={comparer.b}
            abonnementId={comparer.abonnementId}
            onClose={() => setComparer(null)}
          />
        )}
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </DataState>
  );
}