import { createContext, useContext } from "react";

export type DemoPrefill = {
  users?: number;
  plan?: string;
};

export type DemoModalContextValue = {
  openDemo: (source?: string, prefill?: DemoPrefill) => void;
  closeDemo: () => void;
};

export const DemoModalContext = createContext<DemoModalContextValue>({
  openDemo: () => {},
  closeDemo: () => {},
});

/**
 * Permet d'ouvrir la modale de demande de démo depuis n'importe quelle page.
 */
export function useDemoModal() {
  return useContext(DemoModalContext);
}