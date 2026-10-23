/**
 * Aide contextuelle : les astuces propres à la page où l'artisan se trouve.
 *
 * Le panneau « Aide » s'ouvre toujours sur ces conseils avant le guide général de prise en main :
 * quelqu'un bloqué sur l'écran Factures n'a pas besoin de relire « ajoutez d'abord un client ».
 *
 * Chaque page est repérée par sa route (préfixe). Quand une nouvelle page apparaît, il suffit
 * d'ajouter une entrée ici : aucune autre modification n'est nécessaire côté panneau.
 */

export interface AstucePage {
  icon: string;
  titre: string;
  texte: string;
}

/**
 * Événement écouté par le panneau « Aide » : n'importe quel écran peut le déclencher pour
 * ouvrir le panneau (par exemple le rappel discret posé en bas du Planning).
 */
export const EVENEMENT_OUVRIR_AIDE = "artiflow:ouvrir-aide";

/** Demande l'ouverture du panneau d'aide, sans quitter la page en cours. */
export function demanderOuvertureAide(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENEMENT_OUVRIR_AIDE));
}

export interface AidePage {
  /** Préfixe de route servant à reconnaître la page. */
  chemin: string;
  titre: string;
  resume: string;
  astuces: AstucePage[];
  /** Raccourci proposé en bas de la carte (optionnel). */
  lien?: { to: string; label: string };
}

const AIDES_PAGES: AidePage[] = [
  {
    chemin: "/app",
    titre: "Tableau de bord",
    resume: "Votre point de départ chaque matin : ce qui est urgent, ce qui est en cours, ce qu'il reste à faire.",
    astuces: [
      {
        icon: "ri-alarm-warning-line",
        titre: "Les bandeaux du haut sont des alertes, pas de la décoration",
        texte:
          "Un bandeau coloré signale une chose à traiter (impayés, devis en attente, config email à vérifier). Cliquez dessus : il ouvre directement l'écran concerné.",
      },
      {
        icon: "ri-play-circle-line",
        titre: "« Reprendre » vous remet là où vous vous êtes arrêté",
        texte:
          "Un devis commencé ou un chantier ouvert réapparaît sur le tableau de bord : pas besoin de le rechercher dans les listes.",
      },
      {
        icon: "ri-bar-chart-box-line",
        titre: "Les chiffres du mois se lisent de gauche à droite",
        texte:
          "Encaissé, en attente, en retard : ce sont des montants réels issus de vos factures, pas des prévisions.",
      },
    ],
  },
  {
    chemin: "/app/devis",
    titre: "Devis",
    resume: "Vous préparez une proposition de prix, puis vous l'envoyez au client pour accord.",
    astuces: [
      {
        icon: "ri-magic-line",
        titre: "Le bouton « Nouveau devis IA » rédige à votre place",
        texte:
          "Vous décrivez le chantier en quelques mots, l'outil propose les lignes. Vous relisez, vous ajustez les prix, puis vous enregistrez.",
      },
      {
        icon: "ri-book-2-line",
        titre: "La bibliothèque de lignes évite de tout retaper",
        texte:
          "Vos prestations récurrentes (main-d'œuvre, fournitures) sont enregistrées avec leur prix : vous les piochez dans le devis en un clic.",
      },
      {
        icon: "ri-send-plane-line",
        titre: "Envoyer, puis relancer",
        texte:
          "Un devis « Envoyé » sans réponse apparaît dans les relances : inutile de surveiller les dates vous-même.",
      },
      {
        icon: "ri-filter-3-line",
        titre: "Les filtres de statut font le tri",
        texte:
          "Brouillon, Envoyé, Accepté, Refusé : cliquez sur un filtre pour n'afficher que ce qui vous intéresse à cet instant.",
      },
    ],
  },
  {
    chemin: "/app/bibliotheque-lignes",
    titre: "Bibliothèque de lignes",
    resume: "Votre catalogue de prestations réutilisables, avec leurs prix de départ.",
    astuces: [
      {
        icon: "ri-price-tag-3-line",
        titre: "Une ligne = une prestation type",
        texte:
          "Créez une ligne par chose que vous facturez souvent. Le prix enregistré est un point de départ : vous pouvez le changer sur chaque devis.",
      },
      {
        icon: "ri-folder-2-line",
        titre: "Rangez par catégorie",
        texte:
          "Quelques catégories suffisent (main-d'œuvre, fournitures, déplacement). C'est ce qui rend la recherche rapide dans un devis.",
      },
    ],
  },
  {
    chemin: "/app/clients",
    titre: "Clients",
    resume: "Le carnet unique de votre activité : particuliers et entreprises dans la même liste, chaque devis et chaque facture s'appuie dessus.",
    astuces: [
      {
        icon: "ri-search-line",
        titre: "La recherche trouve tout",
        texte:
          "Tapez quelques lettres d'un nom, d'une ville, d'un téléphone, d'un contact ou d'un SIRET : la liste se réduit immédiatement.",
      },
      {
        icon: "ri-building-2-line",
        titre: "« Professionnels » est un filtre, pas un autre carnet",
        texte:
          "Le bouton Professionnels affiche les mêmes fiches, restreintes aux entreprises : c'est là qu'apparaissent l'interlocuteur, le secteur, le SIRET, le CA généré et le tri par chiffre d'affaires. « Tous » rétablit la vue complète.",
      },
      {
        icon: "ri-numbers-line",
        titre: "Les pastilles de type annoncent ce que vous allez trouver",
        texte:
          "Chaque pastille porte son compteur, et un rappel à côté donne la répartition du carnet (X entreprises / Y particuliers). Inutile de cliquer pour savoir s'il y a des entreprises à suivre : le chiffre est là avant.",
      },
      {
        icon: "ri-pushpin-2-line",
        titre: "Épinglez la vue Professionnels pour la rouvrir en un clic",
        texte:
          "En vue Professionnels, le bouton « Épingler » de l'en-tête range cette vue dans vos favorites : elle réapparaît dans la barre latérale et sur le tableau de bord, avec son filtre déjà appliqué.",
      },
      {
        icon: "ri-node-tree",
        titre: "Le menu range le carnet en deux portes d'entrée",
        texte:
          "Dans la barre latérale, le bloc « Clients » se déplie sur « Particuliers » et « Entreprises » : chaque ligne ouvre le même carnet, déjà filtré, avec son compteur à droite. La ligne « Tout le carnet » affiche le total des fiches et ramène à la liste complète en un clic.",
      },
      {
        icon: "ri-building-2-line",
        titre: "La pastille du menu compte vos entreprises",
        texte:
          "Les pastilles des deux sous-entrées affichent le nombre de fiches de chaque type : vous savez combien de particuliers et de pros vous suivez sans ouvrir la page, et le chiffre se met à jour à chaque navigation.",
      },
      {
        icon: "ri-bar-chart-grouped-line",
        titre: "Les deux cartes du haut montrent la tendance",
        texte:
          "Particuliers et Entreprises affichent le CA des trois derniers mois : trois petites barres, puis la variation par rapport au mois précédent. Une flèche vers le bas signale un type qui décroche, avant même d'ouvrir les fiches.",
      },
      {
        icon: "ri-error-warning-line",
        titre: "Le filtre « Fiche incomplète » révèle les trous",
        texte:
          "En vue Professionnels, il ne garde que les entreprises auxquelles il manque au moins une information : SIRET, interlocuteur ou secteur. Le compteur annonce combien de fiches sont concernées, et la ligne de chaque carte ouvre directement le formulaire pour compléter.",
      },
      {
        icon: "ri-file-list-3-line",
        titre: "La fiche client raconte l'historique",
        texte:
          "Ouvrez un client pour retrouver ses devis, ses factures et vos notes. C'est là qu'on comprend en dix secondes où en est la relation.",
      },
      {
        icon: "ri-sticky-note-line",
        titre: "Une note rapide vaut mieux qu'un post-it perdu",
        texte:
          "« Portail à gauche », « préfère le SMS » : ce genre de détail se garde dans la fiche, et ressort au bon moment.",
      },
      {
        icon: "ri-file-excel-2-line",
        titre: "L'export CSV suit la vue affichée",
        texte:
          "Il reprend exactement les fiches filtrées. En vue Professionnels, deux colonnes s'ajoutent : le nombre de devis et le CA HT de chaque entreprise.",
      },
    ],
  },
  {
    chemin: "/app/factures",
    titre: "Factures",
    resume: "La demande de paiement envoyée au client, avec sa date d'échéance.",
    astuces: [
      {
        icon: "ri-file-transfer-line",
        titre: "Une facture naît souvent d'un devis accepté",
        texte:
          "Générer la facture depuis le devis reprend les lignes et les prix : vous n'avez plus qu'à vérifier.",
      },
      {
        icon: "ri-calendar-check-line",
        titre: "L'échéance fait tout le travail",
        texte:
          "La date d'échéance décide du passage en « En retard ». C'est elle qui déclenche les rappels proposés.",
      },
      {
        icon: "ri-error-warning-line",
        titre: "Filtrez « En retard » pour ne rien oublier",
        texte:
          "C'est la liste à regarder avant d'appeler un client : elle ne contient que ce qui est réellement dû.",
      },
    ],
  },
  {
    chemin: "/app/relances",
    titre: "Relances",
    resume: "Les rappels envoyés aux clients qui n'ont pas répondu ou pas payé.",
    astuces: [
      {
        icon: "ri-timer-line",
        titre: "Programmées ou manuelles",
        texte:
          "Une relance programmée part toute seule à la date prévue ; une relance manuelle attend votre clic. Vous pouvez reporter une date sans supprimer la relance.",
      },
      {
        icon: "ri-restart-line",
        titre: "Le renvoi automatique se règle en haut de page",
        texte:
          "Quand une relance reste sans réponse trop longtemps, un message plus ferme peut partir seul. Le seuil et l'interrupteur sont dans le panneau des relances automatiques.",
      },
      {
        icon: "ri-mail-check-line",
        titre: "L'historique dit vraiment ce qui est parti",
        texte:
          "Un envoi réussi et un envoi en échec ne se ressemblent pas : regardez l'historique avant de conclure qu'un client a été prévenu.",
      },
    ],
  },
  {
    chemin: "/app/relances-programmees",
    titre: "Relances programmées",
    resume: "La file d'attente des relances déjà décidées, avec leur date d'envoi.",
    astuces: [
      {
        icon: "ri-calendar-schedule-line",
        titre: "Tout ce qui part bientôt est ici",
        texte:
          "Vous voyez la date prévue de chaque relance : rien ne part sans être passé par cette liste.",
      },
      {
        icon: "ri-shuffle-line",
        titre: "Reprogrammer plutôt que recréer",
        texte:
          "Besoin de décaler plusieurs relances ? Sélectionnez-les et choisissez une nouvelle date : elles gardent leur message.",
      },
    ],
  },
  {
    chemin: "/app/envois-automatiques",
    titre: "Envois automatiques",
    resume: "Les messages qui partent seuls (récapitulatifs, bilans, synthèses) aux dates prévues.",
    astuces: [
      {
        icon: "ri-toggle-line",
        titre: "Chaque automatisation s'active ou se coupe",
        texte:
          "Un interrupteur par envoi : coupez ce qui ne vous sert pas, le reste continue de tourner.",
      },
      {
        icon: "ri-test-tube-line",
        titre: "Testez avant de laisser partir",
        texte:
          "Le test à blanc simule un envoi complet sans toucher aux vrais clients : idéal pour vérifier un contenu.",
      },
      {
        icon: "ri-history-line",
        titre: "L'historique des passages",
        texte:
          "Il indique quand la tâche a tourné pour la dernière fois et ce qu'elle a réellement envoyé.",
      },
    ],
  },
  {
    chemin: "/app/planning",
    titre: "Planning de l'équipe",
    resume: "Qui fait quoi, quand, et où — avec les congés et les conflits à arbitrer.",
    astuces: [
      {
        icon: "ri-calendar-2-line",
        titre: "Semaine ou mois, selon ce que vous cherchez",
        texte:
          "La vue Semaine sert à poser les interventions, la vue Mois à voir la charge d'ensemble et à repérer les trous.",
      },
      {
        icon: "ri-error-warning-line",
        titre: "Les conflits de congé vous préviennent",
        texte:
          "Une intervention qui tombe un jour de congé apparaît en conflit : vous pouvez alors la réaffecter en un geste.",
      },
      {
        icon: "ri-mail-send-line",
        titre: "Envoyer la liste au responsable",
        texte:
          "La carte des conflits permet d'envoyer la liste par email, et de régler le jour et l'heure du rappel automatique. L'historique garde chaque envoi et permet de le renvoyer.",
      },
      {
        icon: "ri-suitcase-line",
        titre: "Les congés se posent depuis le planning",
        texte:
          "Un congé posé ici apparaît à la fois dans le solde annuel et dans le planning personnel de la personne.",
      },
    ],
  },
  {
    chemin: "/app/intervenants",
    titre: "Intervenants",
    resume: "Les personnes de votre équipe, leurs accès et leurs heures.",
    astuces: [
      {
        icon: "ri-user-follow-line",
        titre: "Inviter, c'est donner un accès",
        texte:
          "Une fiche sans compte reste une simple étiquette dans le planning. L'invitation crée le compte pour que la personne voie son propre planning.",
      },
      {
        icon: "ri-filter-3-line",
        titre: "Le filtre « À relancer » fait le ménage",
        texte:
          "Les invitations anciennes sans réponse y sont regroupées : un clic pour relancer, sans chercher dans la liste.",
      },
      {
        icon: "ri-file-user-line",
        titre: "La fiche détaille tout",
        texte:
          "Heures pointées du mois, interventions à venir, absences et congés restants : tout est repris au même endroit.",
      },
    ],
  },
  {
    chemin: "/app/pointages",
    titre: "Pointages",
    resume: "Les heures réellement travaillées, mois par mois, prêtes pour la paie.",
    astuces: [
      {
        icon: "ri-time-line",
        titre: "Seul le pointage compte",
        texte:
          "Une intervention planifiée mais jamais pointée n'apparaît pas dans les heures : c'est volontaire, pour ne compter que le travail réel.",
      },
      {
        icon: "ri-pause-circle-line",
        titre: "La pause se déduit automatiquement",
        texte:
          "La durée affichée est nette : arrivée, départ, moins la pause enregistrée sur l'intervention.",
      },
      {
        icon: "ri-download-2-line",
        titre: "L'export CSV sert à la paie",
        texte:
          "Il détaille chaque ligne et ajoute le total par personne : de quoi transmettre sans recalculer.",
      },
    ],
  },
  {
    chemin: "/app/mon-planning",
    titre: "Mon planning",
    resume: "Vos interventions de la semaine, vos heures et vos congés, dans un seul écran.",
    astuces: [
      {
        icon: "ri-calendar-check-line",
        titre: "Votre semaine, jour par jour",
        texte:
          "Choisissez un jour en haut : vous verrez vos interventions, l'adresse et les consignes laissées par le responsable.",
      },
      {
        icon: "ri-checkbox-circle-line",
        titre: "Marquez une intervention comme faite",
        texte:
          "Le bouton sur la ligne de l'intervention indique au responsable que le travail est terminé.",
      },
      {
        icon: "ri-play-circle-line",
        titre: "Pointez votre arrivée et votre départ",
        texte:
          "Sur chaque intervention, le pointage enregistre vos heures réellement travaillées, pause comprise.",
      },
      {
        icon: "ri-file-paper-2-line",
        titre: "Le PV de recette clôture le chantier",
        texte:
          "Photos, conformité et signature du client se font depuis l'intervention : plus besoin d'imprimer un document.",
      },
      {
        icon: "ri-suitcase-line",
        titre: "Vos congés sont visibles tout de suite",
        texte:
          "Le solde annuel et vos absences s'affichent même les jours sans intervention, pour savoir où vous en êtes.",
      },
    ],
  },
  {
    chemin: "/app/envois",
    titre: "Envois",
    resume: "Tous vos envois réels — devis, factures, relances — réunis dans un seul historique, avec le canal utilisé.",
    astuces: [
      {
        icon: "ri-flask-line",
        titre: "Une ligne « Exemple » n'est pas un vrai envoi",
        texte:
          "Les lignes du jeu de démonstration portent une pastille « Exemple ». Le bandeau du haut ne retient que le dernier envoi réel, et le filtre « Exemples masqués » les retire de la liste.",
      },
      {
        icon: "ri-filter-3-line",
        titre: "Trois filtres suffisent à retrouver un envoi",
        texte:
          "Période (ce mois, ce trimestre…), type (devis, facture, relance) et canal (email, SMS, WhatsApp) se combinent. Cliquez un mois du résumé pour filtrer directement dessus.",
      },
      {
        icon: "ri-send-plane-2-line",
        titre: "Les relances groupées ont leur propre vue",
        texte:
          "Les relances parties en lot (envoi groupé ou renvoi automatique) sont regroupées : le bouton « Relances groupées » n'affiche qu'elles, avec leur propre export.",
      },
      {
        icon: "ri-file-excel-2-line",
        titre: "L'export CSV reprend exactement la sélection",
        texte:
          "Filtres et période inclus, avec un récapitulatif du nombre d'envois par canal et par type. Pratique pour justifier une activité sur un mois.",
      },
    ],
  },
  {
    chemin: "/app/facturation-electronique",
    titre: "Facturation électronique",
    resume: "Préparer le fichier électronique de vos factures et suivre où en est chaque transmission.",
    astuces: [
      {
        icon: "ri-file-code-line",
        titre: "« Préparer le XML » génère le fichier, il ne l'envoie pas",
        texte:
          "Le fichier Factur-X est téléchargé sur votre poste : vous le déposez sur votre plateforme de dématérialisation (PDP) ou vous le transmettez à votre client professionnel.",
      },
      {
        icon: "ri-route-line",
        titre: "C'est vous qui faites avancer le statut",
        texte:
          "À préparer, Prête à transmettre, Transmise, Reçue, Rejetée : chaque étape se met à jour à la main, une fois le dépôt réellement effectué. L'application ne transmet rien toute seule.",
      },
      {
        icon: "ri-error-warning-line",
        titre: "Un rejet se corrige, il ne se supprime pas",
        texte:
          "Indiquez le motif renvoyé par la plateforme : il reste attaché à la facture et alimente la fiche des rejets (PDF ou email à votre comptable).",
      },
      {
        icon: "ri-file-shield-2-line",
        titre: "Les mentions viennent de vos réglages",
        texte:
          "Option paiement à débit, autoliquidation, dispense de TVA et escompte se règlent juste à côté : ce sont elles qui remplissent le fichier et le PDF.",
      },
    ],
  },
  {
    chemin: "/app/abonnements",
    titre: "Abonnements (back-office)",
    resume: "Le suivi des abonnements des artisans inscrits : offres, revenus récurrents, essais et impayés.",
    astuces: [
      {
        icon: "ri-line-chart-line",
        titre: "Le MRR est un revenu mensuel, pas un encaissement",
        texte:
          "Il additionne les abonnements actifs en les ramenant au mois. Une hausse ou une baisse s'explique par les changements d'offre du mois, visibles juste à côté.",
      },
      {
        icon: "ri-user-shared-line",
        titre: "« Volatil » veut dire : change souvent d'offre",
        texte:
          "Le seuil se compte sur les derniers mois. Les comptes concernés se filtrent en « À recontacter » (aucun contact encore) ou « Déjà recontactés ».",
      },
      {
        icon: "ri-time-line",
        titre: "Le délai avant rappel se règle une fois",
        texte:
          "Le réglage du rappel des comptes volatils est enregistré côté serveur : il s'applique aussi sur un autre appareil et au prochain passage de la tâche automatique.",
      },
      {
        icon: "ri-history-line",
        titre: "Les historiques disent si un message est parti",
        texte:
          "Récapitulatifs hebdomadaires et alertes de relance automatique gardent la trace de chaque envoi : un envoi en échec ne ressemble pas à un envoi réussi.",
      },
    ],
  },
  {
    chemin: "/app/chantiers",
    titre: "Chantiers",
    resume: "Le suivi des travaux en cours, étape par étape.",
    astuces: [
      {
        icon: "ri-list-check-2",
        titre: "Les étapes montrent l'avancement",
        texte:
          "Cochez une étape au fur et à mesure : la fiche du chantier reflète toujours la réalité du terrain.",
      },
      {
        icon: "ri-link",
        titre: "Un chantier relie devis, client et planning",
        texte:
          "En ouvrant un chantier, vous retrouvez le devis d'origine, les coordonnées et les interventions prévues.",
      },
    ],
  },
  {
    chemin: "/app/comptabilite",
    titre: "Comptabilité",
    resume: "Les documents à transmettre à votre comptable, prêts à partir.",
    astuces: [
      {
        icon: "ri-folder-shared-line",
        titre: "Un envoi par mois suffit",
        texte:
          "Le journal, la TVA et les justificatifs partent groupés : plus besoin de préparer un dossier à la main.",
      },
      {
        icon: "ri-calendar-line",
        titre: "Les mois manquants sont signalés",
        texte:
          "Le compteur vous indique les mois encore non transmis, pour ne pas découvrir un trou en fin d'année.",
      },
    ],
  },
  {
    chemin: "/app/profil",
    titre: "Mon profil",
    resume: "Vos informations d'entreprise, vos coordonnées et votre abonnement.",
    astuces: [
      {
        icon: "ri-building-line",
        titre: "Ces informations apparaissent sur vos documents",
        texte:
          "Nom, adresse, SIRET et coordonnées se retrouvent sur les devis et factures : vérifiez-les une fois, ils seront justes partout.",
      },
      {
        icon: "ri-shield-keyhole-line",
        titre: "Vos données vous appartiennent",
        texte:
          "Export et suppression sont accessibles ici, sans passer par un support.",
      },
    ],
  },
  {
    chemin: "/app/preferences",
    titre: "Préférences d'affichage",
    resume: "Ce que vous voyez à l'écran : formats, barres, rappels et sons.",
    astuces: [
      {
        icon: "ri-layout-row-line",
        titre: "Chaque réglage est enregistré sur votre compte",
        texte:
          "Vous retrouvez la même présentation sur un autre appareil, sans avoir à tout refaire.",
      },
      {
        icon: "ri-history-line",
        titre: "Les guides peuvent réapparaître",
        texte:
          "Le bouton « Revoir tous les guides » du panneau Aide réaffiche les petits guides d'accueil de chaque page à la prochaine visite.",
      },
    ],
  },
  {
    chemin: "/app/back-office",
    titre: "Vue d'ensemble du back-office",
    resume: "Le point d'entrée du gestionnaire : ce qui attend une décision, puis les chiffres des abonnements.",
    astuces: [
      {
        icon: "ri-sort-desc",
        titre: "Les cartes sont rangées dans l'ordre du quotidien",
        texte:
          "En haut, ce qui demande une action (note interne, suppressions programmées, essais, suivis d'envois). Les chiffres d'abonnements et la régularité comptable viennent plus bas : on y descend pour piloter, pas pour agir dans l'urgence.",
      },
      {
        icon: "ri-line-chart-line",
        titre: "Le MRR n'est pas un encaissement",
        texte:
          "Il additionne les abonnements au statut « Actif », ramenés au mois. Les essais et les impayés sont comptés à part : un MRR correct ne veut donc pas dire que l'argent est arrivé.",
      },
      {
        icon: "ri-file-chart-line",
        titre: "La régularité comptable se lit artisan par artisan",
        texte:
          "Elle indique quels artisans ont des mois encore non transmis à leur comptable. La carte ouvre directement l'écran Comptabilité quand votre compte y a accès.",
      },
      {
        icon: "ri-bug-line",
        titre: "Journal des erreurs : une trace, pas un compteur décoratif",
        texte:
          "Chaque incident de chargement y est listé avec son écran et son code. Vous pouvez le marquer comme résolu, le télécharger en CSV ou vider le journal — vider n'efface que les lignes affichées, jamais les données métier.",
      },
      {
        icon: "ri-shield-user-line",
        titre: "Les accès gestionnaires se donnent depuis un seul compte",
        texte:
          "Seul le gestionnaire principal peut ajouter ou retirer un accès. Les changements d'adresses et d'autorisations restent tracés dans le journal du compte gestionnaire.",
      },
    ],
  },
  {
    chemin: "/app/audit-seo",
    titre: "Audit SEO",
    resume: "Titre, description et visuel de partage de chaque page publique, réunis pour repérer ce qui reste à compléter.",
    astuces: [
      {
        icon: "ri-shield-check-line",
        titre: "Les trois garde-fous du haut donnent le diagnostic",
        texte:
          "Visuels de partage, longueurs et doublons de métadonnées, cohérence du sitemap : ils comptent les écarts. La liste en dessous montre page par page ce qui les provoque.",
      },
      {
        icon: "ri-filter-3-line",
        titre: "Deux cases à cocher vont droit au problème",
        texte:
          "« Sans visuel dédié » et « métadonnées hors plage » se cumulent avec le filtre de groupe : c'est la façon la plus rapide de sortir la liste des pages réellement à retoucher.",
      },
      {
        icon: "ri-text-spacing",
        titre: "Le compteur de caractères anticipe l'affichage dans Google",
        texte:
          "Un titre trop long ou une description trop courte ne cassent rien, mais ils sont tronqués ou peu informatifs dans les résultats. La plage affichée à côté de chaque compteur est celle à viser.",
      },
      {
        icon: "ri-share-line",
        titre: "L'aperçu de partage change de réseau, pas de page",
        texte:
          "LinkedIn, Facebook ou X n'affichent pas la même chose : le sélecteur modifie tous les aperçus de la liste. C'est une simulation de rendu, rien n'est publié depuis cet écran.",
      },
    ],
  },
  {
    chemin: "/app/pros-inscrits",
    titre: "Pros inscrits",
    resume: "Le registre des professionnels inscrits : entreprise, offre, statut et état de leur email de bienvenue.",
    astuces: [
      {
        icon: "ri-line-chart-line",
        titre: "Le MRR de cette page ne retient que les comptes actifs",
        texte:
          "Il additionne le montant mensuel des abonnements « Actif ». Les essais en cours et les comptes impayés existent dans la liste, mais ne sont pas comptés comme revenu.",
      },
      {
        icon: "ri-pie-chart-2-line",
        titre: "Répartition et courbe portent sur tout le registre",
        texte:
          "Les graphiques du haut restent calculés sur l'ensemble des pros inscrits : ils ne suivent pas vos filtres. Pour une lecture filtrée, utilisez l'export CSV de la liste, ou celui de la répartition.",
      },
      {
        icon: "ri-mail-send-line",
        titre: "« Bienvenue à envoyer » évite les oublis",
        texte:
          "Le bouton du haut renvoie l'email d'accueil à tous les pros qui ne l'ont pas encore reçu, avec le compteur exact. Le filtre du même nom permet de vérifier qui est concerné avant d'envoyer.",
      },
      {
        icon: "ri-user-star-line",
        titre: "Une ligne ouvre la fiche complète du compte",
        texte:
          "Coordonnées d'entreprise, historique de l'offre et actions rapides se trouvent dans le panneau de droite. C'est là qu'on change un statut, pas depuis la liste.",
      },
    ],
  },
];

/**
 * Retrouve l'aide de la page correspondant au chemin courant.
 * Le préfixe le plus long gagne, pour que « /app/relances-programmees » ne soit pas
 * confondu avec « /app/relances ».
 */
export function aidePourChemin(pathname: string): AidePage | null {
  const chemin = pathname.replace(/\/+$/, "") || "/";
  let trouve: AidePage | null = null;
  for (const aide of AIDES_PAGES) {
    const exact = chemin === aide.chemin;
    const enfant = aide.chemin === "/app" ? chemin === "/app" : chemin.startsWith(`${aide.chemin}/`);
    if (!exact && !enfant) continue;
    if (trouve === null || aide.chemin.length > trouve.chemin.length) trouve = aide;
  }
  return trouve;
}