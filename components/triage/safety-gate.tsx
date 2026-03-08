import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TriagePayload } from "@/lib/types";

type SafetyGateProps = {
  qc: TriagePayload["qc"];
};

export function SafetyGate({ qc }: SafetyGateProps) {
  return (
    <Card className={qc.is_safe ? "border-success/30" : "border-danger/40"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Контроль безопасности
          </span>
          <Badge variant={qc.is_safe ? "success" : "danger"}>{qc.is_safe ? "Безопасно" : "Небезопасно"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <section>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Что уточнить</p>
          <ul className="space-y-1.5 rounded-lg border border-border/70 bg-surface-2/40 p-2">
            {qc.needs_clarification.length ? (
              qc.needs_clarification.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span>Критичных уточнений нет.</span>
              </li>
            )}
          </ul>
        </section>

        {qc.missing_evidence.length ? (
          <section>
            <p className="mb-1 text-xs text-muted-foreground">Недостающие подтверждения</p>
            <ul className="space-y-1">
              {qc.missing_evidence.map((item) => (
                <li key={item} className="text-muted-foreground">
                  • {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {qc.policy_issues.length ? (
          <section>
            <p className="mb-1 text-xs text-muted-foreground">Ограничения безопасности</p>
            <ul className="space-y-1">
              {qc.policy_issues.map((item) => (
                <li key={item} className="text-danger">
                  • {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
