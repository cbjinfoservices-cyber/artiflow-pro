import { useDemoModal } from "@/hooks/useDemoModal";

export const PHONE_HREF = "tel:+33788946191";
export const WHATSAPP_HREF = "https://wa.me/33788946191";

/**
 * Barre d'action collante en bas d'écran sur mobile (Appeler / WhatsApp / Demander une démo).
 * Évite de perdre le visiteur qui scrolle sans jamais atteindre le contact.
 */
export default function MobileActionBar() {
  const { openDemo } = useDemoModal();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-background-200 bg-background-50/95 backdrop-blur-md">
      <div className="w-full px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] flex items-center gap-2">
        <a
          href={PHONE_HREF}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 rounded-md border border-background-300 bg-background-50 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer"
        >
          <i className="ri-phone-line text-base"></i>
          Appeler
        </a>
        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-12 rounded-md border border-accent-200 bg-accent-50 text-accent-800 text-sm font-semibold whitespace-nowrap cursor-pointer"
        >
          <i className="ri-whatsapp-line text-base"></i>
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => openDemo("barre-mobile")}
          className="flex-[1.3] inline-flex items-center justify-center gap-1.5 h-12 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-calendar-check-line text-base"></i>
          Démo
        </button>
      </div>
    </div>
  );
}