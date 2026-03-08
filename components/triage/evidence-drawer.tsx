"use client";

import Link from "next/link";
import { ExternalLink, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { containsEither } from "@/lib/text-match";
import type { GuidelineQuote, TriagePayload } from "@/lib/types";
import { cn } from "@/lib/utils";

type EvidenceDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightedQuote: string | null;
  focusTerms: string[];
  focusEvidenceQuotes: string[];
  onOpenAllSources: () => void;
  payload: TriagePayload | null;
};

const dedupe = (items: string[]) =>
  Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const filterGuidelines = (items: GuidelineQuote[], queries: string[]) =>
  items.filter((item) =>
    queries.some(
      (query) =>
        containsEither(item.quote, query) ||
        containsEither(item.why, query) ||
        containsEither(item.source, query),
    ),
  );

export function EvidenceDrawer({
  open,
  onOpenChange,
  highlightedQuote,
  focusTerms,
  focusEvidenceQuotes,
  onOpenAllSources,
  payload,
}: EvidenceDrawerProps) {
  const evidenceQuotes = payload?.triage.evidence_quotes ?? [];
  const guidelineQuotes = payload?.rag.guidelines ?? [];
  const query = highlightedQuote?.trim() ?? "";

  const focusQueries = dedupe([
    ...focusTerms,
    ...focusEvidenceQuotes,
    ...(query ? [query] : []),
  ]);
  const hasFocus = focusQueries.length > 0;

  const matchedEvidence = hasFocus
    ? evidenceQuotes.filter((quote) => focusQueries.some((focus) => containsEither(quote, focus)))
    : evidenceQuotes;
  const matchedGuidelines = hasFocus
    ? filterGuidelines(guidelineQuotes, focusQueries)
    : guidelineQuotes;
  const hasMatches = matchedEvidence.length > 0 || matchedGuidelines.length > 0;
  const kbQuery = query || focusQueries[0] || "";
  const kbHref = kbQuery ? `/kb?query=${encodeURIComponent(kbQuery)}` : "/kb";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-4 sm:p-5">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" />
            Источники
          </DialogTitle>
          <DialogDescription>
            Показаны источники, связанные с выбранным сигналом. Можно сразу открыть полный список.
          </DialogDescription>
        </DialogHeader>

        {focusQueries.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Фокус</Badge>
            {focusQueries.slice(0, 4).map((focus) => (
              <Badge key={focus} variant="outline" className="max-w-full truncate text-xs font-normal">
                {focus}
              </Badge>
            ))}
          </div>
        ) : null}

        <ScrollArea className="max-h-[55vh] pr-2">
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Цитаты из звонка</h3>
              <div className="space-y-2">
                {matchedEvidence.length ? (
                  matchedEvidence.map((quote) => (
                    <div
                      key={quote}
                      className={cn(
                        "rounded-xl border border-border bg-surface-2 p-3 text-sm",
                        hasFocus &&
                          focusQueries.some((focus) => containsEither(quote, focus)) &&
                          "border-primary/60 bg-primary/10",
                      )}
                    >
                      &ldquo;{quote}&rdquo;
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Связанные цитаты звонка не найдены.</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Рекомендации и источники</h3>
              <div className="space-y-2">
                {matchedGuidelines.length ? (
                  matchedGuidelines.map((item) => (
                    <article
                      key={`${item.source}-${item.quote}`}
                      className={cn(
                        "rounded-xl border border-border bg-surface-2 p-3",
                        hasFocus &&
                          focusQueries.some(
                            (focus) =>
                              containsEither(item.quote, focus) ||
                              containsEither(item.why, focus) ||
                              containsEither(item.source, focus),
                          ) &&
                          "border-primary/60 bg-primary/10",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{item.source}</p>
                        {item.file_id ? <Badge variant="outline">{item.file_id}</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">&ldquo;{item.quote}&rdquo;</p>
                      <p className="mt-2 text-xs text-foreground/90">Почему: {item.why}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Связанные рекомендации не найдены.</p>
                )}
              </div>
            </section>

            {!hasMatches && hasFocus ? (
              <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                По этому сигналу нет точных совпадений. Нажмите «Показать все» или перейдите в полную базу.
              </p>
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onOpenAllSources}>
            Показать все
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={kbHref}>
              Полная база
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
