export type FaqGuide = { question: string; answer: string };

/**
 * Questions fréquentes réellement affichées en bas de chaque guide.
 * Elles alimentent à la fois le bloc visible (accordéon) et le balisage
 * Schema.org FAQPage de la page guide. Une question doit toujours avoir une
 * réponse visible correspondante pour rester éligible aux rich snippets.
 */
export const faqGuides: Record<string, FaqGuide[]> = {
  "devis-chaudiere-en-5-minutes": [
    {
      question: "Quels postes oublie-t-on le plus souvent sur un devis de chaudière ?",
      answer:
        "Le raccordement gaz, le désembouage du circuit, la mise en service et l'évacuation des fumées. Ce sont ces lignes invisibles qui font perdre plusieurs centaines d'euros de marge.",
    },
    {
      question: "Comment produire un devis de chaudière pendant le chantier ?",
      answer:
        "En partant d'un modèle stable : une ligne pour le matériel, une pour les accessoires indispensables, une pour la main-d'œuvre au forfait et une pour la mise en service. Il ne reste plus qu'à préciser le modèle posé et la configuration des lieux.",
    },
    {
      question: "Faut-il relancer un client après un devis de remplacement de chaudière ?",
      answer:
        "Oui. La décision est rarement immédiate : une relance automatique à 48 h, si le client n'a pas répondu, récupère régulièrement le devis.",
    },
  ],
  "relance-apres-depannage-urgent": [
    {
      question: "Pourquoi un dépannage urgent ne se transforme-t-il pas toujours en chantier signé ?",
      answer:
        "Parce que la décision de remplacement se prend à froid, une fois la pression retombée. Sans relance au bon moment, le devis part souvent à la trappe.",
    },
    {
      question: "Quel est le bon rythme de relance après un dépannage ?",
      answer:
        "Une relance très rapide le soir même ou le lendemain matin, puis une seconde relance à 5 jours qui propose une date d'intervention. Au-delà de trois relances, on passe pour un vendeur insistant.",
    },
    {
      question: "Quel canal privilégier pour relancer un client après une urgence ?",
      answer:
        "Le SMS pour la première relance, car il est lu dans l'heure, puis l'email pour le récapitulatif détaillé.",
    },
  ],
  "devis-mise-aux-normes-postes-oublies": [
    {
      question: "Quels postes sont le plus souvent oubliés sur un devis de mise aux normes ?",
      answer:
        "La liaison équipotentielle, la mise à la terre, les protections différentielles 30 mA, le repérage du tableau, la protection des circuits spécialisés et le remplacement des prises vétustes.",
    },
    {
      question: "Pourquoi faut-il détailler chaque protection sur le devis ?",
      answer:
        "Parce qu'un client qui comprend que le différentiel 30 mA protège sa famille accepte bien plus facilement le montant qu'un client qui voit une ligne obscure intitulée « divers tableau ».",
    },
    {
      question: "Comment ne plus oublier de postes sur ce type de devis ?",
      answer:
        "En enregistrant ces six postes une fois comme modèle réutilisable. La prochaine mise aux normes se chiffre alors en quelques minutes, quelle que soit la précipitation du jour.",
    },
  ],
  "messages-relance-devis-electricite": [
    {
      question: "Pourquoi mes devis électriques font-ils hésiter les clients ?",
      answer:
        "Souvent, non pas à cause du prix, mais parce que le devis est technique : beaucoup de lignes et un vocabulaire que le client ne maîtrise pas.",
    },
    {
      question: "Quel premier message de relance faut-il envoyer ?",
      answer:
        "À 48 h, un message qui rassure plutôt qu'il ne pousse : rappeler en une phrase le problème identifié et proposer de répondre à toute question. C'est la relance la plus efficace.",
    },
    {
      question: "Que faire si le client hésite toujours après deux relances ?",
      answer:
        "Proposer un phasage en deux étapes pour étaler le budget. Sur les rénovations complètes, cette option fait souvent revenir des dossiers qu'on croyait perdus.",
    },
  ],
  "chiffrer-extension-sans-erreur-metres": [
    {
      question: "Quelle est l'erreur classique quand on chiffre une extension ?",
      answer:
        "Sauter directement à l'élévation des murs. Or ce sont le terrassement, les fondations et la dalle qui font grimper le coût réel si on les sous-estime.",
    },
    {
      question: "Comment structurer un devis d'extension fiable ?",
      answer:
        "Décomposer en lots successifs : terrassement, fondations, dalle, élévation, charpente, couverture, menuiseries extérieures, finitions. On chiffre chaque lot, puis on assemble.",
    },
    {
      question: "Quels postes annexes ne faut-il pas oublier ?",
      answer:
        "L'évacuation des terres, la location d'engin et le compte de transport. Ces postes changent complètement la rentabilité d'un chantier d'extension.",
    },
  ],
  "organiser-chantiers-par-zone": [
    {
      question: "Combien coûtent vraiment les trajets entre les chantiers ?",
      answer:
        "Un planning mal ordonné peut coûter une heure de trajet par jour, soit plus de quarante heures par an.",
    },
    {
      question: "Comment regrouper ses chantiers intelligemment ?",
      answer:
        "En regroupant les chantiers d'une même semaine dans un rayon réduit et en évitant d'alterner entre deux secteurs éloignés. Une seule journée en zone éloignée vaut mieux que trois allers-retours étalés.",
    },
    {
      question: "Quel gain peut-on espérer en organisant par zone ?",
      answer:
        "La plupart des artisans qui appliquent ce regroupement récupèrent une demi-journée par semaine, sans travailler plus.",
    },
  ],
  "devis-peinture-au-m2-methode-simple": [
    {
      question: "Faut-il facturer la surface brute ou la surface nette ?",
      answer:
        "La surface nette à peindre. Facturer une surface brute revient à surestimer les murs et à oublier les plafonds, ce qui rend le devis incohérent.",
    },
    {
      question: "Comment mesurer correctement murs et plafonds ?",
      answer:
        "Périmètre fois hauteur pour les murs, plus la surface du plafond, puis déduction des ouvertures selon votre convention habituelle. Cette déduction doit rester visible dans le devis.",
    },
    {
      question: "Pourquoi décliner le prix au m² par type de préparation ?",
      answer:
        "Parce qu'un mur neuf demande une sous-couche plus deux finitions, alors qu'un support sain se contente d'une couche de rafraîchissement. Un prix unique revient à peindre gratuitement la moitié des chantiers.",
    },
  ],
  "pourquoi-devis-facade-partent-trop-tard": [
    {
      question: "Pourquoi les devis de façade partent-ils si tard ?",
      answer:
        "Le retard vient presque toujours du chiffrage des surfaces et des couches de préparation : nettoyage haute pression, traitement fongicide, réparation des fissures, sous-couche puis finition.",
    },
    {
      question: "Quel est le vrai coût de ce retard ?",
      answer:
        "Répondre une semaine après la visite laisse le champ libre à l'entreprise qui a répondu en deux jours. Sur ce type de chantier, répondre le premier double souvent les chances de décrocher le dossier.",
    },
    {
      question: "Comment accélérer la production des devis de façade ?",
      answer:
        "En préparant un modèle par type de façade (enduit, pierre, brique) avec les postes et les prix au m² déjà enregistrés. Le devis se génère alors en quelques minutes.",
    },
  ],
  "variantes-materiaux-dans-un-seul-devis": [
    {
      question: "Pourquoi le choix du matériau bloque-t-il la décision ?",
      answer:
        "Parce que chaque option (bois, alu, PVC, mixte) possède un prix, une durée de vie et un rendu différents. Le client hésite, demande à réfléchir, et le devis s'enlise.",
    },
    {
      question: "Comment débloquer la décision du client ?",
      answer:
        "En proposant deux ou trois variantes chiffrées dans le même document. Le client se décide alors en comparant, au lieu de comparer entre deux entreprises concurrentes.",
    },
    {
      question: "Quel intérêt pour l'artisan de présenter des variantes ?",
      answer:
        "Vous ne vendez plus seulement un prix, vous vendez un conseil, ce qui justifie mieux votre positionnement et rassure le client.",
    },
  ],
  "suivre-commande-sur-mesure-du-devis-a-la-pose": [
    {
      question: "Quelles sont les phases d'un projet de menuiserie sur mesure ?",
      answer:
        "Prise de mesures, validation du devis, commande des matériaux, fabrication en atelier, livraison puis pose. Chaque transition est un risque d'oubli.",
    },
    {
      question: "Où se situe le vrai risque dans le suivi de commande ?",
      answer:
        "Pas dans le travail, mais dans la mémoire : une quincaillerie à commander, une date de pose à confirmer. Ces oublis arrivent surtout entre deux chantiers.",
    },
    {
      question: "Comment fiabiliser le suivi d'une commande sur mesure ?",
      answer:
        "En transformant chaque devis signé en fiche de suivi avec des étapes datées : chaque étape cochée déclenche la suivante et informe le client sans que vous ayez à y penser.",
    },
  ],
  "calculer-reserve-chutes-carrelage": [
    {
      question: "Combien de carreaux faut-il prévoir en plus ?",
      answer:
        "En général 10 % de chutes pour une pose droite et jusqu'à 15 % pour une pose en diagonale, auxquels s'ajoute le carrelage de réserve que tout professionnel laisse au client.",
    },
    {
      question: "Qu'oublie-t-on le plus souvent dans le calcul ?",
      answer:
        "Les découpes et les plinthes. Il faut compter la surface au sol, les plinthes développées et la faïence murale le cas échéant, pas seulement une partie du chantier.",
    },
    {
      question: "Comment éviter les malentendus à la livraison ?",
      answer:
        "En séparant clairement fourniture et pose dans le devis et en affichant la quantité commandée, ce qui justifie aussi votre chiffrage face à un devis concurrent plus « léger ».",
    },
  ],
  "devis-salle-de-bain-structurer": [
    {
      question: "Pourquoi une salle de bain génère-t-elle tant d'oublis ?",
      answer:
        "Parce que les postes s'accumulent : faïence murale, carrelage au sol, plinthes, mais aussi les coupes autour du receveur et des sanitaires.",
    },
    {
      question: "Comment structurer un devis de salle de bain lisible ?",
      answer:
        "En chiffrant séparément chaque surface, avec sa quantité, son prix au m² et sa main-d'œuvre. Le client voit immédiatement l'impact du choix d'une faïence ou d'un sol.",
    },
    {
      question: "Quels postes annexes ne faut-il pas oublier ?",
      answer:
        "Les joints (un joint époxy se facture différemment d'un joint classique) et la préparation du support, comme le ragréage ou le primaire.",
    },
  ],
  "apres-orage-prioriser-urgences-toiture": [
    {
      question: "Comment gérer l'afflux d'appels après un gros orage ?",
      answer:
        "En triant d'abord : d'un côté les urgences réelles (fuite, bâchage nécessaire), de l'autre les demandes de devis pour réfection. Les deux ne se traitent pas au même rythme.",
    },
    {
      question: "À quel rythme traiter chaque type de demande ?",
      answer:
        "Intervention rapide de sécurisation puis devis de réparation dans la journée pour les urgences ; devis détaillé sous 48 h pour les réfections, dont la décision dépend souvent de l'assurance.",
    },
    {
      question: "Faut-il tracer chaque appel après une tempête ?",
      answer:
        "Oui, même en une ligne : qui a appelé, ce qui a été fait, où en est le devis. C'est la seule façon de ne perdre aucun dossier dans la masse.",
    },
  ],
  "devis-sinistre-assurance-clair": [
    {
      question: "Qui lit réellement mon devis de sinistre ?",
      answer:
        "Non seulement le client, mais aussi l'expert d'assurance. Sa clarté détermine la vitesse d'indemnisation, et donc votre délai de paiement.",
    },
    {
      question: "Que doit contenir un devis de sinistre complet ?",
      answer:
        "Une description précise du désordre, la localisation exacte, les surfaces concernées et un détail poste par poste : dépose, remplacement, zinguerie, évacuation.",
    },
    {
      question: "Pourquoi ajouter des photos au dossier ?",
      answer:
        "Une photo datée vaut souvent mieux qu'un paragraphe pour accélérer l'instruction. Ajoutez aussi un rappel des conditions météo si elles expliquent le désordre.",
    },
  ],
  "devis-faux-plafond-sans-erreur": [
    {
      question: "Peut-on appliquer le même prix au m² aux murs et aux plafonds ?",
      answer:
        "Non. Un faux plafond, avec son ossature suspendue, est plus long à poser qu'une cloison simple : un prix unique revient à travailler à perte sur une partie du chantier.",
    },
    {
      question: "Quels postes techniques faut-il détailler ?",
      answer:
        "Ossature, isolant, plaques (avec leur épaisseur et leur type), bandes, enduit et éventuellement peinture. Chacun doit être une ligne avec sa quantité et son unité.",
    },
    {
      question: "Faut-il compter plusieurs passages d'enduit ?",
      answer:
        "Oui, selon la finition attendue. Un rendu lisse se facture plus qu'une finition standard, et cette transparence évite les négociations désagréables en fin de chantier.",
    },
  ],
  "renovation-appartement-piece-par-piece": [
    {
      question: "Pourquoi découper un devis de plâtrerie par pièce ?",
      answer:
        "Un devis global fait peur : le client ne sait pas ce qu'il paye, hésite et repousse la décision. Découpé pièce par pièce, le même montant devient compréhensible et négociable.",
    },
    {
      question: "Chaque pièce demande-t-elle un traitement différent ?",
      answer:
        "Oui : plaques hydrofuges en salle de bain, faux plafond avec éclairage intégré au séjour, simple doublage isolant en chambre. Ce découpage valorise la technicité de chaque zone.",
    },
    {
      question: "Quel autre avantage y a-t-il à découper par pièce ?",
      answer:
        "Cela permet de phaser les travaux : commencer par les pièces de vie et repousser les chambres, ce qui garde le chantier même si le budget initial était limité.",
    },
  ],
  "chiffrer-pose-split-climatisation": [
    {
      question: "Quels postes oublie-t-on le plus souvent sur un devis de climatisation ?",
      answer:
        "Le support mural, le perçage et le rebouchage du mur, les mètres de liaison frigorifique au-delà du kit, l'évacuation des condensats, l'alimentation électrique dédiée et la reprise de l'ancien appareil.",
    },
    {
      question: "Faut-il facturer la mise en service séparément ?",
      answer:
        "Oui, elle mérite sa propre ligne : contrôle d'étanchéité, tirage au vide, charge complémentaire, essais de fonctionnement et vérification des débits. Noyée dans le prix de la machine, elle finit par être considérée comme gratuite.",
    },
    {
      question: "Comment chiffrer plusieurs types de pose sans recalculer à chaque fois ?",
      answer:
        "En partant d'un modèle par type de pose : mono-split, multi-split et gainable. Les postes sont déjà présents avec vos prix, il ne reste qu'à saisir la puissance retenue et les particularités du logement.",
    },
  ],
  "relancer-devis-pompe-a-chaleur": [
    {
      question: "Pourquoi un devis de pompe à chaleur reste-t-il sans réponse ?",
      answer:
        "Rarement parce qu'il est trop cher : le dossier est en attente d'un arbitrage (budget, délai, comparaison) ou d'une question que le client n'a pas osé poser. Sans relance, il se perd.",
    },
    {
      question: "À quel moment faut-il relancer ?",
      answer:
        "Une première relance deux à trois jours après l'envoi, une deuxième à une semaine, puis une troisième plus tard avec une alternative chiffrée plutôt qu'un rappel du prix.",
    },
    {
      question: "Faut-il relancer par SMS ou par email ?",
      answer:
        "Le SMS court pour rouvrir la conversation et proposer une date, l'email pour ce qui doit rester : le devis, les options chiffrées et les documents techniques.",
    },
  ],
  "contrat-entretien-climatisation": [
    {
      question: "Un contrat d'entretien est-il obligatoire pour un particulier ?",
      answer:
        "Aucun texte n'oblige un particulier à signer un contrat avec un professionnel. En revanche, une installation doit être entretenue régulièrement pour rester performante, et certains fabricants conditionnent la garantie au respect de visites d'entretien : vérifiez les conditions de chaque constructeur.",
    },
    {
      question: "Combien facturer un contrat d'entretien climatisation ?",
      answer:
        "Le montant dépend du nombre d'appareils et du déplacement. Sur un mono-split résidentiel, la fourchette courante va de 150 à 200 € par an. L'important est que le forfait couvre le temps sur place et le suivi, plutôt que d'être offert pour emporter la pose.",
    },
    {
      question: "Pourquoi les contrats ne sont-ils pas renouvelés ?",
      answer:
        "Presque toujours par oubli : la date anniversaire passe sans qu'aucune relance ne parte. Une relance automatique deux mois avant l'échéance, par SMS puis par email, suffit à éviter la majorité des sorties.",
    },
  ],
};

faqGuides["acompte-ou-arrhes-devis"] = [
  {
    question: "Un acompte est-il obligatoire sur un devis ?",
    answer:
      "Non. Rien n'oblige un artisan à demander un acompte : c'est une clause du devis, pas une formalité imposée. Si vous en demandez un, il doit figurer par écrit sur le devis, avec son montant et la date à laquelle il est attendu.",
  },
  {
    question: "L'acompte est-il remboursable si le client annule ?",
    answer:
      "Tout dépend de ce que prévoit votre devis et des circonstances de l'annulation. Un acompte engage les deux parties, mais les conséquences d'un retrait ne sont pas les mêmes selon l'avancement du chantier et les commandes déjà passées. Pour trancher un cas précis, faites valider votre clause par un professionnel du droit ou votre comptable.",
  },
  {
    question: "Quelle différence entre un acompte et une facture d'avance ?",
    answer:
      "L'acompte est la somme versée avant les travaux. La facture d'avance est le document qui constate ce versement et le rattache à la prestation. Autrement dit, l'acompte est le paiement, la facture d'avance est la pièce comptable qui l'accompagne.",
  },
  {
    question: "Peut-on demander un acompte sans devis signé ?",
    answer:
      "C'est risqué. Sans devis signé, il n'existe aucune trace de ce que la somme couvre ni du prix total, et le client peut contester le montant. La signature, papier ou électronique, est ce qui rend l'acompte défendable.",
  },
];

faqGuides["facture-electronique-ce-qui-change-artisan"] = [
  {
    question: "Un PDF envoyé par email suffit-il encore pour une facture ?",
    answer:
      "Pour une facture entre deux professionnels, non : il faut un fichier structuré (Factur-X, UBL ou CII) transmis par une plateforme de dématérialisation. Le PDF reste utile comme version lisible par le client, mais il ne constitue plus à lui seul la facture électronique attendue.",
  },
  {
    question: "Faut-il payer une plateforme pour émettre ses factures électroniques ?",
    answer:
      "Tout dépend de la taille de votre activité et de l'offre choisie : certaines plateformes sont payantes, d'autres proposent une formule gratuite pour les petites structures. Le bon réflexe est de comparer en demandant l'avis de votre comptable, puisque c'est lui qui récupérera ensuite les fichiers.",
  },
  {
    question: "Que faire quand une facture électronique est rejetée ?",
    answer:
      "Un rejet signale presque toujours une donnée à corriger : SIRET du client incomplet, taux de TVA incohérent, montant qui ne correspond pas aux lignes. Corrigez la facture, notez le motif pour ne pas le reproduire, puis retransmettez-la. Un rejet n'annule pas la facture, il bloque seulement sa transmission.",
  },
];

/** FAQ d'un guide, ou tableau vide si le guide n'en a pas. */
export function getFaqGuide(slug?: string): FaqGuide[] {
  if (!slug) return [];
  return faqGuides[slug] ?? [];
}