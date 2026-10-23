import { estNouveau } from "@/lib/dates";
import { sujets } from "@/mocks/sujets";

export type ArticleSection = {
  title: string;
  body: string[];
  /** Sous-parties (H3) affichées à la suite des paragraphes de la section. */
  subs?: { title: string; body: string[] }[];
};

export type Article = {
  slug: string;
  category: string;
  title: string;
  /**
   * Titre SEO court (< 60 caractères) utilisé dans l'onglet et les résultats de
   * recherche, quand le titre éditorial complet serait tronqué. Repli sur
   * `title` + « | ArtiFlow-pro » s'il est absent.
   */
  seoTitle?: string;
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
  /**
   * Balisage Schema.org de type BlogPosting (au lieu d'Article), utilisé pour
   * les billets éditoriaux signés par l'entreprise. Les dates sont fournies au
   * format ISO 8601 pour ne dépendre d'aucune conversion.
   */
  blogPosting?: { description: string; datePublished: string; dateModified: string };
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
  "gestion-devis": {
    name: "Gestion du devis",
    shortName: "Gestion du devis",
    icon: "ri-file-list-3-line",
  },
  facturation: {
    name: "Facturation électronique",
    shortName: "Facturation",
    icon: "ri-file-code-line",
  },
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
    seoTitle: "Devis chaudière en 5 minutes | ArtiFlow-pro",
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
          "Sur un remplacement de chaudière, la fourniture pèse lourd dans le total : c'est précisément ce qui justifie de demander une somme à la signature. Le mécanisme et le bon montant sont détaillés dans le guide [[/ressources/acompte-ou-arrhes-devis|acompte ou arrhes : quelle différence et combien demander]].",
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
    seoTitle: "Relancer après un dépannage urgent | ArtiFlow-pro",
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
    seoTitle: "Devis mise aux normes : les 6 postes oubliés | ArtiFlow-pro",
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
    seoTitle: "3 messages de relance devis électricité | ArtiFlow-pro",
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
    seoTitle: "Chiffrer une extension sans erreur de métré | ArtiFlow-pro",
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
          "Comme ces postes se paient avant la première pelletée, sécurisez la trésorerie avec une somme versée à la signature : le guide [[/ressources/acompte-ou-arrhes-devis|acompte ou arrhes]] explique quoi demander et comment l'écrire sur le devis.",
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
    seoTitle: "Organiser ses chantiers par zone | ArtiFlow-pro",
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
    seoTitle: "Devis peinture au m² : la méthode simple | ArtiFlow-pro",
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
          "Et comme les pots de peinture, le primaire et le matériel s'achètent avant de commencer, la question de l'[[/ressources/acompte-ou-arrhes-devis|acompte demandé à la signature]] se pose dès l'envoi du devis.",
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
    seoTitle: "Pourquoi vos devis de façade partent tard | ArtiFlow-pro",
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
    seoTitle: "Variantes de matériaux dans un seul devis | ArtiFlow-pro",
    excerpt:
      "Le client hésite entre chêne et alu ? Proposer les deux options chiffrées dans le même devis double vos chances de signature.",
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
    seoTitle: "Du devis à la pose : suivre une commande | ArtiFlow-pro",
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
    seoTitle: "Réserve de chutes carrelage : bien calculer | ArtiFlow-pro",
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
    seoTitle: "Devis salle de bain : structurer 3 surfaces | ArtiFlow-pro",
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
          "Ce devis précis sert aussi à annoncer la somme attendue à la signature, une fois le carrelage et la faïence commandés : voir [[/ressources/acompte-ou-arrhes-devis|acompte ou arrhes, combien demander]].",
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
    seoTitle: "Après un orage : gérer les urgences toiture | ArtiFlow-pro",
    excerpt:
      "Bâchage, fuites, réfections : comment trier les appels et organiser votre semaine quand tout tombe en même temps sur la toiture.",
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
    seoTitle: "Devis sinistre assurance : clair et complet | ArtiFlow-pro",
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
    seoTitle: "Devis faux plafond en plâtrerie | ArtiFlow-pro",
    excerpt:
      "Ossature, plaques, isolant, bandes, enduit : la bonne façon d'additionner chaque surface d'un chantier de plâtrerie, sans oublier un poste.",
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
    seoTitle: "Rénovation d'appartement pièce par pièce | ArtiFlow-pro",
    excerpt:
      "Pourquoi découper un devis de plâtrerie par pièce rassure le client, facilite les arbitrages et protège votre marge sur chaque chantier.",
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
    slug: "acompte-ou-arrhes-devis",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20a%20deposit%20on%20a%20building%20quote%2C%20a%20document%20sheet%20with%20a%20percentage%20badge%20and%20coin%20shapes%20beside%20subtle%20artisan%20tool%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-acompte&orientation=landscape",
    category: "gestion-devis",
    title: "Acompte ou arrhes : quelle différence et combien demander ?",
    seoTitle: "Acompte ou arrhes : différence et montant | ArtiFlow-pro",
    excerpt:
      "Acompte ou arrhes, quelle différence pour un artisan ? Ce que dit la règle, combien demander à la signature et comment le noter sur votre devis.",
    date: "17 octobre 2026",
    blogPosting: {
      description:
        "Acompte ou arrhes, quelle différence pour un artisan ? Ce que dit la règle, combien demander à la signature et comment le noter sur votre devis.",
      datePublished: "2026-10-17",
      dateModified: "2026-10-17",
    },
    sections: [
      {
        title: "Acompte ou arrhes : la différence en clair",
        body: [
          "Acompte ou arrhes : dans les deux cas, une somme est versée avant les travaux, mais les conséquences ne sont pas du tout les mêmes. Un acompte est une partie du prix payée à l'avance : il engage le client comme l'artisan à aller au bout de la prestation. Les arrhes, elles, laissent à chacune des parties la possibilité de renoncer — le client perd alors la somme versée, et le professionnel doit en rendre le double s'il se retire. La différence ne tient donc pas au montant, mais à l'engagement. Sur un devis de travaux, c'est presque toujours un acompte qui est demandé, même si le mot « arrhes » reste employé dans la conversation courante.",
          "La mécanique du chiffrage se joue de toute façon en amont : notre guide sur le [[/ressources/devis-peinture-au-m2-methode-simple|devis peinture au m²]] détaille comment poser les surfaces et les couches avant même de parler de paiement.",
        ],
        subs: [
          {
            title: "L'acompte engage les deux parties",
            body: [
              "L'acompte est un paiement partiel d'avance. Une fois le devis accepté et la somme versée, le client ne se retire pas sans conséquence, et l'artisan s'engage de son côté à réaliser les travaux convenus. Il se déduit du solde : ce n'est pas un supplément, c'est un morceau du prix total.",
            ],
          },
          {
            title: "Les arrhes laissent une porte de sortie",
            body: [
              "Les arrhes sont une somme d'attente : elles réservent l'accord sans le verrouiller. Si le client renonce, il abandonne les arrhes ; si c'est le professionnel qui renonce, il doit restituer le double de ce qu'il a reçu. Le mécanisme protège les deux côtés, mais il n'organise pas la même chose qu'un acompte.",
            ],
          },
          {
            title: "Ce que ça change sur un chantier",
            body: [
              "Dans le bâtiment, l'acompte à la signature sert à financer ce qui doit être commandé avant d'intervenir : matériaux, menuiseries, carrelage, chaudière. Vous n'avancez plus la trésorerie du client. C'est aussi pourquoi les arrhes sont rares sur un devis de travaux : elles ouvrent au client un droit de retrait que vous ne souhaitez pas forcément quand les commandes sont déjà passées.",
            ],
          },
        ],
      },
      {
        title: "Ce que dit la règle",
        body: [
          "Le principe de base est simple : l'acompte est un paiement partiel qui vaut engagement d'exécuter la prestation, alors que les arrhes sont une somme versée pour réserver l'accord, avec la possibilité pour chaque partie de revenir en arrière — le client en perdant le montant, le professionnel en le remboursant au double.",
          "Au-delà de ce principe, il n'existe pas de règle unique qui trancherait tous les cas. La qualification dépend de ce qui est écrit dans le contrat, de la nature de la prestation et des circonstances de l'annulation. Un même versement peut être analysé différemment selon la façon dont le devis est rédigé, et selon ce qui avait déjà été commandé au moment du retrait.",
          "C'est pourquoi ce guide reste volontairement général et ne remplace pas un avis juridique. Pour votre situation précise — un client qui annule après commande de matériaux, un chantier interrompu, un désaccord sur un montant déjà versé — adressez-vous à un professionnel du droit ou à votre comptable. Ils vous diront comment qualifier la somme dans votre cas et ce que votre devis permet réellement de retenir.",
          "Un point, en revanche, ne dépend d'aucune interprétation : plus votre devis est précis sur la somme et sur ce qu'elle couvre, moins la discussion reste ouverte le jour où le chantier dérape.",
        ],
      },
      {
        title: "Combien demander à la signature",
        body: [
          "En pratique, un acompte de l'ordre de 30 % du montant total revient souvent chez les artisans du bâtiment. Ce n'est pas une obligation : aucun texte n'impose un pourcentage unique. Le bon montant est celui qui couvre ce que vous engagez avant de commencer, sans bloquer le client.",
        ],
        subs: [
          {
            title: "Ce que l'acompte doit couvrir",
            body: [
              "L'acompte doit au moins financer les achats que vous ne pouvez pas avancer. Sur un remplacement de chaudière ou une pose de carrelage, les fournitures pèsent une part importante du devis : un acompte de 30 % y trouve sa justification. Sur une prestation surtout manuelle, la part de matériaux est plus faible, et une somme plus modeste suffit.",
            ],
          },
          {
            title: "Adapter au chantier, pas au pourcentage",
            body: [
              "Une intervention de 2 000 € et un ravalement de 20 000 € ne se financent pas de la même façon. Plus le montant est élevé et plus les délais sont longs, plus l'acompte a de sens ; sur une petite réparation, il est parfois plus simple de facturer à la fin plutôt que d'ajouter une étape de paiement.",
            ],
          },
          {
            title: "Ce que l'acompte protège vraiment",
            body: [
              "Un acompte protège deux choses. Votre trésorerie, d'abord : vous ne payez pas les matériaux de votre poche en attendant la fin du chantier. Votre engagement, ensuite : un client qui a déjà investi dans le projet annule beaucoup moins facilement qu'un client qui n'a rien versé.",
            ],
          },
        ],
      },
      {
        title: "Quand et comment demander l'acompte",
        body: [
          "Le bon moment, c'est la signature du devis, avant toute commande de matériel. Une fois la chaudière commandée ou les carreaux livrés, l'acompte n'a plus la même fonction : la dépense est déjà engagée de votre côté.",
        ],
        subs: [
          {
            title: "Annoncer la règle dès le premier rendez-vous",
            body: [
              "Dites-le au moment de la visite, pas après l'envoi du devis. Un client prévenu qu'un acompte est demandé à la signature ne le découvre pas comme une surprise ; un client qui le découvre sur le document relit tout avec méfiance, y compris le prix.",
            ],
          },
          {
            title: "Écrire noir sur blanc",
            body: [
              "Le devis doit mentionner le montant de l'acompte, la date à laquelle il est attendu, ce qu'il couvre et le solde restant dû. Sans ces quatre éléments, la somme devient discutable au moment du paiement — c'est l'une des premières causes de désaccord en fin de chantier.",
            ],
          },
          {
            title: "Prévoir le cas où l'acompte n'arrive pas",
            body: [
              "Précisez aussi ce qui se passe si la somme n'est pas versée : date de chantier non bloquée, devis caduc au-delà d'un délai. Une phrase suffit, et elle évite d'immobiliser un créneau pour un dossier qui ne démarre pas.",
            ],
          },
        ],
      },
      {
        title: "Le noter proprement sur votre devis",
        body: [
          "La ligne d'acompte doit se lire sans explication. Le plus lisible est de faire apparaître le prix total, puis l'acompte attendu avec sa date, puis le solde à régler à la fin. Le client voit immédiatement ce qu'il paie aujourd'hui et ce qu'il paiera plus tard.",
          "C'est exactement ce que permet l'espace Commercial d'ArtiFlow-pro, celui qui regroupe les devis, les factures et la bibliothèque de lignes. Le devis peut être généré par IA à partir de la description du chantier, puis ajusté à la main avant l'envoi : la ligne d'acompte, elle, reste identique d'un dossier à l'autre. Les fonctions concernées sont détaillées sur la page [[/tarifs|tarifs et fonctionnalités]].",
        ],
        subs: [
          {
            title: "La bibliothèque de lignes",
            body: [
              "Vous enregistrez une ligne d'acompte une fois — intitulé, montant ou pourcentage, mention du solde — et vous la réutilisez sur chaque devis. Le libellé reste identique d'un document à l'autre, ce qui évite les formulations improvisées et les oublis de dernière minute.",
            ],
          },
          {
            title: "Des documents à votre image",
            body: [
              "Les devis et factures sortent avec votre logo, votre couleur d'accent et vos coordonnées de paiement : IBAN, conditions de règlement. Un document qui porte votre identité inspire davantage confiance qu'un PDF anonyme, surtout au moment où il demande une somme à l'avance.",
            ],
          },
          {
            title: "La signature électronique",
            body: [
              "Le client signe le devis en ligne, et l'acompte figure sur le document signé avec sa date. Vous gardez une trace datée de ce qui a été accepté, sans échange d'emails ni scan de papier — c'est ce document-là qui fait foi si la question du versement revient quelques semaines plus tard.",
            ],
          },
        ],
      },
      {
        title: "Les pièges à éviter",
        body: [
          "La plupart des difficultés ne viennent pas du montant, mais de la façon dont il a été annoncé et écrit. Quatre erreurs reviennent plus souvent que les autres.",
        ],
        subs: [
          {
            title: "Confondre les deux termes",
            body: [
              "Écrire « arrhes » sur un devis alors que vous attendez un acompte engageant crée une ambiguïté que le client peut retourner contre vous. Choisissez un mot et gardez-le partout : devis, facture, email, conversation.",
            ],
          },
          {
            title: "Rester à l'oral",
            body: [
              "« Vous me versez 30 % à la signature » : dit au téléphone, ça n'existe pas. Si l'acompte n'est pas sur le devis, vous n'avez aucun moyen de le réclamer proprement. Et si le montant n'est pas daté, il redevient négociable à chaque étape.",
            ],
          },
          {
            title: "Oublier l'acompte sur la facture",
            body: [
              "Le piège le plus fréquent arrive à la fin : le client a versé un acompte, puis la facture finale réclame le prix total. Il faut déduire la somme et l'écrire. Sinon le client réclame, vous corrigez, et vous perdez du temps sur un document qui aurait dû être juste du premier coup.",
            ],
          },
          {
            title: "Ne pas garder la preuve de paiement",
            body: [
              "Conservez la trace du virement avec sa date, rattachée au devis concerné. En cas de désaccord, c'est cette pièce qui compte, pas le souvenir de la conversation. Sur un chantier qui dure plusieurs semaines, deux acomptes se confondent vite.",
            ],
          },
        ],
      },
      {
        title: "Pour aller plus loin",
        body: [
          "Ce guide fait partie de la série de ressources pour artisans du bâtiment : retrouvez les autres dans [[/ressources|tous les guides Ressources]], classés par corps d'état et par thème. Et si votre cas sort du cadre général — annulation, litige, montant déjà versé — écrivez-nous via la [[/contact|page contact]] : nous vous orienterons. Pour un point juridique précis, votre comptable ou un professionnel du droit reste le bon interlocuteur.",
        ],
      },
    ],
  },
  {
    slug: "creer-mot-de-passe-solide",
    href: "/guide/mot-de-passe-solide",
    category: "securite-du-compte",
    title: "Créer un mot de passe solide",
    // Titre distinct de la page dédiée /guide/mot-de-passe-solide : sans cela,
    // les deux URL affichaient exactement le même <title> (cannibalisation).
    seoTitle: "Mot de passe solide : 4 règles simples | ArtiFlow-pro",
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
  {
    slug: "chiffrer-pose-split-climatisation",
    category: "installateur-climatisation",
    title: "Chiffrer une pose de split sans oublier de poste",
    seoTitle: "Devis pose de split : les postes oubliés | ArtiFlow-pro",
    excerpt:
      "Liaisons frigorifiques, support, condensats, mise en service : les postes qui font la marge sur une pose de split, à chiffrer sans repasser au bureau.",
    date: "21 octobre 2026",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20an%20air%20conditioning%20installation%20quote%20guide%2C%20a%20wall%20mounted%20split%20unit%20silhouette%20with%20copper%20refrigerant%20lines%20and%20a%20checklist%20document%2C%20cool%20teal%20and%20warm%20amber%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-split&orientation=landscape",
    sections: [
      {
        title: "Le prix du split ne fait pas le devis",
        body: [
          "Un client qui a vu un split à 600 € en grande surface compare forcément avec votre devis à 1 900 €. Ce n'est pas votre marge qui est en cause : c'est que le prix affiché en magasin ne contient que la machine. Il manque la pose, les liaisons, le support, l'alimentation électrique, l'évacuation des condensats et la mise en service.",
          "Tant que ces postes restent invisibles sur le document, le client ne compare pas deux installations : il compare un appareil à un prix. D'où l'intérêt de détailler chaque ligne, même les plus petites. Un devis de climatisation lisible se défend tout seul, même en pleine canicule quand le client a déjà trois autres devis en main.",
        ],
      },
      {
        title: "Les postes qu'on oublie presque toujours",
        body: [
          "La liste est courte, mais elle revient sur presque tous les chantiers : le support mural (ou le socle au sol pour le groupe extérieur), le perçage du mur avec rebouchage, les mètres de liaison frigorifique au-delà du kit fourni, l'évacuation des condensats, l'alimentation électrique dédiée avec son disjoncteur, et la reprise de l'ancien appareil quand il y en avait un.",
          "À cela s'ajoute ce qui dépend de la configuration : un passage en façade, une hauteur d'intervention qui impose un échafaudage, une liaison un peu longue qui demande un complément de fluide. Autant de postes qui ne se rattrapent pas après coup : sur une pose de split, oublier deux lignes suffit à effacer la marge de la journée.",
        ],
      },
      {
        title: "La mise en service se facture, pas s'offre",
        body: [
          "La mise en service n'est pas une formalité : contrôle d'étanchéité du circuit, tirage au vide, charge complémentaire si nécessaire, essais de fonctionnement et vérification des débits. C'est aussi le moment où vous remettez au client les éléments qui engagent votre garantie.",
          "Sur le devis, cette prestation mérite sa propre ligne, avec un forfait clair. Quand elle est noyée dans le prix de la machine, elle disparaît de la discussion — et le client finit par considérer qu'elle est gratuite, y compris deux ans plus tard quand il faut revenir vérifier l'installation.",
        ],
      },
      {
        title: "Un modèle par type de pose",
        body: [
          "Toutes les poses ne se chiffrent pas de la même façon. Un mono-split en chambre, un multi-split trois pièces et un gainable en combles n'ont ni les mêmes liaisons, ni le même temps de main-d'œuvre, ni les mêmes contraintes d'accès. Partir d'un modèle unique oblige à recalculer à chaque fois, et c'est là que les oublis arrivent.",
          "L'approche qui tient : un modèle par type de pose, avec les postes déjà présents et vos prix déjà enregistrés. Sur le chantier, vous ne saisissez que la puissance retenue et les particularités du logement. Le reste se génère à partir de votre bibliothèque de lignes, la même à chaque dossier.",
        ],
      },
      {
        title: "Envoyer le devis avant de repartir",
        body: [
          "En pleine saison, la vitesse fait la différence. Un devis envoyé le soir même est lu le soir même ; un devis envoyé trois jours plus tard arrive quand le client a déjà fait son choix. Le gain ne vient donc pas du chiffrage, mais du moment où le document part.",
          "Concrètement, le devis se génère depuis le chantier, se relit d'un coup d'œil et part avant que vous ayez remballé le manomètre. Et si le montant engage des fournitures, annoncez dès ce moment la somme attendue à la signature : le guide sur [[/ressources/acompte-ou-arrhes-devis|l'acompte et les arrhes]] explique comment l'écrire sur le devis. Pour le détail des prestations couvertes, voir la [[/metiers/installateur-climatisation|fiche frigoriste climaticien]].",
        ],
      },
    ],
  },
  {
    slug: "relancer-devis-pompe-a-chaleur",
    category: "installateur-climatisation",
    title: "Relancer un devis de pompe à chaleur sans laisser filer le chantier",
    seoTitle: "Relancer un devis de pompe à chaleur | ArtiFlow-pro",
    excerpt:
      "Une pompe à chaleur se décide rarement en un rendez-vous. Le bon rythme de relance, le bon canal et les arguments qui débloquent un dossier.",
    date: "22 octobre 2026",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20following%20up%20a%20heat%20pump%20quote%2C%20a%20heat%20pump%20silhouette%20beside%20a%20calendar%20and%20message%20bubbles%2C%20cool%20teal%20and%20warm%20amber%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-pac&orientation=landscape",
    sections: [
      {
        title: "Une décision qui se prend à froid",
        body: [
          "Sur une pompe à chaleur, le rendez-vous se passe bien, le client est convaincu, et puis plus rien. Ce silence n'est presque jamais un refus : le dossier est simplement en attente d'un arbitrage — budget, délai, comparaison avec un autre devis, ou simplement une question qu'il n'a pas osé poser.",
          "Le problème, c'est que ce silence ne se débloque pas tout seul. Un devis de pompe à chaleur qui reste trois semaines sans nouvelle est un devis perdu dans neuf cas sur dix, non pas parce qu'il était trop cher, mais parce que personne ne l'a relancé au bon moment.",
        ],
      },
      {
        title: "Le bon rythme de relance",
        body: [
          "La séquence qui fonctionne tient en trois temps. Une première relance rapide, deux à trois jours après l'envoi : courte, elle vérifie que le devis est bien arrivé et propose de répondre aux questions. Une deuxième à une semaine, plus factuelle, qui rappelle les points clés et propose une date d'installation.",
          "La troisième arrive plus tard, et change d'angle : elle ne répète pas le prix, elle propose une alternative. Un phasage, une puissance légèrement différente, un planning décalé après la période de chauffe. C'est souvent cette relance-là qui rouvre un dossier qu'on croyait enterré. Au-delà de trois relances, on ne convainc plus : on agace.",
        ],
      },
      {
        title: "SMS court, email détaillé",
        body: [
          "Le canal compte autant que le rythme. Un SMS de deux lignes est lu dans l'heure, y compris par un client qui ne consulte pas ses emails professionnels le soir. C'est le bon support pour la première relance et pour la proposition de date.",
          "L'email garde son rôle pour tout ce qui doit rester : le devis lui-même, le récapitulatif des options, les documents techniques. En clair, le SMS sert à rouvrir la conversation, l'email à fournir la preuve. Utiliser l'un pour l'autre, c'est soit noyer le client, soit passer pour un message publicitaire.",
        ],
      },
      {
        title: "Ce qui débloque vraiment un dossier",
        body: [
          "Quand un client hésite sur la puissance, la meilleure relance n'est pas un argument : c'est un second chiffrage. Proposer les deux options dans le même devis lui permet de trancher seul, sans nouvel échange de mails. C'est aussi ce qui évite la comparaison avec un concurrent qui, lui, aura proposé les deux.",
          "Quand l'hésitation porte sur le budget, le phasage fonctionne mieux qu'une remise : installer les pièces de vie maintenant et les chambres à la saison suivante. Vous gardez le chantier, et le client ne renonce pas à son projet. Le guide sur [[/ressources/variantes-materiaux-dans-un-seul-devis|les variantes dans un seul devis]] détaille la mécanique côté document.",
        ],
      },
      {
        title: "Après la pose, l'entretien",
        body: [
          "Le suivi ne s'arrête pas à la signature. Un contrat d'entretien annuel est la seule prestation récurrente du métier, et c'est aussi celle qu'on oublie de renouveler faute de relance. Un rendez-vous manqué, c'est un client qui part chez le concurrent suivant sans mauvaise intention.",
          "Programmez le rappel dès la mise en service, avec la date anniversaire et la période la plus calme de votre saison. Ce réflexe transforme un carnet de commandes irrégulier en base de revenus stable — et c'est souvent ce qui fait la différence entre un été de rush et une année tenable. Pour la partie chiffrage, voir la [[/metiers/installateur-climatisation|fiche métier frigoriste climaticien]].",
        ],
      },
    ],
  },
  {
    slug: "contrat-entretien-climatisation",
    category: "installateur-climatisation",
    title: "Vendre un contrat d'entretien climatisation sans le brader",
    seoTitle: "Contrat d'entretien climatisation | ArtiFlow-pro",
    excerpt:
      "L'entretien annuel n'est pas un geste commercial en fin de devis : c'est la seule prestation récurrente du métier. Comment le chiffrer, l'écrire et le faire reconduire.",
    date: "22 octobre 2026",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20an%20annual%20air%20conditioning%20maintenance%20contract%2C%20a%20wall%20mounted%20split%20unit%20silhouette%20with%20a%20calendar%20and%20a%20checklist%20document%2C%20a%20wrench%20and%20a%20fan%20blade%20shape%2C%20cool%20teal%20and%20warm%20amber%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-contrat-entretien&orientation=landscape",
    sections: [
      {
        title: "Un revenu récurrent, pas une remise",
        body: [
          "La climatisation a un défaut structurel : elle se vend en une fois, et surtout en une saison. Entre la ruée de juin et le creux de février, le carnet de commandes fait le grand écart, alors que les charges, elles, ne prennent pas de vacances. Le contrat d'entretien annuel est la seule ligne du métier qui lisse cette irrégularité.",
          "C'est aussi ce qui distingue un installateur d'un poseur. Un client qui vous voit une fois par an pour l'entretien ne vous appelle pas uniquement en cas de panne : il vous appelle pour un remplacement, une extension, un deuxième logement. Le contrat n'est donc pas une remise accordée en fin de devis, c'est un abonnement qui entretient la relation autant que la machine.",
        ],
      },
      {
        title: "Ce que couvre réellement la prestation",
        body: [
          "Tant que la prestation reste floue, le client la compare à un simple dépannage et finit par la trouver chère. Mieux vaut écrire noir sur blanc ce qui est fait, visite après visite, plutôt que de vendre un « entretien annuel » que personne ne sait décrire.",
          "Une visite sérieuse couvre au minimum le nettoyage des filtres et des échangeurs, le contrôle de l'étanchéité du circuit, la vérification des pressions et de la charge de fluide, l'évacuation des condensats, les essais de fonctionnement et la désinfection des surfaces. Ajoutez-y le déplacement et, si besoin, le contrôle de l'alimentation électrique.",
        ],
        subs: [
          {
            title: "Ce qui reste hors contrat",
            body: [
              "Précisez également ce qui n'est pas inclus : recharge de fluide en cas de fuite, remplacement de pièce, démontage pour accéder à une unité difficile d'accès. Un client qui découvre une facture en plus au moment de la visite annuelle ne renouvelle pas son contrat l'année suivante.",
            ],
          },
        ],
      },
      {
        title: "Fixer le prix et la bonne formule",
        body: [
          "Sur une climatisation résidentielle, un forfait annuel pour un mono-split se situe souvent dans une fourchette de 150 à 200 €, davantage dès qu'il y a plusieurs unités à visiter. Ce n'est pas un prix à copier, c'est un ordre de grandeur : ce qui compte, c'est que le montant couvre le déplacement, le temps sur place et la part de suivi administratif.",
          "Le plus lisible est de proposer deux ou trois formules : un appareil seul, un multi-split, puis une formule adaptée aux locaux professionnels qui ont plusieurs unités. Cette gradation évite de négocier un prix unique et permet au client de choisir l'engagement qui correspond à son installation.",
        ],
      },
      {
        title: "Écrire l'entretien sur le devis",
        body: [
          "Le contrat ne doit jamais être noyé dans le prix de la pose. Il occupe sa propre ligne, avec un intitulé explicite, la périodicité, le nombre d'appareils couverts et la date anniversaire de la première visite. Le client doit pouvoir relire son devis deux ans plus tard et comprendre exactement ce qu'il a souscrit.",
          "Cette ligne séparée a un second effet : elle rappelle que la pose et l'entretien sont deux prestations distinctes. Un devis de pose bien structuré, avec ses postes invisibles, se défend mieux — la méthode est détaillée dans le guide [[/ressources/chiffrer-pose-split-climatisation|chiffrer une pose de split sans oublier de poste]].",
        ],
      },
      {
        title: "Le faire reconduire sans y penser",
        body: [
          "Un contrat qui n'est pas relancé ne se renouvelle pas. Le rendez-vous annuel doit donc être programmé dès la mise en service, avec la date anniversaire et une relance automatique environ deux mois avant l'échéance. Deux mois, c'est le temps de placer la visite dans le creux de la saison, quand votre planning respire.",
          "Le canal compte : un SMS court suffit pour proposer une date, l'email sert à confirmer et à joindre le récapitulatif. Ce fonctionnement par étapes est exactement celui décrit dans le guide [[/ressources/relancer-devis-pompe-a-chaleur|relancer un devis de pompe à chaleur sans laisser filer le chantier]], et il s'applique tel quel à l'entretien.",
          "Résultat concret : une base de clients qui revient chaque année, un planning rempli en basse saison, et des ventes de matériel qui repartent sans prospection. Sur un métier aussi saisonnier, c'est souvent ce qui fait la différence entre un été de rush et une année tenable. Pour le détail des prestations couvertes, voir la [[/metiers/installateur-climatisation|fiche frigoriste climaticien]].",
        ],
      },
    ],
  },
  {
    slug: "facture-electronique-ce-qui-change-artisan",
    category: "facturation",
    title: "Facture électronique : ce qui change concrètement pour un artisan",
    seoTitle: "Facture électronique : ce qui change | ArtiFlow-pro",
    excerpt:
      "Fini le PDF envoyé par email : la facture devient un fichier structuré qui circule par une plateforme agréée. Ce que ça change dans votre semaine, sans jargon.",
    date: "22 octobre 2026",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20electronic%20invoicing%20for%20craftspeople%2C%20a%20document%20sheet%20turning%20into%20a%20stream%20of%20data%20lines%20and%20a%20shield%20badge%2C%20a%20small%20toolbox%20silhouette%20beside%20it%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20editorial%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-guide-facture-electronique&orientation=landscape",
    sections: [
      {
        title: "Ce qui change vraiment dans une facture",
        body: [
          "Aujourd'hui, une facture d'artisan, c'est un PDF : vous le fabriquez, vous l'envoyez par email, et il reste une pièce que chacun lit de son côté. La facture électronique ne remplace pas ce document par un autre PDF plus joli : elle ajoute des données structurées, lisibles par une machine, qui décrivent la même facture — les lignes, les quantités, les taux de TVA, les totaux, les identifiants des deux entreprises.",
          "Concrètement, le fichier envoyé contient deux choses : une version lisible par un humain, et une version lisible par un logiciel. C'est ce qu'on appelle le format Factur-X. Le même document peut donc être ouvert par votre client et être traité automatiquement par sa comptabilité, sans ressaisie.",
          "Ce qui ne change pas, en revanche, c'est le fond : le prix, les mentions, la TVA, la date d'échéance et les conditions de règlement restent exactement les mêmes. Vous ne facturez pas différemment, vous facturez autrement.",
        ],
      },
      {
        title: "Le calendrier : recevoir d'abord, émettre ensuite",
        body: [
          "La réforme se met en place en deux temps, et c'est le point le plus utile à retenir. La première obligation concerne la réception : toute entreprise doit pouvoir recevoir une facture électronique, quelle que soit sa taille. La seconde concerne l'émission, et elle s'étale selon la taille de l'entreprise : les plus grandes d'abord, puis les PME et les micro-entreprises.",
          "Autrement dit, même si votre propre échéance d'émission est plus lointaine, vous pouvez déjà recevoir des factures électroniques de la part de vos fournisseurs ou de vos clients professionnels. Et un artisan qui attend la dernière vague pour s'équiper se retrouve à devoir tout mettre en place en même temps que sa comptabilité.",
          "Les dates exactes et votre rang dans le calendrier dépendent de la taille de votre structure. Le réflexe à avoir est de vérifier votre échéance sur impots.gouv.fr, plutôt que de vous fier à une date entendue sur un chantier : c'est le seul calendrier qui compte pour vous.",
        ],
      },
      {
        title: "Ce que ça change dans votre semaine de travail",
        body: [
          "Le changement le plus visible est la disparition du circuit « je télécharge, je joins, j'imprime ». La facture passe par une plateforme de dématérialisation, qui l'envoie, l'horodate et conserve la preuve de la transmission. Vous n'avez plus à vous demander si le client a bien reçu son document : le statut vous le dit.",
          "L'autre changement est que la facture devient un objet suivi. Elle a une étape : à préparer, prête, transmise, reçue, rejetée. Un rejet n'est pas une catastrophe, c'est un message : un SIRET incomplet, un taux de TVA incohérent, un montant qui ne correspond pas. Vous corrigez et vous retransmettez, au lieu de découvrir le problème trois semaines plus tard par un appel de votre comptable.",
          "Enfin, votre client professionnel doit vous donner son identifiant (SIREN ou SIRET). C'est une information à demander dès le devis, au même titre que l'adresse : sans elle, la facture ne pourra pas être transmise à sa plateforme.",
        ],
      },
      {
        title: "Les mentions qui comptent toujours autant",
        body: [
          "Un fichier structuré ne pardonne pas l'approximation : ce qui manque dans les données manque dans la facture. Les éléments à surveiller sont peu nombreux, mais ils doivent être justes à chaque envoi.",
        ],
        subs: [
          {
            title: "Votre identité et votre fiscalité",
            body: [
              "Le SIRET de l'entreprise, le numéro de TVA intracommunautaire — ou la mention de franchise en base « TVA non applicable, art. 293 B du CGI » si vous êtes en franchise — et vos coordonnées de règlement : IBAN, conditions et délai de paiement. Une facture électronique dont l'IBAN est absent est une facture que le client ne peut pas régler.",
            ],
          },
          {
            title: "Les mentions propres au bâtiment",
            body: [
              "En sous-traitance, l'autoliquidation par le preneur doit être écrite (art. 283-2 nonies du CGI). L'indemnité forfaitaire de recouvrement de 40 €, l'escompte pour paiement anticipé et, le cas échéant, l'option pour la TVA d'après les débits font aussi partie des mentions à porter. Ce sont des phrases fixes : une fois paramétrées, elles ne changent plus.",
            ],
          },
        ],
      },
      {
        title: "Par où commencer, sans tout changer",
        body: [
          "La bonne nouvelle, c'est que la mise en conformité ne demande pas de revoir votre façon de travailler. Elle demande quatre vérifications, dans cet ordre.",
          "D'abord, l'identité fiscale : SIRET complet, TVA ou franchise, adresse et coordonnées de règlement. Ensuite, les mentions fixes : autoliquidation, indemnité de recouvrement, escompte. Puis l'outil : une plateforme de dématérialisation immatriculée, choisie selon la taille de votre activité — certaines sont payantes, d'autres proposent une offre gratuite pour les petites structures, et le bon choix est celui que votre comptable saura lire. Enfin, le réflexe commercial : demander le SIREN du client professionnel dès la prise de contact.",
          "Reste la question du suivi. Une facture électronique qui reste bloquée en « prête » ne rapporte rien, exactement comme un devis qui dort dans une boîte mail. Prendre l'habitude de traiter les statuts une fois par semaine, en même temps que les relances, évite d'accumuler du retard invisible.",
        ],
      },
      {
        title: "Ce que ça change pour vos clients",
        body: [
          "Un client professionnel y gagne : il reçoit une facture qu'il peut enregistrer sans la retaper, et il voit immédiatement les montants et la TVA. Un particulier, lui, continue de recevoir un document lisible, imprimable s'il le souhaite : le format structuré ne l'empêche pas d'ouvrir sa facture normalement.",
          "En revanche, attendez-vous à une période de transition où certains clients vous demanderont encore « juste un PDF ». C'est normal : gardez le réflexe d'envoyer un document que tout le monde peut ouvrir, tout en respectant le circuit de transmission exigé pour les factures entre professionnels.",
          "Pour la partie pratique côté outil, ArtiFlow-pro prépare le fichier Factur-X de chaque facture, regroupe celles du mois dans une archive et suit les étapes du cycle de vie, du dépôt à l'accusé de réception. Le branchement automatique vers une plateforme agréée se fait côté serveur, dès que vous avez un compte chez un prestataire. Le détail des fonctions figure sur la page [[/tarifs|tarifs et fonctionnalités]].",
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