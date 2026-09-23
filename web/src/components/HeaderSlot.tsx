import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

const HeaderSlotContext = createContext<HTMLElement | null>(null);

export const HeaderSlotProvider = HeaderSlotContext.Provider;

export function HeaderPortal({ children }: { children: ReactNode }) {
  const container = useContext(HeaderSlotContext);
  if (!container) return null;
  return createPortal(children, container);
}
