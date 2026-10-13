# Test de non-régression des règles d'accès (RLS)

> Objectif : garantir qu'**aucune table ne repasse en accès ouvert**. À lancer après toute
> évolution de la base (nouvelle table, nouvelle policy, migration RLS).

## Ce qui est contrôlé

Deux cas sont considérés comme des anomalies :

1. **RLS désactivé** — une table du schéma `public` sans Row Level Security : elle serait
   lisible / modifiable sans filtrage par ligne.
2. **Policy ouverte** — une policy avec `USING (true)` ou `WITH CHECK (true)` visant les rôles
   `public`, `anon` ou `authenticated`, et **absente de la liste blanche**.

## La liste blanche

Certaines tables sont **volontairement** ouvertes et ne doivent pas déclencher l'alerte. Elles sont
déclarées dans la table `public.acces_ouvert_autorise` (`table_name`, `raison`) :

| Table | Raison |
|---|---|
| `diagnostic_email_historique` | Historique du diagnostic de la config email Resend (aucune donnée perso) |
| `order_headers`, `order_items` | Tables de commande de la plateforme (gérées par Readdy Backend) |
| `product_categories`, `product_items`, `product_variants`, `product_skus`, `product_custom_fields`, `product_custom_values` | Catalogue de la boutique : lecture publique volontaire |

> **Ajouter une entrée légitime** : insérer une ligne dans `acces_ouvert_autorise` avec la table et
> une justification claire. Laisser une table ouverte « en passant » sans l'y déclarer fera échouer
> le contrôle — c'est voulu.

## Comment lancer le contrôle

### 1. Depuis le back-office (recommandé)

Back-office → carte **« Contrôle des accès (non-régression) »** → bouton **« Lancer le contrôle »**.

- **Vert** : « Aucun accès ouvert inattendu. » → tout est verrouillé.
- **Rouge** : liste des tables fautives (RLS désactivé ou policy ouverte hors liste blanche), avec
  le détail de la policy concernée.

Le contrôle passe par la fonction Backend `verifier_acces_ouverts()` (SECURITY DEFINER), **réservée
aux gestionnaires** — un compte artisan ne peut pas la lire.

### 2. En SQL (maintenance / CI)

```sql
-- Renvoie les anomalies ; un résultat vide = tout est sain.
select * from public.verifier_acces_ouverts();
```

La même logique, sans la garde de rôle (utile depuis une connexion d'administration) :

```sql
-- Tables sans RLS
select c.relname as table_name, 'rls_desactivee' as probleme
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  and c.relname not like 'pg\_%' and c.relrowsecurity = false
union all
-- Policies ouvertes hors liste blanche
select distinct p.tablename, 'policy_ouverte'
from pg_policies p
where p.schemaname = 'public'
  and (p.qual = 'true' or p.with_check = 'true')
  and p.roles && array['public','anon','authenticated']::name[]
  and p.tablename not in (select a.table_name from public.acces_ouvert_autorise a);
```

## En cas d'échec

1. **Table sans RLS** → `alter table public.<table> enable row level security;` puis vérifier que
   ses policies isolent bien les données par `auth.uid()` (ou par rôle gestionnaire).
2. **Policy ouverte** → soit la remplacer par une règle restrictive (`user_id = auth.uid()`,
   `est_gestionnaire()`, …) ; soit, si l'ouverture est réellement voulue, l'ajouter à la liste
   blanche **avec sa justification**.

Le durcissement historique (tables `abonnements`, `abonnement_historique`, `recontacts_artisans`,
`email_test_historique`) est décrit dans `project_plan.md` §5 — ces tables ne doivent **jamais**
repasser en accès ouvert.