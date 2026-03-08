import type {
  ConsistencyStatus,
  DoctorDraft,
  DoctorReview,
  FetalMovementStatus,
  HomeMeasurementsInput,
  RecommendedRoute,
  RiskLevel,
  TriagePayload,
  UrgencyLevel,
  VitalAnomaly,
} from "@/lib/types";

const CORE_FIELDS: Array<keyof HomeMeasurementsInput> = [
  "gestation_weeks",
  "systolic_bp",
  "diastolic_bp",
  "pulse",
  "temperature",
  "spo2",
  "measurement_time",
  "measurement_source",
];

const COMPLAINT_KEYWORDS = {
  pressure: ["давление", "головн", "мушки", "шум в ушах", "pressure"],
  oxygen: ["одыш", "задых", "не хватает воздуха", "сатурац", "oxygen"],
  fever: ["температ", "жар", "озноб", "fever"],
  bleeding: ["кров", "мажет", "выделен"],
  pain: ["боль", "схват", "каменеет", "тянет"],
  movement: ["шевел", "не двига", "мало двига"],
  fainting: ["головокруж", "обморок", "слабость", "предобмор"],
};

const ROUTE_LABELS: Record<RecommendedRoute, string> = {
  clarify_and_monitor: "Доуточнение и контроль по телефону",
  same_day_ob_review: "Очная акушерская оценка в тот же день",
  urgent_ob_review: "Срочная очная акушерская оценка",
  dispatch_now: "Немедленная маршрутизация/вызов бригады",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Низкий",
  moderate: "Умеренный",
  high: "Высокий",
  critical: "Критический",
};

export const CONSISTENCY_LABELS: Record<ConsistencyStatus, string> = {
  match: "Жалобы и показатели согласуются",
  mismatch: "Есть расхождение между жалобами и показателями",
  not_enough_data: "Недостаточно объективных данных",
};

export const MEASUREMENT_SOURCE_LABELS: Record<HomeMeasurementsInput["measurement_source"], string> = {
  caller_reported: "Со слов пациентки",
  home_device: "Домашний прибор",
  wearable: "Носимое устройство",
  unknown: "Источник не уточнен",
};

export const FETAL_MOVEMENT_LABELS: Record<FetalMovementStatus, string> = {
  normal: "Шевеления обычные",
  reduced: "Шевеления снижены",
  absent: "Шевеления не ощущаются",
  unknown: "Шевеления не уточнены",
};

const BLEEDING_LABELS: Record<HomeMeasurementsInput["bleeding"]["severity"], string> = {
  none: "Кровотечения нет",
  spotting: "Мажущие выделения",
  moderate: "Умеренное кровотечение",
  heavy: "Обильное кровотечение",
  unknown: "Кровотечение не уточнено",
};

const PAIN_LABELS: Record<HomeMeasurementsInput["pain"]["severity"], string> = {
  none: "Боль не указана",
  mild: "Боль слабая",
  moderate: "Боль умеренная",
  severe: "Боль выраженная",
  unknown: "Боль не уточнена",
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeNullableString = (value: unknown) => {
  const normalized = normalizeString(value);
  return normalized || null;
};

const normalizeInteger = (value: unknown, min: number, max: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded >= min && rounded <= max) return rounded;
    return null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) return parsed;
  }

  return null;
};

const normalizeFloat = (value: unknown, min: number, max: number, digits = 1) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= min && value <= max) return Number(value.toFixed(digits));
    return null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim().replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      return Number(parsed.toFixed(digits));
    }
  }

  return null;
};

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  if (typeof value !== "string") return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
};

const hasAnyKeyword = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const buildAnomaly = (params: {
  id: string;
  label: string;
  severity: VitalAnomaly["severity"];
  status: VitalAnomaly["status"];
  value: string;
  reason: string;
  source: VitalAnomaly["source"];
  evidence?: string[];
}): VitalAnomaly => ({
  id: params.id,
  label: params.label,
  severity: params.severity,
  status: params.status,
  value: params.value,
  reason: params.reason,
  source: params.source,
  evidence: uniqueStrings(params.evidence ?? []),
});

const countAvailableCoreFields = (input: HomeMeasurementsInput) =>
  CORE_FIELDS.filter((field) => {
    const value = input[field];
    return value !== null && value !== "" && value !== "unknown";
  }).length;

export const createEmptyHomeMeasurementsInput = (): HomeMeasurementsInput => ({
  complaint_text: "",
  gestation_weeks: null,
  systolic_bp: null,
  diastolic_bp: null,
  pulse: null,
  temperature: null,
  spo2: null,
  bleeding: {
    present: null,
    severity: "unknown",
    note: null,
  },
  pain: {
    present: null,
    severity: "unknown",
    location: null,
  },
  fetal_movement: "unknown",
  measurement_time: null,
  measurement_source: "unknown",
  missing_fields: [
    "gestation_weeks",
    "blood_pressure",
    "pulse",
    "temperature",
    "spo2",
    "measurement_time",
    "measurement_source",
    "bleeding",
    "pain",
    "fetal_movement",
  ],
});

export const computeMissingFields = (input: HomeMeasurementsInput) => {
  const missing = CORE_FIELDS.filter((field) => {
    const value = input[field];
    return value === null || value === "" || value === "unknown";
  }).map((field) => {
    switch (field) {
      case "gestation_weeks":
        return "gestation_weeks";
      case "systolic_bp":
      case "diastolic_bp":
        return "blood_pressure";
      case "pulse":
        return "pulse";
      case "temperature":
        return "temperature";
      case "spo2":
        return "spo2";
      case "measurement_time":
        return "measurement_time";
      case "measurement_source":
        return "measurement_source";
      default:
        return String(field);
    }
  });

  if (input.bleeding.severity === "unknown") missing.push("bleeding");
  if (input.pain.severity === "unknown") missing.push("pain");
  if (input.fetal_movement === "unknown") missing.push("fetal_movement");

  return uniqueStrings(missing);
};

export const normalizeHomeMeasurementsInput = (
  input: Partial<HomeMeasurementsInput> | null | undefined,
): HomeMeasurementsInput => {
  const bleedingSeverity = pickEnum(input?.bleeding?.severity, ["none", "spotting", "moderate", "heavy", "unknown"], "unknown");
  const painSeverity = pickEnum(input?.pain?.severity, ["none", "mild", "moderate", "severe", "unknown"], "unknown");

  const normalized: HomeMeasurementsInput = {
    complaint_text: normalizeString(input?.complaint_text),
    gestation_weeks: normalizeInteger(input?.gestation_weeks, 1, 45),
    systolic_bp: normalizeInteger(input?.systolic_bp, 40, 260),
    diastolic_bp: normalizeInteger(input?.diastolic_bp, 30, 180),
    pulse: normalizeInteger(input?.pulse, 20, 240),
    temperature: normalizeFloat(input?.temperature, 30, 43),
    spo2: normalizeInteger(input?.spo2, 50, 100),
    bleeding: {
      present:
        typeof input?.bleeding?.present === "boolean"
          ? input.bleeding.present
          : bleedingSeverity === "none"
            ? false
            : bleedingSeverity !== "unknown"
              ? true
              : null,
      severity: bleedingSeverity,
      note: normalizeNullableString(input?.bleeding?.note),
    },
    pain: {
      present:
        typeof input?.pain?.present === "boolean"
          ? input.pain.present
          : painSeverity === "none"
            ? false
            : painSeverity !== "unknown"
              ? true
              : null,
      severity: painSeverity,
      location: normalizeNullableString(input?.pain?.location),
    },
    fetal_movement: pickEnum(input?.fetal_movement, ["normal", "reduced", "absent", "unknown"], "unknown"),
    measurement_time: normalizeNullableString(input?.measurement_time),
    measurement_source: pickEnum(
      input?.measurement_source,
      ["caller_reported", "home_device", "wearable", "unknown"],
      "unknown",
    ),
    missing_fields: [],
  };

  normalized.missing_fields = computeMissingFields(normalized);
  return normalized;
};

export const buildVitalsSummary = (input: HomeMeasurementsInput) => {
  const facts = [
    input.gestation_weeks !== null ? `Срок беременности: ${input.gestation_weeks} нед` : null,
    input.systolic_bp !== null && input.diastolic_bp !== null
      ? `АД: ${input.systolic_bp}/${input.diastolic_bp} мм рт. ст.`
      : null,
    input.pulse !== null ? `Пульс: ${input.pulse} уд/мин` : null,
    input.temperature !== null ? `Температура: ${input.temperature.toFixed(1)} C` : null,
    input.spo2 !== null ? `SpO2: ${input.spo2}%` : null,
    input.measurement_time ? `Время измерения: ${input.measurement_time}` : null,
    input.measurement_source !== "unknown"
      ? `Источник: ${MEASUREMENT_SOURCE_LABELS[input.measurement_source]}`
      : null,
    input.bleeding.severity !== "unknown" ? BLEEDING_LABELS[input.bleeding.severity] : null,
    input.pain.severity !== "unknown"
      ? `${PAIN_LABELS[input.pain.severity]}${input.pain.location ? ` (${input.pain.location})` : ""}`
      : null,
    input.fetal_movement !== "unknown" ? FETAL_MOVEMENT_LABELS[input.fetal_movement] : null,
  ];

  return uniqueStrings(facts);
};

const stripTranscriptMarkup = (line: string) =>
  line
    .replace(/^\[[^\]]+\]\s*/u, "")
    .replace(/^(Диспетчер|Operator|Caller|Звонящая|Пациентка)\s*:\s*/iu, "")
    .trim();

const extractCallerNarrative = (text: string) => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const callerLines = lines
    .filter((line) => /(звонящ|caller|пациентк)/iu.test(line))
    .map(stripTranscriptMarkup);

  if (callerLines.length) {
    return callerLines.join(" ").slice(0, 220);
  }

  return lines.map(stripTranscriptMarkup).join(" ").slice(0, 220);
};

const chooseValue = <T>(current: T | null | undefined, fallback: T | null | undefined, emptyValues: unknown[] = [null, undefined, "", "unknown"]) =>
  emptyValues.includes(current as unknown) ? (fallback ?? current ?? null) : current;

export const mergeHomeMeasurementsInput = (
  base: Partial<HomeMeasurementsInput> | null | undefined,
  override: Partial<HomeMeasurementsInput> | null | undefined,
): HomeMeasurementsInput => {
  const baseNormalized = normalizeHomeMeasurementsInput(base);
  const overrideNormalized = normalizeHomeMeasurementsInput(override);

  return normalizeHomeMeasurementsInput({
    complaint_text: overrideNormalized.complaint_text.trim() || baseNormalized.complaint_text,
    gestation_weeks: chooseValue(overrideNormalized.gestation_weeks, baseNormalized.gestation_weeks),
    systolic_bp: chooseValue(overrideNormalized.systolic_bp, baseNormalized.systolic_bp),
    diastolic_bp: chooseValue(overrideNormalized.diastolic_bp, baseNormalized.diastolic_bp),
    pulse: chooseValue(overrideNormalized.pulse, baseNormalized.pulse),
    temperature: chooseValue(overrideNormalized.temperature, baseNormalized.temperature),
    spo2: chooseValue(overrideNormalized.spo2, baseNormalized.spo2),
    bleeding: {
      present: chooseValue(overrideNormalized.bleeding.present, baseNormalized.bleeding.present) ?? null,
      severity: chooseValue(overrideNormalized.bleeding.severity, baseNormalized.bleeding.severity) ?? "unknown",
      note: chooseValue(overrideNormalized.bleeding.note, baseNormalized.bleeding.note) ?? null,
    },
    pain: {
      present: chooseValue(overrideNormalized.pain.present, baseNormalized.pain.present) ?? null,
      severity: chooseValue(overrideNormalized.pain.severity, baseNormalized.pain.severity) ?? "unknown",
      location: chooseValue(overrideNormalized.pain.location, baseNormalized.pain.location) ?? null,
    },
    fetal_movement: chooseValue(overrideNormalized.fetal_movement, baseNormalized.fetal_movement) ?? "unknown",
    measurement_time: chooseValue(overrideNormalized.measurement_time, baseNormalized.measurement_time) ?? null,
    measurement_source:
      (chooseValue(
        overrideNormalized.measurement_source,
        baseNormalized.measurement_source,
      ) as HomeMeasurementsInput["measurement_source"]) ?? "unknown",
  });
};

export const inferHomeMeasurementsFromText = (text: string): HomeMeasurementsInput => {
  const normalizedText = text.replace(/,/g, ".").toLowerCase();
  const complaintText = extractCallerNarrative(text);

  const weeksMatch = normalizedText.match(/(\d{1,2})\s*нед/u);
  const bpMatch =
    normalizedText.match(/(?:ад|давлен[^\d]{0,12}|pressure[^\d]{0,12})?(\d{2,3})\s*[\/\\]\s*(\d{2,3})/u) ??
    normalizedText.match(/\b(\d{2,3})\s*[\/\\]\s*(\d{2,3})\b/u);
  const pulseMatch = normalizedText.match(/(?:пульс|чсс|pulse)[^\d]{0,12}(\d{2,3})/u);
  const temperatureMatch = normalizedText.match(/(?:темп(?:ература)?|temperature|t)[^\d]{0,12}(\d{2}(?:\.\d)?)/u);
  const spo2Match = normalizedText.match(/(?:spo2|сатурац(?:ия)?)[^\d]{0,12}(\d{2,3})/u);
  const measuredByDevice = /(тонометр|пульсоксиметр|градусник|измерил|измерила|померил|померила)/iu.test(text);

  let bleedingSeverity: HomeMeasurementsInput["bleeding"]["severity"] = "unknown";
  if (/(обильн\w*\s+кров|крови\s+много|прокладк\w*\s+промок|льет кровь)/iu.test(text)) {
    bleedingSeverity = "heavy";
  } else if (/(нет крови|крови нет)/iu.test(text)) {
    bleedingSeverity = "none";
  } else if (/(кров|мажет|выделени\w*)/iu.test(text)) {
    bleedingSeverity = /(немного|чуть|мажет|скудн)/iu.test(text) ? "spotting" : "moderate";
  }

  const painSeverity: HomeMeasurementsInput["pain"]["severity"] =
    /(боли нет|не болит)/iu.test(text)
      ? "none"
      : /(сильн\w*\s+боль|невыносим|каждые\s*[123]\s*мин|очень\s+болит)/iu.test(text)
        ? "severe"
        : /(схват|прихватыва|болит|боль)/iu.test(text)
          ? "moderate"
          : /(тянет|дискомфорт)/iu.test(text)
            ? "mild"
            : "unknown";

  const fetalMovement =
    /(не\s+шевел|перестал\w*\s+шевел|не ощущаю шевел)/iu.test(text)
      ? "absent"
      : /(мало\s+шевел|слабее\s+чем\s+обычно|реже\s+шевел|почти\s+не\s+шевел)/iu.test(text)
        ? "reduced"
        : /шевел/i.test(text)
          ? "normal"
          : "unknown";

  return normalizeHomeMeasurementsInput({
    complaint_text: complaintText,
    gestation_weeks: weeksMatch ? Number.parseInt(weeksMatch[1] ?? "", 10) : null,
    systolic_bp: bpMatch ? Number.parseInt(bpMatch[1] ?? "", 10) : null,
    diastolic_bp: bpMatch ? Number.parseInt(bpMatch[2] ?? "", 10) : null,
    pulse: pulseMatch ? Number.parseInt(pulseMatch[1] ?? "", 10) : null,
    temperature: temperatureMatch ? Number.parseFloat(temperatureMatch[1] ?? "") : null,
    spo2: spo2Match ? Number.parseInt(spo2Match[1] ?? "", 10) : null,
    bleeding: {
      present: bleedingSeverity === "unknown" ? null : bleedingSeverity !== "none",
      severity: bleedingSeverity,
      note: /(прокладк\w*\s+промок|крови\s+много|мажет)/iu.test(text) ? extractCallerNarrative(text).slice(0, 120) : null,
    },
    pain: {
      present: painSeverity === "unknown" ? null : painSeverity !== "none",
      severity: painSeverity,
      location: /низ живота|живот|поясниц|внизу живота/iu.test(text)
        ? (text.match(/(низ живота|живот|поясниц\w*|внизу живота)/iu)?.[1] ?? null)
        : null,
    },
    fetal_movement: fetalMovement,
    measurement_time: null,
    measurement_source: measuredByDevice ? "home_device" : complaintText ? "caller_reported" : "unknown",
  });
};

export const hasMeaningfulHomeMeasurements = (input: HomeMeasurementsInput) =>
  Boolean(
    input.complaint_text.trim() ||
      countAvailableCoreFields(input) ||
      input.bleeding.severity !== "unknown" ||
      input.pain.severity !== "unknown" ||
      input.fetal_movement !== "unknown",
  );
const buildClarificationQuestions = (input: HomeMeasurementsInput, anomalies: VitalAnomaly[]) => {
  const questions = [
    input.gestation_weeks === null ? "Уточните точный срок беременности." : null,
    input.systolic_bp === null || input.diastolic_bp === null ? "Если рядом есть тонометр, уточните текущее артериальное давление." : null,
    input.pulse === null ? "Уточните текущий пульс или частоту сердцебиения." : null,
    input.temperature === null ? "Измерьте и назовите температуру тела, если это возможно." : null,
    input.spo2 === null ? "Если есть пульсоксиметр, уточните сатурацию кислорода." : null,
    input.measurement_time === null && countAvailableCoreFields(input) > 0 ? "Уточните время последнего измерения показателей." : null,
    input.measurement_source === "unknown" && countAvailableCoreFields(input) > 0 ? "Уточните, чем именно измерялись показатели: прибором или со слов пациентки." : null,
    input.fetal_movement === "unknown" && (input.gestation_weeks ?? 0) >= 20 ? "Спросите, как пациентка ощущает шевеления плода сейчас." : null,
    input.bleeding.severity === "unknown" ? "Уточните, есть ли кровотечение или мажущие выделения сейчас." : null,
    input.pain.severity === "unknown" ? "Уточните интенсивность боли и ее локализацию." : null,
    anomalies.some((item) => item.id === "bp-inverted") ? "Повторно сверить показатели давления: систолическое не может быть ниже диастолического." : null,
  ];

  return uniqueStrings(questions);
};

const buildOperatorActions = (route: RecommendedRoute, anomalies: VitalAnomaly[]) => {
  const highPriority = anomalies.filter((item) => item.severity === "high" || item.severity === "critical");
  const actions = [
    route === "dispatch_now" ? "Объясните, что приоритет повышен и оставайтесь на линии до подтверждения маршрутизации." : null,
    route === "urgent_ob_review" ? "Подготовьте для врача/бригады список последних измерений и время их получения." : null,
    route === "same_day_ob_review" ? "Зафиксируйте домашние показатели и передайте врачу для очной оценки в тот же день." : null,
    route === "clarify_and_monitor" ? "Соберите недостающие домашние показатели и продолжайте структурированное доуточнение по протоколу." : null,
    highPriority.some((item) => item.id === "oxygen-low") ? "Повторно уточните сатурацию и наличие одышки, не завершая разговор до эскалации." : null,
    highPriority.some((item) => item.id === "fetal-absent") ? "Уточните, когда в последний раз ощущались шевеления плода, и сообщите это врачу без задержки." : null,
  ];

  return uniqueStrings(actions);
};

const collectTranscriptEvidence = (transcript: string, input: HomeMeasurementsInput) => {
  const lines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const text = `${input.complaint_text} ${transcript}`.toLowerCase();
  const patterns = [
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.bleeding) ? /(кров|мажет|выдел)/i : null,
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.movement) ? /(шевел|двига)/i : null,
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.fainting) ? /(головокруж|обморок|слабост)/i : null,
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.pain) ? /(боль|схват|тянет|каменеет)/i : null,
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.pressure) ? /(давление|головн|мушки)/i : null,
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.oxygen) ? /(одыш|воздуха|сатурац)/i : null,
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.fever) ? /(температ|жар|озноб)/i : null,
  ].filter((value): value is RegExp => Boolean(value));

  return uniqueStrings(
    lines.filter((line) => patterns.some((pattern) => pattern.test(line))).slice(0, 6),
  );
};

const buildDoctorReview = (): DoctorReview => ({
  status: "pending",
  reviewer_name: null,
  final_conclusion: null,
  override_reason: null,
  reviewed_at: null,
});

const baseUrgencyFromAnomalies = (anomalies: VitalAnomaly[]): UrgencyLevel => {
  if (anomalies.some((item) => item.severity === "critical")) return 3;
  if (anomalies.some((item) => item.severity === "high")) return 2;
  if (anomalies.some((item) => item.severity === "moderate")) return 1;
  return 0;
};

const analyzeInput = (input: HomeMeasurementsInput, transcript: string) => {
  const text = `${input.complaint_text} ${transcript}`.toLowerCase();
  const anomalies: VitalAnomaly[] = [];

  if (
    input.systolic_bp !== null &&
    input.diastolic_bp !== null &&
    input.systolic_bp <= input.diastolic_bp
  ) {
    anomalies.push(
      buildAnomaly({
        id: "bp-inverted",
        label: "Показатели АД требуют перепроверки",
        severity: "high",
        status: "suspicious",
        value: `${input.systolic_bp}/${input.diastolic_bp} мм рт. ст.`,
        reason: "Систолическое давление оказалось не выше диастолического; вероятна ошибка ввода или измерения.",
        source: "derived",
      }),
    );
  } else if (input.systolic_bp !== null && input.diastolic_bp !== null) {
    if (input.systolic_bp >= 160 || input.diastolic_bp >= 110) {
      anomalies.push(
        buildAnomaly({
          id: "bp-severe-high",
          label: "Критически высокое артериальное давление",
          severity: "critical",
          status: "abnormal",
          value: `${input.systolic_bp}/${input.diastolic_bp} мм рт. ст.`,
          reason: "Домашнее давление попадает в диапазон тяжелой гипертензии у беременной пациентки.",
          source: "home_measurement",
          evidence: hasAnyKeyword(text, COMPLAINT_KEYWORDS.pressure) ? ["Жалобы/речь содержат указание на давление или головную боль."] : [],
        }),
      );
    } else if (input.systolic_bp >= 140 || input.diastolic_bp >= 90) {
      anomalies.push(
        buildAnomaly({
          id: "bp-high",
          label: "Повышенное артериальное давление",
          severity: "high",
          status: "abnormal",
          value: `${input.systolic_bp}/${input.diastolic_bp} мм рт. ст.`,
          reason: "Показатели АД выше безопасного порога для домашнего акушерского скрининга.",
          source: "home_measurement",
        }),
      );
    } else if (input.systolic_bp < 90 || input.diastolic_bp < 60) {
      anomalies.push(
        buildAnomaly({
          id: "bp-low",
          label: "Низкое артериальное давление",
          severity: hasAnyKeyword(text, COMPLAINT_KEYWORDS.fainting) || input.bleeding.present ? "high" : "moderate",
          status: "abnormal",
          value: `${input.systolic_bp}/${input.diastolic_bp} мм рт. ст.`,
          reason: "Показатели АД ниже типового безопасного порога; важна сверка с симптомами слабости/кровопотери.",
          source: "home_measurement",
        }),
      );
    }
  }

  if (input.pulse !== null) {
    if (input.pulse >= 120) {
      anomalies.push(
        buildAnomaly({
          id: "pulse-high",
          label: "Выраженная тахикардия",
          severity: input.pulse >= 130 ? "high" : "moderate",
          status: "abnormal",
          value: `${input.pulse} уд/мин`,
          reason: "Пульс выше ожидаемого диапазона и требует клинической интерпретации вместе с жалобами.",
          source: "home_measurement",
        }),
      );
    } else if (input.pulse <= 50) {
      anomalies.push(
        buildAnomaly({
          id: "pulse-low",
          label: "Сниженный пульс",
          severity: "moderate",
          status: "abnormal",
          value: `${input.pulse} уд/мин`,
          reason: "Частота пульса ниже безопасного диапазона для телефонного triage без очной сверки.",
          source: "home_measurement",
        }),
      );
    }
  }

  if (input.temperature !== null) {
    if (input.temperature >= 38.5) {
      anomalies.push(
        buildAnomaly({
          id: "temperature-high",
          label: "Высокая температура",
          severity: "high",
          status: "abnormal",
          value: `${input.temperature.toFixed(1)} C`,
          reason: "Температура выше 38.5 C требует ускоренной оценки у беременной пациентки.",
          source: "home_measurement",
        }),
      );
    } else if (input.temperature >= 37.5) {
      anomalies.push(
        buildAnomaly({
          id: "temperature-moderate",
          label: "Повышенная температура",
          severity: "moderate",
          status: "abnormal",
          value: `${input.temperature.toFixed(1)} C`,
          reason: "Есть субфебрильная температура, нужна клиническая интерпретация в контексте жалоб.",
          source: "home_measurement",
        }),
      );
    }
  }

  if (input.spo2 !== null) {
    if (input.spo2 <= 92) {
      anomalies.push(
        buildAnomaly({
          id: "oxygen-low",
          label: "Критически сниженная сатурация",
          severity: "critical",
          status: "abnormal",
          value: `${input.spo2}%`,
          reason: "SpO2 <= 92% является серьезным объективным сигналом при телефонной консультации.",
          source: "home_measurement",
        }),
      );
    } else if (input.spo2 <= 94) {
      anomalies.push(
        buildAnomaly({
          id: "oxygen-borderline",
          label: "Сниженная сатурация",
          severity: "high",
          status: "abnormal",
          value: `${input.spo2}%`,
          reason: "SpO2 ниже 95% требует срочной сверки с жалобами и повторной оценки.",
          source: "home_measurement",
        }),
      );
    }
  }

  if (input.bleeding.present || input.bleeding.severity === "spotting" || input.bleeding.severity === "moderate" || input.bleeding.severity === "heavy") {
    anomalies.push(
      buildAnomaly({
        id: input.bleeding.severity === "heavy" ? "bleeding-heavy" : "bleeding-present",
        label: input.bleeding.severity === "heavy" ? "Обильное кровотечение" : "Кровянистые выделения/кровотечение",
        severity:
          input.bleeding.severity === "heavy"
            ? "critical"
            : input.bleeding.severity === "moderate"
              ? "high"
              : "moderate",
        status: "abnormal",
        value: BLEEDING_LABELS[input.bleeding.severity],
        reason: "Даже домашнее указание на кровотечение требует очной акушерской оценки.",
        source: input.bleeding.note ? "symptom" : "home_measurement",
        evidence: input.bleeding.note ? [input.bleeding.note] : [],
      }),
    );
  }

  if (input.pain.present || input.pain.severity === "mild" || input.pain.severity === "moderate" || input.pain.severity === "severe") {
    anomalies.push(
      buildAnomaly({
        id: input.pain.severity === "severe" ? "pain-severe" : "pain-present",
        label: input.pain.severity === "severe" ? "Выраженная боль" : "Есть боль/схваткообразные ощущения",
        severity: input.pain.severity === "severe" ? "high" : input.pain.severity === "moderate" ? "moderate" : "info",
        status: "abnormal",
        value: `${PAIN_LABELS[input.pain.severity]}${input.pain.location ? ` (${input.pain.location})` : ""}`,
        reason: "Интенсивность боли повышает приоритет очной акушерской оценки и требует сверки с остальными данными.",
        source: input.pain.location ? "symptom" : "home_measurement",
      }),
    );
  }

  if (input.fetal_movement === "absent" || input.fetal_movement === "reduced") {
    anomalies.push(
      buildAnomaly({
        id: input.fetal_movement === "absent" ? "fetal-absent" : "fetal-reduced",
        label: input.fetal_movement === "absent" ? "Шевеления плода не ощущаются" : "Шевеления плода снижены",
        severity: input.fetal_movement === "absent" ? "critical" : "high",
        status: "abnormal",
        value: FETAL_MOVEMENT_LABELS[input.fetal_movement],
        reason: "Изменение шевелений плода является значимым акушерским красным флагом.",
        source: "symptom",
      }),
    );
  }

  return { anomalies };
};

const deriveConsistencyStatus = (params: {
  input: HomeMeasurementsInput;
  transcript: string;
  anomalies: VitalAnomaly[];
}) => {
  const availableMeasurements = countAvailableCoreFields(params.input);
  const text = `${params.input.complaint_text} ${params.transcript}`.toLowerCase();
  const severeComplaintSignals =
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.bleeding) ||
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.movement) ||
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.fainting) ||
    hasAnyKeyword(text, COMPLAINT_KEYWORDS.pressure);
  const hasSuspiciousMeasurement = params.anomalies.some((item) => item.status === "suspicious");
  const anomalyIds = new Set(params.anomalies.map((item) => item.id));
  const matched =
    (hasAnyKeyword(text, COMPLAINT_KEYWORDS.bleeding) && (anomalyIds.has("bleeding-present") || anomalyIds.has("bleeding-heavy"))) ||
    (hasAnyKeyword(text, COMPLAINT_KEYWORDS.movement) && (anomalyIds.has("fetal-reduced") || anomalyIds.has("fetal-absent"))) ||
    (hasAnyKeyword(text, COMPLAINT_KEYWORDS.pressure) && (anomalyIds.has("bp-high") || anomalyIds.has("bp-severe-high"))) ||
    (hasAnyKeyword(text, COMPLAINT_KEYWORDS.oxygen) && (anomalyIds.has("oxygen-low") || anomalyIds.has("oxygen-borderline"))) ||
    (hasAnyKeyword(text, COMPLAINT_KEYWORDS.fever) && (anomalyIds.has("temperature-high") || anomalyIds.has("temperature-moderate"))) ||
    (hasAnyKeyword(text, COMPLAINT_KEYWORDS.pain) && (anomalyIds.has("pain-present") || anomalyIds.has("pain-severe")));

  if (hasSuspiciousMeasurement) return "mismatch" satisfies ConsistencyStatus;
  if (!params.anomalies.length && availableMeasurements < 2) return "not_enough_data" satisfies ConsistencyStatus;
  if (matched) return "match" satisfies ConsistencyStatus;
  if (severeComplaintSignals && !params.anomalies.length && availableMeasurements >= 2) {
    return "mismatch" satisfies ConsistencyStatus;
  }
  if (params.anomalies.length && availableMeasurements < 2) return "not_enough_data" satisfies ConsistencyStatus;
  if (!params.anomalies.length && availableMeasurements >= 3) return "match" satisfies ConsistencyStatus;
  if (params.anomalies.length && availableMeasurements >= 3 && params.input.complaint_text.trim()) {
    return "mismatch" satisfies ConsistencyStatus;
  }
  return "not_enough_data" satisfies ConsistencyStatus;
};

const deriveRiskLevel = (params: {
  anomalies: VitalAnomaly[];
  consistencyStatus: ConsistencyStatus;
  currentUrgency: UrgencyLevel;
}) => {
  if (params.anomalies.some((item) => item.severity === "critical") || params.currentUrgency === 3) {
    return "critical" satisfies RiskLevel;
  }
  if (
    params.anomalies.some((item) => item.severity === "high") ||
    params.currentUrgency >= 2 ||
    params.consistencyStatus === "mismatch"
  ) {
    return "high" satisfies RiskLevel;
  }
  if (params.anomalies.some((item) => item.severity === "moderate") || params.currentUrgency === 1) {
    return "moderate" satisfies RiskLevel;
  }
  return "low" satisfies RiskLevel;
};

const deriveRecommendedRoute = (params: {
  riskLevel: RiskLevel;
  consistencyStatus: ConsistencyStatus;
  anomalies: VitalAnomaly[];
}) => {
  if (
    params.riskLevel === "critical" ||
    params.anomalies.some((item) => item.id === "bleeding-heavy" || item.id === "fetal-absent" || item.id === "oxygen-low")
  ) {
    return "dispatch_now" satisfies RecommendedRoute;
  }
  if (params.riskLevel === "high") return "urgent_ob_review" satisfies RecommendedRoute;
  if (params.consistencyStatus === "not_enough_data") return "clarify_and_monitor" satisfies RecommendedRoute;
  if (params.riskLevel === "moderate") return "same_day_ob_review" satisfies RecommendedRoute;
  return "clarify_and_monitor" satisfies RecommendedRoute;
};

const buildDoctorDraft = (params: {
  input: HomeMeasurementsInput;
  anomalies: VitalAnomaly[];
  riskLevel: RiskLevel;
  consistencyStatus: ConsistencyStatus;
  recommendedRoute: RecommendedRoute;
  transcriptEvidence: string[];
  guidelineQuotes: string[];
}): DoctorDraft => {
  const vitalsSummary = buildVitalsSummary(params.input);
  const anomalySummary = params.anomalies.length
    ? params.anomalies.map((item) => `${item.label}: ${item.value}`).slice(0, 4).join("; ")
    : "Явных объективных отклонений по введенным домашним показателям не выявлено.";
  const uncertainty = params.input.missing_fields.length
    ? `Ограничения: отсутствуют/не уточнены поля ${params.input.missing_fields.join(", ")}; данные носят характер самосообщения/домашних измерений.`
    : "Ограничения: данные являются самосообщением/домашними измерениями и требуют врачебной верификации.";

  return {
    status: "draft",
    title: "Черновик объективного заключения",
    objective_summary: vitalsSummary.length ? vitalsSummary.join("; ") : "Объективные домашние показатели не предоставлены.",
    conclusion: `${RISK_LABELS[params.riskLevel]} риск. ${CONSISTENCY_LABELS[params.consistencyStatus]}. ${anomalySummary}`,
    recommended_route: params.recommendedRoute,
    rationale: params.anomalies.length
      ? `Решение опирается на домашние показатели и симптомы: ${params.anomalies.map((item) => item.label).slice(0, 4).join(", ")}.`
      : "Решение опирается на текст жалоб и отсутствие достаточных объективных показателей для подтверждения/опровержения риска.",
    uncertainty,
    evidence: uniqueStrings([
      ...params.transcriptEvidence,
      ...vitalsSummary,
      ...params.guidelineQuotes,
    ]).slice(0, 8),
  };
};

const mergeStringLists = (first: string[], second: string[], max = 12) => uniqueStrings([...first, ...second]).slice(0, max);

export const routeLabel = (route: RecommendedRoute) => ROUTE_LABELS[route];

export const hydrateDecisionSupportPayload = (payload: TriagePayload): TriagePayload => {
  const patientInput = normalizeHomeMeasurementsInput(payload.patient_input);
  const transcript = payload.transcript || patientInput.complaint_text;
  const transcriptEvidence = uniqueStrings([
    ...(payload.triage.evidence_quotes ?? []),
    ...collectTranscriptEvidence(transcript, patientInput),
  ]).slice(0, 8);
  const guidelineQuotes = uniqueStrings(
    payload.rag.guidelines.map((item) => `${item.source}: ${item.quote}`),
  ).slice(0, 6);
  const { anomalies } = analyzeInput(patientInput, transcript);
  const consistencyStatus = deriveConsistencyStatus({
    input: patientInput,
    transcript,
    anomalies,
  });
  const urgencyFloor = baseUrgencyFromAnomalies(anomalies);
  const triageUrgency = payload.triage.urgency > urgencyFloor ? payload.triage.urgency : urgencyFloor;
  const riskLevel = deriveRiskLevel({
    anomalies,
    consistencyStatus,
    currentUrgency: triageUrgency,
  });
  const recommendedRoute = deriveRecommendedRoute({
    riskLevel,
    consistencyStatus,
    anomalies,
  });
  const clarificationQuestions = buildClarificationQuestions(patientInput, anomalies);
  const operatorActions = buildOperatorActions(recommendedRoute, anomalies);
  const objectiveFlags = anomalies
    .filter((item) => item.severity === "high" || item.severity === "critical")
    .map((item) => item.label);
  const vitalsSummary = buildVitalsSummary(patientInput);
  const doctorDraft = buildDoctorDraft({
    input: patientInput,
    anomalies,
    riskLevel,
    consistencyStatus,
    recommendedRoute,
    transcriptEvidence,
    guidelineQuotes,
  });
  const doctorReview = payload.doctor_review?.status ? payload.doctor_review : buildDoctorReview();
  const triagePrimaryReason = anomalies.length
    ? payload.triage.primary_reason.includes("Объективные сигналы:")
      ? payload.triage.primary_reason
      : `${payload.triage.primary_reason}. Объективные сигналы: ${anomalies.map((item) => item.label).slice(0, 3).join(", ")}.`
    : payload.triage.primary_reason;
  const missingEvidence = mergeStringLists(
    payload.qc.missing_evidence,
    consistencyStatus === "mismatch"
      ? ["Есть расхождение между жалобами и домашними показателями; нужен врачебный разбор."]
      : [],
    8,
  );
  const policyIssues = payload.qc.policy_issues ?? [];
  const dispatchNow = payload.triage.dispatch_now || recommendedRoute === "dispatch_now";

  return {
    ...payload,
    transcript,
    patient_input: patientInput,
    extracted: {
      ...payload.extracted,
      pregnancy_weeks: payload.extracted.pregnancy_weeks ?? patientInput.gestation_weeks,
      complaints: mergeStringLists(payload.extracted.complaints ?? [], patientInput.complaint_text ? [patientInput.complaint_text] : [], 6),
      fetal_movement: patientInput.fetal_movement,
      structured_input: patientInput,
      objective_flags: objectiveFlags,
      vitals_snapshot: vitalsSummary,
    },
    triage: {
      ...payload.triage,
      urgency: triageUrgency,
      dispatch_now: dispatchNow,
      confidence:
        consistencyStatus === "not_enough_data"
          ? Math.min(payload.triage.confidence, 0.64)
          : Math.max(payload.triage.confidence, anomalies.length ? 0.7 : payload.triage.confidence),
      primary_reason: triagePrimaryReason,
      red_flags: mergeStringLists(payload.triage.red_flags, objectiveFlags, 10),
      next_questions: mergeStringLists(payload.triage.next_questions, clarificationQuestions, 10),
      operator_script: mergeStringLists(payload.triage.operator_script, operatorActions, 12),
      limitations: uniqueStrings([
        payload.triage.limitations,
        "Домашние показатели требуют врачебной верификации и не заменяют очный осмотр.",
      ]).join(" "),
      evidence_quotes: transcriptEvidence,
      guideline_citations: mergeStringLists(payload.triage.guideline_citations, payload.rag.guidelines.map((item) => item.source), 8),
    },
    operator_card: {
      ...payload.operator_card,
      summary: uniqueStrings([
        payload.operator_card.summary,
        anomalies.length && !payload.operator_card.summary.includes("Объективные сигналы:")
          ? `Объективные сигналы: ${anomalies.map((item) => item.label).slice(0, 3).join(", ")}.`
          : null,
        !payload.operator_card.summary.includes("Риск:")
          ? `Риск: ${RISK_LABELS[riskLevel]}. ${CONSISTENCY_LABELS[consistencyStatus]}.`
          : null,
      ]).join(" "),
      key_facts: mergeStringLists(
        payload.operator_card.key_facts,
        [
          `Риск: ${RISK_LABELS[riskLevel]}`,
          `Согласованность: ${CONSISTENCY_LABELS[consistencyStatus]}`,
          `Маршрут: ${routeLabel(recommendedRoute)}`,
          ...vitalsSummary,
          ...objectiveFlags,
        ],
        12,
      ),
      dispatch_fields: {
        ...payload.operator_card.dispatch_fields,
        gestation_weeks: payload.operator_card.dispatch_fields.gestation_weeks ?? patientInput.gestation_weeks,
      },
      evidence_quotes: transcriptEvidence,
      guideline_citations: mergeStringLists(
        payload.operator_card.guideline_citations,
        payload.rag.guidelines.map((item) => item.source),
        8,
      ),
    },
    anomalies,
    consistency_status: consistencyStatus,
    risk_level: riskLevel,
    recommended_route: recommendedRoute,
    doctor_draft: doctorDraft,
    doctor_review: doctorReview,
    evidence: {
      transcript_quotes: transcriptEvidence,
      vitals_summary: vitalsSummary,
      guideline_quotes: guidelineQuotes,
      anomaly_ids: anomalies.map((item) => item.id),
    },
    qc: {
      ...payload.qc,
      is_safe: missingEvidence.length === 0 && policyIssues.length === 0,
      missing_evidence: missingEvidence,
      needs_clarification: mergeStringLists(payload.qc.needs_clarification, clarificationQuestions, 12),
      policy_issues: policyIssues,
    },
  };
};

