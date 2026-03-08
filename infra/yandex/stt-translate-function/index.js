"use strict";

const METADATA_TOKEN_URL =
  "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token";
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.FETCH_TIMEOUT_MS || "", 10);
const DEFAULT_FETCH_TIMEOUT_MS =
  Number.isFinite(FETCH_TIMEOUT_MS) && FETCH_TIMEOUT_MS >= 1000
    ? Math.min(FETCH_TIMEOUT_MS, 120000)
    : 20000;
const MAX_AUDIO_BYTES = Number.parseInt(process.env.MAX_AUDIO_BYTES || "", 10) || 10 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const ok = (payload, statusCode = 200) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(payload),
});

const fail = (statusCode, message, extra = {}) =>
  ok(
    {
      error: message,
      ...extra,
    },
    statusCode,
  );

const asObject = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
};

const parseEventBody = (event) => {
  const rawBody = event?.body;
  if (!rawBody) return {};

  let text = rawBody;

  if (event?.isBase64Encoded) {
    text = Buffer.from(String(rawBody), "base64").toString("utf8");
  }

  if (typeof text === "string") {
    try {
      return asObject(JSON.parse(text));
    } catch {
      return {};
    }
  }

  return asObject(text);
};

const normalizeBase64 = (audioBase64) =>
  String(audioBase64)
    .trim()
    .replace(/^data:audio\/[^;]+;base64,/, "")
    .replace(/\s+/g, "");

const toShortLang = (lang) => {
  const value = String(lang || "").trim();
  if (!value) return "";
  return value.split("-")[0].toLowerCase();
};

const fetchWithTimeout = async (url, init = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const getIamToken = async () => {
  const staticToken = process.env.YC_IAM_TOKEN?.trim();
  if (staticToken) return staticToken;

  const response = await fetchWithTimeout(METADATA_TOKEN_URL, {
    method: "GET",
    headers: {
      "Metadata-Flavor": "Google",
    },
  });

  if (!response.ok) {
    throw new Error(`Metadata token error: ${response.status}`);
  }

  const tokenPayload = asObject(await response.json());
  const token = String(tokenPayload.access_token || "").trim();

  if (!token) {
    throw new Error("IAM token is empty");
  }

  return token;
};

const runStt = async ({ iamToken, folderId, audioBuffer, sourceLang, audioFormat, sampleRateHertz }) => {
  const sttUrl = new URL("https://stt.api.cloud.yandex.net/speech/v1/stt:recognize");
  sttUrl.searchParams.set("folderId", folderId);
  sttUrl.searchParams.set("lang", sourceLang || "ru-RU");
  sttUrl.searchParams.set("format", audioFormat || "oggopus");

  if (audioFormat === "lpcm" && sampleRateHertz) {
    sttUrl.searchParams.set("sampleRateHertz", String(sampleRateHertz));
  }

  const response = await fetchWithTimeout(sttUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${iamToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: audioBuffer,
  });

  const text = await response.text();
  let parsed = {};
  try {
    parsed = asObject(JSON.parse(text));
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`STT error ${response.status}: ${JSON.stringify(parsed)}`);
  }

  const resultText = String(parsed.result || "").trim();
  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? parsed.confidence
      : null;

  return {
    textOriginal: resultText,
    confidence,
    raw: parsed,
  };
};

const runTranslate = async ({ iamToken, folderId, textOriginal, sourceLang, targetLang }) => {
  const source = toShortLang(sourceLang);
  const target = toShortLang(targetLang);

  if (!textOriginal || !target || target === source) {
    return {
      translated: false,
      textTranslated: textOriginal,
      raw: null,
    };
  }

  const response = await fetchWithTimeout("https://translate.api.cloud.yandex.net/translate/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${iamToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      folderId,
      texts: [textOriginal],
      sourceLanguageCode: source,
      targetLanguageCode: target,
      format: "PLAIN_TEXT",
    }),
  });

  const text = await response.text();
  let parsed = {};
  try {
    parsed = asObject(JSON.parse(text));
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Translate error ${response.status}: ${JSON.stringify(parsed)}`);
  }

  const translatedText = String(parsed.translations?.[0]?.text || textOriginal).trim();

  return {
    translated: translatedText !== textOriginal,
    textTranslated: translatedText,
    raw: parsed,
  };
};

module.exports.handler = async (event) => {
  const method = String(event?.httpMethod || event?.requestContext?.http?.method || "POST").toUpperCase();

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  if (method !== "POST") {
    return fail(405, "Method not allowed");
  }

  try {
    const body = parseEventBody(event);

    const audioBase64 = body.audio_base64;
    if (!audioBase64) {
      return fail(400, "audio_base64 is required");
    }

    const folderId = String(body.folder_id || process.env.YC_FOLDER_ID || "").trim();
    if (!folderId) {
      return fail(500, "YC_FOLDER_ID is not configured");
    }

    const audioFormat = String(body.audio_format || "oggopus").trim().toLowerCase();
    if (!["oggopus", "lpcm"].includes(audioFormat)) {
      return fail(400, "audio_format must be oggopus or lpcm");
    }

    const sampleRateHertz = Number(body.sample_rate_hertz || 0) || null;
    if (audioFormat === "lpcm" && !sampleRateHertz) {
      return fail(400, "sample_rate_hertz is required for lpcm format");
    }

    const sourceLang = String(body.source_lang || "ru-RU").trim() || "ru-RU";
    const targetLang = String(body.target_lang || "ru").trim() || "ru";
    const translate = body.translate !== false;

    const normalized = normalizeBase64(audioBase64);
    const audioBuffer = Buffer.from(normalized, "base64");

    if (!audioBuffer.length) {
      return fail(400, "audio_base64 is empty or invalid");
    }

    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return fail(413, "audio payload is too large", {
        max_audio_bytes: MAX_AUDIO_BYTES,
      });
    }

    const iamToken = await getIamToken();

    const stt = await runStt({
      iamToken,
      folderId,
      audioBuffer,
      sourceLang,
      audioFormat,
      sampleRateHertz,
    });

    const translated = await runTranslate({
      iamToken,
      folderId,
      textOriginal: stt.textOriginal,
      sourceLang,
      targetLang,
    });

    return ok({
      call_id: body.call_id ?? null,
      role: body.role ?? "Unknown",
      source_lang: sourceLang,
      target_lang: targetLang,
      text_original: stt.textOriginal,
      text_translated: translate ? translated.textTranslated : stt.textOriginal,
      translated: translate ? translated.translated : false,
      confidence: stt.confidence,
    });
  } catch (error) {
    return fail(502, "STT/Translate pipeline failed", {
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
