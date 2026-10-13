/**
 * Lexique « en français simple » : traduction des termes un peu techniques de l'outil, pour les
 * personnes qui ne sont pas à l'aise avec l'informatique ou le jargon du bâtiment/gestion.
 *
 * Chaque entrée donne : le terme tel qu'il apparaît dans l'application, une explication courte et
 * concrète (« à quoi ça sert, dans la vraie vie »), et éventuellement le lien vers la page
 * concernée pour aller directement à l'action.
 */

export interface EntreeLexique {
  /** Le terme tel qu'affiché dans l'application. */
  terme: string;
  /** Explication courte et concrète. */
  definition: string;
  /** Route à ouvrir pour agir (optionnel). */
  page?: string;
  /** Libellé du bouton vers la page (optionnel). */
  pageLabel?: string;
}

export const LEXIQUE: EntreeLexique[] = [
  {
    terme: "Devis",
    definition:
      "Le papier que vous envoyez à un client pour proposer un prix. Tant qu'il n'est pas signé, rien n'est engagé.",
    page: "/app/devis",
    pageLabel: "Voir mes devis",
  },
  {
    terme: "Facture",
    definition:
      "La demande de paiement envoyée après un devis signé ou un travail terminé.",
    page: "/app/factures",
    pageLabel: "Voir mes factures",
  },
  {
    terme: "Brouillon",
    definition:
      "Un devis ou une facture en cours de préparation, pas encore envoyé au client. Vous pouvez le modifier autant que vous voulez : le client ne voit rien tant que vous ne l'avez pas envoyé.",
    page: "/app/devis",
    pageLabel: "Voir mes devis",
  },
  {
    terme: "Envoyé",
    definition:
      "Le document est bien parti chez le client (par email ou par lien). À partir de là, vous attendez sa réponse : c'est le moment idéal pour le relancer s'il ne dit rien.",
    page: "/app/devis",
    pageLabel: "Voir mes devis",
  },
  {
    terme: "Accepté",
    definition:
      "Le client a donné son accord sur le devis. Vous pouvez lancer le travail et préparer la facture. « Signé » veut dire qu'il a en plus apposé sa signature en ligne.",
    page: "/app/devis",
    pageLabel: "Voir mes devis",
  },
  {
    terme: "Payée",
    definition:
      "Le client a réglé la facture : l'argent a été encaissé. C'est le signal que tout est bouclé, plus rien à relancer pour ce document.",
    page: "/app/factures",
    pageLabel: "Voir mes factures",
  },
  {
    terme: "Émise",
    definition:
      "La facture est partie chez le client et attend son règlement. C'est le statut de départ : dès qu'elle est réglée, elle passe à « Payée », et si l'échéance est dépassée, à « En retard ».",
    page: "/app/factures",
    pageLabel: "Voir mes factures",
  },
  {
    terme: "En retard",
    definition:
      "La date d'échéance de la facture est dépassée et le paiement n'est pas encore arrivé. C'est le signal qu'il faut relancer le client pour se faire régler.",
    page: "/app/factures",
    pageLabel: "Relancer les impayés",
  },
  {
    terme: "Relance",
    definition:
      "Un petit rappel envoyé à un client qui n'a pas répondu ou n'a pas payé. C'est un message courtois, pas une menace.",
    page: "/app/relances",
    pageLabel: "Voir mes relances",
  },
  {
    terme: "Escalade",
    definition:
      "Ancien nom du « renvoi automatique » : quand une relance reste sans réponse trop longtemps, on passe à un message plus ferme. Voyez l'entrée « Renvoi automatique ».",
    page: "/app/relances#reglage-escalade",
    pageLabel: "Régler le seuil d'escalade",
  },
  {
    terme: "Renvoi automatique",
    definition:
      "Un rappel plus ferme, envoyé tout seul quand une relance reste sans réponse trop longtemps. C'est l'outil qui s'en charge à votre place, sans que vous ayez à cliquer. Le seuil qui déclenche ce renvoi se règle en haut de la page Relances, dans le panneau « Relances automatiques » : « Renvoi automatique après N reports », et « Renvoi auto des retards de plus de N jours ». Vous pouvez même mettre le renvoi en pause en coupant l'interrupteur.",
    page: "/app/relances#reglage-escalade",
    pageLabel: "Régler le seuil d'escalade",
  },
  {
    terme: "Report",
    definition:
      "Changer la date d'une relance déjà prévue : on la décale à plus tard, sans la supprimer. Le client ne reçoit rien tant que la nouvelle date n'est pas arrivée.",
    page: "/app/relances",
    pageLabel: "Voir mes relances",
  },
  {
    terme: "Bilan d'archivage",
    definition:
      "Un récapitulatif annuel de tout ce qui a été transmis à votre comptable sur l'année. Il part tout seul chaque janvier et sert d'archive : vous le retrouvez à tout moment dans l'Espace comptable.",
    page: "/app/comptabilite",
    pageLabel: "Ouvrir l'Espace comptable",
  },
  {
    terme: "Encaissement",
    definition:
      "L'argent réellement reçu d'un client, quand une facture passe au statut « Payée ». C'est ce qui a effectivement rentré sur votre compte, par opposition au simple montant facturé.",
    page: "/app/factures",
    pageLabel: "Voir mes factures",
  },
  {
    terme: "Envoi automatique",
    definition:
      "Un message qui part tout seul, à la date que vous avez choisie, sans que vous ayez à cliquer. Vous pouvez toujours le désactiver.",
    page: "/app/envois-automatiques",
    pageLabel: "Voir les envois automatiques",
  },
  {
    terme: "Bibliothèque de lignes",
    definition:
      "Votre catalogue de prestations prêtes à réutiliser (main-d'œuvre, fournitures, avec leur prix). Vous piochez dedans pour gagner du temps.",
    page: "/app/bibliotheque-lignes",
    pageLabel: "Ouvrir la bibliothèque",
  },
  {
    terme: "Tâche planifiée",
    definition:
      "Un réveil que l'outil se donne tout seul pour faire un travail à heure fixe (envoyer un récapitulatif, vérifier un envoi…). Rien à faire de votre côté.",
  },
  {
    terme: "Guide de première visite",
    definition:
      "La petite carte d'accueil qui apparaît la première fois que vous ouvrez une page : elle explique, pas à pas, comment s'en servir. Vous pouvez la revoir avec le bouton « Revoir le guide » sur la page concernée, ou toutes les réafficher d'un coup depuis le bouton « Aide », en bas à droite, avec « Revoir tous les guides ».",
  },
  {
    terme: "Récapitulatif (récap)",
    definition:
      "Un résumé qui regroupe plusieurs informations en un seul message, envoyé à intervalle régulier (par semaine, par mois…).",
  },
  {
    terme: "Impayé",
    definition:
      "Une facture qui aurait déjà dû être payée et ne l'est pas encore. L'outil les repère pour vous.",
    page: "/app/factures",
    pageLabel: "Repérer les impayés",
  },
  {
    terme: "Montant HT",
    definition:
      "Le prix avant les taxes (TVA). C'est la base de vos calculs de chiffre d'affaires.",
  },
  {
    terme: "Gestionnaire / Back-office",
    definition:
      "Un espace réservé aux personnes qui gèrent le service (support, suivi des comptes). Vous n'avez rien à y faire en tant qu'artisan.",
  },
  {
    terme: "Synchronisation",
    definition:
      "Quand vos réglages sont enregistrés pour être retrouvés à l'identique sur un autre appareil. Vous n'avez rien à faire, c'est automatique.",
  },
];