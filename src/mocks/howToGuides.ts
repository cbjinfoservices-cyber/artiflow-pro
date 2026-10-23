import type { HowToInput } from "@/hooks/useHowToSchema";

/**
 * Guides qui décrivent une méthode pas à pas, et dont le contenu se prête à un
 * balisage Schema.org de type HowTo. Chaque étape reprend fidèlement une
 * section du guide afin de rester alignée sur ce qui est réellement affiché.
 */
const howToGuides: Record<string, Omit<HowToInput, "slug">> = {
  "devis-chaudiere-en-5-minutes": {
    name: "Rédiger un devis de chaudière en 5 minutes, sans rien oublier",
    description:
      "La méthode simple pour produire un devis de chauffage complet, prêt avant de quitter le chantier.",
    totalTime: "PT5M",
    steps: [
      {
        name: "Repérer les postes souvent oubliés",
        text: "Identifier les lignes invisibles qui font perdre de la marge : raccordement gaz, désembouage du circuit, mise en service et évacuation des fumées.",
      },
      {
        name: "Partir d'un modèle stable",
        text: "Composer un modèle stable avec une ligne pour le matériel, une pour les accessoires indispensables, une pour la main-d'œuvre au forfait et une pour la mise en service, avec une variante par type de chaudière.",
      },
      {
        name: "Générer le devis sur le chantier",
        text: "Sur place, préciser le modèle posé et la configuration des lieux, puis générer, relire et envoyer le devis avant la fin de l'intervention.",
      },
      {
        name: "Relancer à 48 h",
        text: "Prévoir une relance automatique à 48 h si le client n'a pas répondu, car sur les remplacements de chaudière la décision est rarement immédiate.",
      },
    ],
  },
  "relance-apres-depannage-urgent": {
    name: "Relancer un client après un dépannage urgent : le bon timing",
    description:
      "Comment structurer vos relances pour transformer un dépannage urgent en chantier signé.",
    steps: [
      {
        name: "Comprendre le moment de la décision",
        text: "Après l'urgence, le client a pris une décision émotionnelle. Le devis de remplacement, lui, se décide à froid une fois la pression retombée.",
      },
      {
        name: "Adopter le bon rythme de relance",
        text: "Envoyer une relance très rapide le soir même ou le lendemain, puis une seconde à 5 jours plus factuelle qui propose une date d'intervention.",
      },
      {
        name: "Choisir le canal qui fait la différence",
        text: "Privilégier le SMS pour la première relance, qui est lu dans l'heure, puis l'email pour le récapitulatif détaillé.",
      },
      {
        name: "Automatiser pour ne rien lâcher",
        text: "Automatiser les relances pour qu'elles partent même en intervention : deux à trois dépannages par mois sont ainsi récupérés sans effort.",
      },
    ],
  },
  "messages-relance-devis-electricite": {
    name: "3 messages de relance qui font signer vos devis électricité",
    description:
      "Trois relances courtes et rassurantes pour débloquer des devis électriques techniques qui font hésiter le client.",
    steps: [
      {
        name: "Relance 1 : rassurer à 48 h",
        text: "Rappeler en une phrase le problème identifié et proposer de répondre à toute question, sans discours commercial : c'est la relance la plus efficace.",
      },
      {
        name: "Relance 2 : apporter une contrainte utile",
        text: "À une semaine, indiquer honnêtement que votre planning de la quinzaine se remplit, sans fausse urgence.",
      },
      {
        name: "Relance 3 : proposer un phasage",
        text: "Plus espacée, proposer un phasage en deux étapes pour étaler le budget et faire revenir les dossiers jugés perdus.",
      },
    ],
  },
  "chiffrer-extension-sans-erreur-metres": {
    name: "Chiffrer une extension sans se tromper sur les métrés",
    description:
      "La méthode pour ne plus perdre de marge en oubliant une étape du gros œuvre lors du chiffrage d'une extension.",
    steps: [
      {
        name: "Décomposer le chantier en lots successifs",
        text: "Séparer terrassement, fondations, dalle, élévation, charpente, couverture, menuiseries extérieures et finitions, puis chiffrer chaque lot avant d'assembler.",
      },
      {
        name: "Ajouter les postes annexes",
        text: "Intégrer systématiquement l'évacuation des terres, la location d'engin et le compte de transport, souvent absents des devis faits à la va-vite.",
      },
      {
        name: "Faire apparaître la logique du chiffrage",
        text: "Montrer la surface développée et le nombre de mètres cubes de béton pour un devis défendable et moins contesté.",
      },
    ],
  },
  "organiser-chantiers-par-zone": {
    name: "Organiser ses chantiers par zone pour couper les trajets",
    description:
      "Comment regrouper vos chantiers par secteur pour récupérer jusqu'à une demi-journée par semaine.",
    steps: [
      {
        name: "Regrouper les chantiers par secteur",
        text: "Concentrer les chantiers d'une même semaine dans un rayon réduit et éviter d'alterner entre deux secteurs éloignés.",
      },
      {
        name: "Visualiser la semaine sur une carte",
        text: "Afficher les interventions sur une carte par semaine puis réorganiser les journées pour limiter les croisements.",
      },
      {
        name: "Réinvestir le temps gagné",
        text: "Utiliser le temps libéré pour le suivi client et les devis, les tâches habituellement repoussées en fin de journée.",
      },
    ],
  },
  "devis-peinture-au-m2-methode-simple": {
    name: "Devis peinture au m² : la méthode simple qui évite les pertes",
    description:
      "La bonne structure de devis peinture pour facturer le bon m² et ne plus travailler à perte.",
    steps: [
      {
        name: "Calculer le m² net à peindre",
        text: "Partir de la surface nette réellement peinte plutôt que d'une surface brute, en tenant compte des plafonds.",
      },
      {
        name: "Mesurer murs et plafonds puis déduire les ouvertures",
        text: "Mesurer le périmètre fois la hauteur pour les murs, ajouter le plafond, puis déduire les portes et fenêtres selon votre convention, en le rendant visible dans le devis.",
      },
      {
        name: "Décliner le prix au m² par préparation",
        text: "Adapter le prix au nombre de couches : une sous-couche plus deux finitions sur un mur neuf, une seule couche sur un support sain.",
      },
      {
        name: "Afficher le temps prévisionnel",
        text: "Terminer par un prévisionnel clair en jours et en compagnons pour faire accepter plus facilement le montant.",
      },
    ],
  },
  "variantes-materiaux-dans-un-seul-devis": {
    name: "Présenter plusieurs variantes de matériaux dans un seul devis",
    description:
      "Comment proposer plusieurs options chiffrées dans le même devis pour accélérer la décision du client.",
    steps: [
      {
        name: "Proposer plusieurs variantes chiffrées",
        text: "Relancer le devis avec deux ou trois variantes chiffrées dans le même document, pour que le client compare au lieu de mettre en concurrence plusieurs entreprises.",
      },
      {
        name: "Mettre en avant le conseil",
        text: "Valoriser le travail de conseil plutôt que le seul prix, pour mieux justifier votre positionnement.",
      },
      {
        name: "Dupliquer le bloc matériaux",
        text: "Dupliquer le bloc matériaux dans le devis et faire varier les lignes concernées, en laissant la main-d'œuvre et les finitions identiques pour garder un document lisible.",
      },
    ],
  },
  "suivre-commande-sur-mesure-du-devis-a-la-pose": {
    name: "Du devis à la pose : suivre une commande sur mesure sans rien perdre",
    description:
      "La méthode pour suivre chaque commande de menuiserie jusqu'à la pose sans relance interne.",
    steps: [
      {
        name: "Lister les phases du projet",
        text: "Identifier les grandes étapes : prise de mesures, validation du devis, commande des matériaux, fabrication, livraison et pose.",
      },
      {
        name: "Transformer le devis signé en fiche de suivi",
        text: "Créer une fiche de suivi avec des étapes datées, où chaque étape cochée déclenche la suivante.",
      },
      {
        name: "Informer le client à chaque étape",
        text: "Tenir le client informé automatiquement pour réduire les appels d'inquiétude et renforcer votre image professionnelle.",
      },
    ],
  },
  "calculer-reserve-chutes-carrelage": {
    name: "Calculer la réserve de chutes au carrelage (et arrêter d'en manquer)",
    description:
      "La méthode pour estimer la bonne quantité de carrelage et protéger votre marge et votre planning.",
    steps: [
      {
        name: "Définir le pourcentage de chutes",
        text: "Prévoir environ 10 % de chutes pour une pose droite et jusqu'à 15 % pour une pose en diagonale, plus le carrelage de réserve laissé au client.",
      },
      {
        name: "Ajouter découpes et plinthes",
        text: "Compter la surface au sol, plus les plinthes développées, plus la faïence murale le cas échéant, au lieu de ne chiffrer qu'une partie.",
      },
      {
        name: "Séparer fourniture et pose",
        text: "Distinguer clairement fourniture et pose dans le devis et afficher la quantité commandée pour éviter les malentendus à la livraison.",
      },
    ],
  },
  "devis-salle-de-bain-structurer": {
    name: "Devis de salle de bain : structurer faïence, sol et plinthes",
    description:
      "Comment structurer un devis de salle de bain clair et rentable, sans oublier de postes.",
    steps: [
      {
        name: "Chiffrer chaque surface séparément",
        text: "Chiffrer faïence murale, carrelage au sol et plinthes séparément, avec quantité, prix au m² et main-d'œuvre pour chaque surface.",
      },
      {
        name: "Ajouter joints et préparation du support",
        text: "Faire apparaître les joints (époxy ou classiques) et la préparation du support (ragréage, primaire), trop souvent passées sous silence.",
      },
      {
        name: "Proposer une date ferme",
        text: "S'appuyer sur un devis précis pour proposer un planning crédible, une salle de bain immobilisant le client qui veut une date ferme.",
      },
    ],
  },
  "apres-orage-prioriser-urgences-toiture": {
    name: "Après un orage : prioriser les urgences de toiture sans stress",
    description:
      "Comment trier les appels et organiser votre semaine quand tout tombe en même temps après un orage.",
    steps: [
      {
        name: "Trier les appels avant tout",
        text: "Éviter de courir partout et de bâcler le chiffrage en commençant par classer les appels reçus après le coup de vent.",
      },
      {
        name: "Séparer urgences et demandes de devis",
        text: "Distinguer les urgences réelles (fuite, bâchage) des demandes de devis de réfection, qui ne se traitent pas au même rythme.",
      },
      {
        name: "Appliquer le bon tempo",
        text: "Pour les urgences, sécuriser rapidement puis envoyer un devis de réparation dans la journée ; pour les réfections, un devis détaillé sous 48 h.",
      },
      {
        name: "Tout tracer",
        text: "Noter chaque situation, même en une ligne : qui a appelé, ce qui a été fait, où en est le devis, pour ne perdre aucun dossier.",
      },
    ],
  },
  "devis-faux-plafond-sans-erreur": {
    name: "Devis de faux plafond : additionner murs et plafonds sans erreur",
    description:
      "La bonne façon d'additionner chaque surface d'un chantier de plâtrerie et de détailler les postes techniques.",
    steps: [
      {
        name: "Séparer les surfaces",
        text: "Distinguer cloisons, doublages et faux plafonds au lieu de les regrouper sous un même prix au m², car leur temps de pose diffère.",
      },
      {
        name: "Chiffrer murs et plafonds à part",
        text: "Appliquer des prix au m² distincts aux murs et aux plafonds, un faux plafond suspendu étant plus long à poser qu'une cloison simple.",
      },
      {
        name: "Détailler les postes techniques",
        text: "Lister ossature, isolant, plaques avec épaisseur et type, bandes, enduit et éventuellement peinture, chacun sur sa propre ligne.",
      },
      {
        name: "Compter les passages d'enduit",
        text: "Prévoir le nombre de passages d'enduit selon la finition attendue, pour que le client paye le rendu réellement demandé.",
      },
    ],
  },
  "renovation-appartement-piece-par-piece": {
    name: "Rénovation d'appartement : chiffrer pièce par pièce",
    description:
      "Pourquoi découper un devis de plâtrerie par pièce rassure le client et protège votre marge.",
    steps: [
      {
        name: "Découper le devis pièce par pièce",
        text: "Remplacer le devis global par un chiffrage par pièce, plus compréhensible et négociable pour le client.",
      },
      {
        name: "Adapter les postes à chaque pièce",
        text: "Tenir compte des particularités : plaques hydrofuges en salle de bain, faux plafond avec éclairage dans le séjour, doublage isolant en chambre.",
      },
      {
        name: "Permettre de phaser les travaux",
        text: "Laisser le client commencer par les pièces de vie et repousser les chambres, pour garder le chantier même avec un budget initial limité.",
      },
    ],
  },
  "devis-mise-aux-normes-postes-oublies": {
    name: "Devis de mise aux normes : la méthode pour ne rien oublier",
    description:
      "La méthode pour chiffrer une mise aux normes électrique complète, en vérifiant les six postes les plus souvent oubliés.",
    steps: [
      {
        name: "Repérer les oublis qui coûtent cher",
        text: "Identifier les détails techniques que le client ne connaît pas (différentiel oublié, mise à la terre négligée, tableau non repéré) et qui font passer votre devis pour plus cher s'il est incomplet.",
      },
      {
        name: "Vérifier les 6 postes clés",
        text: "Passer en revue la liaison équipotentielle, la mise à la terre, les protections différentielles 30 mA, le repérage du tableau, la protection des circuits spécialisés et le remplacement des prises vétustes.",
      },
      {
        name: "Détailler ligne par ligne",
        text: "Faire apparaître chaque protection avec son prix et sa justification, pour rassurer un client qui comprend à quoi sert un différentiel 30 mA plutôt qu'une ligne obscure « divers tableau ».",
      },
      {
        name: "Enregistrer un modèle réutilisable",
        text: "Enregistrer ces postes comme modèle réutilisable, pour chiffrer la prochaine mise aux normes en quelques minutes avec une marge constante.",
      },
    ],
  },
  "pourquoi-devis-facade-partent-trop-tard": {
    name: "Envoyer un devis de façade vite, sans oublier de poste",
    description:
      "La méthode pour produire un devis de ravalement rapidement, dès le retour du chantier, et répondre avant les concurrents.",
    steps: [
      {
        name: "Comprendre d'où vient le retard",
        text: "Identifier que le retard vient du chiffrage des surfaces et des couches de préparation : nettoyage haute pression, traitement fongicide, réparation des fissures, sous-couche puis finition.",
      },
      {
        name: "Chiffrer surfaces et préparation par type de façade",
        text: "Mesurer les surfaces et associer à chacune les postes de préparation correspondants, plutôt que de repartir d'une feuille blanche à chaque visite.",
      },
      {
        name: "Préparer un modèle par type de façade",
        text: "Préparer un modèle par type de façade (enduit, pierre, brique) avec les postes et les prix au m² déjà enregistrés, pour générer un devis en quelques minutes.",
      },
      {
        name: "Répondre le premier",
        text: "Envoyer le devis dès le retour du chantier : sur ce type de dossier, répondre en premier double souvent les chances de décrocher le chantier.",
      },
    ],
  },
  "devis-sinistre-assurance-clair": {
    name: "Rédiger un devis de sinistre clair pour l'assurance",
    description:
      "La méthode pour produire un devis de sinistre complet et lisible par l'expert, afin d'accélérer l'indemnisation et votre paiement.",
    steps: [
      {
        name: "Décrire précisément le désordre",
        text: "Indiquer la nature exacte du désordre et sa localisation, en gardant à l'esprit que le document sera lu par l'expert d'assurance autant que par le client.",
      },
      {
        name: "Détailler poste par poste",
        text: "Éviter le forfaitaire global et lister dépose, remplacement, zinguerie et évacuation, avec les surfaces concernées, car les devis globaux sont les plus souvent contestés.",
      },
      {
        name: "Ajouter des photos datées et le contexte météo",
        text: "Joindre des photos datées et un rappel des conditions météo lorsqu'elles expliquent le désordre, une photo valant souvent mieux qu'un paragraphe.",
      },
      {
        name: "Garder une trace de l'envoi",
        text: "Conserver une copie du devis envoyé et la date de transmission, pour répondre en quelques minutes à une demande de précision de l'expert.",
      },
    ],
  },
  "chiffrer-pose-split-climatisation": {
    name: "Chiffrer une pose de split sans oublier de poste",
    description:
      "La méthode pour produire un devis de climatisation complet, du support mural à la mise en service, sans repasser au bureau.",
    totalTime: "PT10M",
    steps: [
      {
        name: "Lister les postes invisibles du devis",
        text: "Faire apparaître le support mural ou au sol, le perçage et le rebouchage, les liaisons frigorifiques au-delà du kit, l'évacuation des condensats, l'alimentation électrique dédiée et la reprise de l'ancien appareil.",
      },
      {
        name: "Facturer la mise en service sur sa propre ligne",
        text: "Distinguer contrôle d'étanchéité, tirage au vide, charge complémentaire, essais de fonctionnement et vérification des débits, avec un forfait clair.",
      },
      {
        name: "Partir d'un modèle par type de pose",
        text: "Préparer un modèle pour le mono-split, le multi-split et le gainable, avec les postes déjà présents et vos prix déjà enregistrés, pour ne saisir sur place que la puissance et les particularités du logement.",
      },
      {
        name: "Envoyer le devis depuis le chantier",
        text: "Générer, relire et envoyer le devis avant de repartir, en annonçant la somme attendue à la signature lorsque des fournitures sont engagées.",
      },
    ],
  },
  "contrat-entretien-climatisation": {
    name: "Vendre un contrat d'entretien climatisation sans le brader",
    description:
      "La méthode pour chiffrer, écrire et faire reconduire un contrat d'entretien annuel de climatisation.",
    steps: [
      {
        name: "Séparer l'entretien de la pose",
        text: "Faire du contrat une ligne à part sur le devis, avec sa périodicité, le nombre d'appareils couverts et la date anniversaire de la première visite, au lieu de l'offrir en fin de document.",
      },
      {
        name: "Détailler les opérations couvertes",
        text: "Lister ce qui est réellement fait : filtres et échangeurs, étanchéité du circuit, pressions et charge de fluide, évacuation des condensats, essais et désinfection, puis préciser ce qui reste hors contrat.",
      },
      {
        name: "Fixer un forfait et une échéance annuelle",
        text: "Proposer deux ou trois formules selon le nombre d'appareils, avec un montant qui couvre le déplacement et le temps sur place, et une date de visite fixée dès la mise en service.",
      },
      {
        name: "Programmer la relance de reconduction",
        text: "Déclencher une relance automatique environ deux mois avant l'échéance, par SMS court puis par email, pour placer la visite dans le creux de la saison.",
      },
    ],
  },
  "facture-electronique-ce-qui-change-artisan": {
    name: "Passer à la facture électronique sans tout changer",
    description:
      "Quatre vérifications pour émettre des factures conformes au format structuré, sans reprendre votre façon de travailler.",
    steps: [
      {
        name: "Vérifier l'identité fiscale",
        text: "Contrôler le SIRET, le numéro de TVA ou la mention de franchise en base, l'adresse de l'entreprise et les coordonnées de règlement (IBAN, délai de paiement) : ce sont ces données qui alimentent le fichier structuré.",
      },
      {
        name: "Paramétrer les mentions fixes",
        text: "Prévoir une fois pour toutes l'indemnité forfaitaire de recouvrement de 40 €, l'escompte pour paiement anticipé et, en sous-traitance, la mention d'autoliquidation par le preneur.",
      },
      {
        name: "Choisir sa plateforme de dématérialisation",
        text: "Retenir une plateforme immatriculée selon la taille de l'activité, en comparant les offres avec son comptable, puisque c'est lui qui récupérera ensuite les fichiers.",
      },
      {
        name: "Suivre les statuts chaque semaine",
        text: "Traiter les factures « à préparer », transmettre celles qui sont prêtes et corriger immédiatement les rejets, en même temps que les relances clients, pour éviter d'accumuler du retard invisible.",
      },
    ],
  },
};

/** Retourne les données HowTo d'un guide, ou undefined s'il ne décrit pas de méthode pas à pas. */
export function getHowToGuide(slug?: string): HowToInput | undefined {
  if (!slug) return undefined;
  const data = howToGuides[slug];
  return data ? { slug, ...data } : undefined;
}