"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Binary, ExternalLink, ShieldCheck, TextSearch } from "lucide-react";
import { useAppStore } from "@/contexts/app-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TraceDrawer } from "@/components/triage/trace-drawer";
import { CONSISTENCY_LABELS, RISK_LABELS, routeLabel } from "@/lib/maternal-support";

type CaseDetailClientProps = {
  caseId: string;
};

export function CaseDetailClient({ caseId }: CaseDetailClientProps) {
  const { ready, getCaseById } = useAppStore();
  const [traceOpen, setTraceOpen] = useState(false);
  const record = getCaseById(caseId);

  const payload = record?.payload;

  const json = useMemo(() => JSON.stringify(payload ?? {}, null, 2), [payload]);

  if (!ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка обращения</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Читаем локальную историю обращений...</p>
        </CardContent>
      </Card>
    );
  }

  if (!record || !payload) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Обращение не найдено</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Сначала откройте обращение из истории.</p>
          <Button asChild className="mt-4">
            <Link href="/cases">К списку обращений</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{payload.call_id}</h1>
          <Badge variant={payload.qc.is_safe ? "success" : "danger"}>
            {payload.qc.is_safe ? "БЕЗОПАСНО" : "НЕБЕЗОПАСНО"}
          </Badge>
          <Badge variant="secondary">Срочность {payload.triage.urgency}</Badge>
          <Badge variant={payload.risk_level === "critical" ? "danger" : payload.risk_level === "high" || payload.risk_level === "moderate" ? "warning" : "secondary"}>
            Риск {RISK_LABELS[payload.risk_level]}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTraceOpen(true)} className="gap-2">
            <Binary className="h-4 w-4" />
            Открыть ход обработки
          </Button>
          <Button asChild variant="ghost" className="gap-2">
            <Link href="/triage">
              Открыть рабочий экран
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="operator">
        <TabsList>
          <TabsTrigger value="operator">Экран оператора</TabsTrigger>
          <TabsTrigger value="evidence">Источники</TabsTrigger>
          <TabsTrigger value="raw">Технические данные</TabsTrigger>
        </TabsList>

        <TabsContent value="operator" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Объективная поддержка решения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant={payload.consistency_status === "match" ? "success" : payload.consistency_status === "mismatch" ? "danger" : "warning"}>
                  {CONSISTENCY_LABELS[payload.consistency_status]}
                </Badge>
                <Badge variant={payload.recommended_route === "dispatch_now" ? "danger" : payload.recommended_route === "urgent_ob_review" ? "warning" : "secondary"}>
                  {routeLabel(payload.recommended_route)}
                </Badge>
                <Badge variant={payload.doctor_review.status === "pending" ? "outline" : "success"}>
                  review: {payload.doctor_review.status}
                </Badge>
              </div>

              {payload.evidence.vitals_summary.length ? (
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Домашние показатели</p>
                  <ul className="space-y-1">
                    {payload.evidence.vitals_summary.map((fact) => (
                      <li key={fact}>• {fact}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {payload.anomalies.length ? (
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Аномалии</p>
                  <ul className="space-y-1">
                    {payload.anomalies.map((item) => (
                      <li key={item.id}>
                        • {item.label}: {item.value || item.status}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{payload.operator_card.title || "Карточка оператора"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className={payload.operator_card.summary ? "text-foreground" : "text-muted-foreground"}>
                {payload.operator_card.summary || "Сводка не сформирована. Откройте технические данные и ход обработки."}
              </p>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Ключевые факты</p>
                <ul className="space-y-1">
                  {payload.operator_card.key_facts.length ? (
                    payload.operator_card.key_facts.map((fact) => <li key={fact}>• {fact}</li>)
                  ) : (
                    <li className="text-muted-foreground">Нет структурированных фактов в ответе.</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Черновик для врача</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{payload.doctor_draft.objective_summary || "Сводка отсутствует."}</p>
              <p className="text-muted-foreground">{payload.doctor_draft.conclusion || "Заключение отсутствует."}</p>
              <p className="text-xs text-muted-foreground">{payload.doctor_draft.uncertainty}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Скрипт оператора
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {payload.triage.operator_script.length ? (
                payload.triage.operator_script.map((line) => (
                  <p key={line} className="rounded-lg border border-border bg-surface-2/70 p-2 text-sm">
                    {line}
                  </p>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-surface-2/40 p-2 text-sm text-muted-foreground">
                  Скрипт не был сформирован, откройте технические данные и ход обработки для диагностики.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Домашние показатели</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {payload.evidence.vitals_summary.length ? (
                payload.evidence.vitals_summary.map((item) => (
                  <p key={item} className="rounded-lg border border-border bg-surface-2/70 p-2">
                    {item}
                  </p>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-surface-2/40 p-2 text-muted-foreground">
                  Домашние показатели не были сохранены в этом кейсе.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TextSearch className="h-4 w-4" />
                Цитаты из звонка
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {payload.triage.evidence_quotes.length ? (
                payload.triage.evidence_quotes.map((quote) => (
                  <p key={quote} className="rounded-lg border border-border bg-surface-2/70 p-2">
                    “{quote}”
                  </p>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-surface-2/40 p-2 text-muted-foreground">
                  Цитаты не найдены в сохраненном ответе.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Рекомендации</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {payload.rag.guidelines.length ? (
                payload.rag.guidelines.map((item) => (
                  <article key={`${item.source}-${item.quote}`} className="rounded-lg border border-border bg-surface-2/70 p-2">
                    <p className="font-medium">{item.source}</p>
                    <p className="text-muted-foreground">“{item.quote}”</p>
                    <p className="text-xs">Почему: {item.why}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-surface-2/40 p-2 text-muted-foreground">
                  Рекомендации отсутствуют. Проверьте настройки поиска источников в системе.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle>Технические данные результата</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[560px] overflow-auto rounded-xl border border-border bg-background/50 p-3 text-xs">
                {json}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TraceDrawer open={traceOpen} onOpenChange={setTraceOpen} trace={payload.trace ?? []} />
    </div>
  );
}
