"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Binary, Mic, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { LiveCallBar } from "@/components/triage/live-call-bar";
import { TranscriptComposer } from "@/components/triage/transcript-composer";
import { TranscriptTimeline } from "@/components/triage/transcript-timeline";
import { RightActionStack } from "@/components/triage/right-action-stack";
import { EvidenceDrawer } from "@/components/triage/evidence-drawer";
import { TraceDrawer } from "@/components/triage/trace-drawer";
import { HomeMeasurementsPanel } from "@/components/triage/home-measurements-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/contexts/app-store";
import { useRegisterCommandActions } from "@/contexts/command-center";
import { useCallTimer } from "@/hooks/use-call-timer";
import { useHotkey } from "@/hooks/use-hotkey";
import { useLiveCallCapture } from "@/hooks/use-live-call-capture";
import { buildJournalSummary } from "@/lib/journal";
import {
  createEmptyHomeMeasurementsInput,
  inferHomeMeasurementsFromText,
  normalizeHomeMeasurementsInput,
} from "@/lib/maternal-support";
import { DEMO_PRESETS } from "@/lib/mock-data";
import { PIPELINE_STEPS, STORAGE_KEYS } from "@/lib/constants";
import { containsEither } from "@/lib/text-match";
import type { HomeMeasurementsInput, TriagePayload } from "@/lib/types";
import { downloadJson, formatClock, randomCallId, safeJsonParse } from "@/lib/utils";

type RunResult = {
  payload: TriagePayload;
  source: "demo" | "real";
};

type TranscriptSource = "demo" | "live" | "manual";
type CallDraftReason = "before_live_start" | "live_stop";

type CallDraftSnapshot = {
  id: string;
  call_id: string;
  transcript: string;
  source: TranscriptSource;
  reason: CallDraftReason;
  saved_at: string;
};

type SourcesFocus = {
  terms: string[];
  evidenceQuotes: string[];
};

const CALL_DRAFTS_STORAGE_KEY = "pregtriage.callDrafts.v1";
const MAX_STORED_CALL_DRAFTS = 40;
const createEmptySourcesFocus = (): SourcesFocus => ({
  terms: [],
  evidenceQuotes: [],
});
const CONCERN_KEYWORDS = [
  "кровотеч",
  "кровь",
  "схват",
  "боль",
  "каменеет",
  "воды",
  "подтека",
  "головокруж",
  "обморок",
  "слабост",
  "не шевел",
  "шевел",
  "давление",
  "температур",
  "одна",
];
const NON_CLINICAL_TERMS = [
  "адрес",
  "улица",
  "квартира",
  "домофон",
  "подъезд",
  "контакт",
  "телефон",
  "номер",
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const dedupeTerms = (values: string[]) => {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
};

const isNonClinicalTerm = (term: string) => {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;

  return NON_CLINICAL_TERMS.some((value) => {
    const regex = new RegExp(`(^|\\s)${escapeRegExp(value)}([\\s,.!?;:]|$)`, "iu");
    return regex.test(normalized);
  });
};

const extractFullWordHits = (text: string, stems: string[]) => {
  if (!text.trim()) return [] as string[];

  const hits: string[] = [];
  for (const stem of stems) {
    const regex = new RegExp(
      `(?<![\\p{L}\\p{N}_-])[\\p{L}\\p{N}-]*${escapeRegExp(stem)}[\\p{L}\\p{N}-]*(?![\\p{L}\\p{N}_-])`,
      "giu",
    );

    for (const match of text.matchAll(regex)) {
      const candidate = (match[0] ?? "").trim();
      if (candidate.length >= 3) {
        hits.push(candidate);
      }
    }
  }

  return dedupeTerms(hits);
};

const extractCallerTranscript = (transcript: string) => {
  const lines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const callerLines = lines.filter((line) => /(звонящ|caller|пациентк)/iu.test(line));
  if (!callerLines.length) return transcript;
  return callerLines.join("\n");
};

const saveCallDraftSnapshot = (params: {
  callId: string;
  transcript: string;
  source: TranscriptSource;
  reason: CallDraftReason;
}) => {
  if (typeof window === "undefined") return;

  const existing = safeJsonParse<CallDraftSnapshot[]>(
    localStorage.getItem(CALL_DRAFTS_STORAGE_KEY) ?? "[]",
    [],
  );

  const next: CallDraftSnapshot = {
    id: `${params.callId}-${Date.now()}`,
    call_id: params.callId,
    transcript: params.transcript,
    source: params.source,
    reason: params.reason,
    saved_at: new Date().toISOString(),
  };

  localStorage.setItem(
    CALL_DRAFTS_STORAGE_KEY,
    JSON.stringify([next, ...existing].slice(0, MAX_STORED_CALL_DRAFTS)),
  );
};

const parseRunResponse = (json: unknown): RunResult => {
  if (!json || typeof json !== "object") {
    throw new Error("Неожиданный формат ответа");
  }

  const response = json as { data?: TriagePayload; mode?: string };
  if (!response.data) {
    throw new Error("В ответе отсутствуют данные");
  }

  return {
    payload: response.data,
    source: response.mode === "real" ? "real" : "demo",
  };
};

export default function TriagePage() {
  const router = useRouter();
  const { settings, addCase, addRunAudit } = useAppStore();

  const [callId, setCallId] = useState("ВЫЗОВ-ОЖИДАНИЕ");
  const [transcript, setTranscript] = useState("");
  const [patientInput, setPatientInput] = useState<HomeMeasurementsInput>(() => createEmptyHomeMeasurementsInput());
  const [patientInputManual, setPatientInputManual] = useState(false);
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource>("manual");
  const [activePresetLabel, setActivePresetLabel] = useState<string | null>(null);
  const [payload, setPayload] = useState<TriagePayload | null>(null);
  const [runSource, setRunSource] = useState<"demo" | "real">("demo");
  const [running, setRunning] = useState(false);
  const [callTimerRunning, setCallTimerRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [questionChecks, setQuestionChecks] = useState<Record<string, boolean>>({});
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);
  const [liveHighlightText, setLiveHighlightText] = useState<string | null>(null);
  const [activeConcerns, setActiveConcerns] = useState<string[]>([]);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
  const [sourcesFocus, setSourcesFocus] = useState<SourcesFocus>(() => createEmptySourcesFocus());
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [traceDrawerOpen, setTraceDrawerOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const liveRunDebounceRef = useRef<number | null>(null);
  const timerRef = useRef(0);
  const runningRef = useRef(false);

  const { seconds: timerSeconds, reset: resetCallTimer } = useCallTimer(callTimerRunning);

  const workflowStatus = error ? "Error" : running ? "Running" : "Online";
  const suggestedPatientInput = useMemo(
    () => inferHomeMeasurementsFromText(transcript),
    [transcript],
  );
  const concernTerms = useMemo(() => {
    const redFlags = payload?.triage.red_flags ?? [];
    const evidenceQuotes = payload?.triage.evidence_quotes ?? [];
    const modelTerms = payload?.triage.concern_terms ?? [];
    const callerTranscript = extractCallerTranscript(transcript);
    const transcriptWordHits = extractFullWordHits(callerTranscript, CONCERN_KEYWORDS);
    const evidenceWordHits = extractFullWordHits(evidenceQuotes.join(" "), CONCERN_KEYWORDS);

    return dedupeTerms([...modelTerms, ...redFlags, ...transcriptWordHits, ...evidenceWordHits])
      .filter((term) => !isNonClinicalTerm(term))
      .slice(0, 18);
  }, [payload?.triage.concern_terms, payload?.triage.red_flags, payload?.triage.evidence_quotes, transcript]);

  useEffect(() => {
    timerRef.current = timerSeconds;
  }, [timerSeconds]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    if (patientInputManual) return;
    setPatientInput(suggestedPatientInput);
  }, [patientInputManual, suggestedPatientInput]);

  const runTriage = useCallback(async () => {
    const normalizedInput = normalizeHomeMeasurementsInput(patientInput);
    const normalizedTranscript = transcript.trim() || normalizedInput.complaint_text.trim();
    const presumedMode: "demo" | "real" = settings.workflowEndpoint.trim() ? "real" : "demo";

    if (normalizedTranscript.length < 3) {
      const message = "Добавьте транскрипт или текст жалоб не короче 3 символов";
      toast.error(message);
      addRunAudit({
        call_id: callId,
        mode: presumedMode,
        status: "error",
        error: message,
      });
      return;
    }

    setRunning(true);
    setError(null);
    setCurrentStep(0);

    const interval = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= PIPELINE_STEPS.length - 1) return prev;
        return prev + 1;
      });
    }, 750);

    try {
      const response = await fetch("/api/run-triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          call_id: callId,
          transcript: normalizedTranscript,
          patient_input: normalizedInput,
          trace: settings.traceEnabled,
          endpoint: settings.workflowEndpoint.trim() || undefined,
        }),
      });

      const json = (await response.json()) as unknown;

      if (!response.ok) {
        const message =
          typeof json === "object" && json && "error" in json
            ? String((json as { error: string }).error)
            : "Запрос завершился ошибкой";
        throw new Error(message);
      }

      const result = parseRunResponse(json);
      setPayload(result.payload);
      setRunSource(result.source);
      setCallId(result.payload.call_id || callId);
      setPatientInput(result.payload.patient_input);
      setQuestionChecks({});
      setActiveConcerns([]);
      setSourcesFocus(createEmptySourcesFocus());
      setHighlightedQuote(null);
      setFocusedEntryId(null);
      setCurrentStep(PIPELINE_STEPS.length);
      addRunAudit({
        call_id: result.payload.call_id || callId,
        mode: result.source,
        status: "success",
        urgency: result.payload.triage.urgency,
        confidence: result.payload.triage.confidence,
        is_safe: result.payload.qc.is_safe,
        missing_evidence_count: result.payload.qc.missing_evidence.length,
        clarification_count: result.payload.qc.needs_clarification.length,
        red_flags: result.payload.triage.red_flags,
        needs_clarification: result.payload.qc.needs_clarification,
      });
      toast.success(`Оценка обновлена (${result.source === "real" ? "реальный" : "демо"} режим)`);
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Неизвестная ошибка";
      setError(message);
      addRunAudit({
        call_id: callId,
        mode: presumedMode,
        status: "error",
        error: message,
      });
      toast.error(message);
      setCurrentStep(0);
    } finally {
      window.clearInterval(interval);
      setRunning(false);
    }
  }, [addRunAudit, callId, patientInput, settings.traceEnabled, settings.workflowEndpoint, transcript]);

  const scheduleLiveRun = useCallback(() => {
    if (liveRunDebounceRef.current) {
      window.clearTimeout(liveRunDebounceRef.current);
    }

    liveRunDebounceRef.current = window.setTimeout(() => {
      if (runningRef.current) return;
      void runTriage();
    }, 2200);
  }, [runTriage]);

  const appendLiveSegment = useCallback(
    (segment: { role: "Operator" | "Caller"; text: string }) => {
      const text = segment.text.trim();
      if (!text) return;

      const roleLabel = segment.role === "Operator" ? "Диспетчер" : "Звонящая";
      const line = `[${formatClock(timerRef.current)}] ${roleLabel}: ${text}`;

      setTranscript((prev) => (prev.trim() ? `${prev}\n${line}` : line));
      setTranscriptSource("live");
      setActivePresetLabel(null);
      setError(null);
      setLiveHighlightText(text);
      scheduleLiveRun();
    },
    [scheduleLiveRun],
  );

  const {
    supported: liveSupported,
    isRecording: liveRecording,
    isStarting: liveStarting,
    hasSystemAudio,
    recordingReady: liveRecordingReady,
    start: startLiveCapture,
    stop: stopLiveCapture,
    downloadAudio: downloadLiveAudio,
  } = useLiveCallCapture({
    onFinalSegment: appendLiveSegment,
    onStatusMessage: (message) => {
      toast.message(message);
    },
  });

  const toggleLiveCapture = useCallback(async () => {
    try {
      if (liveRecording) {
        stopLiveCapture();
        setCallTimerRunning(false);
        if (liveRunDebounceRef.current) {
          window.clearTimeout(liveRunDebounceRef.current);
          liveRunDebounceRef.current = null;
        }
        const finalTranscript = transcript.trim();
        if (finalTranscript) {
          saveCallDraftSnapshot({
            callId,
            transcript: finalTranscript,
            source: "live",
            reason: "live_stop",
          });
          toast.message("Потоковый захват остановлен. Черновик звонка сохранен.");
        } else {
          toast.message("Потоковый захват остановлен");
        }
        return;
      }

      const previousTranscript = transcript.trim();
      let archivedBeforeStart = false;
      if (previousTranscript) {
        saveCallDraftSnapshot({
          callId,
          transcript: previousTranscript,
          source: transcriptSource,
          reason: "before_live_start",
        });
        archivedBeforeStart = true;
      }

      setCallId(randomCallId());
      setTranscript("");
      setPatientInput(createEmptyHomeMeasurementsInput());
      setPatientInputManual(false);
      setPayload(null);
      setError(null);
      setCurrentStep(0);
      setQuestionChecks({});
      setActiveConcerns([]);
      setSourcesFocus(createEmptySourcesFocus());
      setHighlightedQuote(null);
      setFocusedEntryId(null);
      setLiveHighlightText(null);
      setTranscriptSource("live");
      setActivePresetLabel(null);
      resetCallTimer();
      setCallTimerRunning(true);

      await startLiveCapture();
      toast.success(
        archivedBeforeStart
          ? "Потоковый захват запущен. Предыдущий текст сохранен как черновик звонка."
          : "Потоковый захват запущен. Говорите в микрофон и поделитесь звуком вкладки/системы.",
      );
    } catch (error) {
      setCallTimerRunning(false);
      const message = error instanceof Error ? error.message : "Не удалось запустить потоковый захват";
      toast.error(message);
    }
  }, [callId, liveRecording, resetCallTimer, startLiveCapture, stopLiveCapture, transcript, transcriptSource]);

  const copyScript = useCallback(async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.triage.operator_script.join("\n"));
      toast.success("Скрипт оператора скопирован");
    } catch {
      toast.error("Не удалось скопировать скрипт");
    }
  }, [payload]);

  const copyQuestions = useCallback(async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.triage.next_questions.join("\n"));
      toast.success("Вопросы скопированы");
    } catch {
      toast.error("Не удалось скопировать вопросы");
    }
  }, [payload]);

  const copySummary = useCallback(async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(buildJournalSummary(payload));
      toast.success("Сводка для журнала скопирована");
    } catch {
      toast.error("Не удалось скопировать сводку");
    }
  }, [payload]);

  const exportPayload = useCallback(() => {
    if (!payload) return;
    downloadJson(`${payload.call_id}.json`, payload);
    toast.success("Данные экспортированы");
  }, [payload]);

  const saveCase = useCallback(() => {
    if (!payload) return;
    const caseId = addCase(payload, runSource);
    toast.success(`Обращение сохранено (${caseId.slice(-6)})`);
  }, [addCase, payload, runSource]);

  const applyDemoPreset = useCallback((presetId: string, showToast = true) => {
    const preset = DEMO_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      if (showToast) toast.error("Демо-сценарий не найден");
      return;
    }

    setTranscript(preset.transcript);
    setPatientInput(preset.patientInput);
    setPatientInputManual(true);
    setCallId(randomCallId());
    setTranscriptSource("demo");
    setActivePresetLabel(preset.label);
    setCallTimerRunning(false);
    resetCallTimer();
    setPayload(null);
    setError(null);
    setCurrentStep(0);
    setQuestionChecks({});
    setActiveConcerns([]);
    setSourcesFocus(createEmptySourcesFocus());
    setHighlightedQuote(null);
    setFocusedEntryId(null);
    if (showToast) {
        toast.message(`Загружен сценарий: уровень срочности ${preset.urgency}`);
    }
  }, [resetCallTimer]);

  const handleTranscriptChange = useCallback(
    (value: string) => {
      setTranscript(value);
      if (!liveRecording) {
        setTranscriptSource("manual");
        if (activePresetLabel) {
          setPatientInputManual(false);
        }
        setActivePresetLabel(null);
      }
    },
    [activePresetLabel, liveRecording],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pendingPresetId = localStorage.getItem(STORAGE_KEYS.PENDING_DEMO_PRESET);
    if (!pendingPresetId) return;
    localStorage.removeItem(STORAGE_KEYS.PENDING_DEMO_PRESET);
    applyDemoPreset(pendingPresetId, true);
  }, [applyDemoPreset]);

  const setHighlight = useCallback((text: string | null) => {
    const query = text?.trim() ?? "";
    setHighlightedQuote(query || null);
  }, []);

  const setActiveConcernTerms = useCallback(
    (terms: string[], options?: { entryId?: string | null }) => {
      const uniqueTerms = dedupeTerms(terms).slice(0, 12);
      setActiveConcerns(uniqueTerms);
      setFocusedEntryId(options?.entryId ?? null);
      if (uniqueTerms.length) {
        setHighlight(uniqueTerms[0]);
      } else {
        setHighlight(null);
      }
    },
    [setHighlight],
  );

  const openSources = useCallback(
    (focus: SourcesFocus) => {
      const terms = dedupeTerms(focus.terms).slice(0, 12);
      const evidenceQuotes = dedupeTerms(focus.evidenceQuotes).slice(0, 8);
      setSourcesFocus({
        terms,
        evidenceQuotes,
      });
      setHighlight(terms[0] ?? evidenceQuotes[0] ?? null);
      setFocusedEntryId(null);
      setEvidenceDrawerOpen(true);
    },
    [setHighlight],
  );

  const openAllSources = useCallback(() => {
    setSourcesFocus(createEmptySourcesFocus());
    setHighlight(null);
    setFocusedEntryId(null);
    setEvidenceDrawerOpen(true);
  }, [setHighlight]);

  useEffect(() => {
    if (!liveHighlightText) return;
    const timeout = window.setTimeout(() => setLiveHighlightText(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [liveHighlightText]);

  useEffect(() => {
    if (!activeConcerns.length) return;
    const nextActiveConcerns = activeConcerns.filter((activeTerm) =>
      concernTerms.some((term) => containsEither(term, activeTerm)),
    );

    if (nextActiveConcerns.length === activeConcerns.length) return;
    setActiveConcerns(nextActiveConcerns);
  }, [activeConcerns, concernTerms]);

  useEffect(() => {
    setCallId((prev) => (prev === "ВЫЗОВ-ОЖИДАНИЕ" ? randomCallId() : prev));
  }, []);

  useEffect(() => {
    setRawOpen(settings.rawJsonDefaultOpen);
  }, [settings.rawJsonDefaultOpen]);

  useEffect(
    () => () => {
      if (liveRunDebounceRef.current) {
        window.clearTimeout(liveRunDebounceRef.current);
      }
      stopLiveCapture();
      setCallTimerRunning(false);
    },
    [stopLiveCapture],
  );

  useHotkey("Enter", () => {
    void runTriage();
  });

  const commandActions = useMemo(
    () => [
      {
        id: "run-triage",
        label: "Обновить оценку",
        group: "Операции",
        shortcut: "Ctrl/⌘ Enter",
        run: () => {
          void runTriage();
        },
      },
      {
        id: "export-json",
        label: "Экспорт данных",
        group: "Операции",
        shortcut: "E",
        run: exportPayload,
      },
      {
        id: "toggle-raw",
        label: rawOpen ? "Скрыть техданные" : "Показать техданные",
        group: "Операции",
        shortcut: "R",
        run: () => setRawOpen((prev) => !prev),
      },
      {
        id: "open-kb",
        label: "Открыть базу знаний",
        group: "Операции",
        shortcut: "K",
        run: () => router.push("/kb"),
      },
      {
        id: "toggle-live",
        label: liveRecording ? "Остановить потоковый захват" : "Начать потоковый захват",
        group: "Операции",
        shortcut: "L",
        run: () => {
          void toggleLiveCapture();
        },
      },
      {
        id: "download-live-audio",
        label: "Скачать потоковое аудио",
        group: "Операции",
        shortcut: "A",
        run: () => downloadLiveAudio(),
      },
    ],
    [downloadLiveAudio, exportPayload, liveRecording, rawOpen, router, runTriage, toggleLiveCapture],
  );

  useRegisterCommandActions("triage-page", commandActions);

  return (
    <div className="space-y-4">
      <LiveCallBar
        callId={callId}
        timer={formatClock(timerSeconds)}
        status={workflowStatus as "Online" | "Running" | "Error"}
        transcriptMode={transcriptSource}
        activePresetLabel={activePresetLabel}
        running={running}
        currentStep={currentStep}
        onRun={() => {
          void runTriage();
        }}
        onCopyScript={() => {
          void copyScript();
        }}
        onExport={exportPayload}
        onSave={saveCase}
        canExport={Boolean(payload)}
        liveSupported={liveSupported}
        liveRecording={liveRecording}
        liveStarting={liveStarting}
        onToggleLive={() => {
          void toggleLiveCapture();
        }}
        onDownloadAudio={downloadLiveAudio}
        canDownloadAudio={liveRecordingReady}
      />

      <div className="pointer-events-none fixed bottom-4 right-4 z-40">
        <TooltipProvider>
          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface-1/90 p-1 shadow-lg backdrop-blur">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                    liveRecording ? "bg-success/20 text-success" : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                {liveRecording ? "Потоковая запись активна" : "Потоковая запись остановлена"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                    liveRecording ? (hasSystemAudio ? "bg-success/20 text-success" : "bg-warning/20 text-warning") : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                {liveRecording
                  ? hasSystemAudio
                    ? "Системный звук захвачен"
                    : "Системный звук не захвачен"
                  : "Захват системного звука не активен"}
              </TooltipContent>
            </Tooltip>

            {!liveSupported ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-danger/20 text-danger">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                  <TooltipContent side="left">Встроенное распознавание речи недоступно в этом браузере</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </TooltipProvider>
      </div>

      <TranscriptComposer
        transcript={transcript}
        transcriptMode={transcriptSource}
        activePresetLabel={activePresetLabel}
        supplementalActions={
          <HomeMeasurementsPanel
            value={patientInput}
            suggestedValue={suggestedPatientInput}
            manualMode={patientInputManual}
            onChange={(next) => {
              setPatientInputManual(true);
              setPatientInput(next);
            }}
            onApplySuggested={() => {
              setPatientInputManual(false);
              setPatientInput(suggestedPatientInput);
            }}
          />
        }
        onTranscriptChange={handleTranscriptChange}
      />

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {error ? (
            <Card className="border-danger/45">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-danger">
                  <AlertTriangle className="h-5 w-5" />
                  Ошибка обработки
                </CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <TranscriptTimeline
            transcript={transcript}
            evidenceQuotes={payload?.triage.evidence_quotes ?? []}
            guidelines={payload?.rag.guidelines ?? []}
            redFlags={payload?.triage.red_flags ?? []}
            concernTerms={concernTerms}
            activeConcerns={activeConcerns}
            focusedEntryId={focusedEntryId}
            highlightedQuote={highlightedQuote}
            liveHighlightText={liveHighlightText}
            loading={running}
            onOpenSources={openSources}
            onOpenAllSources={openAllSources}
            onRedFlagClick={({ terms, entryId }) => {
              setActiveConcernTerms(terms, { entryId });
            }}
            onConcernClick={({ terms, entryId }) => {
              setActiveConcernTerms(terms, { entryId });
            }}
          />

          {rawOpen && payload ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Технические данные</span>
                  <Button size="sm" variant="outline" onClick={() => setTraceDrawerOpen(true)} className="gap-2">
                    <Binary className="h-4 w-4" />
                    Ход обработки
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-surface-2/60 p-3 text-xs">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <RightActionStack
          payload={payload}
          loading={running}
          concernTerms={concernTerms}
          activeConcerns={activeConcerns}
          questionChecks={questionChecks}
          onQuestionToggle={(question) =>
            setQuestionChecks((prev) => ({
              ...prev,
              [question]: !prev[question],
            }))
          }
          onCopyQuestions={() => {
            void copyQuestions();
          }}
          onCopyScript={() => {
            void copyScript();
          }}
          onCopySummary={() => {
            void copySummary();
          }}
          onRedFlagClick={(flag) => {
            setActiveConcernTerms([flag], { entryId: null });
          }}
          onConcernSelect={(terms) => {
            setActiveConcernTerms(terms, { entryId: null });
          }}
        />
      </section>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={runSource === "real" ? "success" : "secondary"}>
          Режим: {runSource === "real" ? "Реальный" : "Демо"}
        </Badge>
          <span>Горячие клавиши: Ctrl/⌘+K — палитра команд, Ctrl/⌘+Ввод — обновить оценку.</span>
        </div>

      <EvidenceDrawer
        open={evidenceDrawerOpen}
        onOpenChange={(open) => {
          setEvidenceDrawerOpen(open);
          if (!open) {
            setHighlightedQuote(null);
            setSourcesFocus(createEmptySourcesFocus());
            setFocusedEntryId(null);
          }
        }}
        highlightedQuote={highlightedQuote}
        focusTerms={sourcesFocus.terms}
        focusEvidenceQuotes={sourcesFocus.evidenceQuotes}
        onOpenAllSources={() => {
          setSourcesFocus(createEmptySourcesFocus());
          setHighlight(null);
        }}
        payload={payload}
      />

      <TraceDrawer
        open={traceDrawerOpen}
        onOpenChange={setTraceDrawerOpen}
        trace={payload?.trace ?? []}
      />
    </div>
  );
}
