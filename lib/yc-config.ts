export const YC_FOLDER_ID = "b1gm4qf0ph1v87honq3g";
export const YC_WORKFLOW_ID = "dfqs0456vlif6d6keo53";
export const YC_AGENT_ID = "fvtn7djkbr8jsb4vpqv6";
export const YC_SEARCH_INDEX_NAME = "triage-kb-v1";
export const YC_SERVICE_ACCOUNT_ID = "ajese8sgpgle2m1nd1kg";

export const APIGW_BASE = "https://d5dpcemibk5vlv88dg87.qsvaa8tq.apigw.yandexcloud.net";
export const RUN_ENDPOINT = `${APIGW_BASE}/triage/run`;

export const getStatusEndpoint = (executionId: string) =>
  `${APIGW_BASE}/triage/execution/${executionId}`;
export const getHistoryEndpoint = (executionId: string) =>
  `${APIGW_BASE}/triage/execution/${executionId}/history`;

export const YC_WORKFLOWS_DOCS = {
  auth: "https://yandex.cloud/en/docs/serverless-integrations/api-ref/workflows/authentication",
  start: "https://yandex.cloud/ru/docs/serverless-integrations/workflows/api-ref/Execution/start",
  get: "https://yandex.cloud/ru/docs/serverless-integrations/workflows/api-ref/Execution/get",
  history: "https://yandex.cloud/ru/docs/serverless-integrations/workflows/api-ref/Execution/getHistory",
};
