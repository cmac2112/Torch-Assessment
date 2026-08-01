import { createContext, useContext } from "react";

export interface EventModalContextValue {
  // breadcrumb trail of event ids the user has drilled into, oldest first
  stack: string[];
  currentId: string | null;
  openEvent: (id: string) => void;
  navigateTo: (id: string) => void;
  goToBreadcrumb: (index: number) => void;
  close: () => void;
}

export const EventModalContext = createContext<EventModalContextValue | null>(null);

export const useEventModal = (): EventModalContextValue => {
  const ctx = useContext(EventModalContext);
  if (!ctx) throw new Error("useEventModal must be used within an EventModalProvider");
  return ctx;
};
