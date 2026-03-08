"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppStoreProvider } from "@/contexts/app-store";
import { CommandCenterProvider } from "@/contexts/command-center";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <CommandCenterProvider>
          <AppStoreProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              theme="dark"
              toastOptions={{
                className: "border border-border bg-surface-1 text-foreground",
              }}
            />
          </AppStoreProvider>
        </CommandCenterProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
