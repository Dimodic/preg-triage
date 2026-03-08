import { createEmptyHomeMeasurementsInput, hydrateDecisionSupportPayload, normalizeHomeMeasurementsInput } from "@/lib/maternal-support";
import type { HomeMeasurementsInput, TriagePayload, UrgencyLevel } from "@/lib/types";

export type DemoPreset = {
  id: string;
  label: string;
  urgency: UrgencyLevel;
  description: string;
  transcript: string;
  patientInput: HomeMeasurementsInput;
};

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "demo-urg1",
    label: "Срочность 1 · тревога и тянущая боль",
    urgency: 1,
    description: "Без кровотечения, тянущая боль, неполные домашние показатели.",
    transcript: `[00:04] Диспетчер: Скорая помощь, слушаю вас.
[00:10] Звонящая: Я на 28 неделе, тянет низ живота, очень нервничаю.
[00:18] Диспетчер: Кровотечение, сильная боль или воды отходили?
[00:27] Звонящая: Нет, крови нет, воды не отходили, просто тянет и страшно.
[00:38] Диспетчер: Ребенок шевелится как обычно?
[00:45] Звонящая: Да, шевелится, но я одна дома.`,
    patientInput: normalizeHomeMeasurementsInput({
      complaint_text: "Тянущая боль внизу живота, тревога.",
      gestation_weeks: 28,
      pulse: 92,
      temperature: 36.8,
      bleeding: { severity: "none", present: false, note: null },
      pain: { severity: "mild", present: true, location: "низ живота" },
      fetal_movement: "normal",
      measurement_source: "caller_reported",
    }),
  },
  {
    id: "demo-urg2",
    label: "Срочность 2 · неясная картина",
    urgency: 2,
    description: "Подтекание, схваткообразная боль и повышенное давление.",
    transcript: `[00:03] Диспетчер: Скорая, назовите что случилось.
[00:09] Звонящая: 34 неделя, кажется подтекает вода и живот прихватывает.
[00:17] Диспетчер: Как часто схватки и есть ли кровь?
[00:25] Звонящая: Крови нет, но схватки каждые 8-10 минут, не уверена про воды.
[00:36] Диспетчер: Ребенок шевелится?
[00:41] Звонящая: Да, но будто слабее, чем обычно.`,
    patientInput: normalizeHomeMeasurementsInput({
      complaint_text: "Живот прихватывает, давление выше обычного, шевеления слабее.",
      gestation_weeks: 34,
      systolic_bp: 146,
      diastolic_bp: 94,
      pulse: 108,
      temperature: 37.3,
      bleeding: { severity: "none", present: false, note: null },
      pain: { severity: "moderate", present: true, location: "живот" },
      fetal_movement: "reduced",
      measurement_time: "2026-03-07T12:30",
      measurement_source: "home_device",
    }),
  },
  {
    id: "demo-urg3",
    label: "Срочность 3 · красные флаги",
    urgency: 3,
    description: "Кровотечение, сильная боль, снижение шевелений и тревожные показатели.",
    transcript: `[00:02] Диспетчер: Скорая помощь, чем помочь?
[00:07] Звонящая: 36 недель, сильная боль, кровь и схватки каждые 3 минуты.
[00:15] Диспетчер: Сколько крови и есть ли движения ребенка?
[00:24] Звонящая: Крови много, прокладка промокла, ребенок почти не шевелится.
[00:36] Диспетчер: Кто-то рядом есть и точный адрес?
[00:43] Звонящая: Я одна, адрес улица Лесная 14, квартира 22.`,
    patientInput: normalizeHomeMeasurementsInput({
      complaint_text: "Кровь, сильные схватки, ребенок почти не шевелится.",
      gestation_weeks: 36,
      systolic_bp: 162,
      diastolic_bp: 108,
      pulse: 128,
      spo2: 93,
      bleeding: { severity: "heavy", present: true, note: "Прокладка быстро промокает." },
      pain: { severity: "severe", present: true, location: "живот" },
      fetal_movement: "reduced",
      measurement_time: "2026-03-07T12:42",
      measurement_source: "home_device",
    }),
  },
];

const urgencyPalette: Record<UrgencyLevel, { primaryReason: string; dispatch: boolean; confidence: number }> = {
  0: {
    primaryReason: "Стабильное состояние без признаков острого риска",
    dispatch: false,
    confidence: 0.72,
  },
  1: {
    primaryReason: "Есть жалобы, но критические объективные сигналы не подтверждены",
    dispatch: false,
    confidence: 0.76,
  },
  2: {
    primaryReason: "Есть признаки возможного ухудшения, требуется ускоренная очная оценка",
    dispatch: true,
    confidence: 0.79,
  },
  3: {
    primaryReason: "Комбинация акушерских красных флагов и тревожных домашних показателей",
    dispatch: true,
    confidence: 0.9,
  },
};

const detectUrgency = (transcript: string, input: HomeMeasurementsInput): UrgencyLevel => {
  const lowered = `${transcript} ${input.complaint_text}`.toLowerCase();
  const hasBleeding = /(кров|bleed)/i.test(lowered) || input.bleeding.severity === "moderate" || input.bleeding.severity === "heavy";
  const hasContractions = /(схват|contraction|каждые\s*[123456789]\s*мин)/i.test(lowered) || input.pain.severity === "severe";
  const lowMovement = /(не шевел|мало шевел|почти не шев)/i.test(lowered) || input.fetal_movement === "reduced" || input.fetal_movement === "absent";
  const severeBp = (input.systolic_bp ?? 0) >= 160 || (input.diastolic_bp ?? 0) >= 110;
  const highBp = (input.systolic_bp ?? 0) >= 140 || (input.diastolic_bp ?? 0) >= 90;
  const lowSpo2 = (input.spo2 ?? 100) <= 94;

  if (hasBleeding && (hasContractions || lowMovement || severeBp || lowSpo2)) return 3;
  if (severeBp || lowSpo2 || lowMovement || hasContractions || highBp) return 2;
  if (/тянет|anx|тревог|паник|боль/.test(lowered)) return 1;
  return 0;
};

const getEvidenceQuotes = (transcript: string, urgency: UrgencyLevel): string[] => {
  const lines = transcript.split("\n").filter(Boolean);
  if (urgency === 3) {
    return lines.filter((line) => /(кров|схват|почти не шев|не шев)/i.test(line)).slice(0, 4);
  }
  if (urgency === 2) {
    return lines.filter((line) => /(подтека|схват|слабее|давлен)/i.test(line)).slice(0, 4);
  }
  if (urgency === 1) {
    return lines.filter((line) => /(тянет|нервничаю|страшно)/i.test(line)).slice(0, 3);
  }
  return lines.slice(0, 2);
};

const buildQuestions = (urgency: UrgencyLevel): string[] => {
  const shared = [
    "Уточните точный адрес и контактный номер.",
    "Спросите срок беременности и кратность родов.",
  ];

  if (urgency === 3) {
    return [
      ...shared,
      "Оцените объем кровотечения за последние 30 минут.",
      "Уточните интервал между схватками и интенсивность боли.",
      "Попросите не оставаться одной и подготовить документы.",
    ];
  }

  if (urgency === 2) {
    return [
      ...shared,
      "Подтвердите, есть ли регулярность схваток и их длительность.",
      "Спросите цвет/запах/объем возможного подтекания вод.",
      "Уточните субъективное снижение шевелений плода.",
    ];
  }

  if (urgency === 1) {
    return [
      ...shared,
      "Уточните длительность боли и факторы облегчения.",
      "Проверьте наличие температуры, рвоты или головной боли.",
      "Попросите оставаться на линии при ухудшении симптомов.",
    ];
  }

  return [...shared, "Проверьте наличие дополнительных жалоб."];
};

const buildScript = (urgency: UrgencyLevel): string[] => {
  if (urgency === 3) {
    return [
      "Бригада уже направлена, оставайтесь на линии.",
      "Лягте на левый бок, подготовьте документы и доступ в квартиру.",
      "Если кровотечение усилится или потеряете сознание, сообщите немедленно.",
    ];
  }

  if (urgency === 2) {
    return [
      "Мы организуем срочную оценку, оставайтесь на связи.",
      "Фиксируйте интервалы схваток и характер выделений.",
      "При усилении боли или кровотечении сообщите сразу.",
    ];
  }

  if (urgency === 1) {
    return [
      "Сейчас признаков немедленной угрозы не выявлено.",
      "Оставайтесь в покое, контролируйте шевеления и симптомы.",
      "Если появится кровь, воды или усиление боли, перезвоните немедленно.",
    ];
  }

  return ["Продолжайте наблюдение, при ухудшении симптомов вызывайте скорую немедленно."];
};

const buildGuidelines = (urgency: UrgencyLevel) => {
  const baseline = [
    {
      source: "Протокол акушерской диспетчеризации v2.4",
      quote: "Сначала оцените кровотечение, частоту схваток, шевеления плода и риск гемодинамической нестабильности.",
      why: "Базовый порядок первичной сортировки при акушерском звонке.",
      file_id: "OB-DISP-2.4",
    },
    {
      source: "Домашние показатели в телефонном triage",
      quote: "Самосообщаемые домашние измерения усиливают приоритет маршрутизации, но требуют врачебной верификации.",
      why: "Объективные показатели нужно учитывать отдельно от свободной речи.",
      file_id: "HOME-VITALS-01",
    },
  ];

  if (urgency >= 2) {
    baseline.push({
      source: "Экстренная карта телефонной сортировки при беременности",
      quote: "Возможный разрыв плодных оболочек или регулярные схватки до срока требуют срочной очной оценки.",
      why: "Подтекание/регулярные схватки повышают приоритет выезда.",
      file_id: "EPTC-17",
    });
  }

  if (urgency === 3) {
    baseline.push({
      source: "Памятка по критическим материнским флагам",
      quote: "Кровотечение со снижением шевелений плода и частыми схватками должно рассматриваться как максимальная срочность выезда.",
      why: "Совпадение нескольких красных флагов переводит кейс в максимальную срочность.",
      file_id: "MCF-RED",
    });
  }

  return baseline;
};

export const makeMockPayload = (params: {
  callId: string;
  transcript: string;
  patientInput?: Partial<HomeMeasurementsInput>;
  includeTrace?: boolean;
  forceUrgency?: UrgencyLevel;
}): TriagePayload => {
  const normalizedInput = normalizeHomeMeasurementsInput({
    ...createEmptyHomeMeasurementsInput(),
    ...(params.patientInput ?? {}),
    complaint_text: params.patientInput?.complaint_text ?? params.transcript,
  });
  const urgency = params.forceUrgency ?? detectUrgency(params.transcript, normalizedInput);
  const profile = urgencyPalette[urgency];
  const evidenceQuotes = getEvidenceQuotes(params.transcript, urgency);
  const guidelines = buildGuidelines(urgency);
  const nextQuestions = buildQuestions(urgency);
  const operatorScript = buildScript(urgency);

  const redFlags =
    urgency === 3
      ? ["Вагинальное кровотечение", "Частые схватки", "Снижение шевелений плода"]
      : urgency === 2
        ? ["Регулярные болезненные схватки", "Нужна очная акушерская оценка"]
        : urgency === 1
          ? ["Тянущая боль внизу живота"]
          : [];

  const payload: TriagePayload = {
    call_id: params.callId,
    transcript: params.transcript,
    patient_input: normalizedInput,
    extracted: {
      pregnancy_weeks: normalizedInput.gestation_weeks,
      complaints: normalizedInput.complaint_text ? [normalizedInput.complaint_text] : [],
      bleeding: {
        present: normalizedInput.bleeding.present ?? false,
        color: normalizedInput.bleeding.severity === "none" ? null : "не уточнено",
        pads_changed_count: null,
        time_window_text: null,
      },
      pain: {
        present: normalizedInput.pain.present ?? false,
        pattern: normalizedInput.pain.severity === "severe" ? "выраженная" : normalizedInput.pain.severity,
        location: normalizedInput.pain.location,
      },
      fetal_movement: normalizedInput.fetal_movement,
      dizziness_or_faint: /головокруж|обморок|слабост/i.test(params.transcript),
      address: /адрес\s+([^\n]+)/i.exec(params.transcript)?.[1]?.trim() ?? null,
      alone: /(одна|one|alone)/i.test(params.transcript) ? true : null,
      evidence_quotes: evidenceQuotes,
      structured_input: normalizedInput,
    },
    rag: {
      guidelines,
      notes:
        urgency >= 2
          ? "Повышение срочности по сочетанию жалоб и домашних показателей."
          : "Применены стандартные правила первичной сортировки и домашнего скрининга.",
    },
    triage: {
      urgency,
      dispatch_now: profile.dispatch,
      confidence: profile.confidence,
      primary_reason: profile.primaryReason,
      concern_terms: [
        ...redFlags,
        ...(normalizedInput.complaint_text ? [normalizedInput.complaint_text] : []),
      ].slice(0, 12),
      red_flags: redFlags,
      next_questions: nextQuestions,
      operator_script: operatorScript,
      limitations: "Демо-оценка; не является медицинским диагнозом.",
      evidence_quotes: evidenceQuotes,
      guideline_citations: guidelines.map((g) => g.source),
    },
    operator_card: {
      title:
        urgency === 3
          ? "Высокоприоритетный акушерский выезд"
          : urgency === 2
            ? "Срочное уточнение и вероятный выезд"
            : "Наблюдение с контролем домашних показателей",
      summary:
        urgency === 3
          ? "Критический набор симптомов и тревожные объективные сигналы."
          : urgency === 2
            ? "Симптомы требуют ускоренной очной акушерской оценки."
            : "Признаков немедленной угрозы не выявлено, но нужен контроль симптомов и недостающих показателей.",
      key_facts: [
        `Срочность: уровень ${urgency}`,
        `Немедленный выезд: ${profile.dispatch ? "да" : "нет"}`,
        `Уверенность: ${Math.round(profile.confidence * 100)}%`,
      ],
      dispatch_fields: {
        address: /адрес\s+([^\n]+)/i.exec(params.transcript)?.[1]?.trim() ?? null,
        gestation_weeks: normalizedInput.gestation_weeks,
        alone: /(одна|one|alone)/i.test(params.transcript) ? true : null,
      },
      evidence_quotes: evidenceQuotes,
      guideline_citations: guidelines.map((g) => g.source),
    },
    anomalies: [],
    consistency_status: "not_enough_data",
    risk_level: "moderate",
    recommended_route: urgency >= 2 ? "urgent_ob_review" : "clarify_and_monitor",
    doctor_draft: {
      status: "draft",
      title: "Черновик объективного заключения",
      objective_summary: "Ожидает rule-based анализа домашних показателей.",
      conclusion: "Ожидает объективного сопоставления.",
      recommended_route: urgency >= 2 ? "urgent_ob_review" : "clarify_and_monitor",
      rationale: "Черновик демо-режима до обогащения данных.",
      uncertainty: "Требуется уточнение витальных показателей и врачебная верификация.",
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
      transcript_quotes: evidenceQuotes,
      vitals_summary: [],
      guideline_quotes: guidelines.map((item) => `${item.source}: ${item.quote}`),
      anomaly_ids: [],
    },
    qc: {
      is_safe: urgency < 3,
      missing_evidence: normalizedInput.missing_fields.length ? ["Не все домашние показатели предоставлены."] : [],
      needs_clarification:
        urgency >= 2
          ? ["Подтвердите динамику симптомов", "Сверьте домашние показатели и время измерения"]
          : ["Уточните срок беременности и оставшиеся витальные показатели"],
      policy_issues: [],
    },
    execution: {
      execution_id: `demo-${params.callId.toLowerCase()}`,
      status: "FINISHED",
    },
    trace: params.includeTrace
      ? [
          {
            id: "extract",
            title: "Извлечение фактов звонка",
            type: "llm_extract",
            status: "FINISHED",
            duration: "420ms",
            outputJson: {
              symptoms: redFlags,
              evidence_quotes: evidenceQuotes,
              patient_input: normalizedInput,
            },
          },
          {
            id: "rag",
            title: "Поиск релевантных рекомендаций",
            type: "rag",
            status: "FINISHED",
            duration: "180ms",
            outputJson: {
              guidelines,
            },
          },
          {
            id: "triage",
            title: "Расчет срочности и объективного риска",
            type: "decision",
            status: "FINISHED",
            duration: "230ms",
            outputJson: {
              urgency,
              confidence: profile.confidence,
            },
          },
          {
            id: "qc",
            title: "Контроль безопасности",
            type: "safety",
            status: urgency < 3 ? "SAFE" : "UNSAFE",
            duration: "90ms",
            outputJson: {
              qc: {
                is_safe: urgency < 3,
                needs_clarification: normalizedInput.missing_fields,
              },
            },
          },
        ]
      : [],
  };

  return hydrateDecisionSupportPayload(payload);
};

export const getDemoPresetByUrgency = (urgency: UrgencyLevel) =>
  DEMO_PRESETS.find((item) => item.urgency === urgency);

export const DEFAULT_DEMO_TRANSCRIPT = "";

