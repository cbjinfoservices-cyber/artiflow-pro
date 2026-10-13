import { useCallback, useMemo, useState, type ReactNode } from "react";
import { DemoModalContext, type DemoPrefill } from "@/hooks/useDemoModal";
import DemoModal from "@/components/feature/DemoModal";

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
      <DemoModal open={open} source={source} prefill={prefill} onClose={closeDemo} />
    </DemoModalContext.Provider>
  );
}