# Comptes intervenants et planning

Les comptes invités comme intervenants accèdent uniquement à leur planning, sur le site comme
dans l'application mobile. Les responsables conservent la vue d'équipe et la gestion des créneaux.
La base applique également le filtrage : un compte intervenant ne peut lire que les créneaux qui
lui sont affectés, et ne peut ni les modifier ni consulter les autres intervenants.

## Mise en service

1. Appliquer la migration `supabase/migrations/20261015223000_comptes_intervenants_planning.sql`
   au projet Supabase.
2. Déployer la fonction Edge `inviter-intervenant` (`supabase functions deploy inviter-intervenant`)
   avec les variables Supabase standard disponibles dans l'environnement
   des fonctions.
3. Déployer ensuite le frontend. L'envoi d'invitation dépend de la configuration e-mail et des URL
   de redirection de Supabase Auth.

Une fois activée, le responsable renseigne l'adresse e-mail d'un intervenant dans la gestion de
l'équipe, enregistre sa fiche, puis clique sur « Inviter ». L'adresse doit être nouvelle dans
Supabase Auth. Un intervenant qui a déjà un compte ne peut pas être lié par ce parcours.

La désactivation d'un intervenant suspend l'accès à son planning. Une fiche associée à un compte
ne peut pas être supprimée depuis l'application ; il faut la désactiver pour conserver le lien de
sécurité avec son compte.
