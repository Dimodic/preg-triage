export type UrgencyLevel = 0 | 1 | 2 | 3;

export type WorkflowStatus =
  | "QUEUED"
  | "RUNNING"
  | "FAILED"
  | "FINISHED"
  | "CANCELLED"
  | "PAUSED"
  | "UNKNOWN";

export type SafetyStatus = "SAFE" | "UNSAFE";

export type TranscriptRole = "Operator" | "Caller";

export type MeasurementSource = "caller_reported" | "home_device" | "wearable" | "unknown";

export type FetalMovementStatus = "normal" | "reduced" | "absent" | "unknown";

export type BleedingSeverity = "none" | "spotting" | "moderate" | "heavy" | "unknown";

export type PainSeverity = "none" | "mild" | "moderate" | "severe" | "unknown";

export type ConsistencyStatus = "match" | "mismatch" | "not_enough_data";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export type RecommendedRoute =
  | "clarify_and_monitor"
  | "same_day_ob_review"
  | "urgent_ob_review"
  | "dispatch_now";

export type DoctorReviewStatus = "pending" | "confirmed" | "corrected";

export type TranscriptEntry = {
  id: string;
  role: TranscriptRole;
  text: string;
  time: string;
};

export type GuidelineQuote = {
  source: string;
  quote: string;
  why: string;
  file_id?: string | null;
};

export type TraceEntry = {
  id: string;
  title: string;
  type?: string;
  status: string;
  duration?: string;
  outputJson?: unknown;
};

export type HomeMeasurementsInput = {
  complaint_text: string;
  gestation_weeks: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  bleeding: {
    present: boolean | null;
    severity: BleedingSeverity;
    note: string | null;
  };
  pain: {
    present: boolean | null;
    severity: PainSeverity;
    location: string | null;
  };
  fetal_movement: FetalMovementStatus;
  measurement_time: string | null;
  measurement_source: MeasurementSource;
  missing_fields: string[];
};

export type VitalAnomaly = {
  id: string;
  label: string;
  severity: "info" | "moderate" | "high" | "critical";
  status: "normal" | "abnormal" | "missing" | "suspicious";
  value: string;
  reason: string;
  source: "home_measurement" | "symptom" | "transcript" | "derived";
  evidence: string[];
};

export type DecisionSupportEvidence = {
  transcript_quotes: string[];
  vitals_summary: string[];
  guideline_quotes: string[];
  anomaly_ids: string[];
};

export type DoctorDraft = {
  status: "draft";
  title: string;
  objective_summary: string;
  conclusion: string;
  recommended_route: RecommendedRoute;
  rationale: string;
  uncertainty: string;
  evidence: string[];
};

export type DoctorReview = {
  status: DoctorReviewStatus;
  reviewer_name: string | null;
  final_conclusion: string | null;
  override_reason: string | null;
  reviewed_at: string | null;
};

export type ExtractedFacts = Record<string, unknown> & {
  pregnancy_weeks?: number | null;
  complaints?: string[];
  bleeding?: {
    present: boolean;
    color?: string | null;
    pads_changed_count?: number | null;
    time_window_text?: string | null;
  };
  pain?: {
    present: boolean;
    pattern?: string | null;
    location?: string | null;
  };
  fetal_movement?: FetalMovementStatus;
  dizziness_or_faint?: boolean;
  address?: string | null;
  alone?: boolean | null;
  evidence_quotes?: string[];
  structured_input?: HomeMeasurementsInput;
  objective_flags?: string[];
  vitals_snapshot?: string[];
};

export type TriagePayload = {
  call_id: string;
  transcript: string;
  patient_input: HomeMeasurementsInput;
  extracted: ExtractedFacts;
  rag: {
    guidelines: GuidelineQuote[];
    notes: string;
  };
  triage: {
    urgency: UrgencyLevel;
    dispatch_now: boolean;
    confidence: number;
    primary_reason: string;
    concern_terms?: string[];
    red_flags: string[];
    next_questions: string[];
    operator_script: string[];
    limitations: string;
    evidence_quotes: string[];
    guideline_citations: string[];
  };
  operator_card: {
    title: string;
    summary: string;
    key_facts: string[];
    dispatch_fields: {
      address: string | null;
      gestation_weeks: number | null;
      alone: boolean | null;
    };
    evidence_quotes: string[];
    guideline_citations: string[];
  };
  anomalies: VitalAnomaly[];
  consistency_status: ConsistencyStatus;
  risk_level: RiskLevel;
  recommended_route: RecommendedRoute;
  doctor_draft: DoctorDraft;
  doctor_review: DoctorReview;
  evidence: DecisionSupportEvidence;
  qc: {
    is_safe: boolean;
    missing_evidence: string[];
    needs_clarification: string[];
    policy_issues: string[];
  };
  execution?: {
    execution_id: string;
    status: WorkflowStatus;
  };
  trace?: TraceEntry[];
};

export type CaseSource = "demo" | "real";

export type CaseRecord = {
  id: string;
  created_at: string;
  source: CaseSource;
  payload: TriagePayload;
};

export type RunAuditStatus = "success" | "error";

export type RunAuditEvent = {
  id: string;
  timestamp: string;
  call_id: string;
  mode: CaseSource;
  status: RunAuditStatus;
  urgency: UrgencyLevel | null;
  confidence: number | null;
  is_safe: boolean | null;
  missing_evidence_count: number;
  clarification_count: number;
  red_flags: string[];
  needs_clarification: string[];
  error: string | null;
};

export type AppSettings = {
  workflowEndpoint: string;
  kbEndpoint: string;
  traceEnabled: boolean;
  rawJsonDefaultOpen: boolean;
};

export type CommandAction = {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  shortcut?: string;
  run: () => void;
};

