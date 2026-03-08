"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Eraser,
  ShieldAlert,
  Siren,
} from "lucide-react";
import { useAppStore } from "@/contexts/app-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CounterRow = {
  label: string;
  count: number;
};

const formatRatio = (numerator: number, denominator: number) => {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
};

const buildTopRows = (items: string[], limit = 8): CounterRow[] => {
  const counts = new Map<string, number>();

  for (const item of items) {
    const normalized = item.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"))
    .slice(0, limit);
};

export default function QualityPage() {
  const { runAudits, clearRunAudits } = useAppStore();

  const metrics = useMemo(() => {
    const successEvents = runAudits.filter((item) => item.status === "success");
    const errorEvents = runAudits.filter((item) => item.status === "error");

    const urgentCount = successEvents.filter((item) => (item.urgency ?? 0) >= 2).length;
    const unsafeCount = successEvents.filter((item) => item.is_safe === false).length;
    const evidenceGapCount = successEvents.filter((item) => item.missing_evidence_count > 0).length;

    const confidenceValues = successEvents
      .map((item) => item.confidence)
      .filter((value): value is number => typeof value === "number");
    const avgConfidence = confidenceValues.length
      ? Math.round((confidenceValues.reduce((acc, value) => acc + value, 0) / confidenceValues.length) * 100)
      : 0;

    const clarificationAvg = successEvents.length
      ? (successEvents.reduce((acc, item) => acc + item.clarification_count, 0) / successEvents.length).toFixed(2)
      : "0.00";

    const topRedFlags = buildTopRows(successEvents.flatMap((item) => item.red_flags));
    const topClarifications = buildTopRows(successEvents.flatMap((item) => item.needs_clarification));

    const riskCases = runAudits
      .filter(
        (item) =>
          item.status === "error" ||
          (item.urgency ?? 0) >= 2 ||
          item.is_safe === false ||
          item.clarification_count > 0,
      )
      .slice(0, 12);

    return {
      total: runAudits.length,
      errors: errorEvents.length,
      urgentRate: formatRatio(urgentCount, successEvents.length),
      unsafeRate: formatRatio(unsafeCount, successEvents.length),
      evidenceGapRate: formatRatio(evidenceGapCount, successEvents.length),
      clarificationAvg,
      avgConfidence,
      topRedFlags,
      topClarifications,
      riskCases,
    };
  }, [runAudits]);

  const statCards = [
    {
      label: "Срочные случаи",
      value: metrics.urgentRate,
      icon: Siren,
      tone: "text-danger",
    },
    {
      label: "Небезопасные ответы",
      value: metrics.unsafeRate,
      icon: ShieldAlert,
      tone: "text-warning",
    },
    {
      label: "Пробелы в подтверждениях",
      value: metrics.evidenceGapRate,
      icon: AlertTriangle,
      tone: "text-warning",
    },
    {
      label: "Нагрузка доуточнений",
      value: metrics.clarificationAvg,
      icon: Activity,
      tone: "text-primary",
    },
    {
      label: "Средняя уверенность",
      value: `${metrics.avgConfidence}%`,
      icon: Clock3,
      tone: "text-success",
    },
    {
      label: "Ошибки запуска",
      value: String(metrics.errors),
      icon: BarChart3,
      tone: "text-muted-foreground",
    },
  ] as const;

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Качество</h1>
          <p className="text-sm text-muted-foreground">Оперативные метрики по запускам первичной сортировки.</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">Событий: {metrics.total}</Badge>
          <Button variant="outline" onClick={clearRunAudits} disabled={!metrics.total} className="gap-2">
            <Eraser className="h-4 w-4" />
            Очистить
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-start justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-3xl font-semibold leading-none">{item.value}</p>
                </div>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2/80 ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Siren className="h-4 w-4 text-danger" />
              Частые красные флаги
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {metrics.topRedFlags.length ? (
              metrics.topRedFlags.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-2/50 p-2">
                  <span className="truncate pr-2">{item.label}</span>
                  <Badge variant="danger">{item.count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Пока нет данных.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-warning" />
              Частые пункты доуточнения
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {metrics.topClarifications.length ? (
              metrics.topClarifications.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-2/50 p-2">
                  <span className="truncate pr-2">{item.label}</span>
                  <Badge variant="warning">{item.count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Пока нет данных.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Последние риск-ситуации
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.riskCases.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время</TableHead>
                  <TableHead>Номер вызова</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Срочность</TableHead>
                  <TableHead>Сигнал</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.riskCases.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{item.call_id}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "success" ? "warning" : "danger"}>
                        {item.status === "success" ? "Риск" : "Ошибка"}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.urgency ?? "-"}</TableCell>
                    <TableCell className="max-w-[420px] truncate">
                      {item.error || item.needs_clarification[0] || "Повышенный риск"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-surface-2/35 p-4 text-sm text-muted-foreground">
              Риск-ситуаций пока нет.
              <div className="mt-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/triage">Открыть рабочий экран</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
