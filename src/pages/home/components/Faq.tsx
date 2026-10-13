import { faqs } from "@/mocks/landing";
import FaqAccordion from "@/components/feature/FaqAccordion";

export default function Faq() {
  return (
    <section id="faq" className="w-full bg-background-50">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
              <i className="ri-question-answer-line"></i>
              Questions fréquentes
            </span>
            <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
              On répond avant que vous demandiez
            </h2>
            <p className="mt-3 text-sm text-foreground-500">
              Chaque question a son lien direct : cliquez sur l'icône pour la partager.
            </p>
          </div>

          <div className="mt-10">
            <FaqAccordion items={faqs} idPrefix="faq" />
          </div>
        </div>
      </div>
    </section>
  );
}