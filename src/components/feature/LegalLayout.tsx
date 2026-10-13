import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useBreadcrumbSchema } from "@/hooks/useBreadcrumbSchema";
import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";

export type LegalSectionLink = { id: string; label: string };

type LegalLayoutProps = {
  path: string;
  eyebrow: string;
  eyebrowIcon: string;
  title: string;
  intro: string;
  updatedAt: string;
  metaTitle: string;
  metaDescription: string;
  /** Visuel de partage social dédié à la page légale (Open Graph / Twitter). */
  metaImage: string;
  breadcrumbLabel: string;
  breadcrumbSchemaId: string;
  sections: LegalSectionLink[];
  children: ReactNode;
};

export default function LegalLayout({
  path,
  eyebrow,
  eyebrowIcon,
  title,
  intro,
  updatedAt,
  metaTitle,
  metaDescription,
  metaImage,
  breadcrumbLabel,
  breadcrumbSchemaId,
  sections,
  children,
}: LegalLayoutProps) {
  usePageMeta(metaTitle, metaDescription, { image: metaImage });
  useBreadcrumbSchema(
    [
      { name: "Accueil", path: "/" },
      { name: breadcrumbLabel, path },
    ],
    breadcrumbSchemaId
  );

  useStructuredData(`artiflow-legal-webpage-${path.replace(/\//g, "-")}`, {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${getSiteOrigin()}${path}`,
    url: `${getSiteOrigin()}${path}`,
    name: metaTitle,
    description: metaDescription,
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${getSiteOrigin()}/#website` },
  });

  return (
    <div className="w-full min-h-screen bg-background-50 pb-20 lg:pb-0">
      <Navbar />

      <main>
        <section className="w-full pt-16 md:pt-18 bg-background-100 border-b border-background-200">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-14 md:pt-18 pb-12 md:pb-14">
            <nav className="flex flex-wrap items-center gap-2 text-xs text-foreground-500 mb-6">
              <Link to="/" className="hover:text-foreground-900 cursor-pointer">
                Accueil
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-foreground-800">{breadcrumbLabel}</span>
            </nav>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className={eyebrowIcon}></i>
                {eyebrow}
              </span>
              <h1 className="mt-3 font-heading font-bold text-3xl md:text-5xl text-foreground-950 tracking-tight">
                {title}
              </h1>
              <p className="mt-4 text-base md:text-lg text-foreground-600 leading-relaxed">{intro}</p>
              <span className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50 border border-background-200 text-xs font-medium text-foreground-600">
                <i className="ri-refresh-line text-secondary-600"></i>
                Dernière mise à jour : {updatedAt}
              </span>
            </div>
          </div>
        </section>

        <section className="w-full bg-background-50">
          <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-12">
              <aside className="lg:sticky lg:top-28 lg:self-start">
                <div className="p-5 rounded-lg bg-background-100 border border-background-200">
                  <h2 className="font-heading font-semibold text-sm text-foreground-950 mb-3 flex items-center gap-2">
                    <i className="ri-list-check text-secondary-600"></i>
                    Sommaire
                  </h2>
                  <ul className="flex flex-col gap-2.5">
                    {sections.map((s, i) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className="flex items-start gap-2 text-sm text-foreground-600 hover:text-foreground-950 cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-semibold text-secondary-600 mt-0.5">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="leading-snug">{s.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>

              <div className="flex flex-col gap-10">{children}</div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight pb-3 border-b border-background-200">
        {title}
      </h2>
      <div className="mt-5 flex flex-col gap-4 text-sm md:text-[15px] text-foreground-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}