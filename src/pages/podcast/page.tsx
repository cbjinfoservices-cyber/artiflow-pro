import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import EpisodeCard from "@/pages/podcast/components/EpisodeCard";
import AlertePodcastForm from "@/pages/podcast/components/AlertePodcastForm";
import InterventionsSection from "@/pages/podcast/components/InterventionsSection";
import EpisodesListe from "@/pages/podcast/components/EpisodesListe";
import { useLieuMedia } from "@/pages/podcast/components/useLieuMedia";
import { episodesPodcast, plateformesPodcast } from "@/mocks/podcasts";
import { useEpisodePilote } from "@/hooks/useEpisodePilote";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { usePodcastSchema } from "@/hooks/usePodcastSchema";
import { useInterventionsSchema } from "@/hooks/useInterventionsSchema";

/**
 * Page Podcast / Média : les épisodes audio où l'équipe ArtiFlow-pro
 * intervient, avec lecteurs intégrés et liens vers les plateformes d'origine.
 */
export default function PodcastPage() {
  // Lieu partagé par les épisodes et les interventions : il pilote l'URL (?lieu=…)
  // et reste mémorisé d'une visite à l'autre pour retrouver la vue telle quelle.
  const [lieuMedia, definirLieuMedia] = useLieuMedia();
  // Épisode mis en avant (par défaut le plus récent) : il pilote la carte lecteur.
  const [episodePilote, definirEpisodePilote] = useEpisodePilote();

  usePageMeta(
    "Podcast & médias ArtiFlow-pro · L'équipe sur les ondes",
    "Écoutez les interviews et prises de parole de l'équipe ArtiFlow-pro dans les podcasts et médias du bâtiment : chiffrage par IA, RGPD, produit et croissance.",
    {
      type: "website",
      // Carte Twitter « player » + métadonnées audio, pilotées par l'épisode à la une.
      player: {
        url: episodePilote.listenUrl,
        stream: episodePilote.audioUrl,
        streamType: "audio/mpeg",
        width: 1280,
        height: 720,
        title: episodePilote.title,
      },
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20artistic%20abstract%20scene%20suggesting%20a%20podcast%20studio%20about%20construction%20software%2C%20a%20microphone%20silhouette%20with%20sound%20waves%20and%20subtle%20blueprint%20lines%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%2C%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20banner%2C%20high%20detail%2C%20strong%20contrast&width=1200&height=630&seq=artiflow-og-podcast&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Podcast", path: "/podcast" },
    ],
    "artiflow-podcast-breadcrumb-schema"
  );

  usePodcastSchema();
  useInterventionsSchema();

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        {/* Héro */}
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">Accueil</Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Podcast</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-14 items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                  <i className="ri-mic-line"></i>
                  Podcast & médias
                </span>
                <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight leading-tight">
                  L'équipe ArtiFlow-pro sur les ondes
                </h1>
                <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                  Chiffrage par IA, protection des données, produit ou croissance : retrouvez ici les
                  épisodes où nos équipes prennent le micro, avec le lecteur audio intégré à la page.
                </p>
                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <a
                    href={`#${episodePilote.id}`}
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-play-circle-line"></i>
                    Écouter l'épisode à la une
                  </a>
                  <a
                    href="#alerte-podcast"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-notification-3-line"></i>
                    S'abonner aux alertes
                  </a>
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-mic-2-line"></i>
                    Nous inviter dans votre média
                  </Link>
                </div>
              </div>

              <div className="w-full h-56 md:h-72 rounded-lg overflow-hidden border border-background-200 bg-background-50">
                <img
                  src="https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20a%20warm%20podcast%20recording%20corner%20for%20a%20construction%20software%20brand%2C%20microphone%20on%20a%20boom%20arm%20with%20headphones%20and%20blurred%20blueprint%20lines%2C%20warm%20amber%20and%20deep%20teal%20green%20tones%2C%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=900&height=700&seq=artiflow-podcast-hero&orientation=landscape"
                  alt="Coin studio pour enregistrer les podcasts d'ArtiFlow-pro"
                  title="Podcast et médias ArtiFlow-pro"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Plateformes */}
        <section className="w-full bg-background-50 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-8 md:py-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-secondary-700">
                <i className="ri-broadcast-line"></i>
                Écouter sur vos plateformes habituelles
              </div>
              <div className="flex flex-wrap gap-3">
                {plateformesPodcast.map((plateforme) => (
                  <a
                    key={plateforme.label}
                    href={plateforme.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-sm font-medium text-foreground-800 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className={`${plateforme.icon} text-base text-primary-700`}></i>
                    {plateforme.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bandeau média */}
        <section className="w-full bg-secondary-100 border-b border-secondary-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-6 md:py-7">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-secondary-200 text-secondary-900 text-lg">
                  <i className="ri-newspaper-line"></i>
                </span>
                <div>
                  <h2 className="font-heading font-semibold text-base md:text-lg text-secondary-900">
                    Un média ? Parlons-en
                  </h2>
                  <p className="mt-1 text-sm text-secondary-900/80 leading-relaxed">
                    Journaliste, podcasteur ou rédaction : demandez une interview, des visuels ou des
                    chiffres clés de la marque.
                  </p>
                </div>
              </div>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
              >
                <i className="ri-mail-send-line"></i>
                Nous contacter
              </Link>
            </div>
          </div>
        </section>

        {/* Épisode à la une : pilote la carte lecteur lors du partage */}
        <section className="w-full bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                  <i className="ri-star-line"></i>
                  À la une
                </span>
                <h2 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
                  L'épisode à la une
                </h2>
                <p className="mt-2 text-sm md:text-base text-foreground-600 leading-relaxed">
                  Cet épisode est mis en avant et pilote la carte lecteur lorsqu'on partage cette page sur les
                  réseaux sociaux. Le choix est enregistré pour tout le monde, et non plus seulement dans votre
                  navigateur.
                </p>
              </div>

              <div className="w-full lg:w-auto lg:min-w-[340px] shrink-0">
                <label
                  htmlFor="episode-pilote"
                  className="block text-xs font-semibold uppercase tracking-wide text-foreground-500 mb-2"
                >
                  Choisir l'épisode à la une
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <i className="ri-mic-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500"></i>
                    <select
                      id="episode-pilote"
                      value={episodePilote.id}
                      onChange={(e) => definirEpisodePilote(e.target.value)}
                      className="w-full h-11 pl-9 pr-9 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 appearance-none cursor-pointer"
                    >
                      {episodesPodcast.map((episode) => (
                        <option key={episode.id} value={episode.id}>
                          Ép. {episode.episodeNumber} · {episode.show} — {episode.title}
                        </option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-500 pointer-events-none"></i>
                  </div>
                  <button
                    type="button"
                    onClick={() => definirEpisodePilote(episodesPodcast[0].id)}
                    disabled={episodePilote.id === episodesPodcast[0].id}
                    title="Remettre l'épisode le plus récent à la une"
                    aria-label="Remettre l'épisode le plus récent à la une"
                    className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-md bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300 hover:text-primary-700 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="ri-history-line"></i>
                  </button>
                </div>
                <p className="mt-2 text-xs text-foreground-500">
                  Réglage global, partagé par tous les visiteurs. Par défaut, l'épisode le plus récent est mis
                  en avant.
                </p>
              </div>
            </div>
            <EpisodeCard episode={episodePilote} featured />
          </div>
        </section>

        {/* Tous les épisodes (avec filtre par lieu) */}
        <EpisodesListe
          lieuActif={lieuMedia}
          onLieuChange={definirLieuMedia}
          episodePiloteId={episodePilote.id}
        />

        {/* Interventions publiques (conférences & webinaires) */}
        <InterventionsSection lieuActif={lieuMedia} onLieuChange={definirLieuMedia} />

        {/* Abonnement aux alertes podcast */}
        <section id="alerte-podcast" className="w-full bg-background-100 border-b border-background-200 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-12 items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
                  <i className="ri-notification-3-line"></i>
                  Alerte podcast
                </span>
                <h2 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
                  Recevez chaque nouvel épisode par e-mail
                </h2>
                <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                  Abonnez-vous pour être prévenu dès qu'une nouvelle prise de parole paraît, et indiquez la
                  plateforme sur laquelle vous écoutez habituellement.
                </p>
                <ul className="mt-6 flex flex-col gap-3">
                  {[
                    { icon: "ri-time-line", text: "Une alerte dès qu'un nouvel épisode est publié" },
                    { icon: "ri-headphone-line", text: "Indiquez votre plateforme d'écoute préférée" },
                    { icon: "ri-mail-close-line", text: "Un clic pour se désabonner à tout moment" },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-2.5">
                      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                        <i className={item.icon}></i>
                      </span>
                      <span className="pt-1.5 text-sm text-foreground-700">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 md:p-8 rounded-lg bg-background-50 border border-background-200">
                <h3 className="font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
                  S'abonner aux alertes podcast
                </h3>
                <p className="mt-1.5 text-sm text-foreground-600 mb-6">
                  Indiquez votre email et votre plateforme d'écoute.
                </p>
                <AlertePodcastForm />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full bg-background-100">
          <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
            <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-lg bg-accent-950 text-background-50">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="max-w-2xl">
                  <h2 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">
                    Vous animez un podcast sur le bâtiment ?
                  </h2>
                  <p className="mt-3 text-sm md:text-base text-background-200/85">
                    Nos fondateurs et notre équipe interviennent volontiers sur le chiffrage, l'IA, la
                    protection des données ou l'entrepreneuriat artisanal. Proposez-nous un sujet.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-mail-send-line"></i>
                    Proposer un sujet
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}