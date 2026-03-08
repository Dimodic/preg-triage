"use client";

import { useMemo } from "react";
import { CheckSquare, ClipboardCopy, Copy, FileText, ListChecks, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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
  onRedFlagClick: (redFlag: string) => void;
  onConcernSelect: (terms: string[]) => void;
};

type ConcernInsight = {
  term: string;
  isRedFlag: boolean;
  guideline:
    | {
        source: string;
        quote: string;
        why: string;
      }
    | null;
};

type ConcernGroup = {
  id: string;
  terms: string[];
  isRedFlag: boolean;
  guideline: {
    source: string;
    quote: string;
    why: string;
  };
};

const placeholder = (
  <>
    <Skeleton className="h-52" />
    <Skeleton className="h-40" />
    <Skeleton className="h-48" />
    <Skeleton className="h-44" />
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

const compareByPriority = (a: ConcernInsight, b: ConcernInsight) => {
  const score = (item: ConcernInsight) => (item.isRedFlag ? 100 : 0) + (item.guideline ? 10 : 0);
  const diff = score(b) - score(a);
  if (diff !== 0) return diff;
  return a.term.localeCompare(b.term, "ru");
};

const compareGroups = (a: ConcernGroup, b: ConcernGroup) => {
  const score = (item: ConcernGroup) => (item.isRedFlag ? 100 : 0) + Math.min(item.terms.length, 5);
  const diff = score(b) - score(a);
  if (diff !== 0) return diff;
  return a.terms[0].localeCompare(b.terms[0], "ru");
};

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

const anomalyVariant = {
  info: "secondary",
  moderate: "warning",
  high: "warning",
  critical: "danger",
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
  onRedFlagClick,
  onConcernSelect,
}: RightActionStackProps) {
  const concernInsights = useMemo<ConcernInsight[]>(() => {
    if (!payload) return [];

    const uniqueTerms = dedupeConcernTerms(concernTerms).slice(0, 14);
    return uniqueTerms
      .map((term) => {
        const isRedFlag = payload.triage.red_flags.some((flag) => containsEither(flag, term));
        const guideline =
          payload.rag.guidelines.find(
            (item) => containsEither(item.quote, term) || containsEither(item.why, term),
          ) ?? null;

        return {
          term,
          isRedFlag,
          guideline: guideline
            ? {
                source: guideline.source,
                quote: guideline.quote,
                why: guideline.why,
              }
            : null,
        };
      })
      .sort(compareByPriority);
  }, [concernTerms, payload]);

  const groupedSignals = useMemo<ConcernGroup[]>(() => {
    const map = new Map<string, ConcernGroup>();

    concernInsights.forEach((item) => {
      if (!item.guideline) return;

      const id = `${item.guideline.source}|||${item.guideline.quote}|||${item.guideline.why}`;
      const existing = map.get(id);

      if (!existing) {
        map.set(id, {
          id,
          terms: [item.term],
          isRedFlag: item.isRedFlag,
          guideline: item.guideline,
        });
        return;
      }

      existing.isRedFlag = existing.isRedFlag || item.isRedFlag;

      const duplicate = existing.terms.some((term) => isNearDuplicate(normalizeTerm(term), normalizeTerm(item.term)));
      if (!duplicate) {
        existing.terms.push(item.term);
      }
    });

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        terms: dedupeConcernTerms(group.terms),
      }))
      .sort(compareGroups);
  }, [concernInsights]);

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
          После первого обновления оценки здесь появятся срочность, безопасность, ключевые сигналы,
          вопросы и скрипт.
        </CardContent>
      </Card>
    );
  }

  const withGuideline = groupedSignals;
  const tagsOnly = concernInsights.filter((item) => !item.guideline);
  const insufficientContext =
    payload.qc.needs_clarification.length > 0 &&
    (payload.triage.confidence < 0.65 || payload.qc.missing_evidence.length > 0);
  const normalizedLimitations = payload.triage.limitations.trim();
  const showLimitations =
    normalizedLimitations.length > 0 &&
    normalizedLimitations.toLowerCase() !== "ограничения не были явно возвращены системой.";

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
              Объективная поддержка решения
            </span>
            <Badge variant={riskVariant[payload.risk_level]}>{RISK_LABELS[payload.risk_level]} риск</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={consistencyVariant[payload.consistency_status]}>
              {CONSISTENCY_LABELS[payload.consistency_status]}
            </Badge>
            <Badge variant={payload.recommended_route === "dispatch_now" ? "danger" : payload.recommended_route === "urgent_ob_review" ? "warning" : "secondary"}>
              {routeLabel(payload.recommended_route)}
            </Badge>
            <Badge variant={payload.doctor_review.status === "pending" ? "outline" : "success"}>
              Врачебный review: {payload.doctor_review.status === "pending" ? "ожидается" : payload.doctor_review.status}
            </Badge>
          </div>

          {payload.evidence.vitals_summary.length ? (
            <div className="rounded-lg border border-border/70 bg-surface-2/45 p-2">
              <p className="mb-1 text-xs text-muted-foreground">Введенные показатели</p>
              <div className="flex flex-wrap gap-1.5">
                {payload.evidence.vitals_summary.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 bg-surface-2/35 p-2 text-muted-foreground">
              Домашние показатели не переданы или недостаточны для объективной сверки.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Аномалии и расхождения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payload.anomalies.length ? (
            payload.anomalies.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/70 bg-surface-2/45 p-2">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={anomalyVariant[item.severity]}>{item.label}</Badge>
                  <Badge variant="outline">{item.value || item.status}</Badge>
                </div>
                <p className="text-sm">{item.reason}</p>
                {item.evidence.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">{item.evidence.join(" • ")}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 bg-surface-2/35 p-2 text-sm text-muted-foreground">
              Явных аномалий по переданным домашним показателям не обнаружено.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Черновик для врача
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="rounded-lg border border-border/70 bg-surface-2/45 p-2">
            <p className="mb-1 text-xs text-muted-foreground">Объективная сводка</p>
            <p>{payload.doctor_draft.objective_summary || "Объективная сводка пока не сформирована."}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-surface-2/45 p-2">
            <p className="mb-1 text-xs text-muted-foreground">Черновое заключение</p>
            <p>{payload.doctor_draft.conclusion || "Черновое заключение отсутствует."}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-surface-2/45 p-2">
            <p className="mb-1 text-xs text-muted-foreground">Неопределенность</p>
            <p>{payload.doctor_draft.uncertainty || "Не указана."}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Почему выбрана эта оценка
            </span>
            <Badge variant={insufficientContext ? "warning" : "secondary"}>
              {insufficientContext ? "Нужны уточнения" : "Контекст достаточный"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="rounded-lg border border-border/70 bg-surface-2/45 p-2">
            <p className="mb-1 text-xs text-muted-foreground">Основная причина</p>
            <p>{payload.triage.primary_reason || "Причина не указана."}</p>
          </div>

          {showLimitations ? (
            <div className="rounded-lg border border-border/70 bg-surface-2/45 p-2">
              <p className="mb-1 text-xs text-muted-foreground">Ограничения текущей оценки</p>
              <p>{normalizedLimitations}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Ключевые сигналы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {withGuideline.length ? (
            withGuideline.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onConcernSelect(item.terms)}
                className={cn(
                  "w-full rounded-lg border p-2 text-left transition hover:bg-surface-2/80",
                  activeConcerns.some((activeTerm) =>
                    item.terms.some((term) => containsEither(activeTerm, term)),
                  )
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/70 bg-surface-2/50",
                )}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {item.terms.slice(0, 4).map((term) => (
                    <Badge key={`${item.id}-${term}`} variant={item.isRedFlag ? "danger" : "warning"}>
                      {term}
                    </Badge>
                  ))}
                  {item.terms.length > 4 ? (
                    <Badge variant="outline">+{item.terms.length - 4}</Badge>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground">{item.guideline.source}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.guideline.why}</p>
                {item.guideline.quote ? (
                  <p className="mt-1 text-xs text-foreground/90">&ldquo;{item.guideline.quote}&rdquo;</p>
                ) : null}
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Пока нет сигналов с подтверждённым пояснением.</p>
          )}

          {tagsOnly.length ? (
            <div className="rounded-lg border border-border/70 bg-surface-2/35 p-2">
              <p className="mb-2 text-xs text-muted-foreground">Ещё сигналы</p>
              <div className="flex flex-wrap gap-1.5">
                {tagsOnly.map((item) => (
                  <button key={item.term} type="button" onClick={() => onConcernSelect([item.term])}>
                    <Badge
                      variant={item.isRedFlag ? "danger" : "warning"}
                      className={cn(
                        "cursor-pointer",
                        activeConcerns.some((activeTerm) => containsEither(activeTerm, item.term)) &&
                          "ring-1 ring-ring",
                      )}
                    >
                      {item.term}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Следующие вопросы
            </span>
            <Button size="sm" variant="ghost" onClick={onCopyQuestions} className="h-7 px-2 text-xs">
              <ClipboardCopy className="h-3.5 w-3.5" />
              Копировать все
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
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
            <p className="rounded-lg border border-dashed border-border/70 bg-surface-2/35 p-2 text-sm text-muted-foreground">
              Система не вернула уточняющие вопросы. Проверьте технические данные и ход обработки.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Скрипт оператора
            </span>
            <Button size="sm" variant="ghost" onClick={onCopyScript} className="h-7 px-2 text-xs">
              <Copy className="h-3.5 w-3.5" />
              Копировать
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {payload.triage.operator_script.length ? (
            payload.triage.operator_script.map((line) => (
              <button
                key={line}
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(line);
                  toast.success("Строка скрипта скопирована");
                }}
                className="w-full rounded-lg border border-border/70 bg-surface-2/50 p-2 text-left text-sm transition hover:bg-surface-2"
              >
                {line}
              </button>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 bg-surface-2/35 p-2 text-sm text-muted-foreground">
              Скрипт пока пуст. Проверьте ответ системы и блок контроля безопасности.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Красные флаги</span>
            <Button size="sm" variant="ghost" onClick={onCopySummary} className="h-7 px-2 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Сводка в один клик
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {payload.triage.red_flags.length ? (
            payload.triage.red_flags.map((flag) => (
              <button key={flag} type="button" onClick={() => onRedFlagClick(flag)}>
                <Badge variant="danger" className="cursor-pointer hover:bg-danger/30">
                  {flag}
                </Badge>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Красные флаги не выявлены.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
