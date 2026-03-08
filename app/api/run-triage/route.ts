import { NextResponse } from "next/server";
import { z } from "zod";
import { makeMockPayload } from "@/lib/mock-data";
import {
  hydrateDecisionSupportPayload,
  inferHomeMeasurementsFromText,
  mergeHomeMeasurementsInput,
} from "@/lib/maternal-support";
import {
  RunTriageRequestSchema,
  TriagePayloadSchema,
  buildFallbackPayload,
} from "@/lib/schemas";
import type { TraceEntry, TriagePayload, WorkflowStatus } from "@/lib/types";

const WORKFLOWS_BASE_URL =
  process.env.WORKFLOW_API_BASE ??
  "https://serverless-workflows.api.cloud.yandex.net/workflows/v1";

const GATEWAY_RUN_REGEX = /\/triage\/run\/?$/;
const POLL_MAX_ATTEMPTS = 120;
const POLL_INTERVAL_MS = 900;
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.WORKFLOW_FETCH_TIMEOUT_MS ?? "", 10);
const DEFAULT_FETCH_TIMEOUT_MS =
  Number.isFinite(FETCH_TIMEOUT_MS) && FETCH_TIMEOUT_MS >= 1000
    ? Math.min(FETCH_TIMEOUT_MS, 120_000)
    : 30_000;
const POLL_FETCH_TIMEOUT_MS = Math.min(DEFAULT_FETCH_TIMEOUT_MS, 15_000);
const INPUT_SHAPE_ERROR_REGEX =
  /(полем\s+transcript|inputjson|input\s*json|unexpected token|expected a value|missing\s+transcript)/i;
const DEFAULT_ALLOWED_ENDPOINT_HOSTS = [
  "serverless-workflows.api.cloud.yandex.net",
  ".apigw.yandexcloud.net",
  "localhost",
  "127.0.0.1",
  "::1",
];

const normalizeHost = (value: string) => value.trim().toLowerCase().replace(/^\[|\]$/g, "");

const getAllowedEndpointHosts = () => {
  const fromEnv = (process.env.WORKFLOW_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => normalizeHost(value))
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ALLOWED_ENDPOINT_HOSTS, ...fromEnv]));
};

const isHostAllowed = (hostname: string, allowedHosts: string[]) =>
  allowedHosts.some((hostRule) =>
    hostRule.startsWith(".")
      ? hostname === hostRule.slice(1) || hostname.endsWith(hostRule)
      : hostname === hostRule,
  );

const validateEndpointUrl = (value: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      ok: false as const,
      error: "Некорректный адрес сервиса",
    };
  }

  const hostname = normalizeHost(parsed.hostname);
  const allowedHosts = getAllowedEndpointHosts();
  const localHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const protocol = parsed.protocol.toLowerCase();

  if (!isHostAllowed(hostname, allowedHosts)) {
    return {
      ok: false as const,
      error: "Адрес сервиса не входит в разрешенный список хостов",
    };
  }

  if (protocol !== "https:" && !(localHost && protocol === "http:")) {
    return {
      ok: false as const,
      error: "Адрес сервиса должен использовать HTTPS (кроме localhost в режиме разработки)",
    };
  }

  return {
    ok: true as const,
    url: parsed.toString(),
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Таймаут внешнего запроса (${timeoutMs} мс)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const parseResponseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
};

const cleanJsonText = (value: string) =>
  value
    .trim()
    .replace(/^```[a-zA-Z]*\s*/u, "")
    .replace(/```$/u, "")
    .trim();

const tryParseJsonText = (value: string) => {
  const cleaned = cleanJsonText(value);
  if (!cleaned) return value;

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const objectStart = cleaned.indexOf("{");
    const objectEnd = cleaned.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      const objectCandidate = cleaned.slice(objectStart, objectEnd + 1);
      try {
        return JSON.parse(objectCandidate) as unknown;
      } catch {}
    }

    const arrayStart = cleaned.indexOf("[");
    const arrayEnd = cleaned.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      const arrayCandidate = cleaned.slice(arrayStart, arrayEnd + 1);
      try {
        return JSON.parse(arrayCandidate) as unknown;
      } catch {}
    }
  }

  return value;
};

const parseJsonField = (value: unknown, depth = 0): unknown => {
  if (depth > 3) return value;

  if (typeof value === "string") {
    const parsed = tryParseJsonText(value);
    if (parsed !== value) {
      return parseJsonField(parsed, depth + 1);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => parseJsonField(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, node] of Object.entries(record)) {
      next[key] = parseJsonField(node, depth + 1);
    }
    return next;
  }

  return value;
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const resolveTranscript = (transcript: string, complaintText: string) => {
  const normalizedTranscript = transcript.trim();
  if (normalizedTranscript.length >= 3) return normalizedTranscript;
  return complaintText.trim();
};

const extractExecution = (payload: unknown) => asObject(asObject(payload).execution ?? payload);

const mapHistoryEntries = (historyPayload: unknown): TraceEntry[] => {
  const entries = asObject(historyPayload).entries;
  if (!Array.isArray(entries)) return [];

  return entries.map((entry, index) => {
    const node = asObject(entry);
    const outputNode = asObject(node.output);

    return {
      id: String(node.id ?? `step-${index + 1}`),
      title: String(node.title ?? node.name ?? `Шаг ${index + 1}`),
      type: node.type ? String(node.type) : undefined,
      status: String(node.status ?? "UNKNOWN"),
      duration: node.duration ? String(node.duration) : undefined,
      outputJson: parseJsonField(outputNode.outputJson ?? node.outputJson ?? node.output),
    };
  });
};

const normalizePayload = (params: {
  payload: unknown;
  callId: string;
  transcript: string;
  patientInput: z.infer<typeof RunTriageRequestSchema>["patient_input"];
  status?: WorkflowStatus;
  executionId?: string;
  trace?: TraceEntry[];
}): TriagePayload => {
  const fallback = buildFallbackPayload({
    callId: params.callId,
    transcript: params.transcript,
    patientInput: params.patientInput,
    status: params.status,
  });

  const rawPayload = asObject(params.payload);
  const hasStructuredSections = ["triage", "operator_card", "qc", "rag"].some((key) =>
    Object.prototype.hasOwnProperty.call(rawPayload, key),
  );

  if (!hasStructuredSections) {
    return {
      ...fallback,
      trace: params.trace ?? fallback.trace,
      execution:
        params.executionId || params.status
          ? {
              execution_id: params.executionId ?? fallback.execution?.execution_id ?? "неизвестно",
              status: params.status ?? fallback.execution?.status ?? "UNKNOWN",
            }
          : fallback.execution,
    };
  }

  const prepared: Record<string, unknown> = {
    ...rawPayload,
    call_id: rawPayload.call_id ?? params.callId,
    transcript: rawPayload.transcript ?? params.transcript,
    patient_input: rawPayload.patient_input ?? params.patientInput,
  };

  if (params.executionId || params.status) {
    prepared.execution = {
      execution_id:
        asObject(rawPayload.execution).execution_id ??
        params.executionId ??
        fallback.execution?.execution_id ??
        "неизвестно",
      status:
        asObject(rawPayload.execution).status ??
        params.status ??
        fallback.execution?.status ??
        "UNKNOWN",
    };
  }

  if (params.trace) {
    prepared.trace = params.trace;
  }

  const parsed = TriagePayloadSchema.safeParse(prepared);
  if (parsed.success) return hydrateDecisionSupportPayload(parsed.data);

  return {
    ...fallback,
    trace: params.trace ?? fallback.trace,
    execution:
      params.executionId || params.status
        ? {
            execution_id: params.executionId ?? fallback.execution?.execution_id ?? "неизвестно",
            status: params.status ?? fallback.execution?.status ?? "UNKNOWN",
          }
        : fallback.execution,
  };
};

const pollGatewayExecution = async (params: {
  base: string;
  executionId: string;
  callId: string;
  transcript: string;
  patientInput: z.infer<typeof RunTriageRequestSchema>["patient_input"];
  trace: boolean;
}) => {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const execResponse = await fetchWithTimeout(
      `${params.base}/triage/execution/${params.executionId}`,
      {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
      },
      POLL_FETCH_TIMEOUT_MS,
    );

    const execJson = await parseResponseJson(execResponse);
    if (!execResponse.ok) {
      throw new Error(
        String(
          asObject(execJson).error ??
            asObject(execJson).message ??
            `Ошибка запроса статуса выполнения (${execResponse.status})`,
        ),
      );
    }

    const execution = extractExecution(execJson);
    const status = String(execution.status ?? "UNKNOWN").toUpperCase() as WorkflowStatus;

    if (status === "FINISHED") {
      const executionResultNode = parseJsonField(execution.result ?? {});
      const resultNode = asObject(executionResultNode);
      const resultCandidate =
        resultNode.resultJson ??
        resultNode.outputJson ??
        resultNode.output ??
        resultNode.data ??
        executionResultNode;
      const resultPayload = parseJsonField(resultCandidate);

      let traceEntries: TraceEntry[] = [];
      if (params.trace) {
        const historyResponse = await fetchWithTimeout(
          `${params.base}/triage/execution/${params.executionId}/history`,
          {
            method: "GET",
            cache: "no-store",
            redirect: "manual",
          },
          DEFAULT_FETCH_TIMEOUT_MS,
        );

        const historyJson = await parseResponseJson(historyResponse);
        if (historyResponse.ok) {
          traceEntries = mapHistoryEntries(historyJson);
        }
      }

      return normalizePayload({
        payload: resultPayload,
        callId: params.callId,
        transcript: params.transcript,
        patientInput: params.patientInput,
        status,
        executionId: params.executionId,
        trace: traceEntries,
      });
    }

    if (status === "FAILED" || status === "CANCELLED") {
      const errorNode = asObject(execution.error);
      throw new Error(String(errorNode.message ?? "Процесс обработки завершился ошибкой"));
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Превышено время ожидания завершения процесса обработки");
};

const runGatewayAttempt = async (params: {
  endpoint: string;
  startBody: unknown;
  callId: string;
  transcript: string;
  patientInput: z.infer<typeof RunTriageRequestSchema>["patient_input"];
  trace: boolean;
}) => {
  const startResponse = await fetchWithTimeout(
    params.endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.startBody),
      cache: "no-store",
      redirect: "manual",
    },
    DEFAULT_FETCH_TIMEOUT_MS,
  );

  const startJson = await parseResponseJson(startResponse);

  if (!startResponse.ok) {
    return {
      ok: false as const,
      error:
        asObject(startJson).error ??
        asObject(startJson).message ??
        `Ошибка запуска процесса обработки (${startResponse.status})`,
    };
  }

  const executionId = String(asObject(startJson).executionId ?? "");

  if (!executionId) {
    const fallbackData = asObject(startJson).data ?? startJson;
      const normalized = normalizePayload({
        payload: fallbackData,
        callId: params.callId,
        transcript: params.transcript,
        patientInput: params.patientInput,
      });

    return {
      ok: true as const,
      payload: normalized,
    };
  }

  const base = params.endpoint.replace(GATEWAY_RUN_REGEX, "");

  try {
    const payload = await pollGatewayExecution({
      base,
      executionId,
      callId: params.callId,
      transcript: params.transcript,
      patientInput: params.patientInput,
      trace: params.trace,
    });

    return {
      ok: true as const,
      payload,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Ошибка ожидания завершения процесса",
    };
  }
};

const proxyToGatewayRunEndpoint = async (endpoint: string, body: z.infer<typeof RunTriageRequestSchema>) => {
  const callId = body.call_id ?? `ВЫЗОВ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const trace = Boolean(body.trace);
  const transcript = resolveTranscript(body.transcript, body.patient_input.complaint_text);
  const plainInput = {
    call_id: callId,
    transcript,
    complaint_text: body.patient_input.complaint_text,
    patient_input: body.patient_input,
    trace,
  };

  // Некоторые API Gateway уже сами упаковывают payload в input.inputJson.
  // Поэтому сначала отправляем "человеческий" JSON, затем fallback к Workflows-native body.
  const attempts: Array<{ mode: "plain" | "wrapped"; startBody: unknown }> = [
    {
      mode: "plain",
      startBody: plainInput,
    },
    {
      mode: "wrapped",
      startBody: {
        input: {
          inputJson: JSON.stringify(plainInput),
        },
      },
    },
  ];

  let lastError = "Не удалось запустить процесс обработки";

  for (const attempt of attempts) {
    const runResult = await runGatewayAttempt({
      endpoint,
      startBody: attempt.startBody,
      callId,
      transcript,
      patientInput: body.patient_input,
      trace,
    });

    if (runResult.ok) {
      return {
        ok: true,
        payload: runResult.payload,
      };
    }

    lastError = String(runResult.error);

    const shouldTryFallback = INPUT_SHAPE_ERROR_REGEX.test(lastError);
    const hasNextAttempt = attempt.mode !== "wrapped";

    if (!shouldTryFallback || !hasNextAttempt) {
      break;
    }
  }

  return {
    ok: false,
    error: lastError,
  };
};

const proxyToLegacyEndpoint = async (endpoint: string, body: z.infer<typeof RunTriageRequestSchema>) => {
  const transcript = resolveTranscript(body.transcript, body.patient_input.complaint_text);
  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        call_id: body.call_id,
        transcript,
        complaint_text: body.patient_input.complaint_text,
        patient_input: body.patient_input,
        trace: body.trace,
      }),
      cache: "no-store",
      redirect: "manual",
    },
    DEFAULT_FETCH_TIMEOUT_MS,
  );

  const json = await parseResponseJson(response);

  if (!response.ok) {
    return {
      ok: false,
      error:
        asObject(json).error ?? asObject(json).message ?? `Внешний сервис вернул ошибку ${response.status}`,
    };
  }

  const dataCandidate = asObject(json).data ?? json;

  const normalized = normalizePayload({
    payload: dataCandidate,
    callId: body.call_id ?? `ВЫЗОВ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    transcript,
    patientInput: body.patient_input,
    trace: Array.isArray(asObject(dataCandidate).trace)
      ? ((asObject(dataCandidate).trace as unknown[]) as TraceEntry[])
      : undefined,
  });

  return {
    ok: true,
    payload: normalized,
  };
};

const proxyToEndpoint = async (endpoint: string, body: z.infer<typeof RunTriageRequestSchema>) => {
  if (GATEWAY_RUN_REGEX.test(endpoint)) {
    return proxyToGatewayRunEndpoint(endpoint, body);
  }

  return proxyToLegacyEndpoint(endpoint, body);
};

const runDirectWorkflow = async (params: {
  callId: string;
  transcript: string;
  patientInput: z.infer<typeof RunTriageRequestSchema>["patient_input"];
  trace: boolean;
  workflowId: string;
  iamToken: string;
}) => {
  const headers = {
    Authorization: `Bearer ${params.iamToken}`,
    "Content-Type": "application/json",
  };

  const startResponse = await fetchWithTimeout(
    `${WORKFLOWS_BASE_URL}/execution/${params.workflowId}/start`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          inputJson: JSON.stringify({
            call_id: params.callId,
            transcript: params.transcript,
            complaint_text: params.patientInput.complaint_text,
            patient_input: params.patientInput,
            trace: params.trace,
          }),
        },
      }),
      cache: "no-store",
      redirect: "manual",
    },
    DEFAULT_FETCH_TIMEOUT_MS,
  );

  const startJson = await parseResponseJson(startResponse);
  if (!startResponse.ok) {
    throw new Error(
      String(
          asObject(startJson).message ??
          asObject(startJson).error ??
          `Ошибка запуска выполнения (${startResponse.status})`,
      ),
    );
  }

  const executionId = String(asObject(startJson).executionId ?? "");
  if (!executionId) {
    throw new Error("В ответе запуска отсутствует идентификатор выполнения");
  }

  const deadline = Date.now() + 90_000;
  let status: WorkflowStatus = "QUEUED";
  let executionBody: Record<string, unknown> = {};

  while (Date.now() < deadline) {
    const getResponse = await fetchWithTimeout(
      `${WORKFLOWS_BASE_URL}/execution/${executionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${params.iamToken}`,
        },
        cache: "no-store",
        redirect: "manual",
      },
      POLL_FETCH_TIMEOUT_MS,
    );

    const getJson = await parseResponseJson(getResponse);

    if (!getResponse.ok) {
      throw new Error(
        String(
          asObject(getJson).message ??
            asObject(getJson).error ??
            `Ошибка чтения состояния выполнения (${getResponse.status})`,
        ),
      );
    }

    executionBody = extractExecution(getJson);
    status = String(executionBody.status ?? "UNKNOWN").toUpperCase() as WorkflowStatus;

    if (status === "FINISHED") break;

    if (status === "FAILED" || status === "CANCELLED") {
      const err = asObject(executionBody.error);
      const code = err.errorCode ? `[${String(err.errorCode)}] ` : "";
      throw new Error(`${code}${String(err.message ?? "Ошибка выполнения процесса обработки")}`);
    }

    await sleep(1200);
  }

  if (status !== "FINISHED") {
    throw new Error("Превышено время ожидания получения состояния выполнения");
  }

  const executionResultNode = parseJsonField(executionBody.result ?? {});
  const resultNode = asObject(executionResultNode);
  const resultCandidate =
    resultNode.resultJson ??
    resultNode.outputJson ??
    resultNode.output ??
    resultNode.data ??
    executionResultNode;
  const resultPayload = parseJsonField(resultCandidate);

  let traceEntries: TraceEntry[] = [];

  if (params.trace) {
    const historyResponse = await fetchWithTimeout(
      `${WORKFLOWS_BASE_URL}/execution/${executionId}/history`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${params.iamToken}`,
        },
        cache: "no-store",
        redirect: "manual",
      },
      DEFAULT_FETCH_TIMEOUT_MS,
    );

    const historyJson = await parseResponseJson(historyResponse);

    if (historyResponse.ok) {
      traceEntries = mapHistoryEntries(historyJson);
    }
  }

  return normalizePayload({
    payload: resultPayload,
    callId: params.callId,
    transcript: params.transcript,
    patientInput: params.patientInput,
    status,
    executionId,
    trace: traceEntries,
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RunTriageRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Некорректное тело запроса",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const callId = input.call_id ?? `ВЫЗОВ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const resolvedTranscript = resolveTranscript(input.transcript, input.patient_input.complaint_text);
    const mergedPatientInput = mergeHomeMeasurementsInput(
      inferHomeMeasurementsFromText(`${resolvedTranscript}\n${input.patient_input.complaint_text}`),
      input.patient_input,
    );
    const normalizedInput = {
      ...input,
      transcript: resolvedTranscript,
      patient_input: mergedPatientInput,
    };

    const endpoint = normalizedInput.endpoint?.trim() || process.env.WORKFLOW_RUN_ENDPOINT?.trim();

    if (endpoint) {
      const validatedEndpoint = validateEndpointUrl(endpoint);
      if (!validatedEndpoint.ok) {
        return NextResponse.json({ error: validatedEndpoint.error }, { status: 400 });
      }

      const proxied = await proxyToEndpoint(validatedEndpoint.url, {
        ...normalizedInput,
        call_id: callId,
      });

      if (!proxied.ok) {
        return NextResponse.json({ error: String(proxied.error) }, { status: 502 });
      }

      return NextResponse.json({
        mode: "real",
        data: proxied.payload,
      });
    }

    const workflowId = process.env.WORKFLOW_ID?.trim();
    const iamToken = process.env.YANDEX_IAM_TOKEN?.trim();

    if (workflowId && iamToken) {
      try {
        const payload = await runDirectWorkflow({
          callId,
          transcript: resolvedTranscript,
          patientInput: normalizedInput.patient_input,
          trace: Boolean(normalizedInput.trace),
          workflowId,
          iamToken,
        });

        return NextResponse.json({
          mode: "real",
          data: payload,
        });
      } catch (error) {
        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "Ошибка интеграции с оркестратором",
          },
          { status: 502 },
        );
      }
    }

    const payload = makeMockPayload({
      callId,
      transcript: resolvedTranscript,
      patientInput: normalizedInput.patient_input,
      includeTrace: normalizedInput.trace,
    });

    const normalized = normalizePayload({
      payload,
      callId,
      transcript: resolvedTranscript,
      patientInput: normalizedInput.patient_input,
      status: "FINISHED",
    executionId: payload.execution?.execution_id,
    trace: payload.trace,
    });

    return NextResponse.json({
      mode: "demo",
      data: normalized,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Непредвиденная ошибка сервера",
      },
      { status: 500 },
    );
  }
}
