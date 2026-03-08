"use client";

import { useMemo, useState } from "react";
import { CasesTable } from "@/components/cases/cases-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/contexts/app-store";
import type { UrgencyLevel } from "@/lib/types";

const urgencyFilters: Array<{ label: string; value: "all" | UrgencyLevel }> = [
  { label: "Все", value: "all" },
  { label: "Уровень 0", value: 0 },
  { label: "Уровень 1", value: 1 },
  { label: "Уровень 2", value: 2 },
  { label: "Уровень 3", value: 3 },
];

export default function CasesPage() {
  const { cases, ready } = useAppStore();
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState<"all" | UrgencyLevel>("all");

  const filtered = useMemo(() => {
    return cases.filter((record) => {
      const matchesQuery = record.payload.call_id.toLowerCase().includes(query.trim().toLowerCase());
      const matchesUrgency = urgency === "all" ? true : record.payload.triage.urgency === urgency;
      return matchesQuery && matchesUrgency;
    });
  }, [cases, query, urgency]);

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Загрузка локальных обращений...</p>;
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">История обращений</h1>
          <p className="text-sm text-muted-foreground">Сохраненные сессии обработки звонков из локального хранилища браузера (до 50).</p>
        </div>

        <Badge variant="secondary">Сохранено: {cases.length}</Badge>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            placeholder="Поиск по номеру вызова..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            {urgencyFilters.map((item) => (
              <Button
                key={item.label}
                size="sm"
                variant={urgency === item.value ? "default" : "secondary"}
                onClick={() => setUrgency(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {filtered.length ? (
        <CasesTable cases={filtered} />
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Нет обращений, подходящих под текущие фильтры.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
