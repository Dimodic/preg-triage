"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  AppSettings,
  CaseRecord,
  CaseSource,
  RunAuditEvent,
  RunAuditStatus,
  TriagePayload,
  UrgencyLevel,
} from "@/lib/types";
import {
  MAX_STORED_CASES,
  MAX_STORED_RUN_AUDITS,
  STORAGE_KEYS,
} from "@/lib/constants";
import { safeJsonParse } from "@/lib/utils";
import { RUN_ENDPOINT } from "@/lib/yc-config";
import { hydrateDecisionSupportPayload } from "@/lib/maternal-support";
import { makeMockPayload } from "@/lib/mock-data";
import { buildFallbackPayload } from "@/lib/schemas";

type AppStoreContextValue = {
  ready: boolean;
  cases: CaseRecord[];
  runAudits: RunAuditEvent[];
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;
  addCase: (payload: TriagePayload, source: CaseSource) => string;
  addRunAudit: (event: {
    call_id: string;
    mode: CaseSource;
    status: RunAuditStatus;
    urgency?: UrgencyLevel | null;
    confidence?: number | null;
    is_safe?: boolean | null;
    missing_evidence_count?: number;
    clarification_count?: number;
    red_flags?: string[];
    needs_clarification?: string[];
    error?: string | null;
  }) => string;
  clearRunAudits: () => void;
  getCaseById: (id: string) => CaseRecord | undefined;
};

const defaultSettings: AppSettings = {
  workflowEndpoint: RUN_ENDPOINT,
  kbEndpoint: "",
  traceEnabled: true,
  rawJsonDefaultOpen: false,
};

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

const isSparsePayload = (payload: TriagePayload) =>
  payload.triage.primary_reason === "Не указано" &&
  payload.triage.red_flags.length === 0 &&
  payload.triage.next_questions.length === 0 &&
  payload.triage.operator_script.length === 0 &&
  payload.operator_card.key_facts.length === 0 &&
  payload.rag.guidelines.length === 0;

const hydrateStoredPayload = (payload: TriagePayload): TriagePayload => {
  const fallback = buildFallbackPayload({
    callId: payload.call_id,
    transcript: payload.transcript,
    patientInput: payload.patient_input,
    urgency: payload.triage?.urgency,
    status: payload.execution?.status,
  });

  return hydrateDecisionSupportPayload({
    ...fallback,
    ...payload,
    patient_input: payload.patient_input ?? fallback.patient_input,
    extracted: {
      ...fallback.extracted,
      ...(payload.extracted ?? {}),
    },
    rag: {
      ...fallback.rag,
      ...payload.rag,
    },
    triage: {
      ...fallback.triage,
      ...payload.triage,
    },
    operator_card: {
      ...fallback.operator_card,
      ...payload.operator_card,
      dispatch_fields: {
        ...fallback.operator_card.dispatch_fields,
        ...(payload.operator_card?.dispatch_fields ?? {}),
      },
    },
    anomalies: payload.anomalies ?? fallback.anomalies,
    doctor_draft: {
      ...fallback.doctor_draft,
      ...(payload.doctor_draft ?? {}),
    },
    doctor_review: {
      ...fallback.doctor_review,
      ...(payload.doctor_review ?? {}),
    },
    evidence: {
      ...fallback.evidence,
      ...(payload.evidence ?? {}),
    },
    qc: {
      ...fallback.qc,
      ...payload.qc,
    },
    execution: payload.execution ?? fallback.execution,
    trace: payload.trace?.length ? payload.trace : fallback.trace,
  });
};

const hydrateSparsePayload = (record: CaseRecord): CaseRecord => {
  const hydrated = hydrateStoredPayload(record.payload);
  if (record.source !== "demo") {
    return {
      ...record,
      payload: hydrated,
    };
  }
  if (!isSparsePayload(hydrated)) {
    return {
      ...record,
      payload: hydrated,
    };
  }

  const fallback = makeMockPayload({
    callId: hydrated.call_id,
    transcript: hydrated.transcript,
    patientInput: hydrated.patient_input,
    includeTrace: Boolean(hydrated.trace?.length),
    forceUrgency: hydrated.triage.urgency,
  });

  return {
    ...record,
    payload: {
      ...fallback,
      execution: hydrated.execution ?? fallback.execution,
      trace: hydrated.trace?.length ? hydrated.trace : fallback.trace,
    },
  };
};

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [runAudits, setRunAudits] = useState<RunAuditEvent[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedCases = safeJsonParse<CaseRecord[]>(
      localStorage.getItem(STORAGE_KEYS.CASES) ?? "[]",
      [],
    );
    const storedSettings = safeJsonParse<AppSettings>(
      localStorage.getItem(STORAGE_KEYS.SETTINGS) ?? JSON.stringify(defaultSettings),
      defaultSettings,
    );
    const storedRunAudits = safeJsonParse<RunAuditEvent[]>(
      localStorage.getItem(STORAGE_KEYS.RUN_AUDITS) ?? "[]",
      [],
    );

    const timer = window.setTimeout(() => {
      const hydratedCases = Array.isArray(storedCases)
        ? storedCases.map(hydrateSparsePayload).slice(0, MAX_STORED_CASES)
        : [];
      setCases(hydratedCases);
      setRunAudits(Array.isArray(storedRunAudits) ? storedRunAudits.slice(0, MAX_STORED_RUN_AUDITS) : []);
      setSettingsState({ ...defaultSettings, ...storedSettings });
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !ready) return;
    localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(cases.slice(0, MAX_STORED_CASES)));
  }, [cases, ready]);

  useEffect(() => {
    if (typeof window === "undefined" || !ready) return;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings, ready]);

  useEffect(() => {
    if (typeof window === "undefined" || !ready) return;
    localStorage.setItem(STORAGE_KEYS.RUN_AUDITS, JSON.stringify(runAudits.slice(0, MAX_STORED_RUN_AUDITS)));
  }, [runAudits, ready]);

  const addCase = useCallback((payload: TriagePayload, source: CaseSource) => {
    const id = `${payload.call_id}-${Date.now()}`;
    const record: CaseRecord = {
      id,
      created_at: new Date().toISOString(),
      source,
      payload,
    };

    setCases((prev) => [record, ...prev].slice(0, MAX_STORED_CASES));
    return id;
  }, []);

  const setSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const addRunAudit = useCallback((event: {
    call_id: string;
    mode: CaseSource;
    status: RunAuditStatus;
    urgency?: UrgencyLevel | null;
    confidence?: number | null;
    is_safe?: boolean | null;
    missing_evidence_count?: number;
    clarification_count?: number;
    red_flags?: string[];
    needs_clarification?: string[];
    error?: string | null;
  }) => {
    const id = `${event.call_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record: RunAuditEvent = {
      id,
      timestamp: new Date().toISOString(),
      call_id: event.call_id,
      mode: event.mode,
      status: event.status,
      urgency: event.urgency ?? null,
      confidence: event.confidence ?? null,
      is_safe: event.is_safe ?? null,
      missing_evidence_count: event.missing_evidence_count ?? 0,
      clarification_count: event.clarification_count ?? 0,
      red_flags: event.red_flags ?? [],
      needs_clarification: event.needs_clarification ?? [],
      error: event.error ?? null,
    };

    setRunAudits((prev) => [record, ...prev].slice(0, MAX_STORED_RUN_AUDITS));
    return id;
  }, []);

  const clearRunAudits = useCallback(() => {
    setRunAudits([]);
  }, []);

  const getCaseById = useCallback((id: string) => cases.find((item) => item.id === id), [cases]);

  const value = useMemo(
    () => ({
      ready,
      cases,
      runAudits,
      settings,
      setSettings,
      addCase,
      addRunAudit,
      clearRunAudits,
      getCaseById,
    }),
    [ready, cases, runAudits, settings, setSettings, addCase, addRunAudit, clearRunAudits, getCaseById],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export const useAppStore = () => {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
};
