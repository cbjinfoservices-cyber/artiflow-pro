import { steps } from "@/mocks/landing";

export default function Workflow() {
  return (
    <section id="workflow" className="w-full bg-foreground-950 text-background-50">
      <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-18">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-400">
            <i className="ri-route-line"></i>
            Comment ça marche
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl lg:text-5xl tracking-tight">
            Un chantier, quatre étapes, zéro paperasse
          </h2>
          <p className="mt-4 text-background-200/80 text-base md:text-lg leading-relaxed">
            Vous n'avez rien de technique à apprendre. Vous parlez, vous validez, ArtiFlow-pro s'occupe du reste.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {steps.map((step) => (
            <article key={step.number} className="relative p-6 rounded-lg bg-background-50/5 border border-background-50/15">
              <span className="absolute top-5 right-5 font-heading font-bold text-3xl text-background-50/15">{step.number}</span>
              <span className="w-12 h-12 flex items-center justify-center rounded-lg bg-primary-500 text-background-50 text-2xl mb-4">
                <i className={step.icon}></i>
              </span>
              <h3 className="font-heading font-semibold text-lg text-background-50">{step.title}</h3>
              <p className="mt-2 text-sm text-background-200/75 leading-relaxed">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}