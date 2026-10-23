import { Suspense, lazy, useCallback, useMemo, useState, type ReactNode } from "react";
import { DemoModalContext, type DemoPrefill } from "@/hooks/useDemoModal";

// La fenêtre « Réserver une démo » n'apparaît qu'au clic sur les boutons « Voir une démo ».
// On la charge donc à la demande : son code (et le formulaire qu'elle embarque) sort du bundle
// initial et n'est téléchargé qu'à la première ouverture, ce qui allège le démarrage du site.
const DemoModal = lazy(() => import("@/components/feature/DemoModal"));

export default function DemoModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string | undefined>(undefined);
  const [prefill, setPrefill] = useState<DemoPrefill | undefined>(undefined);

  const openDemo = useCallback((src?: string, pf?: DemoPrefill) => {
    setSource(src);
    setPrefill(pf);
    setOpen(true);
  }, []);

  const closeDemo = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openDemo, closeDemo }), [openDemo, closeDemo]);

  return (
    <DemoModalContext.Provider value={value}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <DemoModal open={open} source={source} prefill={prefill} onClose={closeDemo} />
        </Suspense>
      )}
    </DemoModalContext.Provider>
  );
}