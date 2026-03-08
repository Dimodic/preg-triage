import { z } from "zod";
import type { TriagePayload, UrgencyLevel, WorkflowStatus } from "@/lib/types";
import { createEmptyHomeMeasurementsInput, hydrateDecisionSupportPayload } from "@/lib/maternal-support";

const PatientInputSchema = z
  .object({
    complaint_text: z.string().default(""),
    gestation_weeks: z.number().int().min(1).max(45).nullable().default(null),
    systolic_bp: z.number().int().min(40).max(260).nullable().default(null),
    diastolic_bp: z.number().int().min(30).max(180).nullable().default(null),
    pulse: z.number().int().min(20).max(240).nullable().default(null),
    temperature: z.number().min(30).max(43).nullable().default(null),
    spo2: z.number().int().min(50).max(100).nullable().default(null),
    bleeding: z
      .object({
        present: z.boolean().nullable().default(null),
        severity: z
          .union([
            z.literal("none"),
            z.literal("spotting"),
            z.literal("moderate"),
            z.literal("heavy"),
            z.literal("unknown"),
          ])
          .default("unknown"),
        note: z.string().nullable().default(null),
      })
      .default({
        present: null,
        severity: "unknown",
        note: null,
      }),
    pain: z
      .object({
        present: z.boolean().nullable().default(null),
        severity: z
          .union([
            z.literal("none"),
            z.literal("mild"),
            z.literal("moderate"),
            z.literal("severe"),
            z.literal("unknown"),
          ])
          .default("unknown"),
        location: z.string().nullable().default(null),
      })
      .default({
        present: null,
        severity: "unknown",
        location: null,
      }),
    fetal_movement: z
      .union([
        z.literal("normal"),
        z.literal("reduced"),
        z.literal("absent"),
        z.literal("unknown"),
      ])
      .default("unknown"),
    measurement_time: z.string().nullable().default(null),
    measurement_source: z
      .union([
        z.literal("caller_reported"),
        z.literal("home_device"),
        z.literal("wearable"),
        z.literal("unknown"),
      ])
      .default("unknown"),
    missing_fields: z.array(z.string()).default([]),
  })
  .default(createEmptyHomeMeasurementsInput());

export const RunTriageRequestSchema = z
  .object({
    call_id: z.string().trim().min(3).max(120).optional(),
    transcript: z.string().trim().optional().default(""),
    patient_input: PatientInputSchema.optional().default(createEmptyHomeMeasurementsInput()),
    trace: z.boolean().optional().default(true),
    endpoint: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.transcript.trim().length >= 3 || value.patient_input.complaint_text.trim().length >= 3) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["transcript"],
      message: "Добавьте транскрипт или текст жалоб не короче 3 символов",
    });
  });

const GuidelineSchema = z
  .object({
    source: z.string().default("Неизвестный источник"),
    quote: z.string().default(""),
    why: z.string().default(""),
    file_id: z.string().nullable().optional(),
  })
  .passthrough();

const TriageSchema = z
  .object({
    urgency: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(1),
    dispatch_now: z.boolean().default(false),
    confidence: z.number().min(0).max(1).default(0.5),
    primary_reason: z.string().default("Не указано"),
    concern_terms: z.array(z.string()).default([]),
    red_flags: z.array(z.string()).default([]),
    next_questions: z.array(z.string()).default([]),
    operator_script: z.array(z.string()).default([]),
    limitations: z.string().default(""),
    evidence_quotes: z.array(z.string()).default([]),
    guideline_citations: z.array(z.string()).default([]),
  })
  .passthrough();

const OperatorCardSchema = z
  .object({
    title: z.string().default("Карточка оператора"),
    summary: z.string().default(""),
    key_facts: z.array(z.string()).default([]),
    dispatch_fields: z
      .object({
        address: z.string().nullable().default(null),
        gestation_weeks: z.number().nullable().default(null),
        alone: z.boolean().nullable().default(null),
      })
      .default({
        address: null,
        gestation_weeks: null,
        alone: null,
      }),
    evidence_quotes: z.array(z.string()).default([]),
    guideline_citations: z.array(z.string()).default([]),
  })
  .passthrough();

const VitalAnomalySchema = z
  .object({
    id: z.string().default("anomaly"),
    label: z.string().default("Аномалия"),
    severity: z.union([z.literal("info"), z.literal("moderate"), z.literal("high"), z.literal("critical")]).default("info"),
    status: z.union([z.literal("normal"), z.literal("abnormal"), z.literal("missing"), z.literal("suspicious")]).default("abnormal"),
    value: z.string().default(""),
    reason: z.string().default(""),
    source: z.union([z.literal("home_measurement"), z.literal("symptom"), z.literal("transcript"), z.literal("derived")]).default("derived"),
    evidence: z.array(z.string()).default([]),
  })
  .passthrough();

const DoctorDraftSchema = z
  .object({
    status: z.literal("draft").default("draft"),
    title: z.string().default("Черновик объективного заключения"),
    objective_summary: z.string().default(""),
    conclusion: z.string().default(""),
    recommended_route: z.union([
      z.literal("clarify_and_monitor"),
      z.literal("same_day_ob_review"),
      z.literal("urgent_ob_review"),
      z.literal("dispatch_now"),
    ]).default("clarify_and_monitor"),
    rationale: z.string().default(""),
    uncertainty: z.string().default(""),
    evidence: z.array(z.string()).default([]),
  })
  .passthrough();

const DoctorReviewSchema = z
  .object({
    status: z.union([z.literal("pending"), z.literal("confirmed"), z.literal("corrected")]).default("pending"),
    reviewer_name: z.string().nullable().default(null),
    final_conclusion: z.string().nullable().default(null),
    override_reason: z.string().nullable().default(null),
    reviewed_at: z.string().nullable().default(null),
  })
  .passthrough();

const EvidenceSchema = z
  .object({
    transcript_quotes: z.array(z.string()).default([]),
    vitals_summary: z.array(z.string()).default([]),
    guideline_quotes: z.array(z.string()).default([]),
    anomaly_ids: z.array(z.string()).default([]),
  })
  .passthrough();

const QcSchema = z
  .object({
    is_safe: z.boolean().default(true),
    missing_evidence: z.array(z.string()).default([]),
    needs_clarification: z.array(z.string()).default([]),
    policy_issues: z.array(z.string()).default([]),
  })
  .passthrough();

const TraceSchema = z
  .object({
    id: z.string().default("step"),
    title: z.string().default("Шаг без названия"),
    type: z.string().optional(),
    status: z.string().default("UNKNOWN"),
    duration: z.string().optional(),
    outputJson: z.unknown().optional(),
  })
  .passthrough();

export const TriagePayloadSchema = z
  .object({
    call_id: z.string().default("ВЫЗОВ-НЕИЗВЕСТНО"),
    transcript: z.string().default(""),
    patient_input: PatientInputSchema.default(createEmptyHomeMeasurementsInput()),
    extracted: z.object({}).passthrough().default({}),
    rag: z
      .object({
        guidelines: z.array(GuidelineSchema).default([]),
        notes: z.string().default(""),
      })
      .default({
        guidelines: [],
        notes: "",
      }),
    triage: TriageSchema.default({
      urgency: 1,
      dispatch_now: false,
      confidence: 0.5,
      primary_reason: "Не указано",
      concern_terms: [],
      red_flags: [],
      next_questions: [],
      operator_script: [],
      limitations: "",
      evidence_quotes: [],
      guideline_citations: [],
    }),
    operator_card: OperatorCardSchema.default({
      title: "Карточка оператора",
      summary: "",
      key_facts: [],
      dispatch_fields: {
        address: null,
        gestation_weeks: null,
        alone: null,
      },
      evidence_quotes: [],
      guideline_citations: [],
    }),
    anomalies: z.array(VitalAnomalySchema).default([]),
    consistency_status: z
      .union([z.literal("match"), z.literal("mismatch"), z.literal("not_enough_data")])
      .default("not_enough_data"),
    risk_level: z
      .union([z.literal("low"), z.literal("moderate"), z.literal("high"), z.literal("critical")])
      .default("moderate"),
    recommended_route: z
      .union([
        z.literal("clarify_and_monitor"),
        z.literal("same_day_ob_review"),
        z.literal("urgent_ob_review"),
        z.literal("dispatch_now"),
      ])
      .default("clarify_and_monitor"),
    doctor_draft: DoctorDraftSchema.default({
      status: "draft",
      title: "Черновик объективного заключения",
      objective_summary: "",
      conclusion: "",
      recommended_route: "clarify_and_monitor",
      rationale: "",
      uncertainty: "",
      evidence: [],
    }),
    doctor_review: DoctorReviewSchema.default({
      status: "pending",
      reviewer_name: null,
      final_conclusion: null,
      override_reason: null,
      reviewed_at: null,
    }),
    evidence: EvidenceSchema.default({
      transcript_quotes: [],
      vitals_summary: [],
      guideline_quotes: [],
      anomaly_ids: [],
    }),
    qc: QcSchema.default({
      is_safe: true,
      missing_evidence: [],
      needs_clarification: [],
      policy_issues: [],
    }),
    execution: z
      .object({
        execution_id: z.string(),
        status: z
          .union([
            z.literal("QUEUED"),
            z.literal("RUNNING"),
            z.literal("FAILED"),
            z.literal("FINISHED"),
            z.literal("CANCELLED"),
            z.literal("PAUSED"),
            z.literal("UNKNOWN"),
          ])
          .default("UNKNOWN"),
      })
      .optional(),
    trace: z.array(TraceSchema).optional(),
  })
  .passthrough();

const randomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export const buildFallbackPayload = (params: {
  callId?: string;
  transcript: string;
  patientInput?: z.infer<typeof PatientInputSchema>;
  urgency?: UrgencyLevel;
  status?: WorkflowStatus;
}): TriagePayload => {
  const patientInput = {
    ...createEmptyHomeMeasurementsInput(),
    ...(params.patientInput ?? {}),
  };

  const payload: TriagePayload = {
    call_id: params.callId ?? `ВЫЗОВ-${randomId()}`,
    transcript: params.transcript,
    patient_input: patientInput,
    extracted: {
      structured_input: patientInput,
    },
    rag: {
      guidelines: [],
      notes: "",
    },
    triage: {
      urgency: params.urgency ?? 1,
      dispatch_now: (params.urgency ?? 1) >= 2,
      confidence: 0.55,
      primary_reason: "Автоматически сгенерированный резервный ответ",
      concern_terms: [],
      red_flags: [],
      next_questions: [],
      operator_script: ["Соберите дополнительные данные и оставайтесь на линии."],
      limitations: "Резервный ответ",
      evidence_quotes: [],
      guideline_citations: [],
    },
    operator_card: {
      title: "Резервная карточка оператора",
      summary: "Недостаточно данных, используйте клинический протокол.",
      key_facts: [],
      dispatch_fields: {
        address: null,
        gestation_weeks: patientInput.gestation_weeks,
        alone: null,
      },
      evidence_quotes: [],
      guideline_citations: [],
    },
    anomalies: [],
    consistency_status: "not_enough_data",
    risk_level: "moderate",
    recommended_route: "clarify_and_monitor",
    doctor_draft: {
      status: "draft",
      title: "Черновик объективного заключения",
      objective_summary: "Домашние показатели отсутствуют.",
      conclusion: "Недостаточно объективных данных для заключения.",
      recommended_route: "clarify_and_monitor",
      rationale: "Использован резервный ответ без структурированного анализа.",
      uncertainty: "Требуется ручная проверка и сбор объективных показателей.",
      evidence: [],
    },
    doctor_review: {
      status: "pending",
      reviewer_name: null,
      final_conclusion: null,
      override_reason: null,
      reviewed_at: null,
    },
    evidence: {
      transcript_quotes: [],
      vitals_summary: [],
      guideline_quotes: [],
      anomaly_ids: [],
    },
    qc: {
      is_safe: false,
      missing_evidence: ["Отсутствует структурированный ответ модели"],
      needs_clarification: ["Уточните срок беременности, интенсивность боли, кровотечение"],
      policy_issues: ["Использован резервный режим"],
    },
    execution: params.status
      ? {
          execution_id: "fallback",
          status: params.status,
        }
      : undefined,
    trace: [],
  };

  return hydrateDecisionSupportPayload(payload);
};

