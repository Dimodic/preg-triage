"use client";

import { useMemo } from "react";
import { CheckSquare, ChevronDown, ClipboardCopy, Copy, FileText, ListChecks, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { UrgencyDial } from "@/components/triage/urgency-dial";
import { SafetyGate } from "@/components/triage/safety-gate";
import { CONSISTENCY_LABELS, RISK_LABELS, routeLabel } from "@/lib/maternal-support";
import { containsEither } from "@/lib/text-match";
import type { TriagePayload } from "@/lib/types";
import { cn } from "@/lib/utils";

type RightActionStackProps = {
  payload: TriagePayload | null;
  loading: boolean;
  concernTerms: string[];
  activeConcerns: string[];
  questionChecks: Record<string, boolean>;
  onQuestionToggle: (question: string) => void;
  onCopyQuestions: () => void;
  onCopyScript: () => void;
  onCopySummary: () => void;
  onConcernSelect: (terms: string[]) => void;
};

type CompactSignal = {
  id: string;
  label: string;
  meta?: string;
  priority: number;
  variant: "danger" | "warning";
  terms: string[];
};

const placeholder = (
  <>
    <Skeleton className="h-52" />
    <Skeleton className="h-36" />
    <Skeleton className="h-24" />
    <Skeleton className="h-24" />
  </>
);

const normalizeTerm = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const isNearDuplicate = (a: string, b: string) => a === b || a.includes(b) || b.includes(a);

const dedupeConcernTerms = (terms: string[]) => {
  const result: Array<{ label: string; normalized: string }> = [];

  for (const rawTerm of terms) {
    const label = rawTerm.trim();
    const normalized = normalizeTerm(label);
    if (!label || normalized.length < 3) continue;

    const existingIndex = result.findIndex((item) => isNearDuplicate(item.normalized, normalized));
    if (existingIndex === -1) {
      result.push({ label, normalized });
      continue;
    }

    if (label.length > result[existingIndex].label.length) {
      result[existingIndex] = { label, normalized };
    }
  }

  return result.map((item) => item.label);
};

const truncateText = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
};

const signalPriority = {
  info: 1,
  moderate: 2,
  high: 3,
  critical: 4,
} as const;

const riskVariant = {
  low: "secondary",
  moderate: "warning",
  high: "warning",
  critical: "danger",
} as const;

const consistencyVariant = {
  match: "success",
  mismatch: "danger",
  not_enough_data: "warning",
} as const;

export function RightActionStack({
  payload,
  loading,
  concernTerms,
  activeConcerns,
  questionChecks,
  onQuestionToggle,
  onCopyQuestions,
  onCopyScript,
  onCopySummary,
  onConcernSelect,
}: RightActionStackProps) {
  const compactSignals = useMemo<CompactSignal[]>(() => {
    if (!payload) return [];

    const signals: CompactSignal[] = [
      ...payload.triage.red_flags.map((flag) => ({
        id: `flag-${flag}`,
        label: flag,
        priority: 5,
        variant: "danger" as const,
        terms: [flag],
      })),
      ...payload.anomalies.map((item) => ({
        id: `anomaly-${item.id}`,
        label: item.label,
        meta: item.value || undefined,
        priority: signalPriority[item.severity],
        variant:
          item.severity === "critical" || item.severity === "high"
            ? ("danger" as const)
            : ("warning" as const),
        terms: [item.label, item.value].filter(Boolean) as string[],
      })),
      ...dedupeConcernTerms(concernTerms)
        .slice(0, 8)
        .map((term) => ({
          id: `term-${term}`,
          label: term,
          priority: 1,
          variant: payload.triage.red_flags.some((flag) => containsEither(flag, term))
            ? ("danger" as const)
            : ("warning" as const),
          terms: [term],
        })),
    ].sort((a, b) => {
      const diff = b.priority - a.priority;
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, "ru");
    });

    const deduped: CompactSignal[] = [];

    for (const signal of signals) {
      const normalizedLabel = normalizeTerm(signal.label);
      const existing = deduped.find((item) =>
        isNearDuplicate(normalizeTerm(item.label), normalizedLabel) ||
        item.terms.some((term) =>
          signal.terms.some((candidate) => isNearDuplicate(normalizeTerm(term), normalizeTerm(candidate))),
        ),
      );

      if (!existing) {
        deduped.push({
          ...signal,
          terms: dedupeConcernTerms(signal.terms),
        });
        continue;
      }

      const nextPriority = Math.max(existing.priority, signal.priority);
      if (signal.priority > existing.priority) {
        existing.label = signal.label;
      }

      existing.priority = nextPriority;
      existing.meta = existing.meta || signal.meta;
      existing.variant = existing.variant === "danger" || signal.variant === "danger" ? "danger" : "warning";
      existing.terms = dedupeConcernTerms([...existing.terms, ...signal.terms, signal.label]);
    }

    return deduped;
  }, [concernTerms, payload]);

  const summaryFacts = useMemo(() => {
    if (!payload) return [];

    const facts = payload.evidence.vitals_summary.length
      ? payload.evidence.vitals_summary
      : payload.operator_card.key_facts.filter(
          (fact) =>
            !/^(Срочность|Немедленный выезд|Уверенность|Риск:|Согласованность:|Маршрут:)/u.test(fact),
        );

    return facts.slice(0, 4);
  }, [payload]);

  if (!payload && loading) {
    return <div className="space-y-3">{placeholder}</div>;
  }

  if (!payload) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Панель оператора</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          После первого обновления оценки здесь появятся срочность, безопасность, короткая сводка и действия.
        </CardContent>
      </Card>
    );
  }

  const visibleSignals = compactSignals.slice(0, 4);
  const insufficientContext =
    payload.qc.needs_clarification.length > 0 &&
    (payload.triage.confidence < 0.65 || payload.qc.missing_evidence.length > 0);
  const normalizedLimitations = payload.triage.limitations.trim();
  const showLimitations =
    normalizedLimitations.length > 0 &&
    normalizedLimitations.toLowerCase() !== "ограничения не были явно возвращены системой.";
  const summaryText = truncateText(payload.operator_card.summary || payload.triage.primary_reason, 180);
  const hasActions = payload.triage.next_questions.length > 0 || payload.triage.operator_script.length > 0;

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex justify-end">
          <Badge variant="warning" className="gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Обновление оценки...
          </Badge>
        </div>
      ) : null}

      <UrgencyDial
        urgency={payload.triage.urgency}
        confidence={payload.triage.confidence}
        dispatchNow={payload.triage.dispatch_now}
        insufficientContext={insufficientContext}
      />

      <SafetyGate qc={payload.qc} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Короткая сводка
            </span>
            <Button size="sm" variant="ghost" onClick={onCopySummary} className="h-7 px-2 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Сводка
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={riskVariant[payload.risk_level]}>{RISK_LABELS[payload.risk_level]} риск</Badge>
            <Badge
              variant={
                payload.recommended_route === "dispatch_now"
                  ? "danger"
                  : payload.recommended_route === "urgent_ob_review"
                    ? "warning"
                    : "secondary"
              }
            >
              {routeLabel(payload.recommended_route)}
            </Badge>
            <Badge variant={consistencyVariant[payload.consistency_status]}>
              {CONSISTENCY_LABELS[payload.consistency_status]}
            </Badge>
          </div>

          {summaryText ? (
            <p className="rounded-lg border border-border/70 bg-surface-2/45 p-3">{summaryText}</p>
          ) : null}

          {summaryFacts.length ? (
            <div className="flex flex-wrap gap-1.5">
              {summaryFacts.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}

          {showLimitations && insufficientContext ? (
            <p className="text-xs text-muted-foreground">{truncateText(normalizedLimitations, 140)}</p>
          ) : null}
        </CardContent>
      </Card>

      {visibleSignals.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Критичные сигналы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleSignals.map((item) => {
              const isActive = activeConcerns.some((activeTerm) =>
                item.terms.some((term) => containsEither(activeTerm, term) || containsEither(term, activeTerm)),
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onConcernSelect(item.terms)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-lg border p-2 text-left transition hover:bg-surface-2/80",
                    isActive ? "border-primary/60 bg-primary/10" : "border-border/70 bg-surface-2/50",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <Badge variant={item.variant}>{item.label}</Badge>
                    {item.meta ? <p className="text-xs text-muted-foreground">{item.meta}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">в таймлайн</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {hasActions ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Действия сейчас
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <details className="group rounded-lg border border-border/70 bg-surface-2/35">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Уточнить</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {payload.triage.next_questions[0] || "Уточняющих вопросов нет"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{payload.triage.next_questions.length}</Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                </div>
              </summary>

              <div className="space-y-2 border-t border-border/60 p-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={onCopyQuestions} className="h-7 px-2 text-xs">
                    <ClipboardCopy className="h-3.5 w-3.5" />
                    Копировать все
                  </Button>
                </div>

                {payload.triage.next_questions.length ? (
                  payload.triage.next_questions.map((question) => (
                    <label
                      key={question}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-surface-2/50 p-2"
                    >
                      <Checkbox
                        checked={Boolean(questionChecks[question])}
                        onCheckedChange={() => onQuestionToggle(question)}
                        className="mt-0.5"
                      />
                      <span className="text-sm">{question}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Система не вернула уточняющих вопросов.</p>
                )}
              </div>
            </details>

            <details className="group rounded-lg border border-border/70 bg-surface-2/35">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Сказать пациентке</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {payload.triage.operator_script[0] || "Скрипт пока пуст"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{payload.triage.operator_script.length}</Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                </div>
              </summary>

              <div className="space-y-2 border-t border-border/60 p-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={onCopyScript} className="h-7 px-2 text-xs">
                    <Copy className="h-3.5 w-3.5" />
                    Копировать
                  </Button>
                </div>

                {payload.triage.operator_script.length ? (
                  payload.triage.operator_script.map((line) => (
                    <div
                      key={line}
                      className="rounded-lg border border-border/70 bg-surface-2/50 p-2 text-sm"
                    >
                      {line}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Скрипт пока пуст. Проверьте ответ системы и блок контроля безопасности.
                  </p>
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
