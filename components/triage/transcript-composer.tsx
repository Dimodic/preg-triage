"use client";

import { type ReactNode, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type TranscriptComposerProps = {
  transcript: string;
  transcriptMode: "demo" | "live" | "manual";
  activePresetLabel?: string | null;
  supplementalActions?: ReactNode;
  onTranscriptChange: (value: string) => void;
};

export function TranscriptComposer({
  transcript,
  transcriptMode,
  activePresetLabel,
  supplementalActions,
  onTranscriptChange,
}: TranscriptComposerProps) {
  const [open, setOpen] = useState(false);
  const transcriptModeLabel =
    transcriptMode === "demo"
      ? `Демо-скрипт${activePresetLabel ? `: ${activePresetLabel}` : ""}`
      : transcriptMode === "live"
        ? "Потоковая запись"
        : "Ручной ввод";
  const eventCount = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface-1/75 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium">Транскрипт</span>
          <Badge
            variant={transcriptMode === "demo" ? "secondary" : transcriptMode === "live" ? "success" : "outline"}
            className="max-w-full truncate"
          >
            {transcriptModeLabel}
          </Badge>
          <Badge variant="outline">{eventCount} реплик</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {supplementalActions}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1">
                Редактировать транскрипт
                <ChevronRight className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Редактирование транскрипта</SheetTitle>
                <SheetDescription>
                  Вставьте полный транскрипт звонка. Используйте формат [мм:сс] Роль: текст для корректного парсинга.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3">
                <Label htmlFor="transcript-editor">Транскрипт</Label>
                <Textarea
                  id="transcript-editor"
                  className="min-h-[420px] font-mono text-xs"
                  value={transcript}
                  onChange={(event) => onTranscriptChange(event.target.value)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </section>
  );
}
