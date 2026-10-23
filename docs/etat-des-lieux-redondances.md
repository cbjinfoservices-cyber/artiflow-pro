# État des lieux des contenus redondants — ArtiFlow-pro

Relevé fait le 23 octobre 2026 sur l'ensemble des pages publiques.
Objectif : repérer ce qui se répète d'une page à l'autre (et à l'intérieur d'une même page),
pour décider ensemble de ce qu'on garde, de ce qu'on fusionne et de ce qu'on retire.

Ce document ne supprime rien : il sert de base de décision.

---

## 1. Méthode de mesure

Pour chaque page, on compte :

- **les blocs** (sections distinctes empilées verticalement) ;
- **les CTA** menant à la même action (démo, essai, contact) ;
- **les sujets traités plus d'une fois** à l'intérieur de la page.

Le « poids perçu » vient rarement du nombre de mots : il vient du nombre de blocs qui
racontent la même chose avec un habillage différent.

---

## 2. Cartographie des pages

| Page | Blocs | CTA | Sujets répétés en interne | Verdict |
| --- | --- | --- | --- | --- |
| Accueil `/` | 16 | 5 | nouveautés (3×), temps gagné (4×), démo (5×) | **Dense** |
| Tarifs `/tarifs` | 13 | 3 | mensuel/annuel (5×), économies (4×) | **Très dense** |
| Métiers `/metiers` | 6 | 2 | FAQ + encart d'aide présents ailleurs | Correct |
| Fiche métier `/metiers/:slug` | 7 | 2 | FAQ locale proche de celle de `/metiers` | Correct |
| À propos `/a-propos` | 9 | 2 | 2 blocs de texte long | Dense en texte |
| Auteur `/auteur` | 8 | 1 | 2 blocs de texte long | Dense en texte |
| Contact `/contact` | 6 | 1 | 2 blocs de texte long | Dense en texte |
| Nouveautés `/nouveautes` | 4 | 1 | — | Sain |
| Récapitulatif `/nouveautes/recapitulatif` | 4 | 2 | — (mais 15 visuels lourds) | Sain en contenu, lourd en images |
| Ressources `/ressources` | 5 | 1 | — | Sain |
| Podcast `/podcast` | 5 | 1 | — | Sain |

---

## 3. Redondances inter-pages

### 3.1 L'encart « Besoin d'aide ? » — 3 pages

Présent sur **l'accueil**, **Tarifs** et **Métiers**, avec le même encouragement à parler
à un humain. Sur Tarifs, il double le CTA final qui propose déjà « Écrivez-nous ».

- Décision proposée : le garder là où la question se pose vraiment (Tarifs, page de décision),
  et le retirer de l'accueil où le formulaire de démo juste en dessous fait déjà le travail.

### 3.2 Les FAQ — 7 pages

Des blocs de questions/réponses existent sur : accueil, Tarifs, Métiers, fiche métier,
À propos, Auteur, pages d'annonces. Chaque page en a une, ce qui est sain pour le SEO local,
**mais** plusieurs questions se répondent mot pour mot sur deux pages.

- Décision proposée : conserver une FAQ par page (bon pour le référencement), mais
  réserver les questions génériques (« combien de temps pour démarrer », « mes données »)
  à l'accueil et à Tarifs, et laisser aux pages métier uniquement les questions de leur corps d'état.

### 3.3 « Des documents à votre image » — 2 pages

L'accueil (bloc *Features*) et Tarifs (bloc *DocumentsSurMesure*) racontent la même
personnalisation (couleur, logo, paiement, pied de page, signature), avec deux mises en page
différentes et deux niveaux de détail.

- Décision proposée : garder la version longue sur Tarifs (c'est là qu'on décide),
  et réduire l'accueil à trois lignes + un lien. Ne pas supprimer : condenser.

### 3.4 Les tarifs — 2 pages + 3 variantes

Les offres apparaissent sur l'accueil (*Pricing*) et sur Tarifs, puis sous trois formes
détaillées supplémentaires sur Tarifs (*RecapMensuelAnnuel*, *SimulateurEntreprise*,
comparatif complet).

- Décision proposée : l'accueil garde une grille de 3 offres **sans** le comparatif ligne à ligne
  (déjà sur Tarifs). C'est du contenu utile mais redondant à cet endroit du parcours.

---

## 4. Redondances internes à l'accueil

L'accueil enchaîne 16 blocs. Quatre sujets y reviennent plusieurs fois :

| Sujet | Où il apparaît | Fréquence |
| --- | --- | --- |
| Les nouveautés produit | badge du hero, bloc *Nouveautés* (4 annonces), cartes du bas de *Preuves* (2 annonces), bandeau « à la une » | 4× |
| Le temps gagné / 6 h par semaine | chiffres du hero, *Avant/Après*, *Simulateur*, bloc texte SEO, *Preuves* | 4× |
| « Demander une démo » | hero, *Avant/Après*, *Simulateur*, *ContactCta*, barre mobile | 5× |
| « Documents à votre image » | *Features* et Tarifs | 2× |

C'est ce qui donne l'impression d'une page « pleine » alors qu'elle est surtout répétitive.

---

## 5. Redondances internes à Tarifs

| Sujet | Où il apparaît | Fréquence |
| --- | --- | --- |
| Mensuel vs annuel | sélecteur du haut, lien « Passez à l'annuel » sur chaque carte, bloc « 12 mois », mini-calculateur, encart du simulateur équipe | 5× |
| « Économisez 2 mois » | sélecteur, cartes, bloc 12 mois, encart simulateur | 4× |
| Estimation d'économie | *RecapMensuelAnnuel*, *CalculatriceRoi*, *SimulateurEntreprise* | 3× |

---

## 6. Plan d'action proposé (par ordre de rentabilité)

1. **Accueil — fait dans ce chantier** : condensation des textes et du rythme vertical,
   sans supprimer aucun bloc. Le contenu SEO et les parcours restent intacts.
2. **Accueil — prochaine étape** : remplacer les deux cartes de nouveautés du bas de *Preuves*
   par une simple ligne de rappel vers `/nouveautes` (le bloc du haut fait déjà le travail).
3. **Tarifs** : supprimer le bloc « Ce que vous payez vraiment sur 12 mois » et garder un seul
   calculateur fusionné (ROI + équipe en onglets). Gain estimé : 2 blocs et ~1 400 px de hauteur.
4. **Encart « Besoin d'aide »** : le retirer de l'accueil uniquement.
5. **FAQ** : dédoublonner les questions génériques entre accueil et Tarifs.
6. **Blocs de texte SEO** : sur À propos, Auteur et Contact, deux blocs longs se suivent.
   Les fusionner en un seul bloc à deux colonnes, ou en replier un derrière un « Lire la suite ».

---

## 7. Ce qui n'est PAS redondant (à ne pas toucher)

- Les témoignages de l'accueil et ceux de Tarifs ne sont pas les mêmes personnes ni les mêmes
  arguments (usage quotidien d'un côté, choix de l'offre Pro de l'autre).
- Les pages métier ont chacune un contenu réellement distinct (unités, postes, exemples).
- La page récapitulatif ne répète pas le journal : elle en propose une lecture par visuels.
- Les blocs de texte SEO de l'accueil et de Tarifs couvrent des intentions de recherche
  différentes et doivent rester en place.