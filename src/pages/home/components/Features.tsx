import { espaces } from "@/mocks/landing";

const toneStyles: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

export default function Features() {
  return (
    <section id="fonctionnalites" className="w-full bg-background-50">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-apps-2-line"></i>
            Vos espaces
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Sept espaces, une seule app
          </h2>
          <p className="mt-4 text-foreground-600 text-base leading-relaxed">
            ArtiFlow-pro est rangé comme votre métier : chaque espace regroupe ce qui va ensemble, sans vous perdre.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {espaces.map((espace) => (
            <article
              key={espace.title}
              className="p-5 rounded-lg bg-background-100 border border-background-200 hover:bg-background-50 hover:border-primary-300 transition-colors"
            >
              <span className={`w-11 h-11 flex items-center justify-center rounded-lg text-xl mb-4 ${toneStyles[espace.tone]}`}>
                <i className={espace.icon}></i>
              </span>
              <h3 className="font-heading font-semibold text-base text-foreground-950">{espace.title}</h3>
              <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{espace.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}