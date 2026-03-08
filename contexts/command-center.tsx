"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CommandAction } from "@/lib/types";

type CommandCenterValue = {
  actions: CommandAction[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  registerActions: (owner: string, actions: CommandAction[]) => void;
  unregisterActions: (owner: string) => void;
};

const CommandCenterContext = createContext<CommandCenterValue | null>(null);

export function CommandCenterProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [registry, setRegistry] = useState<Record<string, CommandAction[]>>({});

  const registerActions = useCallback((owner: string, actions: CommandAction[]) => {
    setRegistry((prev) => ({ ...prev, [owner]: actions }));
  }, []);

  const unregisterActions = useCallback((owner: string) => {
    setRegistry((prev) => {
      const next = { ...prev };
      delete next[owner];
      return next;
    });
  }, []);

  const actions = useMemo(() => Object.values(registry).flat(), [registry]);

  const value = useMemo(
    () => ({
      actions,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      registerActions,
      unregisterActions,
    }),
    [actions, isOpen, registerActions, unregisterActions],
  );

  return <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>;
}

export const useCommandCenter = () => {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) throw new Error("useCommandCenter must be used inside CommandCenterProvider");
  return ctx;
};

export const useRegisterCommandActions = (owner: string, actions: CommandAction[]) => {
  const { registerActions, unregisterActions } = useCommandCenter();

  useEffect(() => {
    registerActions(owner, actions);
    return () => unregisterActions(owner);
  }, [actions, owner, registerActions, unregisterActions]);
};
