"use client";

import { Binary, Clock3 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TraceEntry } from "@/lib/types";

type TraceDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trace: TraceEntry[];
};

const statusLabel = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "FINISHED") return "Завершено";
  if (normalized === "RUNNING") return "Выполняется";
  if (normalized === "FAILED") return "Ошибка";
  if (normalized === "QUEUED") return "В очереди";
  if (normalized === "CANCELLED") return "Отменено";
  if (normalized === "SAFE") return "Безопасно";
  if (normalized === "UNSAFE") return "Небезопасно";
  return status;
};

export function TraceDrawer({ open, onOpenChange, trace }: TraceDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Binary className="h-4 w-4" />
            Ход обработки вызова
          </SheetTitle>
          <SheetDescription>Пошаговый журнал обработки звонка.</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] pr-3">
          <div className="space-y-3">
            {trace.length ? (
              trace.map((item) => (
                <article key={item.id} className="rounded-xl border border-border bg-surface-2 p-3">
                  <header className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                      {statusLabel(item.status)}
                    </span>
                  </header>
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.type ?? "шаг"}</span>
                    {item.duration ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {item.duration}
                      </span>
                    ) : null}
                  </div>
                  <pre className="max-h-60 overflow-auto rounded-lg border border-border/70 bg-background/60 p-2 text-xs">
                    {JSON.stringify(item.outputJson ?? {}, null, 2)}
                  </pre>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Записи хода обработки отсутствуют.</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
