"use client";

import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Переключить тему"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="h-9 w-9 rounded-xl"
    >
      <SunMedium className="hidden h-4 w-4 dark:inline-block" />
      <Moon className="inline-block h-4 w-4 dark:hidden" />
    </Button>
  );
}
