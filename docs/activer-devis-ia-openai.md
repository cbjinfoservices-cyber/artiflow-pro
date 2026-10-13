# 🤖 Activer les devis rédigés par IA (clé OpenAI) — ArtiFlow-pro

> Dernière mise à jour : 2026.10.12
> Fonction **optionnelle** : à activer quand tu veux que l'IA propose automatiquement les
> **lignes d'un devis** à partir d'une simple description du chantier.

---

## 1. À quoi ça sert

Dans le formulaire de devis, l'artisan peut **décrire le chantier en quelques mots** (ou dicter
son constat). La fonction `generer-devis-lignes` demande alors à l'IA de proposer un **objet**
et une **liste de lignes chiffrées** (désignation, unité, quantité, prix unitaire HT),
adaptées au corps de métier de l'artisan. L'artisan **corrige** ensuite avant d'enregistrer.

Le code lit **1 secret** côté Backend :

| Secret Backend | Rôle |
|----------------|------|
| `OPENAI_API_KEY` | Clé API OpenAI utilisée par la fonction `generer-devis-lignes` |

> Sans cette clé, la fonction est **coupée proprement** : un message « pas encore configurée »
> s'affiche, et **tout le reste du produit continue de fonctionner** (devis manuels, envois,
> relances…). C'est une fonction de confort, pas un élément bloquant.

---

## 2. Étapes

### 2.1 Créer un compte OpenAI
1. Aller sur **https://platform.openai.com** et créer un compte.
2. Ajouter un moyen de paiement dans **Settings → Billing** (l'API est payante à l'usage).

### 2.2 Créer une clé API
1. Aller dans **API keys** → **Create new secret key**.
2. Copier la clé (elle commence par `sk-…`).
3. ⚠️ La clé n'est affichée **qu'une seule fois** : copie-la tout de suite.

### 2.3 Déposer le secret côté Backend
Déposer la clé dans les **Secrets du Backend** (jamais dans le chat, jamais dans le code) :

| Nom du secret | Valeur |
|---------------|--------|
| `OPENAI_API_KEY` | la clé `sk-…` |

> En cas de doute sur l'emplacement : ces secrets se gèrent depuis l'onglet **Backend →
> Functions/Secrets** du projet.

---

## 3. Vérifier que ça marche

1. Ouvrir l'app → **Espace artisan → Devis**.
2. Créer un devis, puis utiliser le bouton de **génération par IA** : décrire un chantier (ex.
   « Rénovation salle de bain, dépose ancienne baignoire, pose douche italienne, faïence
   murale 12 m² »).
3. L'IA doit proposer un **objet** + plusieurs **lignes** chiffrées, insérées dans le
   formulaire. L'artisan peut tout modifier avant d'enregistrer.

Messages d'erreur possibles :
- « pas encore configurée » → le secret `OPENAI_API_KEY` est absent / pas encore pris en compte.
- « le service IA a refusé la demande » → clé invalide, quota dépassé ou facturation à régler.
- « réponse illisible » → relancer, ou préciser un peu la description.

---

## 4. Points d'attention

- **Coût** : chaque génération consomme du crédit OpenAI (modèle utilisé : `gpt-4o-mini`, très
  économique — fractions de centime par devis).
- **Prévoir un plafond** : fixer une **limite de dépense mensuelle** dans OpenAI
  (**Settings → Limits**) pour éviter les surprises.
- **Révision humaine** : la proposition de l'IA est un **brouillon** ; les prix sont réalistes
  mais doivent être **relus** par l'artisan avant envoi.
- **Aucune donnée sensible** : seul le texte descriptif saisi par l'artisan est envoyé à l'IA.
  Rien n'est enregistré par la fonction : la proposition revient dans le formulaire, à charge de
  l'artisan de l'enregistrer.

---

## 5. À retenir

- Ce n'est **pas** nécessaire au lancement : le produit est complet sans l'IA (devis manuels).
- Tout est **déjà codé** : il ne manque que **le secret `OPENAI_API_KEY`**.
- Une fois la clé déposée, **le bouton de génération du formulaire de devis suffit** à confirmer
  que la fonction est active.
- Pense à **fixer un plafond de dépense** côté OpenAI.