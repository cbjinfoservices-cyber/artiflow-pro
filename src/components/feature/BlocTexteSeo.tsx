type BlocTexte = {
  sousTitre?: string;
  paragraphes?: string[];
  liste?: string[];
};

type BlocTexteSeoProps = {
  id?: string;
  eyebrow?: string;
  eyebrowIcon?: string;
  titre: string;
  intro?: string;
  /** Couleur d'accent du bloc (suit le système de palette). */
  ton?: "primary" | "accent" | "secondary";
  /** Classe de fond de la section (pour alterner les couches visuelles). */
  fond?: string;
  /** Dispose les blocs sur une ou deux colonnes en grand écran. */
  colonnes?: 1 | 2;
  blocs: BlocTexte[];
};

const tonTexte: Record<string, string> = {
  primary: "text-primary-700",
  accent: "text-accent-700",
  secondary: "text-secondary-700",
};

const tonPuce: Record<string, string> = {
  primary: "text-primary-600",
  accent: "text-accent-600",
  secondary: "text-secondary-600",
};

/**
 * Section rédactionnelle réutilisable : un titre, une accroche et une série de
 * blocs de texte (paragraphes et listes). Sert à enrichir le contenu éditorial
 * des pages pour améliorer le ratio texte/HTML sans casser le design existant.
 */
export default function BlocTexteSeo({
  id,
  eyebrow,
  eyebrowIcon,
  titre,
  intro,
  ton = "secondary",
  fond = "bg-background-50",
  colonnes = 2,
  blocs,
}: BlocTexteSeoProps) {
  return (
    <section id={id} className={`w-full border-b border-background-200 ${fond}`}>
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
        <div className="max-w-3xl mb-8 md:mb-10">
          {eyebrow && (
            <span className={`inline-flex items-center gap-2 text-sm font-semibold ${tonTexte[ton]}`}>
              <i className={eyebrowIcon || "ri-article-line"}></i>
              {eyebrow}
            </span>
          )}
          <h2 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
            {titre}
          </h2>
          {intro && (
            <p className="mt-4 text-sm md:text-base text-foreground-600 leading-relaxed">{intro}</p>
          )}
        </div>

        <div
          className={
            colonnes === 2
              ? "grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12"
              : "flex flex-col gap-8"
          }
        >
          {blocs.map((bloc, index) => (
            <div key={index} className="flex flex-col gap-3">
              {bloc.sousTitre && (
                <h3 className="font-heading font-semibold text-lg text-foreground-950">
                  {bloc.sousTitre}
                </h3>
              )}
              {bloc.paragraphes?.map((paragraphe, i) => (
                <p key={i} className="text-sm md:text-[15px] text-foreground-700 leading-relaxed">
                  {paragraphe}
                </p>
              ))}
              {bloc.liste && bloc.liste.length > 0 && (
                <ul className="flex flex-col gap-2.5 mt-1">
                  {bloc.liste.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm md:text-[15px] text-foreground-700 leading-relaxed"
                    >
                      <i
                        className={`ri-arrow-right-circle-line mt-0.5 shrink-0 ${tonPuce[ton]}`}
                      ></i>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}