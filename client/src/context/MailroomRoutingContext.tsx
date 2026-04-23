/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type MailroomRoutingValue = {
  mailroomOpen: boolean;
  setMailroomOpen: (open: boolean) => void;
  openMailroom: () => void;
};

const MailroomRoutingContext = createContext<MailroomRoutingValue | null>(null);

export function MailroomRoutingProvider({ children }: { children: ReactNode }) {
  const [mailroomOpen, setMailroomOpen] = useState(false);
  const openMailroom = useCallback(() => setMailroomOpen(true), []);

  const value = useMemo(
    () => ({
      mailroomOpen,
      setMailroomOpen,
      openMailroom,
    }),
    [mailroomOpen, openMailroom],
  );

  return <MailroomRoutingContext.Provider value={value}>{children}</MailroomRoutingContext.Provider>;
}

export function useMailroomRouting(): MailroomRoutingValue {
  const ctx = useContext(MailroomRoutingContext);
  if (!ctx) {
    throw new Error("useMailroomRouting must be used within MailroomRoutingProvider");
  }
  return ctx;
}
