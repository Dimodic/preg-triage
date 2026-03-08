export const STORAGE_KEYS = {
  CASES: "pregtriage.cases.v1",
  SETTINGS: "pregtriage.settings.v1",
  RUN_AUDITS: "pregtriage.runAudit.v1",
  PENDING_DEMO_PRESET: "pregtriage.pendingDemoPreset.v1",
};

export const MAX_STORED_CASES = 50;
export const MAX_STORED_RUN_AUDITS = 500;

export const PIPELINE_STEPS = ["Данные", "Сигналы", "Справка", "Оценка", "Безопасность"] as const;

export const APP_NAME = "Диспетчер вызовов";
