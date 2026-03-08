"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Copy, Download, Mic, MicOff, Play, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PIPELINE_STEPS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type WorkflowUiStatus = "Online" | "Running" | "Error";

type LiveCallBarProps = {
  callId: string;
  timer: string;
  status: WorkflowUiStatus;
  transcriptMode: "demo" | "live" | "manual";
  activePresetLabel?: string | null;
  currentStep: number;
  running: boolean;
  onRun: () => void;
  onCopyScript: () => void;
  onExport: () => void;
  onSave: () => void;
  canExport: boolean;
  liveSupported: boolean;
  liveRecording: boolean;
  liveStarting: boolean;
  onToggleLive: () => void;
  onDownloadAudio: () => void;
  canDownloadAudio: boolean;
};

export function LiveCallBar({
  callId,
  timer,
  status,
  transcriptMode,
  activePresetLabel,
  currentStep,
  running,
  onRun,
  onCopyScript,
  onExport,
  onSave,
  canExport,
  liveSupported,
  liveRecording,
  liveStarting,
  onToggleLive,
  onDownloadAudio,
  canDownloadAudio,
}: LiveCallBarProps) {
  const reduceMotion = useReducedMotion();
  const totalSteps = PIPELINE_STEPS.length;
  const boundedStep = Math.max(0, Math.min(currentStep, totalSteps));
  const activeIndex = Math.min(boundedStep, totalSteps - 1);
  const isFinished = !running && boundedStep >= totalSteps && status !== "Error";
  const progressPercent = isFinished
    ? 100
    : running
      ? Math.min(96, ((activeIndex + 0.55) / totalSteps) * 100)
      : Math.round((boundedStep / totalSteps) * 100);
  const pipelineLabel =
    status === "Error"
      ? "Ошибка выполнения"
      : isFinished
        ? "Готово"
        : running
          ? `Выполняется: ${PIPELINE_STEPS[activeIndex]}`
          : "Ожидание запуска";
  const compactPipelineLabel =
    status === "Error" ? "Ошибка" : isFinished ? "Готово" : running ? PIPELINE_STEPS[activeIndex] : "Ожидание";
  const systemLabel = status === "Online" ? "онлайн" : status === "Running" ? "выполняется" : "ошибка";
  const transcriptModeLabel =
    transcriptMode === "demo"
      ? `Демо-скрипт${activePresetLabel ? `: ${activePresetLabel}` : ""}`
      : transcriptMode === "live"
        ? "Потоковая запись"
        : "Ручной ввод";
  const pipelineWidget = (
    <div className="rounded-xl border border-border/60 bg-surface-2/75 p-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full border",
            status === "Error" && "border-danger/60 bg-danger/15",
            running && status !== "Error" && "border-primary/60 bg-primary/10",
            isFinished && "border-success/60 bg-success/15",
            !running && !isFinished && status !== "Error" && "border-border bg-surface-1",
          )}
        >
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              status === "Error" && "bg-danger",
              running && status !== "Error" && "animate-pulse bg-primary",
              isFinished && "bg-success",
              !running && !isFinished && status !== "Error" && "bg-muted-foreground",
            )}
          />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] leading-none text-muted-foreground">Этапы обработки</p>
          <p
            className={cn(
              "truncate text-xs font-medium leading-tight",
              status === "Error" && "text-danger",
              running && status !== "Error" && "text-primary",
              isFinished && "text-success",
              !running && !isFinished && status !== "Error" && "text-foreground",
            )}
          >
            {compactPipelineLabel}
          </p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border/70" title={pipelineLabel}>
        <motion.div
          className={cn(
            "h-full rounded-full",
            status === "Error"
              ? "bg-danger"
              : isFinished
                ? "bg-success"
                : "bg-gradient-to-r from-primary to-accent",
          )}
          animate={{ width: `${progressPercent}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeInOut" }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
        <span
          className={cn(
            "inline-flex items-center gap-1 truncate",
            status === "Error" ? "text-danger" : status === "Running" ? "text-warning" : "text-success",
          )}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          Система {systemLabel}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 whitespace-nowrap",
            liveRecording ? "text-success" : "text-muted-foreground",
          )}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          Поток {liveRecording ? "включен" : "выключен"}
        </span>
      </div>
    </div>
  );

  return (
    <section className="sticky top-[4.25rem] z-30 mb-5 rounded-2xl border border-border bg-surface-1/95 p-4 shadow-[0_20px_60px_-40px_rgba(37,99,235,0.6)] backdrop-blur-md">
      <div className="hidden md:absolute md:right-4 md:top-4 md:block md:w-[15.5rem]">{pipelineWidget}</div>

      <div className="md:pr-[16.5rem]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{callId}</Badge>
          <Badge variant="outline">Звонок {timer}</Badge>
          <Badge
            variant={transcriptMode === "demo" ? "secondary" : transcriptMode === "live" ? "success" : "outline"}
          >
            Источник: {transcriptModeLabel}
          </Badge>
        </div>

        <div className="mt-2 md:hidden">{pipelineWidget}</div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant={liveRecording ? "destructive" : "outline"}
            onClick={onToggleLive}
            disabled={liveStarting || !liveSupported}
            className="gap-2"
          >
            {liveRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {liveStarting ? "Подключение..." : liveRecording ? "Остановить поток" : "Начать поток"}
          </Button>
          <Button onClick={onRun} disabled={running} className="gap-2">
            <Play className="h-4 w-4" />
            Обновить оценку
          </Button>
          <Button variant="outline" onClick={onDownloadAudio} disabled={!canDownloadAudio} className="gap-2">
            <Download className="h-4 w-4" />
            Скачать аудио
          </Button>
          <Button variant="secondary" onClick={onCopyScript} disabled={!canExport} className="gap-2">
            <Copy className="h-4 w-4" />
            Копировать скрипт
          </Button>
          <Button variant="outline" onClick={onExport} disabled={!canExport} className="gap-2">
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
          <Button variant="ghost" onClick={onSave} disabled={!canExport} className="gap-2">
            <Save className="h-4 w-4" />
            Сохранить обращение
          </Button>
        </div>
      </div>
    </section>
  );
}
