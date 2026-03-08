# Yandex Cloud deployment (Workflow + API Gateway + STT/Translate Function)

Files in this folder:
- `workflow-preg-triage.yaml` - workflow with low-context mode and robust JSON parsing.
- `apigateway-preg-triage.yaml` - API Gateway spec with triage routes and `/speech/stt-translate`.
- `rag-agent-prompt.txt` - AI Studio Agent prompt for strict JSON + low-context behavior.
- `stt-translate-function/index.js` - Cloud Function handler for STT + Translate.

## 1) Service accounts and roles

Use two service accounts (recommended):

1. `sa-apigw-preg-triage` (used by API Gateway integration)
- `serverless.workflows.executor` on workflow
- `serverless.functions.invoker` on STT/Translate function

2. `sa-fn-stt-translate` (attached to Cloud Function runtime)
- `ai.speechkit-stt.user`
- `ai.translate.user`

## 2) Deploy Cloud Function (`/speech/stt-translate` backend)

Deploy function from `stt-translate-function/` and set env:
- `YC_FOLDER_ID=<your-folder-id>`

If metadata IAM token is unavailable in your setup, also set:
- `YC_IAM_TOKEN=<temporary-iam-token>`

Handler:
- `index.handler`

Runtime:
- `nodejs18`

After deploy, copy function invoke URL (looks like `https://functions.yandexcloud.net/<function-id>`).

## 3) Update API Gateway spec

In `apigateway-preg-triage.yaml`, replace placeholders:
- workflow id in `/triage/run` URL if needed
- `serviceAccountId`
- `/speech/stt-translate` integration URL with your function URL

Then import/update API Gateway from YAML.

## 4) Update Workflow from YAML

Upload `workflow-preg-triage.yaml` to your existing workflow or create a new workflow.

Input payload supported by workflow:
```json
{
  "call_id": "CALL-001",
  "transcript": "...translated or original transcript...",
  "complaint_text": "...short structured complaint summary...",
  "patient_input": {
    "complaint_text": "...",
    "gestation_weeks": 34,
    "systolic_bp": 146,
    "diastolic_bp": 94,
    "pulse": 108,
    "temperature": 37.3,
    "spo2": 97,
    "bleeding": { "present": false, "severity": "none", "note": null },
    "pain": { "present": true, "severity": "moderate", "location": "lower abdomen" },
    "fetal_movement": "reduced",
    "measurement_time": "2026-03-07T12:30",
    "measurement_source": "home_device",
    "missing_fields": ["spo2"]
  },
  "transcript_original": "...original speech text...",
  "source_lang": "ru-RU",
  "target_lang": "ru",
  "trace": true
}
```

## 5) Keep current UI integration

Current app already calls local `/api/run-triage`, which proxies to API Gateway.
Set endpoint in UI Settings to:
- `https://<your-apigw-domain>/triage/run`

Low-context support is already enabled in app code: you can send either a transcript or a short complaint summary plus structured home vitals.

## 6) Optional UI STT wiring

To use Yandex STT in live mode, UI should send audio chunks to:
- `POST https://<your-apigw-domain>/speech/stt-translate`

Expected request body:
```json
{
  "audio_base64": "<base64>",
  "audio_format": "oggopus",
  "source_lang": "ru-RU",
  "target_lang": "ru",
  "translate": true,
  "call_id": "CALL-001",
  "role": "Caller"
}
```

Expected response:
```json
{
  "text_original": "...",
  "text_translated": "...",
  "translated": true,
  "source_lang": "ru-RU",
  "target_lang": "ru",
  "confidence": null
}
```

## 7) PDF criteria alignment (checked)

- Workflow:
  - has explicit low-context branch (safe fallback with clarification questions),
  - preserves explainable multi-step pipeline (`extract -> rag -> triage/card -> qc -> repair`),
  - enforces non-diagnostic/non-treatment behavior in model instructions.
- Agent prompt:
  - strict JSON-only output,
  - quote/source/file_id anti-hallucination rules,
  - explicit prompt-injection resistance rule for transcript/doc fragments.
- API Gateway:
  - keeps execution model with `executionId`, polling and history endpoints,
  - has explicit 400/502 responses for operational transparency,
  - CORS is configured with explicit methods/headers instead of full wildcard methods.
