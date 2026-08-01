import { useMemo, useState, type ReactNode } from "react";
import EventModal from "../Components/EventModal";
import { EventModalContext, type EventModalContextValue } from "../Hooks/useEventModal";

export const EventModalProvider = ({ children }: { children: ReactNode }) => {
  const [stack, setStack] = useState<string[]>([]);

  const value = useMemo<EventModalContextValue>(
    () => ({
      stack,
      currentId: stack.length > 0 ? stack[stack.length - 1] : null,
      openEvent: (id: string) => setStack([id]),
      navigateTo: (id: string) => setStack((s) => [...s, id]),
      goToBreadcrumb: (index: number) => setStack((s) => s.slice(0, index + 1)),
      close: () => setStack([]),
    }),
    [stack],
  );

  return (
    <EventModalContext.Provider value={value}>
      {children}
      {value.currentId && <EventModal />}
    </EventModalContext.Provider>
  );
};
