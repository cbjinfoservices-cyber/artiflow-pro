/**
 * Écran d'attente affiché pendant le chargement à la demande d'une page.
 * Sobre, centré, aux couleurs du site : il évite un écran blanc pendant
 * que le code de la page concernée est téléchargé.
 */
function ChargementPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background-50">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-500" aria-hidden="true"></i>
        </span>
        <span className="text-sm text-foreground-600">Chargement…</span>
      </div>
    </div>
  );
}

export default ChargementPage;