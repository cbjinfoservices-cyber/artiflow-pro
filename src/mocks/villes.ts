export type Ville = {
  slug: string;
  name: string;
  region: string;
  departement: string;
  metaTitle: string;
  metaDescription: string;
  tagline: string;
  intro: string;
  heroImage: string;
  /**
   * Visuel de partage social (Open Graph / Twitter) au format 1200×630.
   * Distinct de l'image héros, qui est un visuel panoramique 1600×900 mal
   * adapté aux aperçus de liens sur les réseaux et dans les messageries.
   */
  shareImage: string;
  cardImage: string;
  /** Quartiers ou secteurs emblématiques de la ville (affichés en puces). */
  quartiers: string[];
  /** Communes de l'agglomération couvertes par le service. */
  agglomeration: string[];
};

/**
 * Grandes villes couvertes par les pages « zone d'intervention ».
 * Chaque page cible les recherches du type « logiciel devis + métier + ville »
 * et renvoie vers les fiches métiers pour renforcer le maillage interne.
 */
export const villes: Ville[] = [
  {
    slug: "paris",
    name: "Paris",
    region: "Île-de-France",
    departement: "Paris (75)",
    metaTitle: "Logiciel de devis artisan à Paris | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Paris en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Vos devis d'artisan générés en 2 minutes, au cœur de Paris.",
    intro:
      "Entre les chantiers du Marais, les rénovations haussmanniennes et les interventions d'urgence en petite couronne, un artisan parisien n'a pas une minute à perdre. ArtiFlow-pro rédige vos devis depuis le chantier, relance vos clients et regroupe vos interventions par secteur pour limiter les trajets dans la capitale.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Parisian%20zinc%20rooftops%20and%20Haussmann%20facade%20silhouettes%20with%20a%20subtle%20Eiffel%20Tower%20outline%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-paris-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Parisian%20zinc%20rooftops%2C%20the%20Eiffel%20Tower%20outline%20and%20Haussmann%20facades%2C%20with%20a%20floating%20quote%20document%20and%20a%20plumb%20bob%20silhouette%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-paris-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Parisian%20zinc%20rooftops%20and%20chimneys%20with%20a%20small%20toolbox%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-paris-card&orientation=landscape",
    quartiers: ["Le Marais", "Bastille", "Montmartre", "La Défense"],
    agglomeration: ["Boulogne-Billancourt", "Saint-Denis", "Montreuil"],
  },
  {
    slug: "lyon",
    name: "Lyon",
    region: "Auvergne-Rhône-Alpes",
    departement: "Rhône (69)",
    metaTitle: "Logiciel de devis artisan à Lyon | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Lyon en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Des devis d'artisan prêts entre deux chantiers lyonnais.",
    intro:
      "De la Presqu'île à la Croix-Rousse, en passant par les pentes et Villeurbanne, les artisans lyonnais enchaînent les interventions dans des bâtis très variés. ArtiFlow-pro rédige vos devis avec vos tarifs, relance vos clients et organise votre semaine par secteur pour limiter les montées et descentes répétées.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Lyon%20rooftops%20with%20the%20Fourviere%20basilica%20outline%20and%20the%20Saone%20river%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-lyon-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Lyon%20rooftops%20with%20the%20Fourviere%20basilica%20outline%20above%20the%20Saone%20river%2C%20a%20trowel%20and%20a%20quote%20sheet%20floating%20in%20the%20foreground%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-lyon-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Lyon%20canut%20buildings%20and%20steep%20rooftops%20with%20a%20trowel%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-lyon-card&orientation=landscape",
    quartiers: ["Presqu'île", "Croix-Rousse", "Confluence", "Part-Dieu"],
    agglomeration: ["Villeurbanne", "Vénissieux", "Bron"],
  },
  {
    slug: "marseille",
    name: "Marseille",
    region: "Provence-Alpes-Côte d'Azur",
    departement: "Bouches-du-Rhône (13)",
    metaTitle: "Logiciel de devis artisan à Marseille | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Marseille en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Vos devis d'artisan envoyés avant de quitter le Vieux-Port.",
    intro:
      "Les chantiers marseillais s'étalent du Vieux-Port aux quartiers Nord, avec des distances qui pèsent vite sur la journée. ArtiFlow-pro rédige vos devis par dictée, priorise les urgences après un coup de mistral et vous aide à regrouper vos interventions par secteur pour ne plus traverser la ville trois fois par jour.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Marseille%20with%20the%20Vieux-Port%20boats%20and%20the%20Notre-Dame%20de%20la%20Garde%20outline%20over%20the%20Mediterranean%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-marseille-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Marseille%20with%20the%20Vieux-Port%20boats%20and%20Notre-Dame%20de%20la%20Garde%20outline%20over%20the%20Mediterranean%2C%20a%20wrench%20and%20a%20signed%20quote%20document%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-marseille-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Marseille%20pastel%20facades%20and%20harbour%20cranes%20with%20a%20wrench%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-marseille-card&orientation=landscape",
    quartiers: ["Vieux-Port", "Le Panier", "Castellane", "La Joliette"],
    agglomeration: ["Aix-en-Provence", "Aubagne", "Vitrolles"],
  },
  {
    slug: "toulouse",
    name: "Toulouse",
    region: "Occitanie",
    departement: "Haute-Garonne (31)",
    metaTitle: "Logiciel de devis artisan à Toulouse | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Toulouse en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Des devis d'artisan taillés pour la brique toulousaine.",
    intro:
      "Entre l'hypercentre en brique rose, les quartiers en pleine croissance et la métropole qui s'étend, les artisans toulousains jonglent entre rénovation et construction neuve. ArtiFlow-pro génère vos devis avec vos tarifs, gère les métrés techniques et relance vos clients jusqu'à la signature.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Toulouse%20pink%20brick%20facades%20and%20the%20Capitole%20outline%20over%20the%20Garonne%20river%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-toulouse-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Toulouse%20pink%20brick%20facades%20and%20the%20Capitole%20outline%20over%20the%20Garonne%2C%20a%20spirit%20level%20and%20a%20rolled%20quote%20plan%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-toulouse-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Toulouse%20brick%20buildings%20and%20a%20roof%20tile%20pattern%20with%20a%20level%20tool%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-toulouse-card&orientation=landscape",
    quartiers: ["Capitole", "Les Carmes", "Saint-Cyprien", "La Cépière"],
    agglomeration: ["Blagnac", "Colomiers", "Balma"],
  },
  {
    slug: "bordeaux",
    name: "Bordeaux",
    region: "Nouvelle-Aquitaine",
    departement: "Gironde (33)",
    metaTitle: "Logiciel de devis artisan à Bordeaux | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Bordeaux en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Vos devis d'artisan prêts le long des Chartrons et de la Garonne.",
    intro:
      "Entre la pierre blonde du centre classé à l'UNESCO, les réhabilitations de la Bastide et les constructions de la métropole, les artisans bordelais ont un carnet bien rempli. ArtiFlow-pro rédige vos devis, sécurise vos postes techniques et relance vos clients pour ne plus laisser un devis dormir.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Bordeaux%20stone%20facades%20and%20the%20Garonne%20quays%20with%20the%20Miroir%20d%20eau%20reflection%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-bordeaux-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Bordeaux%20classical%20stone%20facades%20along%20the%20Garonne%20quays%2C%20a%20paint%20roller%20and%20an%20invoice%20sheet%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-bordeaux-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Bordeaux%20classical%20stone%20facades%20and%20wine%20barrel%20shapes%20with%20a%20paint%20roller%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-bordeaux-card&orientation=landscape",
    quartiers: ["Chartrons", "Saint-Michel", "La Bastide", "Mériadeck"],
    agglomeration: ["Mérignac", "Pessac", "Talence"],
  },
  {
    slug: "lille",
    name: "Lille",
    region: "Hauts-de-France",
    departement: "Nord (59)",
    metaTitle: "Logiciel de devis artisan à Lille | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Lille en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Des devis d'artisan pensés pour le climat et la brique du Nord.",
    intro:
      "Du Vieux-Lille à Wazemmes, en passant par Euratlantique et l'agglomération, les artisans lillois enchaînent les rénovations de maisons de ville et de bâtis anciens. ArtiFlow-pro génère vos devis avec vos tarifs, prévoit les postes liés à l'humidité et relance vos clients au bon rythme.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Lille%20Flemish%20brick%20houses%20and%20the%20Grand%20Place%20with%20a%20belfry%20outline%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-lille-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Lille%20Flemish%20brick%20gable%20houses%20and%20the%20Grand%20Place%20belfry%20outline%2C%20a%20hammer%20and%20a%20quote%20document%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-lille-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Lille%20stepped%20gable%20brick%20houses%20with%20a%20hammer%20and%20nail%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-lille-card&orientation=landscape",
    quartiers: ["Vieux-Lille", "Wazemmes", "Euralille", "Moulins"],
    agglomeration: ["Roubaix", "Tourcoing", "Villeneuve-d'Ascq"],
  },
  {
    slug: "nantes",
    name: "Nantes",
    region: "Pays de la Loire",
    departement: "Loire-Atlantique (44)",
    metaTitle: "Logiciel de devis artisan à Nantes | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Nantes en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Vos devis d'artisan suivis de l'Île de Nantes à Chantenay.",
    intro:
      "Entre les réhabilitations de l'Île de Nantes, les maisons anciennes du centre et les quartiers qui se développent, les artisans nantais jonglent entre restauration et construction. ArtiFlow-pro rédige vos devis depuis le chantier, relance vos clients et suit chaque étape jusqu'à la facture.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Nantes%20with%20the%20Loire%20river%2C%20Ile%20de%20Nantes%20cranes%20and%20a%20giant%20mechanical%20shape%20outline%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-nantes-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Nantes%20river%20quays%20with%20industrial%20cranes%20and%20the%20Loire%2C%20a%20hard%20hat%20and%20a%20floating%20quote%20sheet%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-nantes-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Nantes%20river%20quays%20and%20industrial%20cranes%20with%20a%20hard%20hat%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-nantes-card&orientation=landscape",
    quartiers: ["Île de Nantes", "Graslin", "Chantenay", "Beaulieu"],
    agglomeration: ["Saint-Herblain", "Rezé", "Orvault"],
  },
  {
    slug: "nice",
    name: "Nice",
    region: "Provence-Alpes-Côte d'Azur",
    departement: "Alpes-Maritimes (06)",
    metaTitle: "Logiciel de devis artisan à Nice | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Nice en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Des devis d'artisan prêts entre la mer et les collines niçoises.",
    intro:
      "Des immeubles de la Promenade aux villas des collines, en passant par le Vieux-Nice et l'agglomération azuréenne, les artisans niçois travaillent un bâti varié sous un climat exigeant. ArtiFlow-pro génère vos devis, prévoit les postes liés au bord de mer et relance vos clients jusqu'à la signature.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Nice%20promenade%20des%20Anglais%20and%20pastel%20facades%20over%20the%20Mediterranean%20bay%20with%20palm%20outlines%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-nice-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Nice%20promenade%20and%20pastel%20facades%20over%20the%20Mediterranean%20bay%20with%20palm%20outlines%2C%20a%20paint%20brush%20and%20a%20quote%20card%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-nice-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Nice%20pastel%20ochre%20facades%20and%20palm%20trees%20with%20a%20paint%20brush%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-nice-card&orientation=landscape",
    quartiers: ["Vieux-Nice", "Promenade des Anglais", "Cimiez", "Port"],
    agglomeration: ["Cagnes-sur-Mer", "Antibes", "Saint-Laurent-du-Var"],
  },
  {
    slug: "strasbourg",
    name: "Strasbourg",
    region: "Grand Est",
    departement: "Bas-Rhin (67)",
    metaTitle: "Logiciel de devis artisan à Strasbourg | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Strasbourg en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Des devis d'artisan prêts entre la Grande Île et l'Eurométropole.",
    intro:
      "Du bâti ancien de la Grande Île aux quartiers récents de l'Eurométropole, en passant par Neudorf, les artisans strasbourgeois jonglent entre colombages à rénover et chantiers neufs. ArtiFlow-pro rédige vos devis avec vos tarifs, adapte vos postes au bâti local et relance vos clients jusqu'à la signature.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Strasbourg%20half-timbered%20houses%20and%20the%20cathedral%20spire%20with%20the%20Ill%20river%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-strasbourg-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Strasbourg%20half-timbered%20houses%20and%20the%20cathedral%20spire%20above%20the%20Ill%20river%2C%20a%20trowel%20and%20a%20floating%20invoice%20sheet%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-strasbourg-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Strasbourg%20half-timbered%20facades%20and%20a%20trowel%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-strasbourg-card&orientation=landscape",
    quartiers: ["Grande Île", "Krutenau", "Neudorf", "Robertsau"],
    agglomeration: ["Schiltigheim", "Illkirch-Graffenstaden", "Bischheim"],
  },
  {
    slug: "montpellier",
    name: "Montpellier",
    region: "Occitanie",
    departement: "Hérault (34)",
    metaTitle: "Logiciel de devis artisan à Montpellier | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Montpellier en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Des devis d'artisan taillés pour la croissance montpelliéraine.",
    intro:
      "Entre l'Écusson médiéval, les quartiers neufs de Port Marianne et une métropole qui s'étend vite, les artisans montpelliérains alternent rénovation de centre ancien et construction neuve. ArtiFlow-pro génère vos devis à vos tarifs, gère les métrés techniques et relance vos clients sans que vous y pensiez.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Montpellier%20with%20the%20Place%20de%20la%20Comedie%20and%20the%20Saint-Pierre%20cathedral%20outline%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-montpellier-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Montpellier%20ochre%20facades%20and%20stone%20arches%20near%20the%20Place%20de%20la%20Comedie%2C%20a%20paint%20roller%20and%20a%20quote%20document%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-montpellier-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Montpellier%20ochre%20facades%20and%20stone%20arches%20with%20a%20paint%20roller%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-montpellier-card&orientation=landscape",
    quartiers: ["Écusson", "Antigone", "Port Marianne", "Odysseum"],
    agglomeration: ["Lattes", "Castelnau-le-Lez", "Saint-Jean-de-Védas"],
  },
  {
    slug: "rennes",
    name: "Rennes",
    region: "Bretagne",
    departement: "Ille-et-Vilaine (35)",
    metaTitle: "Logiciel de devis artisan à Rennes | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Rennes en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Vos devis d'artisan suivis de Sainte-Anne à la métropole rennaise.",
    intro:
      "Du centre historique aux maisons à pans de bois, jusqu'aux quartiers en pleine mutation comme Baud-Chardonnet, les artisans rennais enchaînent rénovations et mises aux normes. ArtiFlow-pro rédige vos devis depuis le chantier, organise votre semaine par secteur et relance vos clients jusqu'à la signature.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Rennes%20with%20half-timbered%20houses%20and%20the%20Parlement%20de%20Bretagne%20outline%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-rennes-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Rennes%20timber-framed%20houses%20and%20the%20Parlement%20de%20Bretagne%20outline%2C%20a%20wrench%20and%20a%20signed%20quote%20sheet%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-rennes-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Rennes%20timber-framed%20facades%20and%20a%20wrench%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-rennes-card&orientation=landscape",
    quartiers: ["Centre", "Sainte-Anne", "Villejean", "Beaulieu"],
    agglomeration: ["Cesson-Sévigné", "Saint-Jacques-de-la-Lande", "Chantepie"],
  },
  {
    slug: "grenoble",
    name: "Grenoble",
    region: "Auvergne-Rhône-Alpes",
    departement: "Isère (38)",
    metaTitle: "Logiciel de devis artisan à Grenoble | ArtiFlow-pro",
    metaDescription:
      "Plombier, électricien, maçon, peintre… ArtiFlow-pro génère vos devis à Grenoble en 2 minutes, relance vos clients et organise vos chantiers. Essai gratuit.",
    tagline: "Des devis d'artisan pensés pour la ville et la montagne.",
    intro:
      "Entre les immeubles anciens du centre, les quartiers universitaires et les maisons de la vallée, les artisans grenoblois travaillent un bâti varié sous un climat alpin. ArtiFlow-pro génère vos devis avec vos tarifs, prévoit les postes liés à l'isolation et à la montagne, et relance vos clients au bon moment.",
    heroImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20of%20Grenoble%20with%20alpine%20mountains%20behind%20the%20Bastille%20fort%20outline%20over%20the%20Isere%20valley%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1600&height=900&seq=artiflow-ville-grenoble-hero&orientation=landscape",
    shareImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20sharing%20card%20of%20Grenoble%20alpine%20rooftops%20and%20the%20Bastille%20fort%20outline%20above%20the%20Isere%20valley%2C%20a%20hammer%20and%20a%20floating%20quote%20document%20silhouettes%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20line%20patterns%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-ville-grenoble-n1&orientation=landscape",
    cardImage:
      "https://readdy.ai/api/search-image?query=Stylized%20abstract%20illustration%20of%20Grenoble%20alpine%20rooftops%20and%20the%20Bastille%20cable%20car%20with%20a%20hammer%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20tones%20on%20a%20clean%20charcoal%20background%2C%20premium%20minimal%20composition%2C%20high%20detail&width=400&height=300&seq=artiflow-ville-grenoble-card&orientation=landscape",
    quartiers: ["Centre-ville", "Championnet", "Mistral", "Île Verte"],
    agglomeration: ["Échirolles", "Saint-Martin-d'Hères", "Fontaine"],
  },
];

/** Avantages mis en avant sur chaque page ville (communs, non revendicatifs sur des chiffres locaux). */
export const villeStats = [
  { value: "2 min", label: "pour générer un devis complet" },
  { value: "+28 %", label: "de devis signés grâce aux relances" },
  { value: "0 oubli", label: "sur le suivi des devis envoyés" },
];

export const villesIntro =
  "ArtiFlow-pro est un logiciel de devis pour les artisans du bâtiment, utilisé partout en France. Choisissez votre ville pour découvrir comment l'outil s'adapte à votre métier et à votre secteur.";

/** Points forts déclinés pour une ville donnée. */
export function pointsVille(ville: Ville) {
  return [
    {
      icon: "ri-mic-line",
      title: `Devis dictés depuis le chantier à ${ville.name}`,
      description:
        "Vous dictez l'intervention avec vos tarifs : ArtiFlow-pro monte le devis, les quantités et la main-d'œuvre, prêt à envoyer avant de repartir.",
    },
    {
      icon: "ri-notification-3-line",
      title: "Relances email, SMS et WhatsApp automatiques",
      description:
        "Un devis sans réponse ne dort plus dans une boîte mail : vos clients sont relancés au bon moment, sur le canal qui fonctionne.",
    },
    {
      icon: "ri-road-map-line",
      title: "Planning regroupé par secteur",
      description: `Les chantiers de ${ville.name} et de son agglomération sont ordonnés par zone pour limiter les trajets et enchaîner les interventions.`,
    },
    {
      icon: "ri-shield-check-line",
      title: "Un accompagnement humain",
      description:
        "Une équipe qui connaît le bâtiment vous suit par téléphone, WhatsApp ou email, du premier devis jusqu'à votre facturation.",
    },
  ];
}

/** FAQ locale générée pour une ville. */
export function faqVille(ville: Ville) {
  return [
    {
      question: `ArtiFlow-pro fonctionne-t-il à ${ville.name} ?`,
      answer: `Oui. ArtiFlow-pro est un logiciel en ligne utilisé par les artisans du bâtiment partout en France, y compris à ${ville.name} et dans son agglomération. Il ne nécessite ni installation ni déplacement : tout se fait depuis votre téléphone, sur le chantier comme au bureau.`,
    },
    {
      question: `L'outil est-il adapté à mon métier à ${ville.name} ?`,
      answer: `ArtiFlow-pro se décline pour chaque corps d'état : plombier chauffagiste, électricien, maçon, peintre, menuisier, carreleur, couvreur et plaquiste. Chaque métier dispose de ses modèles de devis et de ses unités, avec vos propres tarifs.`,
    },
    {
      question: `Puis-je regrouper mes chantiers par secteur autour de ${ville.name} ?`,
      answer: `Oui, le planning intelligent regroupe les interventions d'une même zone pour réduire les trajets. C'est particulièrement utile dans ${ville.name} et sa périphérie, où les déplacements peuvent vite peser sur la journée.`,
    },
    {
      question: "Existe-t-il un essai gratuit ?",
      answer:
        "Oui, vous pouvez tester ArtiFlow-pro gratuitement et générer vos premiers devis avant de vous engager. Les offres Essentiel, Pro et Entreprise s'adaptent à votre activité, seul ou en équipe.",
    },
  ];
}