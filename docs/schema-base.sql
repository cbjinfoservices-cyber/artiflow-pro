-- =====================================================================
-- ARTIFLOW - Structure de la base de donnees (schéma public)
-- Genere automatiquement a partir du schema reel du Backend.
-- 59 tables. Les identifiants utilisent des sequences (bigserial).
-- Les colonnes user_id / profiles.id pointent vers auth.users (comptes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

CREATE TABLE abonnement_historique (
  id bigint DEFAULT nextval('abonnement_historique_id_seq'::regclass) NOT NULL,
  abonnement_id bigint NOT NULL,
  artisan_id uuid,
  entreprise text,
  type text DEFAULT 'offre'::text NOT NULL,
  ancienne_valeur text,
  nouvelle_valeur text,
  ancien_montant numeric,
  nouveau_montant numeric,
  motif text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE abonnements (
  id bigint DEFAULT nextval('abonnements_id_seq'::regclass) NOT NULL,
  artisan_id uuid,
  entreprise text NOT NULL,
  email text,
  metier text,
  ville text,
  offre text DEFAULT 'Pro'::text NOT NULL,
  statut text DEFAULT 'Actif'::text NOT NULL,
  montant_mensuel numeric DEFAULT 0 NOT NULL,
  canal_paiement text,
  date_debut date,
  date_echeance date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  iban text,
  mandat_sepa text,
  stripe_customer_id text,
  stripe_subscription_id text,
  rappel_prelevement_charge date,
  montants_ttc boolean DEFAULT true NOT NULL,
  rappel_echeance_unique date,
  rappel_essai_fin date,
  rappel_essai_j1 date,
  bienvenue_envoyee_le timestamp with time zone
);

CREATE TABLE acces_ouvert_autorise (
  table_name text NOT NULL,
  raison text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE alerte_config_stripe (
  id bigint NOT NULL,
  motif text,
  pays text,
  destinataires text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  statut text DEFAULT 'nouvelle'::text NOT NULL,
  traite_par text,
  traite_at timestamp with time zone,
  detail jsonb
);

CREATE TABLE back_office_note (
  id integer NOT NULL,
  note text,
  updated_by text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE chantiers (
  id bigint DEFAULT nextval('chantiers_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  client_id bigint,
  libelle text,
  adresse text,
  statut text DEFAULT 'a_venir'::text,
  date_debut date,
  created_at timestamp with time zone DEFAULT now(),
  montant numeric DEFAULT 0,
  intervenant_id bigint
);

CREATE TABLE clients (
  id bigint DEFAULT nextval('clients_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  nom text NOT NULL,
  telephone text,
  email text,
  adresse text,
  created_at timestamp with time zone DEFAULT now(),
  type text DEFAULT 'particulier'::text,
  contact_nom text,
  siret text,
  secteur text,
  notes text,
  note_priorite text,
  derniere_relance_at timestamp with time zone
);

CREATE TABLE comptable_remplacements (
  id bigint DEFAULT nextval('comptable_remplacements_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  adresse text NOT NULL,
  nom text,
  exercice text,
  type text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE devis (
  id bigint DEFAULT nextval('devis_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  client_id bigint,
  numero text NOT NULL,
  statut text DEFAULT 'brouillon'::text,
  total_ht numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  objet text,
  sign_token text,
  signature_image text,
  signataire_nom text,
  signed_at timestamp with time zone,
  modele_cle text,
  modele_nom text
);

CREATE TABLE devis_modele_usage_events (
  id bigint DEFAULT nextval('devis_modele_usage_events_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  cle text NOT NULL,
  montant numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE devis_modele_usages (
  id bigint DEFAULT nextval('devis_modele_usages_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  cle text NOT NULL,
  modele_id bigint,
  utilisations integer DEFAULT 0 NOT NULL,
  derniere_utilisation timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  montant_total numeric DEFAULT 0 NOT NULL
);

CREATE TABLE devis_modeles (
  id bigint DEFAULT nextval('devis_modeles_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  nom text NOT NULL,
  objet text,
  lignes jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  archive boolean DEFAULT false NOT NULL
);

CREATE TABLE diagnostic_email_historique (
  id bigint DEFAULT nextval('diagnostic_email_historique_id_seq'::regclass) NOT NULL,
  ready boolean DEFAULT false NOT NULL,
  key_present boolean DEFAULT false NOT NULL,
  domain_present boolean DEFAULT false NOT NULL,
  domain_name text,
  domain_status text,
  api_reachable boolean DEFAULT false NOT NULL,
  api_error text,
  checked_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE email_test_historique (
  id bigint DEFAULT nextval('email_test_historique_id_seq'::regclass) NOT NULL,
  user_id uuid,
  destinataire text NOT NULL,
  expediteur text,
  resultat text DEFAULT 'echec'::text NOT NULL,
  message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE envois_auto_tests (
  id bigint DEFAULT nextval('envois_auto_tests_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  automatisation_id text NOT NULL,
  automatisation_nom text NOT NULL,
  resultat text DEFAULT 'succes'::text NOT NULL,
  message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE envois_email (
  id bigint DEFAULT nextval('envois_email_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  facture_id bigint,
  devis_id bigint,
  relance_id bigint,
  type text DEFAULT 'facture'::text NOT NULL,
  destinataire text,
  sujet text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  canal text DEFAULT 'email'::text,
  groupe boolean DEFAULT false NOT NULL,
  mois_cle text,
  mode text,
  nb_lignes integer,
  pieces text,
  est_test boolean DEFAULT false
);

CREATE TABLE escalade_journal (
  id bigint DEFAULT nextval('escalade_journal_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  run_at timestamp with time zone DEFAULT now() NOT NULL,
  examined integer DEFAULT 0 NOT NULL,
  envoye integer DEFAULT 0 NOT NULL,
  echoue integer DEFAULT 0 NOT NULL,
  clients jsonb DEFAULT '[]'::jsonb NOT NULL,
  clients_echoues jsonb DEFAULT '[]'::jsonb,
  relances_echouees jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE etapes_chantier (
  id bigint DEFAULT nextval('etapes_chantier_id_seq'::regclass) NOT NULL,
  chantier_id bigint NOT NULL,
  libelle text NOT NULL,
  fait boolean DEFAULT false,
  photo_url text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE export_csv_mensuel_historique (
  id bigint DEFAULT nextval('export_csv_mensuel_historique_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  destinataires text,
  cc text,
  nb_reessais integer DEFAULT 0,
  nb_passages integer DEFAULT 0,
  test boolean DEFAULT false,
  statut text DEFAULT 'envoye'::text
);

CREATE TABLE factures (
  id bigint DEFAULT nextval('factures_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  devis_id bigint,
  client_id bigint,
  numero text NOT NULL,
  statut text DEFAULT 'Émise'::text NOT NULL,
  total_ht numeric DEFAULT 0 NOT NULL,
  total_ttc numeric DEFAULT 0 NOT NULL,
  date_emission date,
  date_echeance date,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  lignes jsonb DEFAULT '[]'::jsonb,
  date_paiement date
);

CREATE TABLE gestionnaires (
  id bigint NOT NULL,
  email text NOT NULL,
  voir_comptabilite boolean DEFAULT true NOT NULL,
  voir_mon_abonnement boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  libelle text,
  note text
);

CREATE TABLE gestionnaires_journal (
  id bigint DEFAULT nextval('gestionnaires_journal_id_seq'::regclass) NOT NULL,
  email text NOT NULL,
  action text NOT NULL,
  detail text,
  acteur_email text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE intervenants (
  id bigint NOT NULL,
  user_id uuid NOT NULL,
  nom text NOT NULL,
  couleur text,
  metier text,
  telephone text,
  actif boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE lignes_bibliotheque (
  id bigint DEFAULT nextval('lignes_bibliotheque_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  designation text NOT NULL,
  unite text DEFAULT 'u'::text NOT NULL,
  prix_unitaire numeric DEFAULT 0 NOT NULL,
  taux_tva numeric DEFAULT 20 NOT NULL,
  categorie text DEFAULT 'Général'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE lignes_devis (
  id bigint DEFAULT nextval('lignes_devis_id_seq'::regclass) NOT NULL,
  devis_id bigint NOT NULL,
  designation text NOT NULL,
  unite text,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  taux_tva numeric DEFAULT 20
);

CREATE TABLE mot_de_passe_alerte_historique (
  id bigint DEFAULT nextval('mot_de_passe_alerte_historique_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  destinataire text,
  anciennete_jours integer,
  manuel boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE mot_de_passe_recap_historique (
  id bigint DEFAULT nextval('mot_de_passe_recap_historique_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  mois_cle text NOT NULL,
  destinataire text,
  copie_comptable boolean DEFAULT false NOT NULL,
  manuel boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE order_headers (
  id bigint DEFAULT nextval('order_headers_id_seq'::regclass) NOT NULL,
  customer_id text,
  status text,
  customer_notes text,
  admin_notes text,
  tracking_number text,
  currency text DEFAULT 'USD'::text NOT NULL,
  shipping_total numeric DEFAULT 0,
  tax_total numeric DEFAULT 0,
  subtotal_items numeric DEFAULT 0,
  discount_price numeric DEFAULT 0,
  payment_provider text,
  checkout_session_id text,
  payment_id text,
  recipient jsonb DEFAULT jsonb_build_object() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE order_items (
  id bigint DEFAULT nextval('order_items_id_seq'::regclass) NOT NULL,
  order_id bigint NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL,
  sku_id text,
  sku_label text,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price numeric NOT NULL,
  final_price numeric DEFAULT 0,
  subtotal numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE paiements_echecs (
  id bigint DEFAULT nextval('paiements_echecs_id_seq'::regclass) NOT NULL,
  artisan_id uuid,
  artisan_email text,
  entreprise text,
  offre text,
  facturation text,
  montant_mensuel numeric,
  montant_total numeric,
  message text,
  source text DEFAULT 'create-stripe-checkout'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE parametres_app (
  id integer NOT NULL,
  essai_jours integer DEFAULT 14 NOT NULL,
  updated_by text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE parametres_podcast (
  id integer NOT NULL,
  episode_pilote_id text,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE planning_creneaux (
  id bigint DEFAULT nextval('planning_creneaux_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  date date NOT NULL,
  heure text,
  libelle text NOT NULL,
  ville text,
  chantier_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  intervenant_id bigint
);

CREATE TABLE preferences_affichage (
  user_id uuid NOT NULL,
  donnees jsonb,
  maj jsonb,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE product_categories (
  id bigint DEFAULT nextval('product_categories_id_seq'::regclass) NOT NULL,
  name text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE product_custom_fields (
  id bigint DEFAULT nextval('product_custom_fields_id_seq'::regclass) NOT NULL,
  name text NOT NULL,
  field_type text DEFAULT 'text'::text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  required boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE product_custom_values (
  id bigint DEFAULT nextval('product_custom_values_id_seq'::regclass) NOT NULL,
  product_id bigint NOT NULL,
  field_id bigint NOT NULL,
  value text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE product_items (
  id bigint DEFAULT nextval('product_items_id_seq'::regclass) NOT NULL,
  name text NOT NULL,
  category_id bigint,
  status text DEFAULT 'draft'::text NOT NULL,
  description text,
  pricing_mode integer DEFAULT 0,
  currency text DEFAULT 'USD'::text NOT NULL,
  price numeric DEFAULT 0,
  stock integer DEFAULT 0,
  discount_enabled boolean DEFAULT false NOT NULL,
  discount_price numeric DEFAULT NULL::numeric,
  media jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE product_skus (
  id bigint DEFAULT nextval('product_skus_id_seq'::regclass) NOT NULL,
  product_id bigint NOT NULL,
  label text,
  options jsonb DEFAULT '[]'::jsonb NOT NULL,
  price numeric DEFAULT 0,
  stock integer DEFAULT 0,
  discount_enabled boolean DEFAULT false NOT NULL,
  discount_price numeric DEFAULT NULL::numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE product_variants (
  id bigint DEFAULT nextval('product_variants_id_seq'::regclass) NOT NULL,
  product_id bigint NOT NULL,
  name text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE profiles (
  id uuid NOT NULL,
  email text,
  metier text,
  entreprise text,
  telephone text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  logo_url text,
  siret text,
  tva text,
  assurance text,
  email_sujet_devis text,
  email_corps_devis text,
  email_sujet_facture text,
  email_corps_facture text,
  email_sujet_relance text,
  penalites_retard text,
  relance_auto_actif boolean DEFAULT true,
  relance_seuil integer DEFAULT 3,
  relance_escalade_retard integer DEFAULT 30,
  recap_quotidien_actif boolean DEFAULT true,
  recap_canaux text[] DEFAULT ARRAY['Email'::text, 'SMS'::text, 'WhatsApp'::text],
  recap_heure integer DEFAULT 8 NOT NULL,
  pause_jusqu_au date,
  recap_dernier_envoi timestamp with time zone,
  recap_devis_seuil integer DEFAULT 7,
  relance_facture_auto_actif boolean DEFAULT true,
  relance_facture_seuil integer DEFAULT 30,
  relance_facture_delai_min integer DEFAULT 14,
  email_corps_relance text,
  rappel_relance_actif boolean DEFAULT true,
  rappel_relance_heure integer DEFAULT 17,
  decalage_favori integer,
  comptable_email text,
  comptable_auto_actif boolean DEFAULT false,
  comptable_auto_jour integer DEFAULT 1,
  comptable_auto_heure integer DEFAULT 8,
  comptable_auto_dernier_mois text,
  comptable_override_email text,
  comptable_commentaire text,
  comptable_rapport_auto_actif boolean DEFAULT false,
  comptable_export_periode text DEFAULT '12'::text,
  comptable_export_format text DEFAULT 'both'::text,
  comptable_relance_manquante_actif boolean DEFAULT false,
  comptable_relance_delai integer DEFAULT 3,
  comptable_relance_dernier_cle text,
  comptable_app_url text,
  comptable_rapport_copie_artisan boolean DEFAULT true,
  comptable_export_dernier text,
  comptable_bilan_auto_actif boolean DEFAULT false,
  comptable_bilan_jour integer DEFAULT 5,
  comptable_bilan_dernier_annee text,
  comptable_bilan_copie_artisan boolean DEFAULT true,
  comptable_override_email_defaut text,
  comptable_override_adresses jsonb DEFAULT '[]'::jsonb,
  comptable_bilan_alerte_snooze text,
  onboarding_done boolean DEFAULT false NOT NULL,
  sante_alerte_snooze text,
  taux_alerte_snooze text,
  encaissement_alerte_snooze text,
  recontact_rappel_jours integer DEFAULT 7,
  recontact_rappel_hebdo_actif boolean DEFAULT true,
  recontact_rappel_dernier_envoi timestamp with time zone,
  email_sujet_recontact text,
  email_corps_recontact text,
  recontact_taux_alerte integer DEFAULT 20,
  recontact_rappel_hebdo_jour integer DEFAULT 1,
  recontact_rappel_hebdo_heure integer DEFAULT 8,
  recontact_histo_periode text,
  recontact_oublies_alerte_snooze date,
  recontact_oublies_auto_jours integer,
  email_sujet_recontact_auto text,
  email_corps_recontact_auto text,
  recontact_oublies_alerte_email_actif boolean DEFAULT true,
  email_sujet_alerte_artisan text,
  email_corps_alerte_artisan text,
  recontact_alertes_graphe_mois integer,
  comptable_pack_message text,
  comptable_releve_message text,
  comptable_cc_email text,
  comptable_renvoi_destinataire text,
  comptable_remplacant_habituel text,
  envois_auto_recap_hebdo_actif boolean DEFAULT false,
  envois_auto_recap_hebdo_jour integer DEFAULT 1,
  envois_auto_recap_hebdo_heure integer DEFAULT 8,
  envois_auto_recap_hebdo_dernier_envoi timestamp with time zone,
  envois_auto_recap_hebdo_cc jsonb DEFAULT '[]'::jsonb,
  alerte_echec_test_actif boolean DEFAULT true,
  alerte_echec_test_email text,
  alerte_echec_test_dernier_ok_at timestamp with time zone,
  taux_alerte_email_actif boolean,
  taux_alerte_seuil integer,
  taux_alerte_jours integer,
  taux_alerte_dernier_envoi_at timestamp with time zone,
  taux_alerte_recap_hebdo_actif boolean DEFAULT false,
  taux_alerte_recap_hebdo_jour integer DEFAULT 1,
  taux_alerte_recap_hebdo_heure integer DEFAULT 8,
  taux_alerte_recap_hebdo_dernier_envoi timestamp with time zone,
  mot_de_passe_alerte_snooze date,
  mot_de_passe_changements jsonb DEFAULT '[]'::jsonb NOT NULL,
  mot_de_passe_alerte_email_at timestamp with time zone,
  mot_de_passe_alerte_email_actif boolean DEFAULT true,
  mot_de_passe_alerte_test_ok_at timestamp with time zone,
  mot_de_passe_recap_mensuel_dernier_mois text,
  mot_de_passe_recap_mensuel_actif boolean DEFAULT true,
  mot_de_passe_recap_mensuel_dernier_envoi_at timestamp with time zone,
  mot_de_passe_recap_mensuel_test_ok_at timestamp with time zone,
  mot_de_passe_recap_trimestre_dernier text,
  mot_de_passe_recap_annuel_actif boolean DEFAULT true,
  mot_de_passe_recap_annuel_dernier text,
  mot_de_passe_recap_trimestriel_actif boolean DEFAULT true,
  mot_de_passe_comparatif_annuel_actif boolean DEFAULT true,
  mot_de_passe_comparatif_annuel_dernier text,
  mot_de_passe_comparatif_annuel_test_ok_at timestamp with time zone,
  mot_de_passe_comparatif_fenetre integer DEFAULT 12,
  export_csv_mensuel_actif boolean DEFAULT false,
  export_csv_mensuel_jour integer DEFAULT 1,
  export_csv_mensuel_heure integer DEFAULT 8,
  export_csv_mensuel_dernier_envoi timestamp with time zone,
  export_csv_mensuel_cc text,
  echecs_blanc_recap_hebdo_actif boolean DEFAULT false,
  echecs_blanc_recap_hebdo_jour integer DEFAULT 1,
  echecs_blanc_recap_hebdo_heure integer DEFAULT 8,
  echecs_blanc_recap_hebdo_dernier_envoi timestamp with time zone,
  echecs_blanc_recap_hebdo_fenetre integer DEFAULT 7,
  echecs_blanc_recap_alerte_retard_dernier timestamp with time zone,
  echecs_blanc_recap_alerte_seuil integer DEFAULT 30,
  echecs_blanc_recap_alerte_cc jsonb DEFAULT '[]'::jsonb,
  echecs_blanc_recap_hebdo_cc jsonb DEFAULT '[]'::jsonb,
  echecs_blanc_recap_annuel_actif boolean DEFAULT true,
  echecs_blanc_recap_annuel_dernier text,
  echecs_blanc_recap_annuel_jour integer,
  echecs_blanc_recap_annuel_heure integer,
  echecs_blanc_recap_annuel_relance_dernier text,
  echecs_blanc_recap_annuel_relance_delai integer DEFAULT 15,
  echecs_blanc_recap_annuel_cc_comptable boolean DEFAULT false
);

CREATE TABLE recap_alertes_artisan (
  id bigint NOT NULL,
  user_id uuid NOT NULL,
  envoye_le timestamp with time zone DEFAULT now() NOT NULL,
  nb_comptes integer DEFAULT 0 NOT NULL,
  abonnement_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  comptes jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE recap_alertes_stripe_envois (
  id bigint DEFAULT nextval('recap_alertes_stripe_envois_id_seq'::regclass) NOT NULL,
  nb_alertes integer DEFAULT 0 NOT NULL,
  destinataires text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE recap_echecs_annuel_relances (
  id bigint DEFAULT nextval('recap_echecs_annuel_relances_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  exercice text NOT NULL,
  source text DEFAULT 'auto'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE recap_echecs_blanc_envois (
  id bigint DEFAULT nextval('recap_echecs_blanc_envois_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  source text DEFAULT 'manuel'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE recap_echecs_paiement_envois (
  id bigint DEFAULT nextval('recap_echecs_paiement_envois_id_seq'::regclass) NOT NULL,
  nb_echecs integer DEFAULT 0 NOT NULL,
  periode_jours integer DEFAULT 7 NOT NULL,
  destinataires text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE recap_envois (
  id bigint NOT NULL,
  user_id uuid NOT NULL,
  envoye_le timestamp with time zone DEFAULT now() NOT NULL,
  repros integer DEFAULT 0 NOT NULL,
  echecs integer DEFAULT 0 NOT NULL,
  factures integer DEFAULT 0 NOT NULL,
  devis integer DEFAULT 0 NOT NULL
);

CREATE TABLE recap_recontact_envois (
  id bigint DEFAULT nextval('recap_recontact_envois_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  envoye_le timestamp with time zone DEFAULT now() NOT NULL,
  nb_comptes integer DEFAULT 0 NOT NULL,
  origine text DEFAULT 'auto'::text NOT NULL,
  abonnement_ids jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE recontacts_artisans (
  id bigint DEFAULT nextval('recontacts_artisans_id_seq'::regclass) NOT NULL,
  abonnement_id bigint,
  artisan_id uuid,
  entreprise text,
  email text,
  sujet text,
  statut text DEFAULT 'envoye'::text NOT NULL,
  erreur text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  origine text DEFAULT 'manuel'::text
);

CREATE TABLE reessais_envoi_historique (
  id bigint DEFAULT nextval('reessais_envoi_historique_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  fenetre_jours integer DEFAULT 1 NOT NULL,
  relances_relancees integer DEFAULT 0 NOT NULL,
  relances_echouees integer DEFAULT 0 NOT NULL,
  test_relance boolean DEFAULT false NOT NULL,
  resume text
);

CREATE TABLE rejeux_blanc_historique (
  id bigint DEFAULT nextval('rejeux_blanc_historique_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  automatisation_id text NOT NULL,
  automatisation_nom text NOT NULL,
  destinataire text,
  ok boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE relance_facture_envois (
  id bigint DEFAULT nextval('relance_facture_envois_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  facture_id bigint,
  client_id bigint,
  client_nom text,
  numero text,
  montant numeric,
  jours_retard integer DEFAULT 0,
  palier integer DEFAULT 0,
  auto boolean DEFAULT false,
  envoye_le timestamp with time zone DEFAULT now()
);

CREATE TABLE relance_reprogrammations (
  id bigint DEFAULT nextval('relance_reprogrammations_id_seq'::regclass) NOT NULL,
  relance_id bigint NOT NULL,
  ancienne_date date,
  nouvelle_date date,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE relances (
  id bigint DEFAULT nextval('relances_id_seq'::regclass) NOT NULL,
  devis_id bigint NOT NULL,
  canal text DEFAULT 'email'::text,
  date_prevue date,
  statut text DEFAULT 'prevue'::text,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  reprogrammations integer DEFAULT 0 NOT NULL,
  escalade_auto boolean DEFAULT false NOT NULL,
  escalade_le timestamp with time zone
);

CREATE TABLE relances_client (
  id bigint NOT NULL,
  user_id uuid NOT NULL,
  client_id bigint NOT NULL,
  message text,
  date_prevue date NOT NULL,
  statut text DEFAULT 'Programmée'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  envoye_le timestamp with time zone,
  rappel_envoye_le timestamp with time zone,
  motif_echec text
);

CREATE TABLE sante_scores (
  id bigint DEFAULT nextval('sante_scores_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  semaine date NOT NULL,
  score integer NOT NULL,
  emails_manquants integer DEFAULT 0 NOT NULL,
  echecs integer DEFAULT 0 NOT NULL,
  mois_manquants integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE taux_alerte_historique (
  id bigint DEFAULT nextval('taux_alerte_historique_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  taux integer NOT NULL,
  seuil integer NOT NULL,
  jours integer NOT NULL,
  total integer DEFAULT 0 NOT NULL,
  echecs integer DEFAULT 0 NOT NULL,
  manuel boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE test_abonnement_essai_historique (
  id bigint NOT NULL,
  auteur_email text,
  ok boolean DEFAULT false NOT NULL,
  essai_jours integer,
  statut text,
  subscription_id text,
  montant_facture numeric,
  message text,
  detail jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE test_paiement_blanc_historique (
  id bigint NOT NULL,
  auteur_email text,
  ok boolean DEFAULT false NOT NULL,
  mode text DEFAULT 'test'::text,
  session_id text,
  message text,
  detail jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------
-- 2. CLES PRIMAIRES
-- ---------------------------------------------------------------------

ALTER TABLE abonnement_historique           ADD CONSTRAINT abonnement_historique_pkey PRIMARY KEY (id);
ALTER TABLE abonnements                     ADD CONSTRAINT abonnements_pkey PRIMARY KEY (id);
ALTER TABLE acces_ouvert_autorise           ADD CONSTRAINT acces_ouvert_autorise_pkey PRIMARY KEY (table_name);
ALTER TABLE alerte_config_stripe            ADD CONSTRAINT alerte_config_stripe_pkey PRIMARY KEY (id);
ALTER TABLE back_office_note                ADD CONSTRAINT back_office_note_pkey PRIMARY KEY (id);
ALTER TABLE chantiers                       ADD CONSTRAINT chantiers_pkey PRIMARY KEY (id);
ALTER TABLE clients                         ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE comptable_remplacements         ADD CONSTRAINT comptable_remplacements_pkey PRIMARY KEY (id);
ALTER TABLE devis                           ADD CONSTRAINT devis_pkey PRIMARY KEY (id);
ALTER TABLE devis_modele_usage_events       ADD CONSTRAINT devis_modele_usage_events_pkey PRIMARY KEY (id);
ALTER TABLE devis_modele_usages             ADD CONSTRAINT devis_modele_usages_pkey PRIMARY KEY (id);
ALTER TABLE devis_modeles                   ADD CONSTRAINT devis_modeles_pkey PRIMARY KEY (id);
ALTER TABLE diagnostic_email_historique     ADD CONSTRAINT diagnostic_email_historique_pkey PRIMARY KEY (id);
ALTER TABLE email_test_historique           ADD CONSTRAINT email_test_historique_pkey PRIMARY KEY (id);
ALTER TABLE envois_auto_tests               ADD CONSTRAINT envois_auto_tests_pkey PRIMARY KEY (id);
ALTER TABLE envois_email                    ADD CONSTRAINT envois_email_pkey PRIMARY KEY (id);
ALTER TABLE escalade_journal                ADD CONSTRAINT escalade_journal_pkey PRIMARY KEY (id);
ALTER TABLE etapes_chantier                 ADD CONSTRAINT etapes_chantier_pkey PRIMARY KEY (id);
ALTER TABLE export_csv_mensuel_historique   ADD CONSTRAINT export_csv_mensuel_historique_pkey PRIMARY KEY (id);
ALTER TABLE factures                        ADD CONSTRAINT factures_pkey PRIMARY KEY (id);
ALTER TABLE gestionnaires                   ADD CONSTRAINT gestionnaires_pkey PRIMARY KEY (id);
ALTER TABLE gestionnaires_journal           ADD CONSTRAINT gestionnaires_journal_pkey PRIMARY KEY (id);
ALTER TABLE intervenants                    ADD CONSTRAINT intervenants_pkey PRIMARY KEY (id);
ALTER TABLE lignes_bibliotheque             ADD CONSTRAINT lignes_bibliotheque_pkey PRIMARY KEY (id);
ALTER TABLE lignes_devis                    ADD CONSTRAINT lignes_devis_pkey PRIMARY KEY (id);
ALTER TABLE mot_de_passe_alerte_historique  ADD CONSTRAINT mot_de_passe_alerte_historique_pkey PRIMARY KEY (id);
ALTER TABLE mot_de_passe_recap_historique   ADD CONSTRAINT mot_de_passe_recap_historique_pkey PRIMARY KEY (id);
ALTER TABLE order_headers                   ADD CONSTRAINT order_headers_pkey PRIMARY KEY (id);
ALTER TABLE order_items                     ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE paiements_echecs                ADD CONSTRAINT paiements_echecs_pkey PRIMARY KEY (id);
ALTER TABLE parametres_app                  ADD CONSTRAINT parametres_app_pkey PRIMARY KEY (id);
ALTER TABLE parametres_podcast              ADD CONSTRAINT parametres_podcast_pkey PRIMARY KEY (id);
ALTER TABLE planning_creneaux               ADD CONSTRAINT planning_creneaux_pkey PRIMARY KEY (id);
ALTER TABLE preferences_affichage           ADD CONSTRAINT preferences_affichage_pkey PRIMARY KEY (user_id);
ALTER TABLE product_categories              ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);
ALTER TABLE product_custom_fields           ADD CONSTRAINT product_custom_fields_pkey PRIMARY KEY (id);
ALTER TABLE product_custom_values           ADD CONSTRAINT product_custom_values_pkey PRIMARY KEY (id);
ALTER TABLE product_items                   ADD CONSTRAINT product_items_pkey PRIMARY KEY (id);
ALTER TABLE product_skus                    ADD CONSTRAINT product_skus_pkey PRIMARY KEY (id);
ALTER TABLE product_variants                ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);
ALTER TABLE profiles                        ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE recap_alertes_artisan           ADD CONSTRAINT recap_alertes_artisan_pkey PRIMARY KEY (id);
ALTER TABLE recap_alertes_stripe_envois     ADD CONSTRAINT recap_alertes_stripe_envois_pkey PRIMARY KEY (id);
ALTER TABLE recap_echecs_annuel_relances    ADD CONSTRAINT recap_echecs_annuel_relances_pkey PRIMARY KEY (id);
ALTER TABLE recap_echecs_blanc_envois       ADD CONSTRAINT recap_echecs_blanc_envois_pkey PRIMARY KEY (id);
ALTER TABLE recap_echecs_paiement_envois    ADD CONSTRAINT recap_echecs_paiement_envois_pkey PRIMARY KEY (id);
ALTER TABLE recap_envois                    ADD CONSTRAINT recap_envois_pkey PRIMARY KEY (id);
ALTER TABLE recap_recontact_envois          ADD CONSTRAINT recap_recontact_envois_pkey PRIMARY KEY (id);
ALTER TABLE recontacts_artisans             ADD CONSTRAINT recontacts_artisans_pkey PRIMARY KEY (id);
ALTER TABLE reessais_envoi_historique       ADD CONSTRAINT reessais_envoi_historique_pkey PRIMARY KEY (id);
ALTER TABLE rejeux_blanc_historique         ADD CONSTRAINT rejeux_blanc_historique_pkey PRIMARY KEY (id);
ALTER TABLE relance_facture_envois          ADD CONSTRAINT relance_facture_envois_pkey PRIMARY KEY (id);
ALTER TABLE relance_reprogrammations        ADD CONSTRAINT relance_reprogrammations_pkey PRIMARY KEY (id);
ALTER TABLE relances                        ADD CONSTRAINT relances_pkey PRIMARY KEY (id);
ALTER TABLE relances_client                 ADD CONSTRAINT relances_client_pkey PRIMARY KEY (id);
ALTER TABLE sante_scores                    ADD CONSTRAINT sante_scores_pkey PRIMARY KEY (id);
ALTER TABLE taux_alerte_historique          ADD CONSTRAINT taux_alerte_historique_pkey PRIMARY KEY (id);
ALTER TABLE test_abonnement_essai_historique ADD CONSTRAINT test_abonnement_essai_historique_pkey PRIMARY KEY (id);
ALTER TABLE test_paiement_blanc_historique  ADD CONSTRAINT test_paiement_blanc_historique_pkey PRIMARY KEY (id);

-- ---------------------------------------------------------------------
-- 3. CONTRAINTES UNIQUES
-- ---------------------------------------------------------------------

ALTER TABLE devis_modele_usages     ADD CONSTRAINT devis_modele_usages_user_id_cle_key UNIQUE (user_id, cle);
ALTER TABLE product_custom_values   ADD CONSTRAINT product_custom_values_product_id_field_id_key UNIQUE (product_id, field_id);

-- ---------------------------------------------------------------------
-- 4. CLES ETRANGERES
-- ---------------------------------------------------------------------

ALTER TABLE profiles              ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id);
ALTER TABLE clients               ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id);
ALTER TABLE chantiers             ADD CONSTRAINT chantiers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id);
ALTER TABLE chantiers             ADD CONSTRAINT chantiers_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients (id);
ALTER TABLE chantiers             ADD CONSTRAINT chantiers_intervenant_id_fkey FOREIGN KEY (intervenant_id) REFERENCES intervenants (id);
ALTER TABLE devis                 ADD CONSTRAINT devis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id);
ALTER TABLE devis                 ADD CONSTRAINT devis_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients (id);
ALTER TABLE etapes_chantier       ADD CONSTRAINT etapes_chantier_chantier_id_fkey FOREIGN KEY (chantier_id) REFERENCES chantiers (id);
ALTER TABLE lignes_devis          ADD CONSTRAINT lignes_devis_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES devis (id);
ALTER TABLE relances              ADD CONSTRAINT relances_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES devis (id);
ALTER TABLE planning_creneaux     ADD CONSTRAINT planning_creneaux_intervenant_id_fkey FOREIGN KEY (intervenant_id) REFERENCES intervenants (id);
ALTER TABLE preferences_affichage ADD CONSTRAINT preferences_affichage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id);
ALTER TABLE product_items         ADD CONSTRAINT product_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES product_categories (id);
ALTER TABLE product_variants      ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES product_items (id);
ALTER TABLE product_skus          ADD CONSTRAINT product_skus_product_id_fkey FOREIGN KEY (product_id) REFERENCES product_items (id);
ALTER TABLE product_custom_values ADD CONSTRAINT product_custom_values_product_id_fkey FOREIGN KEY (product_id) REFERENCES product_items (id);
ALTER TABLE product_custom_values ADD CONSTRAINT product_custom_values_field_id_fkey FOREIGN KEY (field_id) REFERENCES product_custom_fields (id);
ALTER TABLE order_items           ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES order_headers (id);

-- =====================================================================
-- Fin du script - 59 tables
-- =====================================================================