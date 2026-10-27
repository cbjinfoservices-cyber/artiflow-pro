-- Valeurs par défaut absentes de la description API de Readdy (listes, tableaux, objets JSON) :
-- reprises de docs/schema-base.sql, et liste vide pour les colonnes ajoutées depuis.

ALTER TABLE public.order_headers ALTER COLUMN recipient SET DEFAULT jsonb_build_object();
ALTER TABLE public.product_custom_fields ALTER COLUMN options SET DEFAULT '[]'::jsonb;
ALTER TABLE public.product_skus ALTER COLUMN options SET DEFAULT '[]'::jsonb;
ALTER TABLE public.product_skus ALTER COLUMN discount_price SET DEFAULT NULL::numeric;
ALTER TABLE public.escalade_journal ALTER COLUMN clients SET DEFAULT '[]'::jsonb;
ALTER TABLE public.escalade_journal ALTER COLUMN clients_echoues SET DEFAULT '[]'::jsonb;
ALTER TABLE public.escalade_journal ALTER COLUMN relances_echouees SET DEFAULT '[]'::jsonb;
ALTER TABLE public.factures ALTER COLUMN lignes SET DEFAULT '[]'::jsonb;
ALTER TABLE public.devis_modeles ALTER COLUMN lignes SET DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN recap_canaux SET DEFAULT ARRAY['Email'::text, 'SMS'::text, 'WhatsApp'::text];
ALTER TABLE public.profiles ALTER COLUMN comptable_override_adresses SET DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN envois_auto_recap_hebdo_cc SET DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN mot_de_passe_changements SET DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN echecs_blanc_recap_alerte_cc SET DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN echecs_blanc_recap_hebdo_cc SET DEFAULT '[]'::jsonb;
ALTER TABLE public.recap_alertes_artisan ALTER COLUMN abonnement_ids SET DEFAULT '[]'::jsonb;
ALTER TABLE public.recap_alertes_artisan ALTER COLUMN comptes SET DEFAULT '[]'::jsonb;
ALTER TABLE public.product_variants ALTER COLUMN options SET DEFAULT '[]'::jsonb;
ALTER TABLE public.recap_recontact_envois ALTER COLUMN abonnement_ids SET DEFAULT '[]'::jsonb;
ALTER TABLE public.product_items ALTER COLUMN discount_price SET DEFAULT NULL::numeric;
ALTER TABLE public.product_items ALTER COLUMN media SET DEFAULT '[]'::jsonb;

-- Colonnes ajoutées après le document : liste vide par défaut.
ALTER TABLE public.profiles ALTER COLUMN recap_chantiers_ccs SET DEFAULT '[]'::jsonb;
ALTER TABLE public.pv_recettes ALTER COLUMN conformite SET DEFAULT '[]'::jsonb;
ALTER TABLE public.pv_recettes ALTER COLUMN photos SET DEFAULT '[]'::jsonb;
ALTER TABLE public.facture_modeles ALTER COLUMN lignes SET DEFAULT '[]'::jsonb;
