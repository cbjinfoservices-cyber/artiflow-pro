import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { estGestionnairePrincipal, normaliseEmail } from "@/lib/roles";

export interface Profile {
  id: string;
  email: string | null;
  metier: string | null;
  entreprise: string | null;
  telephone: string | null;
  /** Parcours de démarrage guidé terminé (ou passé) pour cet artisan. */
  onboarding_done?: boolean | null;
  logo_url: string | null;
  siret: string | null;
  tva: string | null;
  assurance: string | null;
  penalites_retard: string | null;
  email_sujet_devis: string | null;
  email_corps_devis: string | null;
  email_sujet_facture: string | null;
  email_corps_facture: string | null;
  email_sujet_relance: string | null;
  email_corps_relance: string | null;
  /** Objet de l'email de récap hebdomadaire des recontacts (comptes très volatils à recontacter). */
  email_sujet_recontact?: string | null;
  /** Texte introductif de l'email de récap hebdomadaire des recontacts. */
  email_corps_recontact?: string | null;
  /** Objet de l'email d'auto-relance des oubliés (comptes jamais relancés après un récap). */
  email_sujet_recontact_auto?: string | null;
  /** Texte de l'email d'auto-relance des oubliés. */
  email_corps_recontact_auto?: string | null;
  /** Objet de l'email d'alerte envoyé à l'artisan quand l'auto-relance des oubliés expédie des relances. */
  email_sujet_alerte_artisan?: string | null;
  /** Texte de l'email d'alerte envoyé à l'artisan. */
  email_corps_alerte_artisan?: string | null;
  /** Adresse email du comptable, mémorisée pour l'envoi du journal comptable. */
  comptable_email?: string | null;
  /** Commentaire libre mémorisé, repris par défaut à chaque envoi de régularité au comptable. */
  comptable_commentaire?: string | null;
  /** Message d'accompagnement mémorisé, pré-rempli pour les renvois du pack comptable. */
  comptable_pack_message?: string | null;
  /** Message d'accompagnement mémorisé, pré-rempli pour l'envoi du relevé des prélèvements seul. */
  comptable_releve_message?: string | null;
  /** Adresse secondaire mémorisée, mise en copie (Cc) des emails au comptable. */
  comptable_cc_email?: string | null;
  /** Dernier destinataire choisi pour un renvoi (pack / relevé), reproposé pré-rempli à la prochaine session. */
  comptable_renvoi_destinataire?: string | null;
  /** Dernière adresse de comptable remplaçant utilisée pour un renvoi, cible du renvoi « remplaçant habituel ». */
  comptable_remplacant_habituel?: string | null;
  /** Dernière adresse ponctuelle utilisée pour un renvoi (ex. comptable remplaçant), proposée en suggestion. */
  comptable_override_email?: string | null;
  /** Adresse ponctuelle par défaut (ex. comptable remplaçant habituel), pré-remplie au premier envoi. */
  comptable_override_email_defaut?: string | null;
  /** Adresses ponctuelles nommées (ex. « Comptable remplaçant A »), proposées au renvoi (journaux et bilans). */
  comptable_override_adresses?: { nom: string; email: string }[] | null;
  /** Date (AAAA-MM-JJ) jusqu'à laquelle l'alerte « bilan manquant » est mise de côté, ou null. */
  comptable_bilan_alerte_snooze?: string | null;
  /** Date (AAAA-MM-JJ) jusqu'à laquelle l'alerte « santé du compte sous le seuil » est mise de côté, ou null. */
  sante_alerte_snooze?: string | null;
  /** Date (AAAA-MM-JJ) jusqu'à laquelle l'alerte « taux de réussite en chute » est mise de côté, ou null. */
  taux_alerte_snooze?: string | null;
  /** Date (AAAA-MM-JJ) jusqu'à laquelle l'alerte « taux d'encaissement faible » est mise de côté, ou null. */
  encaissement_alerte_snooze?: string | null;
  /** Date (AAAA-MM-JJ) jusqu'à laquelle l'alerte « comptes oubliés sur vos derniers récaps » est mise de côté, ou null. */
  recontact_oublies_alerte_snooze?: string | null;
  /** Délai (en jours) d'auto-relance des oubliés après un récap, ou null/0 si désactivé. */
  recontact_oublies_auto_jours?: number | null;
  /** L'artisan reçoit un email d'alerte quand l'auto-relance des oubliés a réellement expédié des relances. */
  recontact_oublies_alerte_email_actif?: boolean | null;
  /** Envoi automatique mensuel du journal au comptable activé. */
  comptable_auto_actif?: boolean | null;
  /** Jour du mois (1-28) de l'envoi automatique mensuel. */
  comptable_auto_jour?: number | null;
  /** Heure d'envoi (0-23, heure de Paris) de l'envoi automatique mensuel. */
  comptable_auto_heure?: number | null;
  /** Dernier mois envoyé automatiquement (clé « AAAA-MM » du mois écoulé). */
  comptable_auto_dernier_mois?: string | null;
  /** Envoie en plus, à chaque envoi automatique, un récap de régularité (graphe + CSV) au comptable. */
  comptable_rapport_auto_actif?: boolean | null;
  /** Reçoit aussi une copie du récap de régularité dans sa propre boîte (optionnel). */
  comptable_rapport_copie_artisan?: boolean | null;
  /** Période d'archive mémorisée pour les exports de régularité (« 6 » / « 12 » / « 24 »). */
  comptable_export_periode?: string | null;
  /** Format d'export par défaut mémorisé (« image » / « csv » / « both »). */
  comptable_export_format?: string | null;
  /** Dernier type d'export de l'historique utilisé (« csv-filtre », « csv-complet », « pdf-filtre », « pdf-complet »). */
  comptable_export_dernier?: string | null;
  /** Prévient l'artisan par email quand un mois attendu reste sans envoi automatique. */
  comptable_relance_manquante_actif?: boolean | null;
  /** Délai (en jours) après le jour d'envoi avant de prévenir l'artisan. */
  comptable_relance_delai?: number | null;
  /** Dernier mois (« AAAA-MM ») pour lequel l'artisan a déjà été prévenu (anti-doublon). */
  comptable_relance_dernier_cle?: string | null;
  /** Base publique de l'application, mémorisée pour construire les liens des emails comptables. */
  comptable_app_url?: string | null;
  /** Envoi automatique du bilan d'archivage (historique des envois) au comptable en fin d'année. */
  comptable_bilan_auto_actif?: boolean | null;
  /** Jour du mois de janvier (1-28) où part le bilan d'archivage annuel. */
  comptable_bilan_jour?: number | null;
  /** Dernière année clôturée pour laquelle le bilan d'archivage a été envoyé (anti-doublon). */
  comptable_bilan_dernier_annee?: string | null;
  /** Reçoit aussi une copie du bilan d'archivage dans sa propre boîte (optionnel). */
  comptable_bilan_copie_artisan?: boolean | null;
  relance_auto_actif?: boolean | null;
  relance_seuil?: number | null;
  relance_escalade_retard?: number | null;
  recap_quotidien_actif?: boolean | null;
  recap_canaux?: string[] | null;
  recap_heure?: number | null;
  recap_devis_seuil?: number | null;
  relance_facture_auto_actif?: boolean | null;
  relance_facture_seuil?: number | null;
  relance_facture_delai_min?: number | null;
  rappel_relance_actif?: boolean | null;
  rappel_relance_heure?: number | null;
  /** Récap hebdomadaire par email de la synthèse des envois automatiques activé. */
  envois_auto_recap_hebdo_actif?: boolean | null;
  /** Jour de la semaine d'envoi du récap hebdo (1 = lundi … 7 = dimanche). */
  envois_auto_recap_hebdo_jour?: number | null;
  /** Heure d'envoi du récap hebdo (0-23, heure de Paris). */
  envois_auto_recap_hebdo_heure?: number | null;
  /** Date et heure du dernier récap hebdo réellement envoyé. */
  envois_auto_recap_hebdo_dernier_envoi?: string | null;
  /** Adresses mises en copie (Cc) de chaque récap hebdo des envois automatiques (comptable, collaborateur…). */
  envois_auto_recap_hebdo_cc?: { nom?: string; email: string }[] | null;
  /** Export CSV mensuel par email (journal des réessais + journal d'escalade) activé. */
  export_csv_mensuel_actif?: boolean | null;
  /** Jour du mois (1-28) de l'envoi automatique de l'export CSV mensuel. */
  export_csv_mensuel_jour?: number | null;
  /** Heure d'envoi (0-23, heure de Paris) de l'export CSV mensuel. */
  export_csv_mensuel_heure?: number | null;
  /** Date et heure du dernier export CSV mensuel réellement envoyé. */
  export_csv_mensuel_dernier_envoi?: string | null;
  /** Destinataires en copie (Cc) de l'export CSV mensuel, séparés par des virgules. */
  export_csv_mensuel_cc?: string | null;
  /** Décalage (jours) enregistré comme réglage favori pour la reprogrammation en lot. */
  decalage_favori?: number | null;
  pause_jusqu_au?: string | null;
  recap_dernier_envoi?: string | null;
  /** Avertir l'artisan par email quand un email de test échoue (interrupteur du Diagnostic). */
  alerte_echec_test_actif?: boolean | null;
  /** Adresse de réception de l'alerte d'échec (vide = adresse du compte). */
  alerte_echec_test_email?: string | null;
  /** Date et heure du dernier test d'alerte réussi (preuve que l'adresse reçoit bien les alertes). */
  alerte_echec_test_dernier_ok_at?: string | null;
  /** Prévient l'artisan par email si le taux de réussite des tests passe sous un seuil. */
  taux_alerte_email_actif?: boolean | null;
  /** Seuil (en %) en dessous duquel l'alerte de taux se déclenche. */
  taux_alerte_seuil?: number | null;
  /** Nombre de jours consécutifs (fenêtre) sous le seuil avant d'alerter. */
  taux_alerte_jours?: number | null;
  /** Date et heure du dernier email d'alerte de taux envoyé (anti-doublon). */
  taux_alerte_dernier_envoi_at?: string | null;
  /** Récap hebdomadaire par email des alertes de taux envoyées dans la semaine activé. */
  taux_alerte_recap_hebdo_actif?: boolean | null;
  /** Jour de la semaine d'envoi du récap des alertes de taux (1 = lundi … 7 = dimanche). */
  taux_alerte_recap_hebdo_jour?: number | null;
  /** Heure d'envoi du récap des alertes de taux (0-23, heure de Paris). */
  taux_alerte_recap_hebdo_heure?: number | null;
  /** Date et heure du dernier récap hebdomadaire des alertes de taux réellement envoyé. */
  taux_alerte_recap_hebdo_dernier_envoi?: string | null;
  /** Envoi hebdomadaire du récap d'échecs des rejeux « test à blanc » (CSV) activé. */
  echecs_blanc_recap_hebdo_actif?: boolean | null;
  /** Jour de la semaine d'envoi du récap d'échecs (1 = lundi … 7 = dimanche). */
  echecs_blanc_recap_hebdo_jour?: number | null;
  /** Heure d'envoi du récap d'échecs (0-23, heure de Paris). */
  echecs_blanc_recap_hebdo_heure?: number | null;
  /** Fenêtre (en jours) couverte par le récap d'échecs : 7, 14 ou 30. */
  echecs_blanc_recap_hebdo_fenetre?: number | null;
  /** Date et heure du dernier récap d'échecs des rejeux réellement envoyé. */
  echecs_blanc_recap_hebdo_dernier_envoi?: string | null;
  /** Seuil (en jours) au-delà duquel l'archivage des récaps d'échecs est signalé en retard : 15, 30 ou 60. */
  echecs_blanc_recap_alerte_seuil?: number | null;
  /** Adresses mises en copie (Cc) du rappel « archivage en retard » (comptable, collaborateur…). */
  echecs_blanc_recap_alerte_cc?: { nom?: string; email: string }[] | null;
  /** Adresses mises en copie (Cc) de chaque récap hebdo d'échecs des rejeux (comptable, collaborateur…). */
  echecs_blanc_recap_hebdo_cc?: { nom?: string; email: string }[] | null;
  /** L'envoi annuel du PDF de régularité d'archivage des récaps d'échecs est activé. */
  echecs_blanc_recap_annuel_actif?: boolean | null;
  /** Dernière année clôturée pour laquelle le PDF de régularité a été envoyé (anti-doublon). */
  echecs_blanc_recap_annuel_dernier?: string | null;
  /** Jour du mois de janvier (1-28) où part le récap annuel de régularité. */
  echecs_blanc_recap_annuel_jour?: number | null;
  /** Heure d'envoi (0-23, heure de Paris) du récap annuel de régularité. */
  echecs_blanc_recap_annuel_heure?: number | null;
  /** Dernière année clôturée pour laquelle une relance automatique a été adressée (anti-doublon). */
  echecs_blanc_recap_annuel_relance_dernier?: string | null;
  /** Délai (en jours) après la date réglée avant la relance automatique du récap annuel : 15, 30 ou 45. */
  echecs_blanc_recap_annuel_relance_delai?: number | null;
  /** Envoie aussi le récap annuel de régularité au comptable en copie (Cc) quand cette option est activée. */
  echecs_blanc_recap_annuel_cc_comptable?: boolean | null;
  /** Date (AAAA-MM-JJ) jusqu'à laquelle l'alerte « renouveler le mot de passe » est mise de côté, ou null. */
  mot_de_passe_alerte_snooze?: string | null;
  /** L'email d'alerte « mot de passe ancien » est activé (interrupteur du profil). */
  mot_de_passe_alerte_email_actif?: boolean | null;
  /** Date et heure du dernier email d'alerte « mot de passe ancien » réellement envoyé. */
  mot_de_passe_alerte_email_at?: string | null;
  /** Date et heure du dernier test manuel de l'alerte mot de passe réussi (preuve de rendu). */
  mot_de_passe_alerte_test_ok_at?: string | null;
  /** Le récap mensuel par email des alertes « mot de passe ancien » est activé (interrupteur du profil). */
  mot_de_passe_recap_mensuel_actif?: boolean | null;
  /** Clé « AAAA-MM » du dernier mois récapitulé (anti-doublon du récap mensuel). */
  mot_de_passe_recap_mensuel_dernier_mois?: string | null;
  /** Date et heure du dernier récap mensuel réellement envoyé. */
  mot_de_passe_recap_mensuel_dernier_envoi_at?: string | null;
  /** Date et heure du dernier test manuel du récap mensuel réussi (preuve de rendu). */
  mot_de_passe_recap_mensuel_test_ok_at?: string | null;
  /** Clé « AAAA-Tn » du dernier trimestre récapitulé au comptable (anti-doublon du récap trimestriel). */
  mot_de_passe_recap_trimestre_dernier?: string | null;
  /** Le récap trimestriel par email au comptable est activé (interrupteur du tableau de bord). */
  mot_de_passe_recap_trimestriel_actif?: boolean | null;
  /** L'envoi annuel du PDF d'historique des récaps au comptable est activé. */
  mot_de_passe_recap_annuel_actif?: boolean | null;
  /** Dernière année clôturée pour laquelle l'historique des récaps a été envoyé (anti-doublon). */
  mot_de_passe_recap_annuel_dernier?: string | null;
  /** L'envoi annuel du comparatif de cadence (PDF) au comptable est activé. */
  mot_de_passe_comparatif_annuel_actif?: boolean | null;
  /** Dernière année clôturée pour laquelle le comparatif de cadence a été envoyé (anti-doublon). */
  mot_de_passe_comparatif_annuel_dernier?: string | null;
  /** Date et heure du dernier test manuel du comparatif de cadence réussi (preuve de rendu). */
  mot_de_passe_comparatif_annuel_test_ok_at?: string | null;
  /** Fenêtre (en mois) retenue pour le comparatif de cadence : 6, 12 ou 24. */
  mot_de_passe_comparatif_fenetre?: number | null;
  /** Historique (ISO, du plus récent au plus ancien) des derniers changements de mot de passe. */
  mot_de_passe_changements?: string[] | null;
}

/** Une adresse reconnue comme gestionnaire (hors gestionnaire principal, fixe). */
export interface Gestionnaire {
  id: number;
  email: string;
  /** Libellé libre affiché dans la liste (ex. « Comptable externe », « Support »), ou null. */
  libelle: string | null;
  /** Note interne longue (contexte, mission, précisions…), affichée dans la fiche de la ligne. */
  note: string | null;
  /** Accès à l'entrée « Comptabilité ». */
  voir_comptabilite: boolean;
  /** Accès à l'entrée « Mon abonnement ». */
  voir_mon_abonnement: boolean;
  created_at: string;
  updated_at: string;
}

/** Champs modifiables d'une adresse gestionnaire. */
export interface GestionnairePatch {
  libelle?: string | null;
  note?: string | null;
  voir_comptabilite?: boolean;
  voir_mon_abonnement?: boolean;
}

/** Une entrée du journal des modifications de la liste des gestionnaires. */
export interface JournalGestionnaire {
  id: number;
  email: string;
  /** « ajout », « modification » ou « retrait ». */
  action: string;
  detail: string | null;
  acteur_email: string | null;
  created_at: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
  metier: string;
  entreprise: string;
  telephone: string;
}

export interface ProfilePayload {
  entreprise: string;
  metier: string;
  telephone: string;
  logo_url: string | null;
  siret: string;
  tva: string;
  assurance: string;
  penalites_retard: string;
  email_sujet_devis: string;
  email_corps_devis: string;
  email_sujet_facture: string;
  email_corps_facture: string;
  email_sujet_relance: string;
  email_corps_relance: string;
  email_sujet_recontact: string;
  email_corps_recontact: string;
  email_sujet_recontact_auto: string;
  email_corps_recontact_auto: string;
  email_sujet_alerte_artisan: string;
  email_corps_alerte_artisan: string;
}

interface AuthResult {
  error: string | null;
  info?: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileLoading: boolean;
  loading: boolean;
  /** Compte reconnu comme gestionnaire (accès au back-office Abonnements). */
  isGestionnaire: boolean;
  /** Compte gestionnaire principal (seul autorisé à gérer la liste des gestionnaires). */
  isGestionnairePrincipal: boolean;
  /** Adresses reconnues comme gestionnaires (vide pour un compte artisan). */
  gestionnaires: Gestionnaire[];
  /** Le chargement de la liste des gestionnaires est en cours. */
  gestionnairesLoading: boolean;
  /** Journal des modifications de la liste des gestionnaires (du plus récent au plus ancien). */
  journal: JournalGestionnaire[];
  /** Le chargement du journal est en cours. */
  journalLoading: boolean;
  /** Recharge le journal des modifications depuis le Backend. */
  refreshJournal: () => Promise<void>;
  /** Le compte courant peut voir l'entrée « Comptabilité » (toujours vrai pour un artisan). */
  voirComptabilite: boolean;
  /** Le compte courant peut voir l'entrée « Mon abonnement » (toujours vrai pour un artisan). */
  voirMonAbonnement: boolean;
  /** Recharge la liste des gestionnaires depuis le Backend. */
  refreshGestionnaires: () => Promise<void>;
  /** Ajoute une adresse gestionnaire (réservé au gestionnaire principal). */
  ajouterGestionnaire: (
    email: string,
    voirComptabilite: boolean,
    voirMonAbonnement: boolean,
    libelle: string | null,
  ) => Promise<{ error: string | null }>;
  /** Met à jour le libellé et/ou les préférences d'une adresse gestionnaire (réservé au gestionnaire principal). */
  majGestionnaire: (
    id: number,
    patch: GestionnairePatch,
  ) => Promise<{ error: string | null }>;
  /** Retire une adresse gestionnaire (réservé au gestionnaire principal). */
  supprimerGestionnaire: (id: number) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (payload: SignUpPayload) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  sendMagicLink: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: ProfilePayload) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function computeRedirect(): string {
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  return `${window.location.origin}${base}/app`;
}

async function createProfileFromUser(user: User): Promise<Profile | null> {
  const meta = (user.user_metadata || {}) as Record<string, string | undefined>;
  const row = {
    id: user.id,
    email: user.email ?? null,
    metier: meta.metier ?? null,
    entreprise: meta.entreprise ?? null,
    telephone: meta.telephone ?? null,
  };
  const { data } = await supabase.from("profiles").insert(row).select("*").maybeSingle();
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  const [gestionnairesLoading, setGestionnairesLoading] = useState(false);
  const [journal, setJournal] = useState<JournalGestionnaire[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);

  useEffect(() => {
    let active = true;

    // La session est résolue immédiatement : on ne bloque pas l'affichage
    // derrière le chargement du profil.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .catch(() => {
        /* silencieux */
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Le callback doit rester synchrone : on ne fait que mettre à jour l'état local.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async () => {
    const user = session?.user;
    if (!user) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setProfile(data as Profile);
      } else {
        // Premier accès : on crée la fiche artisan à partir des infos d'inscription.
        setProfile(await createProfileFromUser(user));
      }
    } catch {
      /* silencieux : l'espace reste utilisable même si le profil tarde */
    } finally {
      setProfileLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Liste des adresses gestionnaires. Le Backend ne renvoie des lignes qu'aux comptes
  // gestionnaires (les artisans reçoivent une liste vide) ; l'écriture y est réservée au
  // gestionnaire principal par les règles de sécurité côté Backend.
  const loadGestionnaires = useCallback(async () => {
    const user = session?.user;
    if (!user) {
      setGestionnaires([]);
      return;
    }
    setGestionnairesLoading(true);
    try {
      const { data, error } = await supabase
        .from("gestionnaires")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error) setGestionnaires((data as Gestionnaire[]) ?? []);
    } catch {
      /* silencieux : le rôle principal reste reconnu même si la liste tarde */
    } finally {
      setGestionnairesLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadGestionnaires();
  }, [loadGestionnaires]);

  // Journal des modifications : le Backend ne renvoie des lignes qu'aux comptes
  // gestionnaires (les artisans reçoivent une liste vide).
  const loadJournal = useCallback(async () => {
    const user = session?.user;
    if (!user) {
      setJournal([]);
      return;
    }
    setJournalLoading(true);
    try {
      const { data, error } = await supabase
        .from("gestionnaires_journal")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error) setJournal((data as JournalGestionnaire[]) ?? []);
    } catch {
      /* silencieux */
    } finally {
      setJournalLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const ajouterGestionnaire = useCallback(
    async (
      email: string,
      voirComptabilite: boolean,
      voirMonAbonnement: boolean,
      libelle: string | null,
    ) => {
      const adresse = normaliseEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) {
        return { error: "Saisissez une adresse email valide." };
      }
      const { error } = await supabase.from("gestionnaires").insert({
        email: adresse,
        libelle: libelle?.trim() || null,
        voir_comptabilite: voirComptabilite,
        voir_mon_abonnement: voirMonAbonnement,
      });
      if (error) {
        if (error.code === "23505") return { error: "Cette adresse est déjà gestionnaire." };
        return { error: "L'ajout a échoué. Vérifiez que vous êtes bien le gestionnaire principal." };
      }
      await loadGestionnaires();
      await loadJournal();
      return { error: null };
    },
    [loadGestionnaires, loadJournal],
  );

  const majGestionnaire = useCallback(
    async (id: number, patch: GestionnairePatch) => {
      const clean: GestionnairePatch = { ...patch };
      if (typeof clean.libelle === "string") clean.libelle = clean.libelle.trim() || null;
      if (typeof clean.note === "string") clean.note = clean.note.trim() || null;
      const { error } = await supabase
        .from("gestionnaires")
        .update({ ...clean, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return { error: "La mise à jour a échoué." };
      setGestionnaires((prev) => prev.map((g) => (g.id === id ? { ...g, ...clean } : g)));
      loadJournal();
      return { error: null };
    },
    [loadJournal],
  );

  const supprimerGestionnaire = useCallback(
    async (id: number) => {
      const { error } = await supabase.from("gestionnaires").delete().eq("id", id);
      if (error) return { error: "La suppression a échoué." };
      setGestionnaires((prev) => prev.filter((g) => g.id !== id));
      loadJournal();
      return { error: null };
    },
    [loadJournal],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, []);

  const signUp = useCallback(async (payload: SignUpPayload) => {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          metier: payload.metier,
          entreprise: payload.entreprise,
          telephone: payload.telephone,
        },
        emailRedirectTo: computeRedirect(),
      },
    });
    if (error) return { error: error.message, needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const sendMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: computeRedirect() },
    });
    if (error) return { error: error.message };
    return { error: null, info: "Lien de connexion envoyé ! Vérifiez votre boîte mail." };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const updateProfile = useCallback(
    async (payload: ProfilePayload): Promise<{ error: string | null }> => {
      const user = session?.user;
      if (!user) return { error: "Vous devez être connecté pour enregistrer vos informations." };
      const row = {
        id: user.id,
        email: user.email ?? null,
        entreprise: payload.entreprise,
        metier: payload.metier,
        telephone: payload.telephone,
        logo_url: payload.logo_url,
        siret: payload.siret || null,
        tva: payload.tva || null,
        assurance: payload.assurance || null,
        penalites_retard: payload.penalites_retard || null,
        email_sujet_devis: payload.email_sujet_devis || null,
        email_corps_devis: payload.email_corps_devis || null,
        email_sujet_facture: payload.email_sujet_facture || null,
        email_corps_facture: payload.email_corps_facture || null,
        email_sujet_relance: payload.email_sujet_relance || null,
        email_corps_relance: payload.email_corps_relance || null,
        email_sujet_recontact: payload.email_sujet_recontact || null,
        email_corps_recontact: payload.email_corps_recontact || null,
        email_sujet_recontact_auto: payload.email_sujet_recontact_auto || null,
        email_corps_recontact_auto: payload.email_corps_recontact_auto || null,
        email_sujet_alerte_artisan: payload.email_sujet_alerte_artisan || null,
        email_corps_alerte_artisan: payload.email_corps_alerte_artisan || null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("profiles").upsert(row).select("*").maybeSingle();
      if (error) return { error: error.message };
      if (data) setProfile(data as Profile);
      return { error: null };
    },
    [session],
  );

  const monEmail = session?.user?.email ?? null;
  const isPrincipal = estGestionnairePrincipal(monEmail);
  const estDansListe = gestionnaires.some((g) => normaliseEmail(g.email) === normaliseEmail(monEmail));
  const isGestionnaire = isPrincipal || estDansListe;
  const maLigne = gestionnaires.find((g) => normaliseEmail(g.email) === normaliseEmail(monEmail));
  const voirComptabilite = !isGestionnaire ? true : maLigne ? maLigne.voir_comptabilite : true;
  const voirMonAbonnement = !isGestionnaire ? true : maLigne ? maLigne.voir_mon_abonnement : true;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      loading,
      isGestionnaire,
      isGestionnairePrincipal: isPrincipal,
      gestionnaires,
      gestionnairesLoading,
      journal,
      journalLoading,
      voirComptabilite,
      voirMonAbonnement,
      refreshGestionnaires: loadGestionnaires,
      refreshJournal: loadJournal,
      ajouterGestionnaire,
      majGestionnaire,
      supprimerGestionnaire,
      signIn,
      signUp,
      sendMagicLink,
      signOut,
      refreshProfile: loadProfile,
      updateProfile,
    }),
    [
      session,
      profile,
      profileLoading,
      loading,
      isGestionnaire,
      isPrincipal,
      gestionnaires,
      gestionnairesLoading,
      journal,
      journalLoading,
      voirComptabilite,
      voirMonAbonnement,
      loadGestionnaires,
      loadJournal,
      ajouterGestionnaire,
      majGestionnaire,
      supprimerGestionnaire,
      signIn,
      signUp,
      sendMagicLink,
      signOut,
      loadProfile,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  return ctx;
}