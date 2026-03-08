"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Clock3, FlagTriangleLeft, Info, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { containsEither, extractMeaningfulTokens } from "@/lib/text-match";
import type { GuidelineQuote } from "@/lib/types";
import { cn, parseTranscriptTimeline } from "@/lib/utils";

type TranscriptTimelineProps = {
  transcript: string;
  evidenceQuotes: string[];
  guidelines: GuidelineQuote[];
  redFlags: string[];
  concernTerms: string[];
  activeConcerns: string[];
  focusedEntryId?: string | null;
  highlightedQuote: string | null;
  liveHighlightText?: string | null;
  loading: boolean;
  onOpenSources: (focus: { terms: string[]; evidenceQuotes: string[] }) => void;
  onOpenAllSources: () => void;
  onRedFlagClick: (params: { terms: string[]; entryId: string }) => void;
  onConcernClick: (params: { terms: string[]; entryId: string }) => void;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildWordRegex = (term: string) => {
  const escaped = escapeRegExp(term);
  if (!escaped) return null;

  return new RegExp(
    `(?<![\\p{L}\\p{N}_-])[\\p{L}\\p{N}-]*${escaped}[\\p{L}\\p{N}-]*(?![\\p{L}\\p{N}_-])`,
    "giu",
  );
};

const dedupeList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

const collectRegexMatches = (text: string, regex: RegExp) =>
  Array.from(text.matchAll(regex))
    .map((match) => {
      const matchedText = match[0] ?? "";
      const start = match.index ?? -1;
      if (start < 0 || !matchedText) return null;
      return {
        start,
        end: start + matchedText.length,
        matchedText,
      };
    })
    .filter((match): match is { start: number; end: number; matchedText: string } => Boolean(match));

const collectWeekRanges = (text: string, term: string) => {
  const weekNumber = term.match(/(?<!\d)(\d{1,2})(?!\d)/u)?.[1];
  if (!weekNumber) return [] as Array<{ start: number; end: number; matchedText: string }>;

  const weekOrPregnancySignal =
    /\u043d\u0435\u0434\u0435\u043b|\u0431\u0435\u0440\u0435\u043c\u0435\u043d/iu.test(term);
  if (!weekOrPregnancySignal) return [] as Array<{ start: number; end: number; matchedText: string }>;

  const weekRegex = new RegExp(
    `(?<![\\p{L}\\p{N}_-])${weekNumber}\\s*(?:[-\\u2013\\u2014]\\s*)?(?:[\\p{L}])?\\s*\\u043d\\u0435\\u0434[\\p{L}\\p{N}-]*(?![\\p{L}\\p{N}_-])`,
    "giu",
  );

  return collectRegexMatches(text, weekRegex);
};

const collectTokenMatches = (text: string, token: string) => {
  const exactRegex = buildWordRegex(token);
  const exactMatches = exactRegex ? collectRegexMatches(text, exactRegex) : [];

  if (exactMatches.length || /\d/u.test(token) || token.length < 6) {
    return exactMatches;
  }

  const stemRegex = buildWordRegex(token.slice(0, 4));
  if (!stemRegex) return exactMatches;

  return collectRegexMatches(text, stemRegex);
};

const collectTermRanges = (text: string, term: string) => {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return [] as Array<{ start: number; end: number; matchedText: string }>;

  const phraseRegex = /\s/.test(normalizedTerm) ? new RegExp(escapeRegExp(normalizedTerm), "giu") : null;
  if (phraseRegex) {
    const phraseMatches = collectRegexMatches(text, phraseRegex);
    if (phraseMatches.length) return phraseMatches;
  }

  const weekRanges = collectWeekRanges(text, normalizedTerm);
  if (weekRanges.length) return weekRanges;

  const tokens = extractMeaningfulTokens(normalizedTerm);
  return tokens.flatMap((token) => collectTokenMatches(text, token));
};

const renderHighlightedText = (params: {
  text: string;
  matchedConcerns: string[];
  redFlags: string[];
  activeConcerns: string[];
  onConcernClick: (term: string) => void;
}) => {
  const terms = dedupeList(params.matchedConcerns);
  if (!terms.length) return params.text;

  const ranges: Array<{ start: number; end: number; term: string; matchedText: string }> = [];

  for (const term of terms) {
    for (const match of collectTermRanges(params.text, term)) {
      ranges.push({
        start: match.start,
        end: match.end,
        term,
        matchedText: match.matchedText,
      });
    }
  }

  if (!ranges.length) return params.text;

  const selected = ranges
    .sort((a, b) => (a.start === b.start ? b.end - b.start - (a.end - a.start) : a.start - b.start))
    .reduce<Array<{ start: number; end: number; term: string; matchedText: string }>>((acc, current) => {
      const overlap = acc.some((item) => current.start < item.end && current.end > item.start);
      if (!overlap) acc.push(current);
      return acc;
    }, [])
    .sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];
  let cursor = 0;

  selected.forEach((range, index) => {
    if (range.start > cursor) {
      nodes.push(<span key={`plain-${index}`}>{params.text.slice(cursor, range.start)}</span>);
    }

    const isRed = params.redFlags.some(
      (flag) => containsEither(flag, range.term) || containsEither(flag, range.matchedText),
    );

    const isActive = params.activeConcerns.some(
      (activeTerm) =>
        containsEither(activeTerm, range.term) || containsEither(activeTerm, range.matchedText),
    );

    nodes.push(
      <button
        key={`hit-${range.start}-${range.end}`}
        type="button"
        onClick={() => params.onConcernClick(range.term)}
        className={cn(
          "inline rounded px-1 py-0.5 text-left transition",
          isRed
            ? "bg-danger/20 text-danger hover:bg-danger/25"
            : "bg-warning/20 text-warning hover:bg-warning/25",
          isActive && "ring-1 ring-offset-0 ring-ring",
        )}
      >
        {range.matchedText}
      </button>,
    );

    cursor = range.end;
  });

  if (cursor < params.text.length) {
    nodes.push(<span key="plain-end">{params.text.slice(cursor)}</span>);
  }

  return nodes;
};

const guidelineMatchesEntry = (
  guideline: GuidelineQuote,
  terms: string[],
  evidence: string[],
) =>
  terms.some(
    (term) =>
      containsEither(guideline.quote, term) ||
      containsEither(guideline.why, term) ||
      containsEither(guideline.source, term),
  ) ||
  evidence.some((quote) => containsEither(guideline.quote, quote) || containsEither(guideline.why, quote));

export function TranscriptTimeline({
  transcript,
  evidenceQuotes,
  guidelines,
  redFlags,
  concernTerms,
  activeConcerns,
  focusedEntryId,
  highlightedQuote,
  liveHighlightText,
  loading,
  onOpenSources,
  onOpenAllSources,
  onRedFlagClick,
  onConcernClick,
}: TranscriptTimelineProps) {
  const timeline = parseTranscriptTimeline(transcript);
  const reduceMotion = useReducedMotion();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>{"\u0422\u0430\u0439\u043c\u043b\u0430\u0439\u043d \u0442\u0440\u0430\u043d\u0441\u043a\u0440\u0438\u043f\u0442\u0430"}</span>
          <div className="flex items-center gap-2">
            {loading ? (
              <Badge variant="warning" className="gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {"\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435..."}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="gap-1">
              <Clock3 className="h-3 w-3" />
              {timeline.length} {"\u0441\u043e\u0431\u044b\u0442\u0438\u0439"}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {timeline.length === 0 ? (
            <article className="rounded-xl border border-dashed border-border/80 bg-surface-2/40 p-4 text-sm text-muted-foreground">
              {loading
                ? "\u0418\u0434\u0435\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u043e\u0446\u0435\u043d\u043a\u0438. \u0422\u0430\u0439\u043c\u043b\u0430\u0439\u043d \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f, \u043a\u0430\u043a \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0440\u0435\u043f\u043b\u0438\u043a\u0438."
                : "\u0422\u0430\u0439\u043c\u043b\u0430\u0439\u043d \u043f\u0443\u0441\u0442. \u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u043f\u043e\u0442\u043e\u043a\u043e\u0432\u0443\u044e \u0437\u0430\u043f\u0438\u0441\u044c \u0438\u043b\u0438 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0440\u0430\u043d\u0441\u043a\u0440\u0438\u043f\u0442 \u0432\u0440\u0443\u0447\u043d\u0443\u044e."}
            </article>
          ) : null}

          {timeline.map((entry, idx) => {
            const isCallerEntry = entry.role === "Caller";
            const matchedEvidence = evidenceQuotes.filter((quote) => containsEither(entry.text, quote));
            const matchedFlags = isCallerEntry
              ? redFlags.filter((flag) => containsEither(entry.text, flag))
              : [];
            const matchedConcerns = isCallerEntry
              ? concernTerms.filter((term) => containsEither(entry.text, term))
              : [];
            const warningConcerns = dedupeList(
              matchedConcerns.filter((term) => !matchedFlags.some((flag) => containsEither(flag, term))),
            );
            const focusTerms = dedupeList([...matchedFlags, ...warningConcerns]);
            const matchedGuidelines = guidelines.filter((item) =>
              guidelineMatchesEntry(item, focusTerms, matchedEvidence),
            );
            const previewGuidelines = matchedGuidelines.slice(0, 2);
            const hasSources = matchedEvidence.length > 0 || matchedGuidelines.length > 0;

            const isHighlighted = focusedEntryId
              ? focusedEntryId === entry.id
              : highlightedQuote
                ? containsEither(entry.text, highlightedQuote)
                : false;
            const isLiveHighlighted = liveHighlightText ? containsEither(entry.text, liveHighlightText) : false;
            const roleLabel =
              entry.role === "Operator"
                ? "\u0414\u0438\u0441\u043f\u0435\u0442\u0447\u0435\u0440"
                : "\u0417\u0432\u043e\u043d\u044f\u0449\u0430\u044f";
            const entryActiveConcerns =
              focusedEntryId && focusedEntryId !== entry.id ? [] : activeConcerns;

            return (
              <motion.article
                key={entry.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: reduceMotion ? 0 : idx * 0.02 }}
                className={cn(
                  "rounded-xl border border-border/70 bg-surface-2/45 p-3",
                  entry.role === "Operator" ? "mr-12" : "ml-12",
                  isHighlighted && "animate-evidence border-primary/70",
                  isLiveHighlighted && "border-accent/60 bg-accent/10",
                )}
              >
                <header className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                  <span>{roleLabel}</span>
                  <div className="flex items-center gap-1.5">
                    {hasSources ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            title={`\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438: ${matchedEvidence.length + matchedGuidelines.length}`}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/45 bg-primary/15 text-primary transition hover:bg-primary/25"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[min(92vw,26rem)] p-3">
                          <div className="space-y-3">
                            <p className="text-xs font-medium text-foreground">
                              {"\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u043f\u043e \u044d\u0442\u043e\u0439 \u0440\u0435\u043f\u043b\u0438\u043a\u0435"}
                            </p>

                            {focusTerms.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {focusTerms.map((term) => (
                                  <button
                                    key={`${entry.id}-${term}`}
                                    type="button"
                                    onClick={() => onConcernClick({ terms: [term], entryId: entry.id })}
                                  >
                                    <Badge
                                      variant={
                                        matchedFlags.some((flag) => containsEither(flag, term))
                                          ? "danger"
                                          : "warning"
                                      }
                                      className="cursor-pointer"
                                    >
                                      {term}
                                    </Badge>
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            <div className="space-y-1.5">
                              <p className="text-[11px] text-muted-foreground">{"\u0418\u0437 \u0437\u0432\u043e\u043d\u043a\u0430"}</p>
                              {matchedEvidence.length ? (
                                matchedEvidence.slice(0, 3).map((quote) => (
                                  <p
                                    key={`${entry.id}-${quote}`}
                                    className="rounded-md border border-border/70 bg-surface-2/70 px-2 py-1 text-xs text-foreground/90"
                                  >
                                    &ldquo;{quote}&rdquo;
                                  </p>
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  {"\u041f\u0440\u044f\u043c\u044b\u0445 \u0446\u0438\u0442\u0430\u0442 \u0432 \u0440\u0435\u043f\u043b\u0438\u043a\u0435 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e."}
                                </p>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-[11px] text-muted-foreground">{"\u0418\u0437 \u0431\u0430\u0437\u044b \u0437\u043d\u0430\u043d\u0438\u0439"}</p>
                              {previewGuidelines.length ? (
                                previewGuidelines.map((item) => (
                                  <article
                                    key={`${entry.id}-${item.source}-${item.quote}`}
                                    className="rounded-md border border-border/70 bg-surface-2/70 px-2 py-1.5"
                                  >
                                    <p className="text-[11px] font-medium text-foreground">{item.source}</p>
                                    <p className="text-xs text-muted-foreground">&ldquo;{item.quote}&rdquo;</p>
                                  </article>
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  {"\u041f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0446\u0438\u0442\u0430\u0442\u044b \u0438\u0437 \u0431\u0430\u0437\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b."}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenSources({
                                    terms: focusTerms,
                                    evidenceQuotes: matchedEvidence,
                                  })
                                }
                                className="inline-flex h-7 items-center rounded-md border border-border/70 px-2 text-xs text-foreground transition hover:bg-surface-2"
                              >
                                {"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u043e \u0440\u0435\u043f\u043b\u0438\u043a\u0435"}
                              </button>
                              <button
                                type="button"
                                onClick={onOpenAllSources}
                                className="inline-flex h-7 items-center rounded-md border border-border/50 px-2 text-xs text-muted-foreground transition hover:bg-surface-2/70 hover:text-foreground"
                              >
                                {"\u0412\u0441\u0435 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438"}
                              </button>
                            </div>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}

                    {matchedFlags.length ? (
                      <button
                        type="button"
                        onClick={() => onRedFlagClick({ terms: matchedFlags, entryId: entry.id })}
                        title={`\u041a\u0440\u0430\u0441\u043d\u044b\u0435 \u0444\u043b\u0430\u0433\u0438: ${matchedFlags.length}`}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-danger/45 bg-danger/15 text-danger transition hover:bg-danger/25"
                      >
                        <AlertTriangle className="h-3 w-3" />
                      </button>
                    ) : null}

                    {warningConcerns.length ? (
                      <button
                        type="button"
                        onClick={() => onConcernClick({ terms: warningConcerns, entryId: entry.id })}
                        title={`\u0412\u0430\u0436\u043d\u044b\u0435 \u0441\u0438\u0433\u043d\u0430\u043b\u044b: ${warningConcerns.length}`}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-warning/45 bg-warning/15 text-warning transition hover:bg-warning/25"
                      >
                        <FlagTriangleLeft className="h-3 w-3" />
                      </button>
                    ) : null}
                    <span>{entry.time}</span>
                  </div>
                </header>

                <p className="text-sm leading-relaxed text-foreground">
                  {renderHighlightedText({
                    text: entry.text,
                    matchedConcerns,
                    redFlags,
                    activeConcerns: entryActiveConcerns,
                    onConcernClick: (term) => onConcernClick({ terms: [term], entryId: entry.id }),
                  })}
                </p>
              </motion.article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
