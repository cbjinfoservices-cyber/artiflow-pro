import DemoForm from "@/components/feature/DemoForm";

const advantages = [
  { icon: "ri-time-line", text: "Démonstration en 20 minutes, sans engagement" },
  { icon: "ri-smartphone-line", text: "On configure votre premier devis avec vous" },
  { icon: "ri-shield-check-line", text: "Vos données restent les vôtres, conformité RGPD" },
];

export default function ContactCta() {
  return (
    <section id="contact" className="w-full bg-background-100 border-t border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-18">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl mx-auto items-stretch">
          <div className="p-7 md:p-10 rounded-lg bg-foreground-950 text-background-50 flex flex-col">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-400">
              <i className="ri-calendar-check-line"></i>
              Réserver une démo
            </span>
            <h2 className="mt-4 font-heading font-bold text-3xl md:text-4xl leading-tight tracking-tight">
              Voyez ArtiFlow-pro écrire un devis pour vous
            </h2>
            <p className="mt-4 text-background-200/80 text-sm md:text-base leading-relaxed">
              Laissez-nous vos coordonnées : on vous rappelle pour une démonstration adaptée à votre métier, en 20 minutes.
            </p>

            <ul className="mt-7 flex flex-col gap-4 flex-1">
              {advantages.map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-background-50/10 text-primary-400">
                    <i className={item.icon}></i>
                  </span>
                  <span className="text-sm text-background-100/90 pt-2">{item.text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-6 border-t border-background-50/15 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <span className="flex items-center gap-2 text-background-100/85">
                <i className="ri-phone-line text-primary-400"></i> 07 88 94 61 91
              </span>
              <span className="flex items-center gap-2 text-background-100/85">
                <i className="ri-mail-line text-primary-400"></i> contact@artiflow-pro.com
              </span>
            </div>
          </div>

          <div className="p-7 md:p-10 rounded-lg bg-background-50 border border-background-200">
            <DemoForm idPrefix="af-home" source="accueil" />
          </div>
        </div>
      </div>
    </section>
  );
}