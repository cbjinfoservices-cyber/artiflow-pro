/**
 * Aperçus illustratifs de l'identité unifiée sur la page d'annonce :
 * un document PDF (facture), un email client et la page publique de signature.
 * Tous reprennent la couleur d'accent, le logo et le pied de page du profil.
 */
function DocumentMockup() {
  return (
    <div className="rounded-lg border border-background-200 overflow-hidden bg-background-50">
      <div className="h-1.5 bg-accent-500" />
      <div className="p-5">
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
              <div className="flex justify-between font-bold text-foreground-950 pt-0.5">
                <span>Total TTC</span>
                <span>5 256,00 €</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-foreground-600">
          Merci de votre confiance · Devis gratuit sous 48 h
        </p>
      </div>
    </div>
  );
}

function EmailMockup() {
  return (
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
            Voici votre devis D-2026-014 d'un montant de 5 256,00 €. Vous pouvez le signer directement en ligne
            via le bouton ci-dessous.
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
  );
}

function SignatureMockup() {
  return (
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
  );
}

export default function MockupsIdentite() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
      <figure className="flex flex-col">
        <DocumentMockup />
        <figcaption className="mt-3 flex items-center gap-2 text-xs text-foreground-500">
          <i className="ri-file-text-line text-accent-600"></i>
          Le devis et la facture en PDF
        </figcaption>
      </figure>
      <figure className="flex flex-col">
        <EmailMockup />
        <figcaption className="mt-3 flex items-center gap-2 text-xs text-foreground-500">
          <i className="ri-mail-send-line text-accent-600"></i>
          L'email reçu par votre client
        </figcaption>
      </figure>
      <figure className="flex flex-col">
        <SignatureMockup />
        <figcaption className="mt-3 flex items-center gap-2 text-xs text-foreground-500">
          <i className="ri-quill-pen-line text-accent-600"></i>
          La page de signature en ligne
        </figcaption>
      </figure>
    </div>
  );
}