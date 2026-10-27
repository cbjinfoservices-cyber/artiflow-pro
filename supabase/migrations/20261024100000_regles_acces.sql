-- =====================================================================
-- Règles d'accès d'ArtiFlow-pro (RLS), fonctions et automatismes.
--
-- Principe : le site interroge la base avec le compte de la personne connectée et s'appuie
-- sur ces règles pour ne lui montrer que ses propres données (les requêtes du site ne filtrent
-- pas toujours elles-mêmes par compte). Les fonctions serveur utilisent la clé « service_role »,
-- qui contourne ces règles : c'est volontaire, elles font leurs propres vérifications.
--
-- Rôles :
--   - artisan       : propriétaire de ses données (colonne user_id, ou artisan_id pour l'abonnement) ;
--   - intervenant   : compte relié à une fiche « intervenants » (compte_id), accès à son planning,
--                     ses pointages et ses PV de recette, rien d'autre de l'entreprise ;
--   - gestionnaire  : back-office (adresse principale, ou listée dans « gestionnaires »). Il voit
--                     les abonnements et les journaux techniques, PAS les fichiers clients, devis
--                     ou factures des artisans.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fonctions d'identification des rôles
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.email_connecte()
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT lower(coalesce(auth.jwt() ->> 'email', '')) $$;

CREATE OR REPLACE FUNCTION public.est_gestionnaire_principal()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT public.email_connecte() = 'cbj.infoservices@gmail.com' $$;

-- SECURITY DEFINER : lit la liste des gestionnaires sans dépendre des règles de cette table.
CREATE OR REPLACE FUNCTION public.est_gestionnaire()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.est_gestionnaire_principal()
      OR EXISTS (SELECT 1 FROM public.gestionnaires g WHERE lower(g.email) = public.email_connecte() AND public.email_connecte() <> '')
$$;

-- Vrai si la personne connectée est le compte intervenant actif de cette fiche, chez cet artisan.
CREATE OR REPLACE FUNCTION public.est_intervenant_de(p_proprietaire uuid, p_intervenant bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.intervenants i
    WHERE i.id = p_intervenant AND i.user_id = p_proprietaire AND i.compte_id = auth.uid() AND i.actif
  )
$$;

-- Propriété des tables « enfants » (sans colonne user_id) : vérifiée via la table parente.
CREATE OR REPLACE FUNCTION public.devis_m_appartient(p_devis bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.devis d WHERE d.id = p_devis AND d.user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.chantier_m_appartient(p_chantier bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.chantiers c WHERE c.id = p_chantier AND c.user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.relance_m_appartient(p_relance bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.relances r JOIN public.devis d ON d.id = r.devis_id
    WHERE r.id = p_relance AND d.user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.email_connecte(), public.est_gestionnaire_principal(), public.est_gestionnaire(),
  public.est_intervenant_de(uuid, bigint), public.devis_m_appartient(bigint), public.chantier_m_appartient(bigint),
  public.relance_m_appartient(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_connecte(), public.est_gestionnaire_principal(), public.est_gestionnaire(),
  public.est_intervenant_de(uuid, bigint), public.devis_m_appartient(bigint), public.chantier_m_appartient(bigint),
  public.relance_m_appartient(bigint) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. RLS activée partout : sans règle explicite, aucune ligne n'est accessible.
-- ---------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Données métier de l'artisan : accès réservé au propriétaire (user_id).
--    Les gestionnaires n'y ont PAS accès (fichiers clients, devis, factures…).
-- ---------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'devis', 'factures', 'chantiers', 'relances_client', 'lignes_bibliotheque',
    'devis_modeles', 'facture_modeles', 'devis_modele_usages', 'devis_modele_usage_events',
    'comptable_remplacements', 'preferences_affichage', 'rappels_conflits_config',
    'conflits_conges_traites', 'alertes_conflit_conge', 'envois_liste_conflits',
    'suivi_notifications', 'sante_scores', 'envois_email'
  ] LOOP
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))$f$, t || '_proprietaire', t);
  END LOOP;
END $$;

-- Tables enfants : propriété vérifiée via le devis, le chantier ou la relance parente.
CREATE POLICY lignes_devis_proprietaire ON public.lignes_devis FOR ALL TO authenticated
  USING (public.devis_m_appartient(devis_id)) WITH CHECK (public.devis_m_appartient(devis_id));
CREATE POLICY relances_proprietaire ON public.relances FOR ALL TO authenticated
  USING (public.devis_m_appartient(devis_id)) WITH CHECK (public.devis_m_appartient(devis_id));
CREATE POLICY etapes_chantier_proprietaire ON public.etapes_chantier FOR ALL TO authenticated
  USING (public.chantier_m_appartient(chantier_id)) WITH CHECK (public.chantier_m_appartient(chantier_id));
CREATE POLICY relance_reprogrammations_proprietaire ON public.relance_reprogrammations FOR ALL TO authenticated
  USING (public.relance_m_appartient(relance_id)) WITH CHECK (public.relance_m_appartient(relance_id));

-- ---------------------------------------------------------------------
-- 4. Équipe : fiches intervenants, planning, pointages, PV de recette.
--    (Les règles de lecture et les règles restrictives des intervenants et du planning sont
--     dans la migration 20261015223000 ; on ajoute ici les droits d'écriture du propriétaire.)
-- ---------------------------------------------------------------------

CREATE POLICY intervenants_ecriture_proprietaire ON public.intervenants FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY intervenants_maj_proprietaire ON public.intervenants FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY intervenants_suppression_proprietaire ON public.intervenants FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY planning_creneaux_ecriture_proprietaire ON public.planning_creneaux FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY planning_creneaux_maj_proprietaire ON public.planning_creneaux FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY planning_creneaux_suppression_proprietaire ON public.planning_creneaux FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Pointages et PV : l'artisan, ou l'intervenant concerné (qui les remplit depuis l'application terrain).
CREATE POLICY pointages_proprietaire_ou_intervenant ON public.pointages FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.est_intervenant_de(user_id, intervenant_id))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.est_intervenant_de(user_id, intervenant_id));
CREATE POLICY pv_recettes_proprietaire_ou_intervenant ON public.pv_recettes FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.est_intervenant_de(user_id, intervenant_id))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.est_intervenant_de(user_id, intervenant_id));

-- ---------------------------------------------------------------------
-- 5. Profil : le sien ; les gestionnaires voient tous les profils (liste des pros inscrits).
-- ---------------------------------------------------------------------

CREATE POLICY profiles_proprietaire ON public.profiles FOR ALL TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_lecture_gestionnaire ON public.profiles FOR SELECT TO authenticated
  USING (public.est_gestionnaire());

-- ---------------------------------------------------------------------
-- 6. Journaux techniques de l'artisan : le sien ; lecture de tous pour les gestionnaires.
-- ---------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'email_test_historique', 'envois_auto_tests', 'escalade_journal', 'export_csv_mensuel_historique',
    'mot_de_passe_alerte_historique', 'mot_de_passe_recap_historique', 'recap_alertes_artisan',
    'recap_echecs_annuel_relances', 'recap_echecs_blanc_envois', 'recap_envois', 'recap_recontact_envois',
    'reessais_envoi_historique', 'rejeux_blanc_historique', 'relance_facture_envois',
    'taux_alerte_historique', 'astuces_signalements'
  ] LOOP
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))$f$, t || '_proprietaire', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (public.est_gestionnaire())$f$, t || '_lecture_gestionnaire', t);
  END LOOP;
END $$;

-- Demandes de suppression de compte : lecture seule (écritures par les fonctions serveur).
CREATE POLICY suppressions_compte_lecture ON public.suppressions_compte FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.est_gestionnaire());

-- ---------------------------------------------------------------------
-- 7. Abonnements (colonne artisan_id). Les gestionnaires gèrent tout ; l'artisan lit le sien et
--    ne peut modifier que des champs descriptifs (verrou par déclencheur, section 10).
-- ---------------------------------------------------------------------

CREATE POLICY abonnements_lecture ON public.abonnements FOR SELECT TO authenticated
  USING (
    artisan_id = (SELECT auth.uid())
    OR (artisan_id IS NULL AND lower(email) = public.email_connecte())
    OR public.est_gestionnaire()
  );
CREATE POLICY abonnements_creation ON public.abonnements FOR INSERT TO authenticated
  WITH CHECK (artisan_id = (SELECT auth.uid()) OR public.est_gestionnaire());
CREATE POLICY abonnements_maj ON public.abonnements FOR UPDATE TO authenticated
  USING (artisan_id = (SELECT auth.uid()) OR public.est_gestionnaire())
  WITH CHECK (artisan_id = (SELECT auth.uid()) OR public.est_gestionnaire());
CREATE POLICY abonnements_suppression ON public.abonnements FOR DELETE TO authenticated
  USING (public.est_gestionnaire());

CREATE POLICY abonnement_historique_lecture ON public.abonnement_historique FOR SELECT TO authenticated
  USING (artisan_id = (SELECT auth.uid()) OR public.est_gestionnaire());
CREATE POLICY abonnement_historique_creation ON public.abonnement_historique FOR INSERT TO authenticated
  WITH CHECK (artisan_id = (SELECT auth.uid()) OR public.est_gestionnaire());

CREATE POLICY paiements_echecs_lecture ON public.paiements_echecs FOR SELECT TO authenticated
  USING (artisan_id = (SELECT auth.uid()) OR public.est_gestionnaire());

CREATE POLICY recontacts_artisans_gestionnaire ON public.recontacts_artisans FOR ALL TO authenticated
  USING (public.est_gestionnaire()) WITH CHECK (public.est_gestionnaire());
CREATE POLICY recontacts_artisans_lecture_artisan ON public.recontacts_artisans FOR SELECT TO authenticated
  USING (artisan_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------
-- 8. Back-office uniquement.
-- ---------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alerte_config_stripe', 'back_office_note', 'diagnostic_email_historique', 'envoi_fournisseur_historique',
    'recap_echecs_paiement_envois', 'recap_alertes_stripe_envois', 'test_abonnement_essai_historique',
    'test_paiement_blanc_historique', 'brevo_taux_alerte_historique'
  ] LOOP
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (public.est_gestionnaire()) WITH CHECK (public.est_gestionnaire())$f$, t || '_gestionnaire', t);
  END LOOP;
END $$;

CREATE POLICY gestionnaires_journal_lecture ON public.gestionnaires_journal FOR SELECT TO authenticated
  USING (public.est_gestionnaire());

-- Liste des gestionnaires : chacun voit sa propre ligne (pour connaître ses droits), les
-- gestionnaires voient toute la liste, seul le gestionnaire principal la modifie.
CREATE POLICY gestionnaires_lecture ON public.gestionnaires FOR SELECT TO authenticated
  USING (lower(email) = public.email_connecte() OR public.est_gestionnaire());
CREATE POLICY gestionnaires_creation ON public.gestionnaires FOR INSERT TO authenticated
  WITH CHECK (public.est_gestionnaire_principal());
CREATE POLICY gestionnaires_maj ON public.gestionnaires FOR UPDATE TO authenticated
  USING (public.est_gestionnaire_principal()) WITH CHECK (public.est_gestionnaire_principal());
CREATE POLICY gestionnaires_suppression ON public.gestionnaires FOR DELETE TO authenticated
  USING (public.est_gestionnaire_principal());

-- Paramètres de l'application : lisibles par tous (durée d'essai affichée sur le site public),
-- modifiables par les gestionnaires.
CREATE POLICY parametres_app_lecture ON public.parametres_app FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY parametres_app_ecriture ON public.parametres_app FOR INSERT TO authenticated
  WITH CHECK (public.est_gestionnaire());
CREATE POLICY parametres_app_maj ON public.parametres_app FOR UPDATE TO authenticated
  USING (public.est_gestionnaire()) WITH CHECK (public.est_gestionnaire());
CREATE POLICY parametres_podcast_lecture ON public.parametres_podcast FOR SELECT TO anon, authenticated USING (true);

-- Tables héritées du modèle Readdy (boutique), inutilisées : RLS active, aucune règle → fermées.
-- order_headers, order_items, product_* , acces_ouvert_autorise.

-- Liste blanche du contrôle « accès ouverts » du back-office (lectures publiques assumées).
INSERT INTO public.acces_ouvert_autorise (table_name, raison) VALUES
  ('parametres_app', 'Durée d''essai et réglages non sensibles, affichés sur le site public.'),
  ('parametres_podcast', 'Épisode pilote du podcast, affiché sur le site public.');

-- ---------------------------------------------------------------------
-- 9. Fonctions appelées par le site
-- ---------------------------------------------------------------------

-- Compteur d'utilisation d'un modèle de devis (atomique, pour l'utilisateur connecté).
CREATE OR REPLACE FUNCTION public.increment_modele_usage(p_cle text, p_modele_id bigint DEFAULT NULL, p_montant numeric DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  INSERT INTO public.devis_modele_usages (user_id, cle, modele_id, utilisations, derniere_utilisation, montant_total)
  VALUES (auth.uid(), p_cle, p_modele_id, 1, now(), coalesce(p_montant, 0))
  ON CONFLICT (user_id, cle) DO UPDATE
    SET utilisations = public.devis_modele_usages.utilisations + 1,
        derniere_utilisation = now(),
        modele_id = coalesce(excluded.modele_id, public.devis_modele_usages.modele_id),
        montant_total = public.devis_modele_usages.montant_total + coalesce(p_montant, 0);
  INSERT INTO public.devis_modele_usage_events (user_id, cle, montant) VALUES (auth.uid(), p_cle, coalesce(p_montant, 0));
END $$;

-- Contrôle de sécurité du back-office : tables sans RLS, ou avec une règle « ouverte à tous »
-- (USING true / WITH CHECK true) absente de la liste blanche.
CREATE OR REPLACE FUNCTION public.verifier_acces_ouverts()
RETURNS TABLE (table_name text, probleme text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.est_gestionnaire() THEN
    RETURN QUERY SELECT NULL::text, 'non_autorise'::text, 'Contrôle réservé aux gestionnaires.'::text;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT c.relname::text, 'rls_desactivee'::text, 'La sécurité par ligne (RLS) est désactivée sur cette table.'::text
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    UNION ALL
    SELECT p.tablename::text, 'policy_ouverte'::text,
           format('La règle « %s » autorise tout le monde (%s).', p.policyname, p.cmd)
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (trim(coalesce(p.qual, '')) = 'true' OR trim(coalesce(p.with_check, '')) = 'true')
      AND p.tablename NOT IN (SELECT a.table_name FROM public.acces_ouvert_autorise a);
END $$;

-- Régularité comptable de tous les artisans (back-office). Un artisan est « suivi » s'il a activé
-- l'envoi automatique de son journal ; ses mois manquants sont comptés comme dans le site
-- (src/lib/comptableRegularite.ts) : du mois suivant son premier envoi automatique au mois écoulé.
CREATE OR REPLACE FUNCTION public.regu_comptable_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mois_courant date := date_trunc('month', now() AT TIME ZONE 'Europe/Paris')::date;
  resultat jsonb;
BEGIN
  IF NOT public.est_gestionnaire() THEN
    RETURN jsonb_build_object('error', 'non_autorise');
  END IF;

  WITH envois AS (
    SELECT e.user_id, e.created_at, date_trunc('month', e.created_at AT TIME ZONE 'Europe/Paris')::date AS mois
    FROM public.envois_email e
    WHERE e.type = 'comptable' AND lower(coalesce(e.mode, '')) = 'automatique'
  ),
  suivis AS (
    SELECT p.id AS user_id, (SELECT min(v.mois) FROM envois v WHERE v.user_id = p.id) AS premier
    FROM public.profiles p
    WHERE p.comptable_auto_actif IS TRUE
  ),
  manquants AS (
    SELECT s.user_id,
      (SELECT count(*) FROM generate_series(s.premier + interval '1 month', mois_courant - interval '1 month', interval '1 month') AS m(mois)
       WHERE NOT EXISTS (SELECT 1 FROM envois v WHERE v.user_id = s.user_id AND v.mois = m.mois::date))::int AS nb
    FROM suivis s WHERE s.premier IS NOT NULL
  ),
  serie AS (
    SELECT m.mois::date AS mois
    FROM generate_series(mois_courant - interval '6 months', mois_courant - interval '1 month', interval '1 month') AS m(mois)
  )
  SELECT jsonb_build_object(
    'artisansSuivis',       (SELECT count(*) FROM suivis),
    'artisansReguliers',    (SELECT count(*) FROM manquants WHERE nb = 0),
    'artisansRetard',       (SELECT count(*) FROM manquants WHERE nb > 0),
    'artisansSansEnvoi',    (SELECT count(*) FROM suivis WHERE premier IS NULL),
    'moisManquantsTotal',   (SELECT coalesce(sum(nb), 0) FROM manquants),
    'envoisAutoMoisEcoule', (SELECT count(*) FROM envois WHERE mois = mois_courant - interval '1 month'),
    'dernierEnvoiAt',       (SELECT max(created_at) FROM envois),
    'dernierEnvoiMois',     (SELECT to_char(max(mois), 'YYYY-MM') FROM envois),
    'serie6mois', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'mois', to_char(s.mois, 'YYYY-MM'),
        'envois', (SELECT count(*) FROM envois v WHERE v.mois = s.mois),
        'artisans', (SELECT count(DISTINCT v.user_id) FROM envois v WHERE v.mois = s.mois),
        'attendus', (SELECT count(*) FROM suivis su WHERE su.premier IS NOT NULL AND su.premier <= s.mois)
      ) ORDER BY s.mois), '[]'::jsonb)
      FROM serie s
    )
  ) INTO resultat;
  RETURN resultat;
END $$;

REVOKE ALL ON FUNCTION public.increment_modele_usage(text, bigint, numeric), public.verifier_acces_ouverts(),
  public.regu_comptable_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_modele_usage(text, bigint, numeric), public.verifier_acces_ouverts(),
  public.regu_comptable_stats() TO authenticated;

-- ---------------------------------------------------------------------
-- 10. Automatismes (déclencheurs)
-- ---------------------------------------------------------------------

-- Verrou de l'abonnement : un artisan ne peut ni se créer un abonnement payant, ni changer
-- son offre, son statut, son montant ou ses identifiants Stripe. Seuls les gestionnaires et
-- les fonctions serveur (service_role) le peuvent.
CREATE OR REPLACE FUNCTION public.verrou_abonnement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.est_gestionnaire() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.artisan_id := auth.uid();
    NEW.statut := 'Essai';
    NEW.montant_mensuel := 0;
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.iban := NULL;
    NEW.mandat_sepa := NULL;
    RETURN NEW;
  END IF;
  IF NEW.offre IS DISTINCT FROM OLD.offre
     OR NEW.statut IS DISTINCT FROM OLD.statut
     OR NEW.montant_mensuel IS DISTINCT FROM OLD.montant_mensuel
     OR NEW.artisan_id IS DISTINCT FROM OLD.artisan_id
     OR NEW.canal_paiement IS DISTINCT FROM OLD.canal_paiement
     OR NEW.date_debut IS DISTINCT FROM OLD.date_debut
     OR NEW.date_echeance IS DISTINCT FROM OLD.date_echeance
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.iban IS DISTINCT FROM OLD.iban
     OR NEW.mandat_sepa IS DISTINCT FROM OLD.mandat_sepa THEN
    RAISE EXCEPTION 'Modification réservée au back-office ou au paiement en ligne.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER abonnements_verrou
  BEFORE INSERT OR UPDATE ON public.abonnements
  FOR EACH ROW EXECUTE FUNCTION public.verrou_abonnement();

-- Journal des gestionnaires : qui a ajouté, modifié ou retiré une adresse, et quand.
CREATE OR REPLACE FUNCTION public.journaliser_gestionnaires()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  acteur text := nullif(public.email_connecte(), '');
  details text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.gestionnaires_journal (email, action, detail, acteur_email)
    VALUES (NEW.email, 'ajout', NEW.libelle, acteur);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.gestionnaires_journal (email, action, detail, acteur_email)
    VALUES (OLD.email, 'retrait', OLD.libelle, acteur);
    RETURN OLD;
  END IF;
  IF NEW.libelle IS DISTINCT FROM OLD.libelle THEN details := details || format('Libellé : %s → %s', coalesce(OLD.libelle, '—'), coalesce(NEW.libelle, '—')); END IF;
  IF NEW.note IS DISTINCT FROM OLD.note THEN details := details || 'Note modifiée'::text; END IF;
  IF NEW.voir_comptabilite IS DISTINCT FROM OLD.voir_comptabilite THEN
    details := details || format('Comptabilité : %s', CASE WHEN NEW.voir_comptabilite THEN 'visible' ELSE 'masquée' END);
  END IF;
  IF NEW.voir_mon_abonnement IS DISTINCT FROM OLD.voir_mon_abonnement THEN
    details := details || format('Mon abonnement : %s', CASE WHEN NEW.voir_mon_abonnement THEN 'visible' ELSE 'masqué' END);
  END IF;
  IF array_length(details, 1) > 0 THEN
    INSERT INTO public.gestionnaires_journal (email, action, detail, acteur_email)
    VALUES (NEW.email, 'modification', array_to_string(details, ' · '), acteur);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER gestionnaires_journal_auto
  AFTER INSERT OR UPDATE OR DELETE ON public.gestionnaires
  FOR EACH ROW EXECUTE FUNCTION public.journaliser_gestionnaires();

-- ---------------------------------------------------------------------
-- 11. Stockage des photos de chantier (privé, rangé par compte : <user_id>/<fichier>)
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('suivi-chantier', 'suivi-chantier', false, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY suivi_chantier_lecture ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'suivi-chantier' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY suivi_chantier_envoi ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'suivi-chantier' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY suivi_chantier_suppression ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'suivi-chantier' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
