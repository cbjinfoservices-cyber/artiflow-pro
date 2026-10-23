/**
 * Visuels de partage social (Open Graph / Twitter) dédiés à certaines pages
 * publiques qui retombaient jusque-là sur l'image générique du site.
 *
 * Chaque constante est une URL absolue 1200×630 au format attendu par les
 * réseaux sociaux. Elles suivent la direction artistique du site (ambre/teal
 * sur fond charbon) et sont réutilisées à la fois par les pages concernées
 * (via `usePageMeta`) et par l'audit SEO (`src/lib/auditSeo.ts`), pour garder
 * une seule source de vérité.
 */

/** Ressources — vue « Par sujet » (guides classés par thème). */
export const IMAGE_PARTAGE_SUJETS =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20illustrating%20construction%20resources%20sorted%20by%20topic%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20geometric%20shapes%2C%20floating%20tag%20and%20folder%20silhouettes%2C%20blueprint%20grid%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-sujets-n1&orientation=landscape";

/** Ma bibliothèque — favoris et notes personnelles. */
export const IMAGE_PARTAGE_BIBLIOTHEQUE =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20representing%20a%20personal%20library%20of%20saved%20guides%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20bookmark%20and%20stacked%20notebook%20silhouettes%2C%20blueprint%20lines%20on%20a%20deep%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-bibliotheque-n1&orientation=landscape";

/** Mentions légales. */
export const IMAGE_PARTAGE_MENTIONS =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20legal%20notices%20of%20a%20construction%20software%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20official%20document%20and%20balance%20scale%20silhouettes%2C%20thin%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-mentions-n1&orientation=landscape";

/** CGV & CGU. */
export const IMAGE_PARTAGE_CGV =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20for%20terms%20of%20sale%20and%20use%20of%20a%20software%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20contract%20signature%20and%20paragraph%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-cgv-n1&orientation=landscape";

/** RGPD & données personnelles. */
export const IMAGE_PARTAGE_RGPD =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20personal%20data%20protection%20and%20GDPR%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20shield%2C%20padlock%20and%20node%20network%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-rgpd-n1&orientation=landscape";

/** Politique de cookies. */
export const IMAGE_PARTAGE_COOKIES =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20browser%20cookies%20and%20consent%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20toggle%20switches%20and%20cookie%20circle%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-cookies-n1&orientation=landscape";

/** Accessibilité. */
export const IMAGE_PARTAGE_ACCESSIBILITE =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20digital%20accessibility%20and%20inclusion%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20wheelchair%2C%20eye%20and%20key%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-accessibilite-n1&orientation=landscape";

/**
 * Visuels de partage dédiés aux pages auteurs (une par membre de l'équipe).
 * Ils remplacent la photo de profil, inadaptée au format d'aperçu social, tout
 * en gardant la direction artistique du site (ambre/teal sur fond charbon) et un
 * sujet qui évoque le domaine de chacun.
 */

/** Léa Marchand — direction, conduite de travaux. */
export const IMAGE_PARTAGE_AUTEUR_LEA =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20leading%20construction%20projects%20and%20field%20management%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20site%20plan%2C%20hard%20hat%20and%20rising%20structure%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-auteur-lea-n1&orientation=landscape";

/** Karim Benali — technique, architecture logicielle et IA. */
export const IMAGE_PARTAGE_AUTEUR_KARIM =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20software%20architecture%20and%20applied%20artificial%20intelligence%20for%20construction%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20server%20racks%2C%20circuit%20and%20blueprint%20shapes%2C%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-auteur-karim-n1&orientation=landscape";

/** Sophie Renard — produit, design et terrain. */
export const IMAGE_PARTAGE_AUTEUR_SOPHIE =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20product%20design%20shaped%20by%20real%20job%20sites%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20wireframe%20screens%2C%20sketchbook%20and%20pencil%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-auteur-sophie-n1&orientation=landscape";

/** Antoine Lefèvre — relation artisans et support. */
export const IMAGE_PARTAGE_AUTEUR_ANTOINE =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20human%20support%20and%20customer%20care%20for%20craftspeople%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20headset%2C%20chat%20bubbles%20and%20helping%20hand%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-auteur-antoine-n1&orientation=landscape";

/** Camille Dufour — data & IA, modèles de chiffrage. */
export const IMAGE_PARTAGE_AUTEUR_CAMILLE =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20data%20science%20and%20cost%20estimation%20models%20for%20construction%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20neural%20network%20nodes%2C%20bar%20charts%20and%20blueprint%20shapes%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-auteur-camille-n1&orientation=landscape";

/** Julien Barbier — croissance, contenu et SEO. */
export const IMAGE_PARTAGE_AUTEUR_JULIEN =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20growth%2C%20content%20and%20visibility%20for%20a%20construction%20software%20brand%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%2C%20abstract%20rising%20curves%2C%20megaphone%20and%20article%20page%20silhouettes%2C%20blueprint%20lines%20over%20a%20deep%20charcoal%20background%2C%20cinematic%20soft%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-auteur-julien-n1&orientation=landscape";

/** Guide pratique — créer un mot de passe solide (page autonome /guide/mot-de-passe-solide). */
export const IMAGE_PARTAGE_GUIDE_MOT_DE_PASSE =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20creating%20a%20strong%20password%2C%20a%20large%20padlock%20and%20floating%20key%20shapes%20with%20subtle%20data%20patterns%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=guide-mdp-solide-og&orientation=landscape";

/** Récapitulatif du journal — toutes les annonces et leurs visuels de partage. */
export const IMAGE_PARTAGE_RECAP_NOUVEAUTES =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20showing%20a%20timeline%20of%20product%20announcement%20cards%20with%20sharing%20thumbnails%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20grid%20lines%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-recap-nouveautes&orientation=landscape";

/** Annonce produit — personnalisation des documents (identité unifiée). */
export const IMAGE_PARTAGE_PERSONNALISATION =
  "https://readdy.ai/api/search-image?query=Stylized%20abstract%20editorial%20banner%20about%20unified%20brand%20identity%20for%20construction%20documents%2C%20overlapping%20quote%20and%20invoice%20cards%20with%20a%20color%20swatch%20palette%20and%20an%20envelope%20silhouette%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%20on%20a%20deep%20charcoal%20background%2C%20blueprint%20grid%20lines%2C%20cinematic%20moody%20lighting%2C%20minimal%20premium%20composition%2C%20generous%20negative%20space%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-personnalisation-documents&orientation=landscape";