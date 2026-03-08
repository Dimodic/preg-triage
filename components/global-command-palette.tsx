"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Binary, BookOpen, FileJson, PlayCircle, BarChart3 } from "lucide-react";
import { useHotkey } from "@/hooks/use-hotkey";
import { useCommandCenter } from "@/contexts/command-center";
import type { CommandAction } from "@/lib/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export function GlobalCommandPalette() {
  const router = useRouter();
  const { actions, isOpen, open, close } = useCommandCenter();

  useHotkey("k", () => {
    if (isOpen) {
      close();
      return;
    }
    open();
  });

  const navigationActions = useMemo<CommandAction[]>(
    () => [
      {
        id: "nav-triage",
        label: "Открыть рабочий экран",
        group: "Навигация",
        hint: "Перейти на рабочий экран",
        run: () => router.push("/triage"),
      },
      {
        id: "nav-kb",
        label: "Открыть базу знаний",
        group: "Навигация",
        hint: "Перейти на /kb",
        run: () => router.push("/kb"),
      },
      {
        id: "nav-cases",
        label: "Открыть обращения",
        group: "Навигация",
        hint: "Перейти на /cases",
        run: () => router.push("/cases"),
      },
      {
        id: "nav-quality",
        label: "Открыть качество",
        group: "Навигация",
        hint: "Перейти на /quality",
        run: () => router.push("/quality"),
      },
    ],
    [router],
  );

  const mergedActions = [...actions, ...navigationActions];

  return (
    <CommandDialog open={isOpen} onOpenChange={(next) => (next ? open() : close())}>
      <CommandInput placeholder="Введите команду..." />
      <CommandList>
        <CommandEmpty>Команда не найдена.</CommandEmpty>

        <CommandGroup heading="Сценарий">
          {mergedActions
            .filter((action) => action.group === "Операции")
            .map((action) => (
              <CommandItem
                key={action.id}
                onSelect={() => {
                  close();
                  action.run();
                }}
              >
                {action.id.includes("run") ? <PlayCircle /> : action.id.includes("export") ? <FileJson /> : action.id.includes("raw") ? <Binary /> : <BookOpen />}
                <span>{action.label}</span>
                {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
              </CommandItem>
            ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Навигация">
          {mergedActions
            .filter((action) => action.group !== "Операции")
            .map((action) => (
              <CommandItem
                key={action.id}
                onSelect={() => {
                  close();
                  action.run();
                }}
              >
                {action.id.includes("quality") ? <BarChart3 /> : <BookOpen />}
                <span>{action.label}</span>
              </CommandItem>
            ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
