# Sauvegarde & restauration des données — ArtiFlow-pro

> Objectif : donner à chaque artisan **le contrôle sur ses propres données** et un moyen
> concret de les archiver — sans dépendre d'un mécanisme invisible.

---

## 1. Le filet de sécurité applicatif : « Exporter mes données »

Chaque artisan peut télécharger **l'intégralité de ses données** depuis son espace :

**Préférences d'affichage → section « Sauvegarde de vos données » → bouton « Exporter mes données (ZIP) »**.

L'export génère une archive ZIP `artiflow-mes-donnees-AAAA-MM-JJ.zip` contenant :

| Fichier | Contenu |
|---|---|
| `lisez-moi.txt` | Mode d'emploi de l'archive |
| `synthese.json` | Récapitulatif : nombre de lignes exportées par catégorie |
| `01-profil.csv` … `32-preferences-affichage.csv` | Un CSV par catégorie : profil, clients, devis, lignes de devis, modèles, factures, chantiers, étapes, relances, plannings, bibliothèque de lignes, historique des envois, alertes, récaps automatiques, préférences… |

**Points importants :**

- **Uniquement vos données** : le Backend filtre automatiquement par compte (règles d'accès
  RLS). Aucune donnée d'un autre artisan ne peut être exportée.
- **Format** : CSV séparé par des points-virgules, encodage UTF-8 (BOM inclus) → s'ouvre
  directement dans Excel FR, LibreOffice ou Numbers.
- **Une colonne vide** = une donnée jamais renseignée (rien n'a été perdu).
- L'archive contient des **données personnelles** (coordonnées de vos clients, montants) :
  conservez-la en lieu sûr (disque chiffré, cloud privé).

**Quand exporter ?** Idéalement **une à deux fois par mois**, et **systématiquement avant**
une opération sensible : changement d'outil, clôture annuelle, avant de purger d'anciennes
données.

### Le raccourci « Sauvegarder mes données »

Pour ne plus dépendre d'une seule page, un raccourci permanent existe dans le **menu du compte**
(en haut à droite, sur **n'importe quelle page** de l'espace) : **« Sauvegarder mes données »**.
Il ouvre une fenêtre à trois onglets : **Exporter**, **Réimporter**, **Historique**.
Le bouton **« Historique »** du rappel mensuel du tableau de bord ouvre la même fenêtre.

### Formats disponibles

| Format | Usage |
|---|---|
| **CSV** | Un fichier par catégorie, à ouvrir dans un tableur (lecture humaine). |
| **JSON** | Un fichier `donnees.json` structuré, **prévu pour la restauration** (réimport). |
| **Les deux** | Le CSV pour lire, le JSON pour réimporter plus tard. |

Le **dernier format choisi est mémorisé** et **pré-sélectionné** à chaque ouverture d'un sélecteur d'export (menu du compte, page Préférences) : plus besoin de rechoisir son format favori à chaque fois.

### Historique des exports

Chaque export est consigné dans un **journal local** (les 24 derniers) : date, format, nombre de
catégories, nombre de lignes et taille de l'archive. Consultable via l'onglet **Historique** de la
fenêtre de sauvegarde.

Cet historique est **exportable en CSV** (bouton « Exporter en CSV » dans l'onglet Historique) :
une ligne par sauvegarde (date, format, catégories, lignes, taille), fichier
`artiflow-historique-exports-<date>.csv` — utile pour tenir un journal d'archivage hors application.

### Assistant de réimport (restauration)

L'onglet **Réimporter** lit un fichier `donnees.json` et propose de **réinjecter les tables une par
une** (ou toutes, dans l'ordre logique parents → enfants) :

- seules les **tables déclarées** par l'application sont acceptées (un fichier quelconque ne peut pas
  écrire dans une table arbitraire) ;
- les écritures passent par les **règles d'accès** du Backend : chaque compte ne peut restaurer que
  dans **son propre** périmètre ;
- le réimport est prévu pour **le même compte** (récupération après perte, retour en arrière) : les
  lignes déjà présentes sont **mises à jour** par identifiant, les nouvelles sont **ajoutées**.

> Conseil : faites une sauvegarde fraîche **avant** un réimport, et vérifiez le résultat table par
> table grâce au compte rendu affiché.

**Garde-fou intégré** : plutôt que de vous fier à ce conseil, l'assistant **propose lui-même une
sauvegarde de sécurité** juste avant chaque réinjection. Au moment de confirmer, deux choix :
« **Sauvegarder puis réinjecter** » (une archive complète CSV + JSON est générée puis téléchargée
avant la réinjection ; si la sauvegarde échoue, la réinjection est bloquée pour ne rien risquer) ou
« **Sans sauvegarde** » pour passer outre en connaissance de cause.

---

## 2. Sauvegarde complète de la base (côté Backend)

⚠️ **À savoir** : la sauvegarde/restauration automatique de la base **n'est pas incluse** dans
le module Backend (Auth, base, Storage, Functions). C'est un service d'infrastructure.

Deux conséquences pratiques :

1. **Ne comptez pas sur un « retour en arrière » automatique** pour retrouver une donnée
   supprimée par erreur. Le réflexe de secours, c'est **l'export du point 1** (à faire
   régulièrement, donc).
2. **Pour une sauvegarde d'infrastructure complète** (dump de la base), contactez le support
   Readdy via le formulaire de support : <https://readdy.ai/feedback>. Précisez le projet
   concerné et la nature du besoin (archivage, migration, restauration).

---

## 3. Bonnes pratiques recommandées

| Fréquence | Action |
|---|---|
| Chaque semaine | Clic sur « Exporter mes données » et rangement de l'archive dans un dossier daté |
| Chaque mois | Vérification que l'archive est bien lisible (ouverture d'un CSV au hasard) |
| Avant toute action risquée | Export systématique (changement d'outil, nettoyage de données) |
| En fin d'exercice | Export + conservation à long terme (archivage comptable) |

**Côté sécurité**, ces règles protègent déjà vos données au quotidien :

- RLS activé sur **toutes** les tables : chaque compte ne voit que ses lignes.
- Les journaux de back-office (abonnements, recontacts) sont réservés aux gestionnaires.
- Aucune clé API privée n'est exposée au navigateur ; les envois sortants passent par des
  fonctions Backend qui gardent les secrets côté serveur.

---

## 4. Rappel RGPD

L'export couvre le **droit à la portabilité** (article 20) : la personne peut récupérer ses
données dans un format structuré et lisible par machine. En cas de demande d'un utilisateur,
l'outil permet de répondre en quelques secondes, sans intervention technique.