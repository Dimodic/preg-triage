"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Siren } from "lucide-react";
import type { UrgencyLevel } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { urgencyColor, urgencyLabel } from "@/lib/utils";

type UrgencyDialProps = {
  urgency: UrgencyLevel;
  confidence: number;
  dispatchNow: boolean;
  insufficientContext?: boolean;
};

export function UrgencyDial({ urgency, confidence, dispatchNow, insufficientContext = false }: UrgencyDialProps) {
  const reduceMotion = useReducedMotion();
  const stroke = urgencyColor[urgency];
  const normalized = urgency / 3;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - normalized * circumference;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Индикатор срочности</span>
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {insufficientContext ? <Badge variant="warning">Контекст неполный</Badge> : null}
            <Badge variant={urgency >= 3 ? "danger" : urgency === 2 ? "warning" : "secondary"}>
              Уровень {urgency}
            </Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mx-auto mb-3 h-36 w-36">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" stroke="var(--border)" strokeWidth="8" fill="none" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              stroke={stroke}
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: offset }}
              initial={false}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold" style={{ color: stroke }}>
              {urgency}
            </span>
            <span className="text-xs text-muted-foreground">{urgencyLabel[urgency]}</span>
          </div>

          {urgency === 3 ? (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full border border-danger/45"
              animate={{ scale: [1, 1.07, 1], opacity: [0.9, 0.2, 0.9] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 1.3, repeat: Number.POSITIVE_INFINITY }}
            />
          ) : null}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Уверенность</span>
            <span>{Math.round(confidence * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Диспетчеризация</span>
            <span className="flex items-center gap-1 font-medium">
              {dispatchNow ? <Siren className="h-4 w-4 text-danger" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
              {dispatchNow ? "Сейчас" : "Оценка"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
