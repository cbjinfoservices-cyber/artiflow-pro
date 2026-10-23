import { Link } from "react-router-dom";
import AnnonceALaUneBanner from "@/components/feature/AnnonceALaUneBanner";
import { estNouveau } from "@/lib/dates";
import { nouveautes } from "@/mocks/nouveautes";

// Annonce mise en avant : sa fraîcheur conditionne la présence de l'ancre dans le sommaire.
const ANNONCE_ID = "personnalisation-documents";

type Tone = "primary" | "accent" | "secondary";

const POINTS: { icon: string; title: string; desc: string; tone: Tone }[] = [
  {
    icon: "ri-palette-line",
    title: "Couleur d'accent au choix",
    desc: "Cuivre, terracotta, or vieilli, vert forêt, bordeaux, anthracite — ou une teinte sur mesure à la pipette.",
    tone: "accent",
  },
  {
    icon: "ri-image-line",
    title: "Votre logo, affiché ou masqué",
    desc: "Le logo de l'entreprise s'affiche en haut des devis et factures, activable ou masquable en un clic.",
    tone: "primary",
  },
  {
    icon: "ri-bank-card-line",
    title: "Coordonnées de paiement",
    desc: "IBAN, BIC et conditions de règlement repris en bas de vos factures, pour être payé plus vite.",
    tone: "secondary",
  },
  {
    icon: "ri-file-text-line",
    title: "Message de pied de page libre",
    desc: "Un mot de remerciement ou une mention utile, sur tous vos documents devis et factures.",
    tone: "accent",
  },
  {
    icon: "ri-mail-send-line",
    title: "La même identité dans vos emails",
    desc: "Devis, factures et relances envoyés à vos clients portent votre couleur et votre logo.",
    tone: "primary",
  },
  {
    icon: "ri-quill-pen-line",
    title: "Jusqu'à la signature du client",
    desc: "La page de signature en ligne du devis reprend elle aussi vos couleurs, jusqu'au dernier clic.",
    tone: "secondary",
  },
];

const TONE: Record<Tone, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

/**
 * Section marketing « Vos documents à votre image » de la page Tarifs.
 * Met en avant la personnalisation des documents (couleur, logo, paiement, pied de page)
 * et l'identité reprise dans les emails clients et la page de signature, avec un aperçu
 * de document illustratif.
 */
export default function DocumentsSurMesure() {
  const annonce = nouveautes.find((n) => n.id === ANNONCE_ID);
  const annonceFraiche = Boolean(annonce?.lien && estNouveau(annonce.dateIso, 7));

  return (
    <>
      {annonceFraiche && (
        <section id="annonce" className="w-full bg-background-50 scroll-mt-32">
          <div className="w-full px-4 md:px-8 lg:px-12 pt-16 md:pt-20">
            <AnnonceALaUneBanner />
          </div>
        </section>
      )}

      <section id="documents" className="w-full bg-background-50 scroll-mt-32">
        <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
              <i className="ri-palette-line"></i>
              Votre image, partout
            </span>
            <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
              Des documents à votre image
            </h2>
            <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
              Devis, factures, emails et page de signature : ArtiFlow-pro porte vos couleurs et votre logo du premier
              document jusqu'à la signature du client. On règle tout une fois, dans votre profil.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">
            {/* Aperçu de document illustratif */}
            <div className="rounded-lg border border-background-200 overflow-hidden bg-background-50">
              <div className="h-1.5 bg-accent-500" />
              <div className="p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-10 h-10 shrink-0 rounded-full bg-accent-500 text-background-50 flex items-center justify-center font-heading font-bold text-sm">
                      PB
                    </span>
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-sm text-foreground-950 truncate">Plomberie Benali</p>
                      <p className="text-[11px] text-foreground-500 truncate">Plombier chauffagiste · Lyon</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-heading font-extrabold text-base tracking-wide text-foreground-950">FACTURE</p>
                    <p className="text-[11px] text-foreground-500">N° F-2026-014</p>
                  </div>
                </div>

                <div className="h-px bg-background-200 my-4" />

                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-foreground-500">
                      <th className="text-left font-semibold pb-1.5 border-b border-background-200">Désignation</th>
                      <th className="text-right font-semibold pb-1.5 border-b border-background-200">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="text-foreground-800">
                    <tr>
                      <td className="py-1.5 border-b border-background-100">Dépose et évacuation</td>
                      <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">420,00 €</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 border-b border-background-100">Pose faïence et plomberie</td>
                      <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">3 960,00 €</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-3 flex justify-end">
                  <div className="w-48 rounded-md bg-background-100 flex overflow-hidden">
                    <span className="w-1 shrink-0 bg-accent-500" />
                    <div className="flex-1 px-3 py-2 text-[11px]">
                      <div className="flex justify-between text-foreground-500">
                        <span>Total HT</span>
                        <span className="text-foreground-900">4 380,00 €</span>
                      </div>
                      <div className="flex justify-between text-foreground-500 mt-0.5">
                        <span>TVA</span>
                        <span className="text-foreground-900">876,00 €</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground-950 pt-1 mt-1 border-t border-background-200">
                        <span>Total TTC</span>
                        <span>5 256,00 €</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-md bg-background-100 flex overflow-hidden">
                  <span className="w-1 shrink-0 bg-accent-500" />
                  <div className="flex-1 px-3 py-2">
                    <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">
                      Coordonnées de paiement
                    </p>
                    <p className="text-[11px] text-foreground-700">IBAN : FR76 1234 5678 9012 · BIC : ABCDFRPP</p>
                  </div>
                </div>

                <p className="mt-3 text-center text-[11px] text-foreground-600">
                  Merci de votre confiance · Devis gratuit sous 48 h
                </p>
              </div>
            </div>

            {/* Liste des personnalisations */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {POINTS.map((p) => (
                <li
                  key={p.title}
                  className="flex items-start gap-3 p-4 rounded-lg bg-background-100 border border-background-200"
                >
                  <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-base ${TONE[p.tone]}`}>
                    <i className={p.icon}></i>
                  </span>
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground-950">{p.title}</p>
                    <p className="mt-0.5 text-xs text-foreground-600 leading-relaxed">{p.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Mini-aperçus : email client et page de signature, pour montrer que l'identité
              se poursuit jusqu'au client, pas seulement dans le PDF. */}
          <div className="mt-12 md:mt-16">
            <div className="max-w-2xl mb-6">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                <i className="ri-shield-check-line"></i>
                Jusqu'au client
              </span>
              <h3 className="mt-3 font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
                La même identité dans vos emails et à la signature
              </h3>
              <p className="mt-3 text-foreground-600 text-base leading-relaxed">
                Votre client reçoit un email à vos couleurs et signe votre devis sur une page qui reprend votre logo et
                votre teinte. Il ne voit jamais que vous — pas de logo ArtiFlow de son côté.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
              {/* Aperçu de l'email client */}
              <figure className="flex flex-col">
                <div className="rounded-lg border border-background-200 overflow-hidden bg-background-50">
                  <div className="h-1.5 bg-accent-500" />
                  <div className="p-5">
                    <div className="flex items-center gap-2.5 pb-4 border-b border-background-200">
                      <span className="w-10 h-10 shrink-0 rounded-full bg-accent-500 text-background-50 flex items-center justify-center font-heading font-bold text-sm">
                        PB
                      </span>
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-sm text-foreground-950 truncate">Plomberie Benali</p>
                        <p className="text-[11px] text-foreground-500 truncate">Plombier chauffagiste · Lyon</p>
                      </div>
                    </div>
                    <div className="pt-4">
                      <p className="text-[13px] text-foreground-800">Bonjour M. Bernard,</p>
                      <p className="mt-2 text-[13px] text-foreground-700 leading-relaxed">
                        Voici votre devis D-2026-014 d'un montant de 5 256,00 €. Vous pouvez le signer directement en
                        ligne via le bouton ci-dessous.
                      </p>
                      <span className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-[12px] font-semibold whitespace-nowrap">
                        <i className="ri-quill-pen-line"></i>
                        Consulter et signer le devis
                      </span>
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-background-100 border-t border-background-200 text-center">
                    <p className="text-[11px] text-foreground-500">Merci de votre confiance · Devis gratuit sous 48 h</p>
                  </div>
                </div>
                <figcaption className="mt-3 flex items-center gap-2 text-xs text-foreground-500">
                  <i className="ri-mail-send-line text-accent-600"></i>
                  Email client — devis, facture ou relance
                </figcaption>
              </figure>

              {/* Aperçu de la page de signature */}
              <figure className="flex flex-col">
                <div className="rounded-lg border border-background-200 overflow-hidden bg-background-50">
                  <div className="h-1.5 bg-accent-500" />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-10 h-10 shrink-0 rounded-full bg-accent-500 text-background-50 flex items-center justify-center font-heading font-bold text-sm">
                          PB
                        </span>
                        <p className="font-heading font-bold text-sm text-foreground-950 truncate">Plomberie Benali</p>
                      </div>
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap">
                        Devis D-2026-014
                      </span>
                    </div>

                    <div className="mt-4 rounded-md bg-background-100 p-3 text-center">
                      <p className="text-[11px] text-foreground-500">Montant à signer</p>
                      <p className="font-heading font-extrabold text-xl text-foreground-950">5 256,00 €</p>
                    </div>

                    <div className="mt-3 flex items-center gap-2 p-3 rounded-md border border-dashed border-background-300">
                      <i className="ri-quill-pen-line text-accent-600"></i>
                      <span className="text-[12px] text-foreground-600">Signature du client</span>
                    </div>

                    <span className="mt-3 inline-flex items-center justify-center gap-2 w-full h-10 rounded-md bg-accent-500 text-background-50 text-[13px] font-semibold">
                      <i className="ri-check-double-line"></i>
                      Accepter et signer
                    </span>
                  </div>
                </div>
                <figcaption className="mt-3 flex items-center gap-2 text-xs text-foreground-500">
                  <i className="ri-quill-pen-line text-accent-600"></i>
                  Page de signature en ligne du devis
                </figcaption>
              </figure>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/nouveautes/personnalisation-documents"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-megaphone-line"></i>
                Lire l'annonce complète
              </Link>
              <Link
                to="/metiers"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-background-100 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
              >
                <i className="ri-tools-line"></i>
                Voir par métier
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}