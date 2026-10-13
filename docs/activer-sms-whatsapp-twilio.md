# 📱 Activer les SMS / WhatsApp (Twilio) — ArtiFlow-pro

> Dernière mise à jour : 2026.10.12
> Canal **optionnel** : à activer quand tu veux relancer tes clients par **SMS** ou **WhatsApp**,
> en plus de l'email. Non bloquant pour le lancement.

---

## 1. À quoi ça sert

Aujourd'hui, les relances clients partent par **email**. Le canal **SMS / WhatsApp** est **déjà
codé** dans le produit (page Relances : bouton d'envoi SMS/WhatsApp + « test SMS »). Il ne
manque que les **identifiants Twilio**. Sans eux, le produit fonctionne normalement : seul
l'envoi SMS/WhatsApp affiche un message « pas encore configuré ».

Le code lit **4 secrets** côté Backend :

| Secret Backend | Rôle |
|----------------|------|
| `TWILIO_ACCOUNT_SID` | Identifiant du compte Twilio |
| `TWILIO_AUTH_TOKEN` | Jeton d'authentification Twilio |
| `TWILIO_SMS_FROM` | Numéro expéditeur des **SMS** (format `+33…`) |
| `TWILIO_WHATSAPP_FROM` | Numéro expéditeur **WhatsApp** (format `+33…`) |

> Ces secrets ne sont **jamais** mis dans le code de l'app : ils sont stockés côté Backend
> (Secrets), l'app appelle une fonction qui les utilise.

---

## 2. Étapes

### 2.1 Créer le compte Twilio
1. Aller sur **https://www.twilio.com** et créer un compte.
2. Vérifier l'email et le numéro de téléphone demandés.

### 2.2 Récupérer le Account SID et le Auth Token
1. Dans la **Console Twilio** → page d'accueil du projet.
2. Noter le **Account SID** (commence par `AC…`).
3. Cliquer sur **Auth Token** pour le révéler, puis le copier.

### 2.3 Acheter un numéro expéditeur SMS
1. **Phone Numbers → Buy a number**.
2. Choisir un numéro avec la capacité **SMS** (un numéro français `+33…` si tu veux envoyer
   depuis la France).
3. Noter le numéro au format **E.164** (ex. `+33612345678`).

### 2.4 Configurer WhatsApp (optionnel)
1. **Messaging → Senders → WhatsApp** (ou **Twilio WhatsApp**).
2. Sélectionner le **numéro WhatsApp Business** à utiliser en expéditeur.
3. Noter le numéro au format E.164 → il servira pour `TWILIO_WHATSAPP_FROM`.

> Astuce : il est possible d'utiliser le **même numéro** pour `TWILIO_SMS_FROM` et
> `TWILIO_WHATSAPP_FROM`.

### 2.5 Déposer les 4 secrets côté Backend
Les secrets se déposent dans les **Secrets du Backend** (jamais dans le chat, jamais dans le code) :

| Nom du secret | Valeur |
|---------------|--------|
| `TWILIO_ACCOUNT_SID` | le Account SID (`AC…`) |
| `TWILIO_AUTH_TOKEN` | le Auth Token |
| `TWILIO_SMS_FROM` | le numéro SMS (`+33…`) |
| `TWILIO_WHATSAPP_FROM` | le numéro WhatsApp (`+33…`) |

> En cas de doute sur l'emplacement : ces secrets se gèrent depuis l'onglet **Backend →
> Functions/Secrets** du projet.

---

## 3. Vérifier que ça marche

1. Ouvrir l'app → **Espace artisan → Relances**.
2. Utiliser le bouton **« Test SMS »** : saisir un numéro de téléphone et choisir **SMS** ou
   **WhatsApp**, puis envoyer.
3. Le message doit arriver sur le téléphone. Sinon, lire le message d'erreur affiché :
   - « pas encore configuré » → les secrets ne sont pas déposés / pas encore pris en compte.
   - « Numéro d'envoi manquant » → `TWILIO_SMS_FROM` (ou `TWILIO_WHATSAPP_FROM`) est vide.
   - Erreur Twilio (codes 21211, 21608…) → numéro destinataire invalide, ou compte en **mode
     essai** (il faut alors vérifier le numéro destinataire dans Twilio).

> ⚠️ Un compte Twilio **neuf est en « mode essai »** : il n'envoie qu'aux **numéros vérifiés**.
> Pour envoyer à n'importe qui, il faut faire une demande de passage en production (et, pour un
> envoi depuis un numéro FR vers l'international, vérifier les autorisations du numéro).

---

## 4. Points d'attention

- **Coût** : chaque SMS/WhatsApp envoyé est facturé par Twilio (tarif variable selon le pays).
- **Numéro client obligatoire** : l'envoi utilise le `téléphone` de la fiche client. S'il est
  vide, l'app invite à le renseigner.
- **Format** : les numéros français saisis en `06…` / `07…` sont automatiquement convertis en
  `+33…` par le code.
- **La même relance** peut partir par email **et** par SMS si les deux canaux sont activés.
- Le canal SMS/WhatsApp est mentionné dans **l'offre Pro**.

---

## 5. À retenir

- Le SMS/WhatsApp n'est **pas** nécessaire au lancement (l'email couvre l'essentiel).
- Tout est **déjà codé** : il ne manque que les **4 secrets Twilio**.
- Une fois les secrets déposés, **le bouton « Test SMS » de la page Relances suffit** à confirmer
  que le canal est opérationnel.