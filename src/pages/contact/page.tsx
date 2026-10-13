import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import ContactForm from "@/pages/contact/components/ContactForm";

const canaux = [
  {
    icon: "ri-phone-line",
    label: "Par téléphone",
    value: "07 88 94 61 91",
    href: "tel:+33788946191",
    hint: "Du lundi au vendredi, 9 h – 18 h",
    tone: "primary" as const,
  },
  {
    icon: "ri-whatsapp-line",
    label: "Sur WhatsApp",
    value: "Discuter maintenant",
    href: "https://wa.me/33788946191",
    hint: "Réponse rapide, en semaine",
    tone: "accent" as const,
  },
  {
    icon: "ri-mail-line",
    label: "Par email",
    value: "contact@artiflow-pro.fr",
    href: "mailto:contact@artiflow-pro.fr",
    hint: "Réponse sous 24 h ouvrées",
    tone: "secondary" as const,
  },
];

const engagements = [
  { icon: "ri-time-line", text: "Une réponse humaine sous 24 heures ouvrées" },
  { icon: "ri-smartphone-line", text: "Un accompagnement adapté à votre métier" },
  { icon: "ri-shield-check-line", text: "Vos données restent les vôtres (conformité RGPD)" },
];

export default function ContactPage() {
  usePageMeta(
    "Contact ArtiFlow-pro · Parler à un conseiller artisan",
    "Contactez ArtiFlow-pro par téléphone, WhatsApp ou email. Une équipe qui connaît le bâtiment vous répond sous 24 heures ouvrées pour vous aider à démarrer.",
    {
      image:
        "https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20a%20warm%20friendly%20customer%20support%20moment%20for%20an%20artisan%20SaaS%2C%20telephone%20headset%20and%20craftsman%20tools%20resting%20on%20a%20wooden%20desk%20with%20warm%20orange%20and%20deep%20teal%20green%20tones%2C%20blueprint%20lines%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-contact&orientation=landscape",
    }
  );

  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: "Contact", path: "/contact" },
    ],
    "artiflow-contact-breadcrumb-schema"
  );

  const toneClasses: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    accent: "bg-accent-100 text-accent-700",
    secondary: "bg-secondary-100 text-secondary-700",
  };

  const contactPageSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "url": `${getSiteOrigin()}/contact`,
    "name": "Contact ArtiFlow-pro · Parler à un conseiller artisan",
    "description": "Contactez ArtiFlow-pro par téléphone, WhatsApp ou email. Une équipe qui connaît le bâtiment vous répond sous 24 heures ouvrées pour vous aider à démarrer.",
    "image": "https://readdy.ai/api/search-image?query=Stylized%20artistic%20scene%20of%20a%20warm%20friendly%20customer%20support%20moment%20for%20an%20artisan%20SaaS%2C%20telephone%20headset%20and%20craftsman%20tools%20resting%20on%20a%20wooden%20desk%20with%20warm%20orange%20and%20deep%20teal%20green%20tones%2C%20blueprint%20lines%20on%20a%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1200&height=630&seq=artiflow-og-contact&orientation=landscape",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${getSiteOrigin()}/contact`
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": `${getSiteOrigin()}/` },
        { "@type": "ListItem", "position": 2, "name": "Contact", "item": `${getSiteOrigin()}/contact` }
      ]
    },
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "telephone": "+33788946191",
        "contactType": "customer support",
        "areaServed": "FR",
        "availableLanguage": [
          "français",
          "anglais"
        ]
      }
    ]
  };

  useStructuredData("artiflow-contact-page-schema", contactPageSchema);

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-20 pb-12 md:pb-16">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">
                Accueil
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">Contact</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-customer-service-2-line"></i>
                On est là pour vous
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                Parlons de votre activité d'artisan
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">
                Une question sur les offres, envie de voir ArtiFlow-pro en action ou besoin d'un coup de main
                pour démarrer ? Choisissez le canal qui vous arrange — on vous répond vite.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-10 items-start">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3">
                  {canaux.map((c) => (
                    <a
                      key={c.label}
                      href={c.href}
                      target={c.href.startsWith("http") ? "_blank" : undefined}
                      rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="group flex items-start gap-4 p-5 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors cursor-pointer"
                    >
                      <span
                        className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-lg ${toneClasses[c.tone]}`}
                      >
                        <i className={c.icon}></i>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
                          {c.label}
                        </span>
                        <span className="mt-0.5 block font-heading font-semibold text-base text-foreground-950 break-words group-hover:text-primary-700 transition-colors">
                          {c.value}
                        </span>
                        <span className="mt-1 block text-xs text-foreground-500">{c.hint}</span>
                      </span>
                      <i className="ri-arrow-right-line text-foreground-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all mt-3"></i>
                    </a>
                  ))}
                </div>

                <div className="p-5 rounded-lg bg-accent-950 text-background-50">
                  <h2 className="font-heading font-semibold text-base text-background-50 flex items-center gap-2">
                    <i className="ri-map-pin-2-line text-accent-400"></i>
                    Nos engagements
                  </h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {engagements.map((e) => (
                      <li key={e.text} className="flex items-start gap-2.5">
                        <i className={`${e.icon} text-accent-400 mt-0.5`}></i>
                        <span className="text-sm text-background-100/90 leading-relaxed">{e.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-6 md:p-8 rounded-lg bg-background-100 border border-background-200">
                <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
                  Envoyez-nous un message
                </h2>
                <p className="mt-1.5 text-sm text-foreground-600 mb-6">
                  Remplissez le formulaire, on revient vers vous rapidement.
                </p>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-100 border-t border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
            <div className="p-8 md:p-10 rounded-lg bg-foreground-950 text-background-50 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="font-heading font-bold text-2xl md:text-3xl tracking-tight">
                  Vous préférez voir l'outil en action ?
                </h2>
                <p className="mt-3 text-sm md:text-base text-background-200/85">
                  Réservez une démonstration de 20 minutes : on configure votre premier devis avec vous, sans
                  engagement.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="tel:+33788946191"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-phone-line"></i>
                  Appeler maintenant
                </a>
                <a
                  href="https://wa.me/33788946191"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                >
                  <i className="ri-whatsapp-line"></i>
                  Écrire sur WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}