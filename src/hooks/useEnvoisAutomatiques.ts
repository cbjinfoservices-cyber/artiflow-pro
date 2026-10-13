import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useComptableMoisManquants } from "@/hooks/useComptableMoisManquants";
import { lireRecapHeure, lireRecapJour, prochainsRecapsHebdo } from "@/lib/recontactSeuil";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import {
  calculerStatut,
  executionsImminentes,
  FENETRE_IMMINENTE_MS,
  libelleEcheance,
  prochainAnnuel,
  prochainHebdo,
  prochainHoraire,
  prochainMensuel,
  prochainQuotidien,
  type AutoItem,
  type ExecutionImminente,
} from "@/lib/envoisAutomatiques";

/** Colonnes de profil utiles pour déduire l'état des automatisations. */
interface AutoProfile {
  recontact_rappel_hebdo_actif?: boolean | null;
  recontact_rappel_dernier_envoi?: string | null;
  recap_quotidien_actif?: boolean | null;
  recap_heure?: number | null;
  recap_dernier_envoi?: string | null;
  comptable_auto_actif?: boolean | null;
  comptable_auto_jour?: number | null;
  comptable_auto_heure?: number | null;
  comptable_auto_dernier_mois?: string | null;
  comptable_relance_manquante_actif?: boolean | null;
  comptable_relance_dernier_cle?: string | null;
  comptable_bilan_auto_actif?: boolean | null;
  comptable_bilan_jour?: number | null;
  comptable_bilan_dernier_annee?: string | null;
  relance_auto_actif?: boolean | null;
  pause_jusqu_au?: string | null;
  envois_auto_recap_hebdo_actif?: boolean | null;
  envois_auto_recap_hebdo_jour?: number | null;
  envois_auto_recap_hebdo_heure?: number | null;
  envois_auto_recap_hebdo_dernier_envoi?: string | null;
  taux_alerte_recap_hebdo_actif?: boolean | null;
  taux_alerte_recap_hebdo_jour?: number | null;
  taux_alerte_recap_hebdo_heure?: number | null;
  taux_alerte_recap_hebdo_dernier_envoi?: string | null;
  echecs_blanc_recap_hebdo_actif?: boolean | null;
  echecs_blanc_recap_hebdo_jour?: number | null;
  echecs_blanc_recap_hebdo_heure?: number | null;
  echecs_blanc_recap_hebdo_fenetre?: number | null;
  echecs_blanc_recap_hebdo_dernier_envoi?: string | null;
}

interface RecapRecontactRow {
  envoye_le: string | null;
  nb_comptes: number | null;
  origine: string | null;
}

interface EnvoiRow {
  type: string;
  mode: string | null;
  mois_cle: string | null;
  nb_lignes: number | null;
  created_at: string | null;
}

interface EscaladeRow {
  run_at: string | null;
  envoye: number | null;
  echoue: number | null;
}

interface RecapQuotidienRow {
  envoye_le: string | null;
}

interface AbonnementRow {
  rappel_prelevement_charge: string | null;
}

export interface EnvoisAutomatiquesResult {
  items: AutoItem[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Vrai si la pause vacances couvre la date du jour. */
function estEnPause(pauseJusquAu: string | null | undefined): boolean {
  if (!pauseJusquAu) return false;
  return String(pauseJusquAu).slice(0, 10) >= new Date().toISOString().slice(0, 10);
}

/**
 * Assemble l'état de toutes les automatisations d'envoi à partir des traces déjà
 * enregistrées en base (récaps, envois comptables, journal d'escalade, rappels de
 * prélèvement) et des réglages mémorisés sur le profil. Aucune donnée n'est inventée :
 * un passage qui ne laisse pas de trace est signalé comme tel.
 */
export async function chargerEnvoisAutomatiques(userId: string, moisManquants: number): Promise<AutoItem[]> {
  const [profRes, recapRes, envoisRes, escaladeRes, recapQuotRes, aboRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "recontact_rappel_hebdo_actif, recontact_rappel_dernier_envoi, recap_quotidien_actif, recap_heure, recap_dernier_envoi, comptable_auto_actif, comptable_auto_jour, comptable_auto_heure, comptable_auto_dernier_mois, comptable_relance_manquante_actif, comptable_relance_dernier_cle, comptable_bilan_auto_actif, comptable_bilan_jour, comptable_bilan_dernier_annee, relance_auto_actif, pause_jusqu_au, envois_auto_recap_hebdo_actif, envois_auto_recap_hebdo_jour, envois_auto_recap_hebdo_heure, envois_auto_recap_hebdo_dernier_envoi, taux_alerte_recap_hebdo_actif, taux_alerte_recap_hebdo_jour, taux_alerte_recap_hebdo_heure, taux_alerte_recap_hebdo_dernier_envoi, echecs_blanc_recap_hebdo_actif, echecs_blanc_recap_hebdo_jour, echecs_blanc_recap_hebdo_heure, echecs_blanc_recap_hebdo_fenetre, echecs_blanc_recap_hebdo_dernier_envoi",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("recap_recontact_envois")
      .select("envoye_le, nb_comptes, origine")
      .order("envoye_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("envois_email")
      .select("type, mode, mois_cle, nb_lignes, created_at")
      .in("type", ["comptable", "comptable_bilan"])
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("escalade_journal")
      .select("run_at, envoye, echoue")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("recap_envois")
      .select("envoye_le")
      .order("envoye_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("abonnements")
      .select("rappel_prelevement_charge")
      .eq("artisan_id", userId)
      .not("rappel_prelevement_charge", "is", null)
      .order("rappel_prelevement_charge", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Contrôle explicite des erreurs de requête : le client Backend ne « lève » pas d'exception
  // sur une colonne ou une table invalide, il renvoie `{ data: null, error }`. Sans ce contrôle,
  // un écran retomberait silencieusement sur des données vides. On remonte donc la première
  // erreur rencontrée (avec sa table) pour qu'elle soit visible et journalisée.
  const reponses: { table: string; error: unknown }[] = [
    { table: "profiles", error: profRes.error },
    { table: "recap_recontact_envois", error: recapRes.error },
    { table: "envois_email", error: envoisRes.error },
    { table: "escalade_journal", error: escaladeRes.error },
    { table: "recap_envois", error: recapQuotRes.error },
    { table: "abonnements", error: aboRes.error },
  ];
  const enErreur = reponses.find((r) => r.error);
  if (enErreur) {
    journaliserDepuisErreur({
      ecran: "Envois automatiques",
      source: enErreur.table,
      error: enErreur.error,
    });
    throw new Error(`[${enErreur.table}] chargement impossible`);
  }

  const p = (profRes.data ?? {}) as AutoProfile;
  const recap = (recapRes.data ?? null) as RecapRecontactRow | null;
  const envois = (envoisRes.data ?? []) as EnvoiRow[];
  const escaladeRun = (escaladeRes.data ?? null) as EscaladeRow | null;
  const recapQuot = (recapQuotRes.data ?? null) as RecapQuotidienRow | null;
  const abo = (aboRes.data ?? null) as AbonnementRow | null;

  const dernierJournal = envois.find((e) => e.type === "comptable") ?? null;
  const dernierBilan = envois.find((e) => e.type === "comptable_bilan") ?? null;
  const pause = estEnPause(p.pause_jusqu_au);

  const modeLabel = (mode: string | null) => (String(mode ?? "").toLowerCase() === "automatique" ? "automatique" : "manuel");
  const derniereDateHebdo = recap?.envoye_le ?? p.recontact_rappel_dernier_envoi ?? null;

  // Récap hebdomadaire des recontacts : la prochaine date suit le jour/heure réglés (préférences locales).
  let prochainHebdo: string | null = null;
  try {
    const liste = prochainsRecapsHebdo(lireRecapJour(), lireRecapHeure(), 1);
    prochainHebdo = liste[0] ? liste[0].toISOString() : null;
  } catch {
    prochainHebdo = null;
  }

  const recapHebdo: AutoItem = {
    id: "recap-hebdo",
    categorie: "recap",
    nom: "Récap hebdo des recontacts",
    description: "Liste chaque semaine les comptes très volatils à recontacter, et relance automatiquement les oubliés.",
    icone: "ri-mail-star-line",
    frequence: "Hebdomadaire (1×/semaine)",
    lien: "/app/abonnements",
    lienLabel: "Ouvrir Abonnements",
    actif: p.recontact_rappel_hebdo_actif !== false,
    enPause: pause,
    dernierPassage: derniereDateHebdo,
    dernierDetail: recap
      ? `${recap.nb_comptes ?? 0} compte(s) · origine ${recap.origine === "test" ? "test manuel" : "automatique"}`
      : null,
    prochaine: prochainHebdo,
    prochaineLibelle: prochainHebdo ? libelleEcheance(prochainHebdo) : "selon la cadence réglée",
    tracable: true,
    statut: calculerStatut({
      actif: p.recontact_rappel_hebdo_actif !== false,
      enPause: pause,
      tracable: true,
      dernierPassage: derniereDateHebdo,
      toleranceJours: 8,
    }),
    note: null,
  };

  // Alerte « mois comptable resté sans envoi » : passage quotidien, sans trace propre en base.
  const relanceManquanteActif = p.comptable_relance_manquante_actif === true;
  const alerteManquant: AutoItem = {
    id: "relance-manquant",
    categorie: "automatisation",
    nom: "Alerte mois comptable sans envoi",
    description: "Prévient par email quand un mois attendu est resté sans envoi automatique du journal comptable.",
    icone: "ri-calendar-close-line",
    frequence: "Quotidienne",
    lien: "/app/comptabilite",
    lienLabel: "Ouvrir Comptabilité",
    actif: relanceManquanteActif,
    enPause: pause,
    dernierPassage: null,
    dernierDetail: p.comptable_relance_dernier_cle ? `Dernier mois alerté : ${p.comptable_relance_dernier_cle}` : null,
    prochaine: null,
    prochaineLibelle: "chaque jour",
    tracable: false,
    statut: calculerStatut({
      actif: relanceManquanteActif,
      enPause: pause,
      tracable: false,
      dernierPassage: null,
      toleranceJours: 2,
      alertes: moisManquants,
    }),
    note:
      moisManquants > 0
        ? `${moisManquants} mois manquant(s) à régulariser actuellement.`
        : "Ce passage ne laisse pas de trace en base : seul le dernier mois alerté est mémorisé.",
  };

  // Envoi mensuel du journal comptable au comptable.
  const journalAuto = p.comptable_auto_actif === true;
  const prochainJournal = prochainMensuel(p.comptable_auto_jour ?? 1, p.comptable_auto_heure ?? 8);
  const journal: AutoItem = {
    id: "journal-mensuel",
    categorie: "automatisation",
    nom: "Journal comptable mensuel",
    description: "Envoie automatiquement au comptable le journal du mois écoulé (PDF complet en pièce jointe).",
    icone: "ri-file-chart-line",
    frequence: "Mensuelle",
    lien: "/app/comptabilite",
    lienLabel: "Ouvrir Comptabilité",
    actif: journalAuto,
    enPause: pause,
    dernierPassage: dernierJournal?.created_at ?? null,
    dernierDetail: dernierJournal
      ? `Mois ${dernierJournal.mois_cle ?? "—"} · ${dernierJournal.nb_lignes ?? 0} ligne(s) · ${modeLabel(dernierJournal.mode)}`
      : p.comptable_auto_dernier_mois
        ? `Dernier mois traité : ${p.comptable_auto_dernier_mois}`
        : null,
    prochaine: prochainJournal,
    prochaineLibelle: libelleEcheance(prochainJournal),
    tracable: true,
    statut: calculerStatut({
      actif: journalAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: dernierJournal?.created_at ?? null,
      toleranceJours: 35,
    }),
    note: journalAuto ? null : "Envoi mensuel non activé dans les réglages comptables.",
  };

  // Bilan d'archivage annuel.
  const bilanAuto = p.comptable_bilan_auto_actif === true;
  const prochainBilan = prochainAnnuel(p.comptable_bilan_jour ?? 5, 8);
  const bilan: AutoItem = {
    id: "bilan-annuel",
    categorie: "automatisation",
    nom: "Bilan d'archivage annuel",
    description: "Transmet en janvier au comptable l'historique complet des envois de l'exercice écoulé (PDF).",
    icone: "ri-archive-2-line",
    frequence: "Annuelle (en janvier)",
    lien: "/app/comptabilite",
    lienLabel: "Ouvrir Comptabilité",
    actif: bilanAuto,
    enPause: pause,
    dernierPassage: dernierBilan?.created_at ?? null,
    dernierDetail: p.comptable_bilan_dernier_annee
      ? `Dernier exercice archivé : ${p.comptable_bilan_dernier_annee}`
      : null,
    prochaine: prochainBilan,
    prochaineLibelle: libelleEcheance(prochainBilan),
    tracable: true,
    statut: calculerStatut({
      actif: bilanAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: dernierBilan?.created_at ?? null,
      toleranceJours: 400,
    }),
    note: bilanAuto ? null : "Bilan annuel non activé dans les réglages comptables.",
  };

  // Rappel « J-3 avant prélèvement » (piloté par Stripe, envoyé seulement avant un prélèvement).
  const dernierRappel = abo?.rappel_prelevement_charge ?? null;
  const rappel: AutoItem = {
    id: "rappel-prelevement",
    categorie: "automatisation",
    nom: "Rappel de prélèvement (J-3)",
    description: "Prévient l'artisan 3 jours avant chaque prélèvement de son abonnement payé par carte.",
    icone: "ri-bank-card-line",
    frequence: "Quotidienne (envoi à J-3)",
    lien: "/app/profil?onglet=abonnement",
    lienLabel: "Ouvrir mon abonnement",
    actif: true,
    enPause: false,
    dernierPassage: dernierRappel,
    dernierDetail: dernierRappel ? `Dernier prélèvement annoncé : ${dernierRappel}` : null,
    prochaine: null,
    prochaineLibelle: "chaque jour",
    tracable: Boolean(dernierRappel),
    statut: calculerStatut({
      actif: true,
      tracable: Boolean(dernierRappel),
      dernierPassage: dernierRappel,
      toleranceJours: 40,
    }),
    note: "Ne se déclenche que lorsqu'un prélèvement est imminent : les longs silences sont normaux.",
  };

  // Escalade automatique des relances en retard (passage horaire, journalisé).
  const escaladeAuto = p.relance_auto_actif !== false;
  const prochainEscalade = prochainHoraire();
  const escalade: AutoItem = {
    id: "escalade-relances",
    categorie: "automatisation",
    nom: "Escalade automatique des relances",
    description: "Relance tout seul les clients dont la relance est en retard, à chaque passage.",
    icone: "ri-alarm-warning-line",
    frequence: "Horaire",
    lien: "/app/relances",
    lienLabel: "Ouvrir Relances",
    actif: escaladeAuto,
    enPause: pause,
    dernierPassage: escaladeRun?.run_at ?? null,
    dernierDetail: escaladeRun ? `${escaladeRun.envoye ?? 0} envoyée(s) · ${escaladeRun.echoue ?? 0} échec(s)` : null,
    prochaine: prochainEscalade,
    prochaineLibelle: libelleEcheance(prochainEscalade),
    tracable: true,
    statut: calculerStatut({
      actif: escaladeAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: escaladeRun?.run_at ?? null,
      toleranceJours: 2,
      alertes: (escaladeRun?.echoue ?? 0) > 0 ? 1 : 0,
    }),
    note: (escaladeRun?.echoue ?? 0) > 0 ? "Le dernier passage a enregistré des échecs d'envoi." : null,
  };

  // Récapitulatif quotidien par email à l'artisan.
  const recapQuotidienAuto = p.recap_quotidien_actif !== false;
  const prochainRecapQuot = prochainQuotidien(p.recap_heure ?? 8);
  const dernierRecapQuot = recapQuot?.envoye_le ?? p.recap_dernier_envoi ?? null;
  const recapQuotidien: AutoItem = {
    id: "recap-quotidien",
    categorie: "recap",
    nom: "Récapitulatif quotidien",
    description: "Envoie un email résumant chaque jour les factures en retard, devis sans réponse et échecs d'envoi.",
    icone: "ri-mail-line",
    frequence: "Quotidienne",
    lien: "/app/dashboard",
    lienLabel: "Ouvrir le tableau de bord",
    actif: recapQuotidienAuto,
    enPause: pause,
    dernierPassage: dernierRecapQuot,
    dernierDetail: null,
    prochaine: prochainRecapQuot,
    prochaineLibelle: libelleEcheance(prochainRecapQuot),
    tracable: true,
    statut: calculerStatut({
      actif: recapQuotidienAuto,
      enPause: pause,
      tracable: true,
      dernierPassage: dernierRecapQuot,
      toleranceJours: 2,
    }),
    note: null,
  };

  // Récap hebdomadaire par email de la synthèse des envois automatiques.
  const recapEnvoisHebdoActif = p.envois_auto_recap_hebdo_actif === true;
  const prochainHebdoEnvois = prochainHebdo(
    p.envois_auto_recap_hebdo_jour ?? 1,
    p.envois_auto_recap_hebdo_heure ?? 8,
  );
  const recapEnvoisHebdo: AutoItem = {
    id: "recap-hebdo-envois-auto",
    categorie: "recap",
    nom: "Récap hebdo des envois automatiques",
    description:
      "Envoie chaque semaine par email la synthèse de vos envois automatiques (CSV en pièce jointe).",
    icone: "ri-calendar-schedule-line",
    frequence: "Hebdomadaire",
    lien: "/app/dashboard",
    lienLabel: "Ouvrir le tableau de bord",
    actif: recapEnvoisHebdoActif,
    enPause: pause,
    dernierPassage: p.envois_auto_recap_hebdo_dernier_envoi ?? null,
    dernierDetail: null,
    prochaine: prochainHebdoEnvois,
    prochaineLibelle: libelleEcheance(prochainHebdoEnvois),
    tracable: true,
    statut: calculerStatut({
      actif: recapEnvoisHebdoActif,
      enPause: pause,
      tracable: true,
      dernierPassage: p.envois_auto_recap_hebdo_dernier_envoi ?? null,
      toleranceJours: 8,
    }),
    note: recapEnvoisHebdoActif ? null : "Récap hebdo non activé depuis le tableau de bord.",
  };

  // Récap hebdomadaire par email des ALERTES DE TAUX de réussite. Ses réglages sont
  // centralisés sur cette même page (section « Réglage du récap hebdo des alertes de taux »).
  const recapAlertesActif = p.taux_alerte_recap_hebdo_actif === true;
  const prochainRecapAlertes = prochainHebdo(
    p.taux_alerte_recap_hebdo_jour ?? 1,
    p.taux_alerte_recap_hebdo_heure ?? 8,
  );
  const recapAlertesHebdo: AutoItem = {
    id: "recap-hebdo-alertes-taux",
    categorie: "recap",
    nom: "Récap hebdo des alertes de taux",
    description:
      "Résume chaque semaine par email les alertes de taux de réussite envoyées (réelles et tests), avec les jours concernés.",
    icone: "ri-mail-star-line",
    frequence: "Hebdomadaire",
    lien: "/app/envois-automatiques#reglages-recap-alertes-taux",
    lienLabel: "Voir le réglage",
    actif: recapAlertesActif,
    enPause: pause,
    dernierPassage: p.taux_alerte_recap_hebdo_dernier_envoi ?? null,
    dernierDetail: null,
    prochaine: prochainRecapAlertes,
    prochaineLibelle: libelleEcheance(prochainRecapAlertes),
    tracable: true,
    statut: calculerStatut({
      actif: recapAlertesActif,
      enPause: pause,
      tracable: true,
      dernierPassage: p.taux_alerte_recap_hebdo_dernier_envoi ?? null,
      toleranceJours: 8,
    }),
    note: recapAlertesActif
      ? null
      : "Récap hebdo non activé : réglez-le dans la section « Réglage du récap hebdo des alertes de taux ».",
  };

  // Récap hebdomadaire par email des ÉCHECS des rejeux « test à blanc » (CSV en pièce jointe).
  // Ses réglages sont centralisés sur cette même page (section « Réglage du récap hebdo des échecs »).
  const recapEchecsActif = p.echecs_blanc_recap_hebdo_actif === true;
  const prochainRecapEchecs = prochainHebdo(
    p.echecs_blanc_recap_hebdo_jour ?? 1,
    p.echecs_blanc_recap_hebdo_heure ?? 8,
  );
  const recapEchecsHebdo: AutoItem = {
    id: "recap-hebdo-echecs-blanc",
    categorie: "recap",
    nom: "Récap hebdo des échecs test à blanc",
    description:
      "Envoie chaque semaine par email le récap des échecs de vos rejeux « test à blanc », regroupés par automatisation (CSV en pièce jointe).",
    icone: "ri-file-warning-line",
    frequence: "Hebdomadaire",
    lien: "/app/envois-automatiques#reglages-recap-echecs-blanc",
    lienLabel: "Voir le réglage",
    actif: recapEchecsActif,
    enPause: pause,
    dernierPassage: p.echecs_blanc_recap_hebdo_dernier_envoi ?? null,
    dernierDetail: null,
    prochaine: prochainRecapEchecs,
    prochaineLibelle: libelleEcheance(prochainRecapEchecs),
    tracable: true,
    statut: calculerStatut({
      actif: recapEchecsActif,
      enPause: pause,
      tracable: true,
      dernierPassage: p.echecs_blanc_recap_hebdo_dernier_envoi ?? null,
      toleranceJours: 8,
    }),
    note: recapEchecsActif
      ? null
      : "Récap hebdo non activé : réglez-le dans la section « Réglage du récap hebdo des échecs test à blanc ».",
  };

  return [recapHebdo, alerteManquant, journal, bilan, rappel, escalade, recapQuotidien, recapEnvoisHebdo, recapAlertesHebdo, recapEchecsHebdo];
}

/**
 * Charge l'état de toutes les automatisations d'envoi pour l'utilisateur connecté et
 * expose un état de chargement/erreur, avec une fonction de rechargement manuel.
 */
export function useEnvoisAutomatiques(): EnvoisAutomatiquesResult {
  const { user } = useAuth();
  const moisManquants = useComptableMoisManquants();
  const [items, setItems] = useState<AutoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(async () => {
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let actif = true;
    (async () => {
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await chargerEnvoisAutomatiques(user.id, moisManquants);
        if (actif) setItems(res);
      } catch {
        if (actif) setError("Impossible de charger l'état des envois automatiques pour l'instant.");
      } finally {
        if (actif) setLoading(false);
      }
    })();
    return () => {
      actif = false;
    };
  }, [user, moisManquants, reloadKey]);

  return { items, loading, error, reload };
}

/** État consolidé de l'entrée de menu « Envois automatiques ». */
export interface EnvoisAutoMenu {
  /** Nombre d'automatisations « à vérifier » (pastille rouge de l'entrée de menu). */
  attention: number;
  /** Automatisations/récaps dont l'exécution tombe dans l'heure (bandeau chronologique du menu). */
  imminentes: ExecutionImminente[];
}

/**
 * Charge l'état des automatisations pour l'entrée de menu « Envois automatiques » : le nombre
 * « à vérifier » (pastille rouge) et la grille chronologique des exécutions prévues dans la fenêtre
 * d'alerte (petit bandeau du menu). La fenêtre (15 / 30 / 60 min) et les automatisations exclues du
 * signalement sont fournies par l'appelant. Ne se déclenche que si `enabled` est vrai (ex. compte
 * artisan, pas gestionnaire) pour éviter des requêtes inutiles. L'état est rechargé toutes les
 * 10 minutes, et une horloge interne rejoue toutes les 30 secondes pour tenir le compte à rebours à jour.
 */
export function useEnvoisAutoMenu(
  moisManquants: number,
  enabled: boolean,
  fenetreMs: number = FENETRE_IMMINENTE_MS,
  exclusions: string[] = [],
): EnvoisAutoMenu {
  const { user } = useAuth();
  const [items, setItems] = useState<AutoItem[]>([]);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    let actif = true;
    if (!enabled || !user) {
      setItems([]);
      return () => {
        actif = false;
      };
    }
    const charger = async () => {
      try {
        const res = await chargerEnvoisAutomatiques(user.id, moisManquants);
        if (actif) setItems(res);
      } catch (e) {
        journaliserDepuisErreur({
          ecran: "Menu · Envois automatiques",
          source: "chargement du menu",
          error: e,
          gravite: "avertissement",
        });
        if (actif) setItems([]);
      }
    };
    charger();
    const id = window.setInterval(charger, 10 * 60 * 1000);
    return () => {
      actif = false;
      window.clearInterval(id);
    };
  }, [user, moisManquants, enabled]);

  // Horloge du compte à rebours : rejoue toutes les 30 secondes tant que l'entrée est affichée.
  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => setMaintenant(Date.now()), 30 * 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return {
    attention: items.filter((i) => i.statut === "attention").length,
    imminentes: executionsImminentes(
      items.filter((i) => !exclusions.includes(i.id)),
      new Date(maintenant),
      fenetreMs,
    ),
  };
}