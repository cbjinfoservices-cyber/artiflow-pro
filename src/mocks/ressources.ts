import { estNouveau } from "@/lib/dates";
import { sujets } from "@/mocks/sujets";

export type ArticleSection = { title: string; body: string[] };

export type Article = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date: string;
  /** Visuel de partage social (Open Graph) dédié à ce guide, format 1200×630. */
  shareImage: string;
  sections: ArticleSection[];
  /**
   * Adresse canonique quand le guide vit sur sa propre page (ex. guide pratique
   * de sécurité) plutôt que sur la page génrique `/ressources/:slug`.
   */
  href?: string;
};

/**
 * Catégories de guides pratiques qui ne sont pas des corps d'état (ex. sécurité du
 * compte). Elles vivent dans le même catalogue que les guides métiers, mais
 * s'affichent avec leur propre libellé au lieu du repli « Artisan ».
 */
export const CATEGORIES_GUIDES_PRATIQUES: Record<
  string,
  { name: string; shortName: string; icon: string }
> = {
  "securite-du-compte": { name: "Sécurité du compte", shortName: "Sécurité", icon: "ri-shield-keyhole-line" },
};

/** Libellé d'une catégorie de guide (pratique ou non), avec repli générique. */
export function libelleCategorieGuide(category: string): string | null {
  return CATEGORIES_GUIDES_PRATIQUES[category]?.name ?? null;
}

/** Source minimale nécessaire au calcul du temps de lecture d'un guide. */
export type LectureSource = { sections: ArticleSection[]; excerpt?: string };

/** Vitesse de lecture retenue pour un guide (mots/minute). */
export const MOTS_PAR_MINUTE = 200;

/** Nombre de mots d'un texte, en ignorant les espaces multiples. */
export function compteMots(texte: string): number {
  const propre = texte.trim();
  return propre === "" ? 0 : propre.split(/\s+/).length;
}

/**
 * Temps de lecture réel d'un guide, calculé à partir de son contenu (extrait +
 * titres de sections + paragraphes) plutôt qu'un champ saisi à la main.
 * Arrondi à la minute supérieure, avec un minimum d'une minute.
 */
export function readingMinutes(article: LectureSource): number {
  const texte = `${article.excerpt ?? ""} ${articleFullText(article)}`;
  return Math.max(1, Math.ceil(compteMots(texte) / MOTS_PAR_MINUTE));
}

/** Libellé affichable du temps de lecture d'un guide (ex. « 3 min »). */
export function formatLecture(article: LectureSource): string {
  return `${readingMinutes(article)} min`;
}

const MOIS_FR = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

/** Convertit une date française (« 18 septembre 2026 ») en timestamp, ou 0 si illisible. */
export function parseDateFr(date: string): number {
  const match = date.match(/(\d{1,2})\s+([A-Za-zéèêëûôàîï]+)\s+(\d{4})/i);
  if (!match) return 0;
  const mois = match[2]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const index = MOIS_FR.indexOf(mois);
  if (index === -1) return 0;
  return new Date(Number(match[3]), index, Number(match[1])).getTime();
}

/** Concatène le texte complet d'un guide (titres de sections + paragraphes) pour la recherche. */
export function articleFullText(article: { sections: ArticleSection[] }): string {
  return article.sections
    .map((section) => [section.title, ...section.body].join(" "))
    .join(" ");
}

export const articles: Article[] = [
  {
    slug: "devis-chaudiere-en-5-minutes",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20a%20boiler%20replacement%20quote%20guide%2C%20a%20wall-mounted%20condensing%20boiler%20silhouette%20with%20copper%20pipes%20and%20a%20quote%20document%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-chaudiere&orientation=landscape",
    category: "plombier-chauffagiste",
    title: "Rédiger un devis de chaudière en 5 minutes, sans rien oublier",
    excerpt:
      "Chaudière, accessoires, main-d'œuvre et mise en service : la méthode simple pour un devis de chauffage complet, prêt avant de quitter le chantier.",
    date: "18 septembre 2026",
    sections: [
      {
        title: "Les postes qu'on oublie",
        body: [
          "Un devis de chaudière raté, c'est souvent une ligne oubliée : le raccordement gaz, le désembouage du circuit, la mise en service ou l'évacuation des fumées. Ces postes invisibles représentent pourtant plusieurs centaines d'euros de marge, et ils sont la première cause de devis refaits à la main le dimanche soir.",
        ],
      },
      {
        title: "Partir d'un modèle stable",
        body: [
          "La bonne approche consiste à partir d'un modèle stable : une ligne pour le matériel, une pour les accessoires indispensables, une pour la main-d'œuvre au forfait et une pour la mise en service. Votre bibliothèque de prix doit contenir une variante par type de chaudière (gaz à condensation, murale, au sol, pompe à chaleur) afin de ne jamais recalculer à zéro.",
        ],
      },
      {
        title: "Générer le devis sur le chantier",
        body: [
          "Une fois ce modèle en place, la seule chose à faire sur le chantier est de préciser le modèle posé et la configuration des lieux. Le devis se génère, vous le relisez d'un coup d'œil, et il part chez le client avant la fin de l'intervention. C'est ce décalage de quelques heures qui fait souvent la différence avec un concurrent qui enverra son prix trois jours plus tard.",
        ],
      },
      {
        title: "Relancer à 48 h",
        body: [
          "Dernier réflexe utile : prévoir une relance automatique à 48 h si le client n'a pas répondu. Sur les remplacements de chaudière, la décision est rarement immédiate, et une relance bien placée récupère régulièrement le devis.",
        ],
      },
    ],
  },
  {
    slug: "relance-apres-depannage-urgent",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20following%20up%20after%20an%20emergency%20plumbing%20repair%2C%20a%20smartphone%20with%20message%20bubbles%20and%20a%20water%20drop%20next%20to%20a%20wrench%20silhouette%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-depannage&orientation=landscape",
    category: "plombier-chauffagiste",
    title: "Relancer un client après un dépannage urgent : le bon timing",
    excerpt:
      "Un client sans eau chaude ne doit pas attendre votre appel. Voici comment structurer vos relances pour transformer le dépannage en chantier signé.",
    date: "10 septembre 2026",
    sections: [
      {
        title: "Après l'urgence, la décision retombe",
        body: [
          "Après un dépannage urgent, le client a souvent pris une décision émotionnelle : il veut de l'eau chaude tout de suite. Le devis de remplacement, lui, se décide à froid, une fois la pression retombée. C'est exactement là que la plupart des artisans perdent le chantier, faute d'avoir relancé au bon moment.",
        ],
      },
      {
        title: "Le bon rythme de relance",
        body: [
          "La règle qui fonctionne : une relance très rapide (le soir même ou le lendemain matin) pour remercier et rappeler que le devis est disponible, puis une seconde relance à 5 jours, plus factuelle, qui propose une date d'intervention. Au-delà de trois relances, on passe pour un vendeur insistant.",
        ],
      },
      {
        title: "Le canal fait la différence",
        body: [
          "Le canal compte autant que le rythme. Un SMS court est lu dans l'heure, alors qu'un email part souvent dans les spams ou se noie. Pour un dépannage, mieux vaut donc privilégier le SMS pour la première relance, puis l'email pour le récapitulatif détaillé.",
        ],
      },
      {
        title: "Automatiser pour ne rien lâcher",
        body: [
          "Sur ce métier, l'automatisation fait gagner beaucoup : les relances partent même quand vous êtes sous un évier ou en train de faire la route. Ce sont souvent deux à trois dépannages par mois récupérés sans effort supplémentaire.",
        ],
      },
    ],
  },
  {
    slug: "devis-mise-aux-normes-postes-oublies",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20an%20electrical%20compliance%20quote%20guide%2C%20a%20modern%20electrical%20panel%20silhouette%20with%20circuit%20breakers%20and%20a%20checklist%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-normes&orientation=landscape",
    category: "electricien",
    title: "Devis de mise aux normes : les 6 postes qu'on oublie tout le temps",
    excerpt:
      "Différentiels, terre, repérage, gaines : la checklist des postes qui sécurisent votre marge sur les devis de mise en conformité électrique.",
    date: "22 septembre 2026",
    sections: [
      {
        title: "Les oublis qui coûtent cher",
        body: [
          "Une mise aux normes électrique se joue sur des détails : un différentiel oublié, une mise à la terre négligée, un tableau non repéré. Le client, lui, ne connaît pas ces postes techniques. Il compare donc des devis, et le vôtre passe pour plus cher s'il est incomplet.",
        ],
      },
      {
        title: "Les 6 postes à vérifier",
        body: [
          "Les six postes les plus fréquemment oubliés sont : la liaison équipotentielle, la mise à la terre, les protections différentielles 30 mA, le repérage du tableau, la protection des circuits spécialisés et le remplacement des prises vétustes. Chacun a un prix et une justification, et chacun doit apparaître explicitement.",
        ],
      },
      {
        title: "Détailler pour rassurer",
        body: [
          "Sur un devis, mieux vaut détailler ligne par ligne en expliquant à quoi sert chaque protection. Un client qui comprend que le différentiel 30 mA protège sa famille accepte bien plus facilement le montant qu'un client qui voit une ligne obscure intitulée « divers tableau ».",
        ],
      },
      {
        title: "Enregistrer un modèle réutilisable",
        body: [
          "Enregistrez ces postes une fois comme modèle réutilisable : la prochaine mise aux normes se chiffre alors en quelques minutes, et la marge reste constante, quelle que soit la précipitation du jour.",
        ],
      },
    ],
  },
  {
    slug: "messages-relance-devis-electricite",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20follow-up%20messages%20for%20electrical%20quotes%2C%20chat%20bubbles%20and%20a%20lightning%20bolt%20with%20a%20copper%20cable%20silhouette%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-relance-elec&orientation=landscape",
    category: "electricien",
    title: "3 messages de relance qui font signer vos devis électricité",
    excerpt:
      "Les devis électriques techniques font hésiter. Ces trois relances, courtes et rassurantes, débloquent la décision sans passer pour un vendeur.",
    date: "14 septembre 2026",
    sections: [
      {
        title: "Un devis technique qui fait hésiter",
        body: [
          "Les devis d'électricité sont souvent techniques : beaucoup de lignes, beaucoup de protections, un vocabulaire que le client ne maîtrise pas. Il hésite donc, non pas parce que le prix est trop élevé, mais parce qu'il n'est pas sûr d'avoir compris.",
        ],
      },
      {
        title: "Relance 1 : rassurer à 48 h",
        body: [
          "La première relance, à 48 h, doit rassurer plutôt que pousser : rappeler en une phrase le problème identifié, et proposer de répondre à toute question. Rien de commercial, juste un service. C'est la relance la plus efficace.",
        ],
      },
      {
        title: "Relance 2 : une contrainte utile",
        body: [
          "La deuxième, à une semaine, apporte une contrainte utile : votre planning de la quinzaine se remplit. Sans fausse urgence, cette information honnête débloque souvent les clients qui hésitaient à rappeler.",
        ],
      },
      {
        title: "Relance 3 : proposer un phasage",
        body: [
          "La troisième, plus espacée, propose une alternative : un phasage en deux étapes pour étaler le budget. Sur les rénovations complètes, cette option fait revenir des dossiers qu'on croyait perdus pour de bon.",
        ],
      },
    ],
  },
  {
    slug: "chiffrer-extension-sans-erreur-metres",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20measuring%20a%20building%20extension%20quote%2C%20a%20measuring%20tape%20with%20foundation%20and%20brick%20wall%20shapes%20over%20a%20blueprint%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-extension&orientation=landscape",
    category: "macon",
    title: "Chiffrer une extension sans se tromper sur les métrés",
    excerpt:
      "Terrassement, fondations, élévation, toiture : la méthode pour ne plus perdre de marge en oubliant une étape du gros œuvre.",
    date: "20 septembre 2026",
    sections: [
      {
        title: "Une extension se chiffre par étapes",
        body: [
          "Une extension se chiffre par étapes, et l'erreur classique est de sauter directement à l'élévation des murs. Or ce sont le terrassement, les fondations et la dalle qui font grimper le coût réel, et donc la marge, si on les sous-estime.",
        ],
      },
      {
        title: "Décomposer en lots successifs",
        body: [
          "La méthode solide : décomposer en lots successifs (terrassement, fondations, dalle, élévation, charpente, couverture, menuiseries extérieures, finitions), puis chiffrer chaque lot séparément avant d'assembler. Cette décomposition évite les oublis et rend le devis défendable face à un client qui compare.",
        ],
      },
      {
        title: "Les postes annexes à ne pas oublier",
        body: [
          "Pensez à ajouter systématiquement l'évacuation des terres, la location d'engin et le compte de transport. Ces postes annexes changent complètement la rentabilité d'un chantier d'extension, et ils sont presque toujours absents des devis faits à la va-vite.",
        ],
      },
      {
        title: "Montrer la logique du chiffrage",
        body: [
          "Enfin, faites apparaître la surface développée et le nombre de mètres cubes de béton dans le devis. Un client qui voit la logique du chiffrage conteste beaucoup moins le montant, et vos litiges de fin de chantier disparaissent.",
        ],
      },
    ],
  },
  {
    slug: "organiser-chantiers-par-zone",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20organizing%20construction%20jobsites%20by%20area%2C%20connected%20map%20pins%20and%20a%20delivery%20truck%20shape%20over%20a%20route%20line%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-zones&orientation=landscape",
    category: "macon",
    title: "Organiser ses chantiers par zone pour couper les trajets",
    excerpt:
      "Une heure par jour passée dans les bouchons, c'est une semaine de travail perdue par an. Voici comment regrouper vos chantiers intelligemment.",
    date: "8 septembre 2026",
    sections: [
      {
        title: "Le vrai coût des trajets",
        body: [
          "Sur les chantiers de maçonnerie, les déplacements pèsent lourd : matériaux volumineux, engins à déplacer, allers-retours imprévus. Un planning mal ordonné peut coûter une heure de trajet par jour, soit plus de quarante heures par an.",
        ],
      },
      {
        title: "Regrouper par secteur",
        body: [
          "Le principe est simple : regrouper les chantiers d'une même semaine dans un rayon réduit, et éviter d'alterner entre deux secteurs éloignés. Une seule journée en zone éloignée, plutôt que trois allers-retours étalés, change radicalement le rythme de la semaine.",
        ],
      },
      {
        title: "Visualiser la semaine sur une carte",
        body: [
          "Concrètement, visualisez vos interventions sur une carte par semaine, puis réorganisez les journées pour limiter les croisements. La plupart des artisans qui appliquent ça récupèrent une demi-journée par semaine, sans travailler plus.",
        ],
      },
      {
        title: "Du temps gagné pour le suivi client",
        body: [
          "Cette organisation a un second effet : elle libère du temps pour le suivi client et les devis, qui sont justement les tâches qu'on repousse toujours en fin de journée quand on est épuisé par la route.",
        ],
      },
    ],
  },
  {
    slug: "devis-peinture-au-m2-methode-simple",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20a%20painting%20quote%20per%20square%20meter%2C%20a%20paint%20roller%20with%20color%20swatches%20and%20a%20metre%20grid%20pattern%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-peinture&orientation=landscape",
    category: "peintre-finitions",
    title: "Devis peinture au m² : la méthode simple qui évite les pertes",
    excerpt:
      "Déduire les ouvertures, gérer les plafonds, prévoir les couches : la bonne structure de devis pour ne plus travailler à perte.",
    date: "24 septembre 2026",
    sections: [
      {
        title: "Tout part du m² net",
        body: [
          "En peinture, tout part du m² net à peindre. Le piège classique est de facturer une surface brute : on surestime les murs, on oublie les plafonds, et le devis devient incohérent à l'arrivée. Le client, lui, ne comprend pas pourquoi le prix diffère d'un devis à l'autre.",
        ],
      },
      {
        title: "Mesurer murs et plafonds",
        body: [
          "La règle de base : mesurer périmètre fois hauteur pour les murs, ajouter la surface du plafond, puis déduire les ouvertures (portes et fenêtres) selon votre convention habituelle. Cette déduction doit être visible dans le devis, c'est un gage de sérieux.",
        ],
      },
      {
        title: "Décliner le prix par préparation",
        body: [
          "Ensuite, chaque surface appelle un nombre de couches : une sous-couche plus deux finitions sur un mur neuf, une seule couche de rafraîchissement sur un support sain. Le prix au m² doit donc être décliné par type de préparation, sinon vous peignez gratuitement la moitié de vos chantiers.",
        ],
      },
      {
        title: "Afficher le temps prévisionnel",
        body: [
          "Terminez toujours par un prévisionnel de temps clair (nombre de jours, nombre de compagnons). Le client accepte un prix plus facilement quand il voit le travail que ça représente réellement.",
        ],
      },
    ],
  },
  {
    slug: "pourquoi-devis-facade-partent-trop-tard",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20late%20facade%20renovation%20quotes%2C%20a%20building%20facade%20silhouette%20with%20a%20clock%20and%20a%20quote%20document%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-facade&orientation=landscape",
    category: "peintre-finitions",
    title: "Pourquoi vos devis de façade partent toujours trop tard",
    excerpt:
      "Un ravalement de façade, ça se joue à quelques jours. Ce retard systématique vous coûte des chantiers, voici comment le corriger.",
    date: "12 septembre 2026",
    sections: [
      {
        title: "Un chantier qui se joue à quelques jours",
        body: [
          "Les devis de façade ont un profil particulier : gros montants, décision lente, et souvent une copropriété ou une famille qui consulte plusieurs entreprises. Envoyer son prix une semaine après la visite, c'est laisser le champ libre à celui qui a répondu en deux jours.",
        ],
      },
      {
        title: "D'où vient le retard",
        body: [
          "Le retard vient presque toujours du même endroit : le chiffrage des surfaces et des couches de préparation. Nettoyage haute pression, traitement fongicide, réparation des fissures, sous-couche puis finition : autant de postes qui demandent un calcul précis et fastidieux.",
        ],
      },
      {
        title: "Préparer un modèle par type de façade",
        body: [
          "La solution est de préparer un modèle par type de façade (enduit, pierre, brique) avec les postes et les prix au m² déjà enregistrés. Une fois ce modèle prêt, un devis de ravalement se génère en quelques minutes, dès le retour du chantier.",
        ],
      },
      {
        title: "Répondre le premier",
        body: [
          "Ce gain de temps se transforme directement en taux de signature : sur ce type de chantier, répondre le premier double souvent vos chances de décrocher le dossier.",
        ],
      },
    ],
  },
  {
    slug: "variantes-materiaux-dans-un-seul-devis",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20material%20variants%20in%20one%20carpentry%20quote%2C%20wood%2C%20aluminium%20and%20pvc%20sample%20swatches%20beside%20a%20single%20document%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-variantes&orientation=landscape",
    category: "menuisier",
    title: "Présenter plusieurs variantes de matériaux dans un seul devis",
    excerpt:
      "Le client hésite entre chêne et alu ? Proposer les deux options dans le même devis double vos chances de signature.",
    date: "19 septembre 2026",
    sections: [
      {
        title: "Le choix du matériau bloque la décision",
        body: [
          "En menuiserie, le choix du matériau est le principal point de blocage. Bois, alu, PVC, mixte : chaque option a un prix, une durée de vie et un rendu différent. Le client hésite, demande à réfléchir, et le devis s'enlise.",
        ],
      },
      {
        title: "Proposer plusieurs variantes chiffrées",
        body: [
          "Plutôt que d'attendre sa décision, proposez directement deux ou trois variantes chiffrées dans le même document. Le client se décide alors en comparant, au lieu de comparer entre deux entreprises concurrentes.",
        ],
      },
      {
        title: "Vendre le conseil, pas seulement le prix",
        body: [
          "Cette approche a un effet secondaire précieux : elle met en avant votre travail de conseil. Vous ne vendez plus un prix, vous vendez un accompagnement, ce qui justifie mieux votre positionnement.",
        ],
      },
      {
        title: "Dupliquer proprement le bloc matériaux",
        body: [
          "Techniquement, il suffit de dupliquer le bloc matériaux dans le devis et de faire varier les lignes concernées. Le reste (main-d'œuvre, pose, finitions) reste identique, ce qui garde le document lisible et rapide à produire.",
        ],
      },
    ],
  },
  {
    slug: "suivre-commande-sur-mesure-du-devis-a-la-pose",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20tracking%20a%20custom%20carpentry%20order%20from%20quote%20to%20installation%2C%20a%20clipboard%20timeline%20with%20checkpoints%20and%20a%20door%20silhouette%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-suivi&orientation=landscape",
    category: "menuisier",
    title: "Du devis à la pose : suivre une commande sur mesure sans rien perdre",
    excerpt:
      "Délais d'atelier, quincailleries, rendez-vous de pose : la méthode pour suivre chaque commande jusqu'au bout sans relance interne.",
    date: "6 septembre 2026",
    sections: [
      {
        title: "Un parcours en plusieurs phases",
        body: [
          "Un projet de menuiserie sur mesure traverse plusieurs phases : prise de mesures, validation du devis, commande des matériaux, fabrication en atelier, livraison puis pose. Chaque transition est un risque d'oubli.",
        ],
      },
      {
        title: "Le vrai risque : l'oubli",
        body: [
          "Le problème n'est pas le travail, mais la mémoire. Entre deux chantiers, on oublie qu'une quincaillerie doit être commandée, ou qu'un client attend une confirmation de date de pose.",
        ],
      },
      {
        title: "Transformer le devis signé en fiche de suivi",
        body: [
          "La méthode qui marche : transformer chaque devis signé en une fiche de suivi avec des étapes datées. À chaque étape cochée, la suivante est déclenchée, et le client est informé sans que vous ayez à y penser.",
        ],
      },
      {
        title: "Une image plus professionnelle",
        body: [
          "Résultat concret : moins d'appels de clients inquiets, moins de commandes passées en retard, et une image nettement plus professionnelle. La qualité artisanale ne se voit pas seulement dans l'ouvrage, elle se voit aussi dans le suivi.",
        ],
      },
    ],
  },
  {
    slug: "calculer-reserve-chutes-carrelage",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20estimating%20tile%20offcuts%20and%20reserves%2C%20geometric%20tile%20shapes%20with%20a%20percentage%20symbol%20and%20a%20trowel%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-chutes&orientation=landscape",
    category: "carreleur",
    title: "Calculer la réserve de chutes au carrelage (et arrêter d'en manquer)",
    excerpt:
      "Mauvaise estimation, voyage en magasin, délai repoussé : la réserve de chutes bien calculée protège votre marge et votre planning.",
    date: "21 septembre 2026",
    sections: [
      {
        title: "La question qui coûte cher",
        body: [
          "Combien de carreaux commander pour une pièce de 22 m² ? La question paraît simple, mais c'est elle qui fait perdre de l'argent aux carreleurs : trop peu, il faut repartir en magasin et perdre une journée ; trop, le client refuse de payer le surplus.",
        ],
      },
      {
        title: "Combien de chutes prévoir",
        body: [
          "La règle de base est un pourcentage de chutes, généralement 10 % pour une pose droite et jusqu'à 15 % pour une pose en diagonale. À cela s'ajoute le carrelage de réserve, que tout professionnel sérieux laisse au client.",
        ],
      },
      {
        title: "Ne pas oublier découpes et plinthes",
        body: [
          "L'erreur n'est pas dans le pourcentage, mais dans l'oubli des découpes et des plinthes. Il faut compter la surface au sol, plus les plinthes développées, plus la faïence murale le cas échéant. Trop de devis ne chiffrent qu'une partie.",
        ],
      },
      {
        title: "Séparer fourniture et pose",
        body: [
          "En séparant clairement fourniture et pose dans le devis, et en affichant la quantité commandée, vous évitez les malentendus au moment de la livraison. C'est aussi une façon élégante de justifier votre chiffrage face à un devis concurrent plus « léger ».",
        ],
      },
    ],
  },
  {
    slug: "devis-salle-de-bain-structurer",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20structuring%20a%20bathroom%20tiling%20quote%2C%20geometric%20wall%20and%20floor%20tiles%20with%20a%20shower%20silhouette%20and%20water%20drops%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-sdb&orientation=landscape",
    category: "carreleur",
    title: "Devis de salle de bain : structurer faïence, sol et plinthes",
    excerpt:
      "Trois surfaces, trois prix, beaucoup de postes à ne pas oublier : comment structurer un devis de salle de bain clair et rentable.",
    date: "9 septembre 2026",
    sections: [
      {
        title: "Le chantier le plus fréquent, le plus piégeux",
        body: [
          "Une salle de bain est le chantier le plus fréquent du carreleur, et paradoxalement celui qui génère le plus d'oublis. Faïence murale, carrelage au sol, plinthes, mais aussi les coupes autour du receveur et des sanitaires : les postes s'accumulent vite.",
        ],
      },
      {
        title: "Chiffrer chaque surface séparément",
        body: [
          "La structure recommandée est de chiffrer séparément chaque surface, avec sa quantité, son prix au m² et sa main-d'œuvre. Un client voit ainsi immédiatement l'impact du choix d'une faïence plus grande ou d'un sol en grès cérame.",
        ],
      },
      {
        title: "Joints et préparation du support",
        body: [
          "Il faut aussi penser aux joints et aux finitions : un joint époxy se facture différemment d'un joint classique, et cela doit apparaître. De même, la préparation du support (ragréage, primaire) est trop souvent passée sous silence.",
        ],
      },
      {
        title: "Une date ferme grâce à un devis précis",
        body: [
          "Enfin, gardez en tête la contrainte de délai : une salle de bain immobilise le client, qui veut une date ferme. Un devis précis permet de proposer un planning crédible, et donc d'emporter la décision.",
        ],
      },
    ],
  },
  {
    slug: "apres-orage-prioriser-urgences-toiture",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20prioritizing%20roofing%20emergencies%20after%20a%20storm%2C%20terracotta%20roof%20tiles%20with%20rain%20and%20lightning%20and%20a%20prioritized%20checklist%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-orage&orientation=landscape",
    category: "couvreur",
    title: "Après un orage : prioriser les urgences de toiture sans stress",
    excerpt:
      "Bâchage, fuites, réfections : comment trier les appels et organiser votre semaine quand tout tombe en même temps.",
    date: "23 septembre 2026",
    sections: [
      {
        title: "Trier les appels avant tout",
        body: [
          "Après un gros coup de vent ou un orage de grêle, le téléphone sonne sans arrêt. Le risque n'est pas de manquer de travail, mais de mal l'organiser : on court partout, on bâche en urgence, et on finit la semaine épuisé sans avoir chiffré correctement.",
        ],
      },
      {
        title: "Urgences réelles et demandes de devis",
        body: [
          "La première chose à faire est de trier : d'un côté les urgences réelles (toiture qui fuit, bâchage nécessaire), de l'autre les demandes de devis pour réfection. Les deux ne se traitent pas au même rythme et ne mobilisent pas les mêmes personnes.",
        ],
      },
      {
        title: "Le bon tempo pour chaque cas",
        body: [
          "Pour les urgences, une intervention rapide de sécurisation, puis un devis de réparation envoyé dans la journée. Pour les réfections, un devis détaillé sous 48 h, car la décision dépend souvent de l'assurance et prendra du temps de toute façon.",
        ],
      },
      {
        title: "Tout tracer, même en une ligne",
        body: [
          "Tracez chaque situation, même en une ligne : qui a appelé, ce qui a été fait, où en est le devis. Après une tempête, c'est la seule façon de ne perdre aucun dossier dans la masse.",
        ],
      },
    ],
  },
  {
    slug: "devis-sinistre-assurance-clair",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20a%20clear%20insurance%20claim%20roofing%20quote%2C%20a%20roof%20and%20shield%20silhouette%20beside%20a%20detailed%20report%20document%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-sinistre&orientation=landscape",
    category: "couvreur",
    title: "Devis de sinistre pour l'assurance : être clair et complet",
    excerpt:
      "Un devis bien rédigé fait accepter le dossier plus vite. Voici ce que l'expert attend, et les erreurs qui rallongent les délais.",
    date: "11 septembre 2026",
    sections: [
      {
        title: "Votre devis est lu par l'expert",
        body: [
          "Sur un sinistre de toiture, votre devis n'est pas seulement lu par le client : il est transmis à l'expert d'assurance. Sa clarté détermine la vitesse d'indemnisation, et donc votre délai de paiement.",
        ],
      },
      {
        title: "Ce que l'expert attend",
        body: [
          "Ce que l'expert attend : une description précise du désordre, la localisation exacte, les surfaces concernées, et un détail poste par poste (dépose, remplacement, zinguerie, évacuation). Les devis forfaitaires globaux sont les plus souvent contestés.",
        ],
      },
      {
        title: "Les photos accélèrent le dossier",
        body: [
          "Ajoutez systématiquement des photos datées de l'avant et un rappel des conditions météo si elles expliquent le désordre. Une photo vaut souvent mieux qu'un paragraphe pour accélérer l'instruction du dossier.",
        ],
      },
      {
        title: "Garder une trace de l'envoi",
        body: [
          "Gardez enfin une copie du devis envoyé et la date de transmission. Si l'expert demande une précision, vous pourrez répondre en quelques minutes plutôt qu'en reprenant tout le chiffrage.",
        ],
      },
    ],
  },
  {
    slug: "devis-faux-plafond-sans-erreur",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20a%20drywall%20false%20ceiling%20quote%2C%20plasterboard%20panels%20and%20a%20suspended%20ceiling%20grid%20with%20a%20taping%20knife%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-placo&orientation=landscape",
    category: "platrier",
    title: "Devis de faux plafond : additionner murs et plafonds sans erreur",
    excerpt:
      "Ossature, plaques, isolant, bandes, enduit : la bonne façon d'additionner chaque surface d'un chantier de plâtrerie.",
    date: "17 septembre 2026",
    sections: [
      {
        title: "Ne pas mélanger les surfaces",
        body: [
          "Un chantier de plâtrerie mélange toujours plusieurs types de surfaces : cloisons, doublages, faux plafonds. Le piège est de les regrouper sous un même prix au m², alors que chacune demande un temps de pose différent.",
        ],
      },
      {
        title: "Chiffrer murs et plafonds à part",
        body: [
          "Il faut donc chiffrer séparément les murs et les plafonds, avec des prix au m² distincts. Un faux plafond, avec son ossature suspendue, est plus long à poser qu'une cloison simple : mélanger les deux revient à travailler à perte sur une partie du chantier.",
        ],
      },
      {
        title: "Les postes techniques détaillés",
        body: [
          "Ensuite viennent les postes techniques : ossature, isolant, plaques (avec leur épaisseur et leur type), bandes, enduit et éventuellement peinture. Chacun doit être une ligne, avec sa quantité et son unité.",
        ],
      },
      {
        title: "Compter les passages d'enduit",
        body: [
          "Enfin, prévoyez le nombre de passages d'enduit selon la finition attendue. Un client qui demande un rendu lisse doit le payer ; un client qui accepte une finition standard paiera moins. Cette transparence évite les négociations désagréables en fin de chantier.",
        ],
      },
    ],
  },
  {
    slug: "renovation-appartement-piece-par-piece",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20room%20by%20room%20apartment%20renovation%20plastering%2C%20an%20apartment%20floor%20plan%20with%20plasterboard%20and%20partition%20shapes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-appart&orientation=landscape",
    category: "platrier",
    title: "Rénovation d'appartement : chiffrer pièce par pièce",
    excerpt:
      "Pourquoi découper un devis de plâtrerie par pièce rassure le client, facilite les arbitrages et protège votre marge.",
    date: "5 septembre 2026",
    sections: [
      {
        title: "Un devis global fait peur",
        body: [
          "Sur une rénovation complète d'appartement, un devis global de plâtrerie fait peur. Le client ne sait pas ce qu'il paye, hésite, et repousse la décision. Découpé pièce par pièce, le même montant devient compréhensible et négociable.",
        ],
      },
      {
        title: "Chaque pièce a ses particularités",
        body: [
          "Chaque pièce possède ses particularités : une salle de bain demande des plaques hydrofuges, un séjour peut avoir un faux plafond avec éclairage intégré, une chambre un simple doublage isolant. Ce découpage valorise la technicité de chaque zone.",
        ],
      },
      {
        title: "Permettre de phaser les travaux",
        body: [
          "Il permet aussi au client de phaser les travaux : commencer par les pièces de vie et repousser les chambres. Vous gardez alors le chantier, même si son budget initial était insuffisant pour tout faire d'un coup.",
        ],
      },
      {
        title: "Un devis facile à ajuster",
        body: [
          "Enfin, un devis par pièce est beaucoup plus facile à ajuster en cours de chantier. Si le client change d'avis sur une pièce, vous modifiez une section sans reprendre tout le document.",
        ],
      },
    ],
  },
  {
    slug: "creer-mot-de-passe-solide",
    href: "/guide/mot-de-passe-solide",
    category: "securite-du-compte",
    title: "Créer un mot de passe solide",
    excerpt:
      "Longueur, variété, unicité et méthode de la phrase de passe : le guide simple pour protéger votre espace ArtiFlow-pro et vos données clients.",
    date: "13 octobre 2026",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20creating%20a%20strong%20password%2C%20a%20large%20padlock%20and%20floating%20key%20shapes%20with%20subtle%20data%20patterns%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=guide-mdp-solide-og&orientation=landscape",
    sections: [
      {
        title: "Pourquoi un mot de passe solide compte vraiment",
        body: [
          "Votre espace ArtiFlow-pro contient vos devis, vos clients et vos factures. Un mot de passe faible, c'est une porte ouverte sur tout ça. La bonne nouvelle : quelques règles simples suffisent à écarter l'immense majorité des risques, et elles sont faciles à retenir.",
        ],
      },
      {
        title: "Les 4 ingrédients d'un mot de passe solide",
        body: [
          "Visez au moins 12 caractères : la longueur protège plus que la complexité. Mélangez majuscules, minuscules, chiffres et au moins un caractère spécial. Évitez votre prénom, votre date de naissance ou « azerty1234 ». Enfin, gardez un mot de passe différent pour chaque site : c'est la règle la plus importante.",
        ],
      },
      {
        title: "La méthode de la phrase de passe",
        body: [
          "Choisissez une phrase que vous retenez facilement, gardez les premières lettres de chaque mot, remplacez-en quelques-unes par des chiffres ou des symboles, puis ajoutez un élément propre au site (par exemple « AF » pour ArtiFlow-pro). Vous obtenez un mot de passe long, unique et mémorisable en quelques minutes.",
        ],
      },
      {
        title: "Les erreurs à éviter",
        body: [
          "Réutiliser le même mot de passe partout, le garder écrit en clair, le partager par email ou SMS, ou choisir une suite logique comme 123456. Pensez aussi à changer votre mot de passe dès qu'un service vous prévient d'une connexion inhabituelle.",
        ],
      },
    ],
  },
];

/** Nombre de publications les plus récentes mises en avant comme « nouvelles ». */
const NOUVEAU_NOMBRE = 3;

/**
 * Guides les plus récents du catalogue (du plus récent au plus ancien). On
 * s'appuie sur l'ordre de parution plutôt que sur l'horloge du visiteur, pour
 * rester stable dans le temps et éviter de marquer tout le catalogue comme
 * « nouveau ».
 */
export const articlesRecents: Article[] = [...articles]
  .sort((a, b) => parseDateFr(b.date) - parseDateFr(a.date))
  .slice(0, NOUVEAU_NOMBRE);

/** Vrai si le guide fait partie des toutes dernières publications. */
export function isNouveauArticle(article: { slug: string }): boolean {
  return articlesRecents.some((recent) => recent.slug === article.slug);
}

/**
 * Date ISO (AAAA-MM-JJ) d'un guide, déduite de sa date française affichée.
 * Sert à alimenter le badge « Nouveau » fondé sur la fraîcheur réelle.
 */
export function articleDateIso(article: { date: string }): string {
  const timestamp = parseDateFr(article.date);
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const annee = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/** Fenêtre de fraîcheur (jours) utilisée pour compter les guides « nouveaux ». */
export const NOUVEAU_GUIDES_JOURS = 30;

/**
 * Date ISO du guide le plus récent d'un thème ("" si le thème ou ses guides
 * sont introuvables). Sert à afficher un badge « Nouveau » sur un thème tant
 * qu'au moins un de ses guides reste récent.
 */
export function sujetDateRecente(slug: string): string {
  const sujet = sujets.find((s) => s.slug === slug);
  if (!sujet) return "";
  const dates = sujet.articleSlugs
    .map((artSlug) => articles.find((a) => a.slug === artSlug))
    .filter((a): a is Article => Boolean(a))
    .map((a) => articleDateIso(a))
    .filter(Boolean);
  if (dates.length === 0) return "";
  // Les dates ISO (AAAA-MM-JJ) se comparent comme du texte dans l'ordre chronologique.
  return [...dates].sort((a, b) => b.localeCompare(a))[0];
}

/**
 * Nombre de guides publiés récemment, c'est-à-dire portant le badge « Nouveau ».
 * Sert au compteur affiché à côté de l'entrée « Ressources » de la navigation.
 */
export function compterGuidesNouveaux(): number {
  return articles.filter((a) => estNouveau(articleDateIso(a), NOUVEAU_GUIDES_JOURS)).length;
}