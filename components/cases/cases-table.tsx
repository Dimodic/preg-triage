"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CONSISTENCY_LABELS, RISK_LABELS } from "@/lib/maternal-support";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CaseRecord } from "@/lib/types";

const urgencyVariant: Record<number, "secondary" | "warning" | "danger"> = {
  0: "secondary",
  1: "warning",
  2: "warning",
  3: "danger",
};

type CasesTableProps = {
  cases: CaseRecord[];
};

export function CasesTable({ cases }: CasesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Номер вызова</TableHead>
          <TableHead>Срочность</TableHead>
          <TableHead>Риск</TableHead>
          <TableHead>Согласованность</TableHead>
          <TableHead>Выезд</TableHead>
          <TableHead>Уверенность</TableHead>
          <TableHead>Безопасность</TableHead>
          <TableHead>Источник</TableHead>
          <TableHead>Создан</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((record) => (
          <TableRow key={record.id}>
            <TableCell>
              <Link href={`/cases/${encodeURIComponent(record.id)}`} className="font-medium text-primary hover:underline">
                {record.payload.call_id}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={urgencyVariant[record.payload.triage.urgency] ?? "secondary"}>
                Уровень {record.payload.triage.urgency}
              </Badge>
            </TableCell>
            <TableCell>{RISK_LABELS[record.payload.risk_level]}</TableCell>
            <TableCell>{CONSISTENCY_LABELS[record.payload.consistency_status]}</TableCell>
            <TableCell>{record.payload.triage.dispatch_now ? "Да" : "Нет"}</TableCell>
            <TableCell>{Math.round(record.payload.triage.confidence * 100)}%</TableCell>
            <TableCell>
              <Badge variant={record.payload.qc.is_safe ? "success" : "danger"}>
                {record.payload.qc.is_safe ? "БЕЗОПАСНО" : "НЕБЕЗОПАСНО"}
              </Badge>
            </TableCell>
            <TableCell>{record.source === "demo" ? "Демо" : "Реальный"}</TableCell>
            <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
