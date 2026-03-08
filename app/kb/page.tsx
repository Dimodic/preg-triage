"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, BookOpen, FileText, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/contexts/app-store";

type KBItem = {
  source: string;
  quote: string;
  why: string;
  file_id?: string;
  score?: number;
};

const initialResults: KBItem[] = [
  {
    source: "Протокол акушерской диспетчеризации v2.4",
    quote: "Сначала оцените кровотечение, интервал схваток, шевеления плода и состояние матери.",
    why: "Базовая последовательность первичной сортировки для экстренных акушерских вызовов.",
    file_id: "OB-DISP-2.4",
    score: 0.74,
  },
  {
    source: "Экстренная карта телефонной сортировки при беременности",
    quote: "Подозрение на разрыв плодных оболочек при регулярных схватках требует срочной оценки.",
    why: "Используется в логике эскалации для срочности 2+.",
    file_id: "EPTC-17",
    score: 0.68,
  },
];

const quickQueries = [
  "кровотечение и схватки",
  "снижение шевелений плода",
  "головная боль и давление",
  "послеродовое ухудшение",
];

const scoreVariant = (value?: number): "success" | "warning" | "secondary" => {
  if (typeof value !== "number") return "secondary";
  if (value >= 0.75) return "success";
  if (value >= 0.5) return "warning";
  return "secondary";
};

export default function KbPage() {
  const { settings } = useAppStore();
  const [query, setQuery] = useState("кровотечение и схватки");
  const [results, setResults] = useState<KBItem[]>(initialResults);
  const [loading, setLoading] = useState(false);

  const searchKb = useCallback(async (queryValue: string) => {
    setLoading(true);
    try {
      const endpoint = settings.kbEndpoint.trim() || "/api/kb-search";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryValue.trim() }),
      });

      const json = (await response.json()) as { items?: KBItem[]; error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Ошибка поиска по базе знаний");
      }

      setResults(json.items ?? []);
      toast.success("Результаты поиска обновлены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка запроса к базе знаний");
    } finally {
      setLoading(false);
    }
  }, [settings.kbEndpoint]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const queryFromUrl = new URLSearchParams(window.location.search).get("query")?.trim();
    if (!queryFromUrl) return;
    setQuery(queryFromUrl);
    void searchKb(queryFromUrl);
  }, [searchKb]);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [results]);

  const stats = useMemo(() => {
    const withScore = sortedResults.filter((item) => typeof item.score === "number");
    const averageScore = withScore.length
      ? Math.round((withScore.reduce((acc, item) => acc + (item.score ?? 0), 0) / withScore.length) * 100)
      : 0;

    const strongMatches = withScore.filter((item) => (item.score ?? 0) >= 0.7).length;
    const withSourceId = sortedResults.filter((item) => Boolean(item.file_id)).length;

    return {
      total: sortedResults.length,
      averageScore,
      strongMatches,
      withSourceId,
    };
  }, [sortedResults]);

  const sourceCoverage = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of sortedResults) {
      const key = item.file_id?.trim() || "Не указан";
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"))
      .slice(0, 8);
  }, [sortedResults]);

  const runSearch = useCallback(() => {
    const normalized = query.trim();
    if (!normalized) {
      toast.warning("Введите поисковую формулировку");
      return;
    }
    void searchKb(normalized);
  }, [query, searchKb]);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-[1.65fr_1fr]">
        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/15 via-surface-2 to-surface-1">
          <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl tracking-tight">
              <BookOpen className="h-5 w-5" />
              Поиск по базе знаний
            </CardTitle>
            <CardDescription className="max-w-3xl text-muted-foreground">
              Экран проверки подтверждений: система показывает релевантные фрагменты, источник и пояснение,
              почему цитата попала в выдачу.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="Например: кровотечение и схватки каждые 3 минуты"
                className="sm:flex-1"
              />
              <Button onClick={runSearch} disabled={loading} className="gap-2">
                <Search className="h-4 w-4" />
                {loading ? "Поиск..." : "Найти"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {quickQueries.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    setQuery(value);
                    void searchKb(value);
                  }}
                >
                  {value}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Сводка выдачи
            </CardTitle>
            <CardDescription>Метрики текущего запроса.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <article className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
              <p className="text-xs text-muted-foreground">Всего фрагментов</p>
              <p className="mt-1 text-xl font-semibold">{stats.total}</p>
            </article>
            <article className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
              <p className="text-xs text-muted-foreground">Средняя релевантность</p>
              <p className="mt-1 text-xl font-semibold">{stats.averageScore}%</p>
            </article>
            <article className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
              <p className="text-xs text-muted-foreground">Сильные совпадения</p>
              <p className="mt-1 text-xl font-semibold">{stats.strongMatches}</p>
            </article>
            <article className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
              <p className="text-xs text-muted-foreground">С явным источником</p>
              <p className="mt-1 text-xl font-semibold">{stats.withSourceId}</p>
            </article>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-3">
          {sortedResults.length ? (
            sortedResults.map((item) => (
              <Card key={`${item.source}-${item.quote}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-start justify-between gap-2 text-base">
                    <span className="max-w-[72%]">{item.source}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={scoreVariant(item.score)}>
                        {typeof item.score === "number"
                          ? `релевантность ${(item.score * 100).toFixed(0)}%`
                          : "релевантность не оценена"}
                      </Badge>
                      {item.file_id ? <Badge variant="outline">{item.file_id}</Badge> : null}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
                    <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Цитата из источника
                    </p>
                    <p className="text-muted-foreground">“{item.quote}”</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-surface-2/45 p-2.5">
                    <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      Причина попадания в выдачу
                    </p>
                    <p>{item.why}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                Источники не найдены. Уточните формулировку запроса или расширьте базу знаний.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Как читать выдачу
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Сначала смотрите релевантность и источник.</p>
              <p>2. Затем проверяйте, совпадает ли цитата с текущим разговором.</p>
              <p>3. После этого используйте пояснение для решения о доуточнении.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Покрытие источников
              </CardTitle>
              <CardDescription>Какие документы чаще попадают в текущую выдачу.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {sourceCoverage.length ? (
                sourceCoverage.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-2/45 p-2">
                    <span className="truncate pr-2">{row.label}</span>
                    <Badge variant="secondary">{row.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Нет данных по покрытиям источников.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
