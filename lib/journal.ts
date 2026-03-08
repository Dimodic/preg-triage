import { CONSISTENCY_LABELS, RISK_LABELS, routeLabel } from "@/lib/maternal-support";
import type { TriagePayload } from "@/lib/types";

export const buildJournalSummary = (payload: TriagePayload) => {
  const questions = payload.triage.next_questions.slice(0, 3).join("; ");
  const redFlags = payload.triage.red_flags.length
    ? payload.triage.red_flags.join(", ")
    : "явные красные флаги не выявлены";

  return [
    `[${new Date().toLocaleString()}] ${payload.call_id}`,
    `Срочность: уровень ${payload.triage.urgency} | Немедленный выезд: ${payload.triage.dispatch_now ? "да" : "нет"} | Уверенность: ${Math.round(payload.triage.confidence * 100)}%`,
    `Риск: ${RISK_LABELS[payload.risk_level]} | Согласованность: ${CONSISTENCY_LABELS[payload.consistency_status]} | Маршрут: ${routeLabel(payload.recommended_route)}`,
    `Основная причина: ${payload.triage.primary_reason}`,
    `Красные флаги: ${redFlags}`,
    `Аномалии: ${payload.anomalies.length ? payload.anomalies.map((item) => `${item.label} (${item.value})`).join(", ") : "не выявлены"}`,
    `Следующие вопросы: ${questions || "нет"}`,
    `Контроль безопасности: ${payload.qc.is_safe ? "БЕЗОПАСНО" : "НЕБЕЗОПАСНО"}`,
  ].join("\n");
};
